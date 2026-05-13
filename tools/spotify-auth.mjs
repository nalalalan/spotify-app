import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const envPath = path.join(appDir, ".env.local");
const defaultRedirectUri = "http://127.0.0.1:5178/callback";
const scopes = ["playlist-read-private", "playlist-read-collaborative"];

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

async function loadEnv() {
  try {
    const parsed = parseEnv(await fs.readFile(envPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function upsertEnvValue(key, value) {
  let lines = [];
  try {
    lines = (await fs.readFile(envPath, "utf8")).split(/\r?\n/);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const rendered = `${key}=${value}`;
  let replaced = false;
  lines = lines.map((line) => {
    if (line.match(new RegExp(`^\\s*${key}\\s*=`))) {
      replaced = true;
      return rendered;
    }
    return line;
  });

  if (!replaced) {
    if (lines.length && lines.at(-1) !== "") lines.push("");
    lines.push(rendered);
  }

  await fs.writeFile(envPath, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n")}\n`, "utf8");
}

function openBrowser(url) {
  const escapedUrl = url.replace(/'/g, "''");
  const commands =
    process.platform === "win32"
      ? ["powershell.exe", ["-NoProfile", "-Command", `Start-Process '${escapedUrl}'`]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];

  const child = spawn(commands[0], commands[1], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function tokenRequestBody(params) {
  return new URLSearchParams(params).toString();
}

async function exchangeCodeForToken(code, redirectUri) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenRequestBody({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Spotify token exchange failed: ${response.status}`);
  }
  if (!payload.refresh_token) {
    throw new Error("Spotify did not return a refresh token.");
  }
  return payload;
}

async function main() {
  await loadEnv();

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || defaultRedirectUri;

  if (!clientId || !clientSecret) {
    console.error(`Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in ${envPath}.`);
    console.error(`Add ${redirectUri} as the Spotify app redirect URI, then rerun this script.`);
    process.exit(1);
  }

  const redirect = new URL(redirectUri);
  const state = crypto.randomBytes(18).toString("hex");
  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes.join(" "),
    redirect_uri: redirectUri,
    state,
  }).toString();

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, redirectUri);
      if (requestUrl.pathname !== redirect.pathname) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      if (requestUrl.searchParams.get("state") !== state) {
        response.writeHead(400);
        response.end("Spotify state mismatch.");
        return;
      }

      const code = requestUrl.searchParams.get("code");
      if (!code) {
        response.writeHead(400);
        response.end("Spotify did not return an authorization code.");
        return;
      }

      const token = await exchangeCodeForToken(code, redirectUri);
      await upsertEnvValue("SPOTIFY_REFRESH_TOKEN", token.refresh_token);

      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Spotify authorization saved. You can close this tab.");
      server.close();
      console.log(`Saved SPOTIFY_REFRESH_TOKEN to ${envPath}.`);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
      server.close();
      console.error(error.message);
      process.exitCode = 1;
    }
  });

  await new Promise((resolve) => server.listen(Number(redirect.port || 80), redirect.hostname, resolve));
  console.log(`Listening for Spotify authorization at ${redirectUri}`);
  console.log(authorizeUrl.toString());
  openBrowser(authorizeUrl.toString());
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
