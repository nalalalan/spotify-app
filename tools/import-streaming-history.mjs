import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const defaultHistoryDir = path.join(appDir, "data", "spotify-streaming-history");
const playlistDataPath = path.join(appDir, "public", "playlist-data.json");
const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sourceArg = args.find((arg) => !arg.startsWith("--"));
const historyPath = path.resolve(appDir, sourceArg || defaultHistoryDir);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function textKey(title, artist) {
  return `${normalizeText(title)}:::${normalizeText(artist)}`;
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function trackIdFromUri(uri) {
  const match = String(uri || "").match(/spotify:track:([A-Za-z0-9]+)/);
  return match?.[1] || null;
}

function createStats(matchBasis) {
  return {
    playCount: 0,
    streams30s: 0,
    totalMs: 0,
    firstPlayedAt: null,
    lastPlayedAt: null,
    matchBasis,
  };
}

function addStats(stats, event) {
  stats.playCount += 1;
  if (event.msPlayed >= 30000) stats.streams30s += 1;
  stats.totalMs += event.msPlayed;

  if (event.playedAt) {
    if (!stats.firstPlayedAt || event.playedAt < stats.firstPlayedAt) stats.firstPlayedAt = event.playedAt;
    if (!stats.lastPlayedAt || event.playedAt > stats.lastPlayedAt) stats.lastPlayedAt = event.playedAt;
  }
}

function normalizePlayedAt(event) {
  if (event.ts) return new Date(event.ts).toISOString();
  if (event.endTime) return new Date(`${String(event.endTime).replace(" ", "T")}Z`).toISOString();
  return null;
}

function normalizeEvent(raw) {
  const format = raw.ts ? "extended" : raw.endTime ? "account_data" : "unknown";
  const title = raw.master_metadata_track_name || raw.trackName || raw.track_name || null;
  const artist = raw.master_metadata_album_artist_name || raw.artistName || raw.artist_name || null;
  const uri = raw.spotify_track_uri || raw.spotifyTrackUri || raw.trackUri || null;
  const msPlayed = Number(raw.ms_played ?? raw.msPlayed ?? raw.ms_played_ms ?? 0);

  if (!title || !artist || !Number.isFinite(msPlayed) || msPlayed <= 0) return null;

  return {
    title,
    artist,
    spotifyUri: uri,
    spotifyTrackId: trackIdFromUri(uri),
    msPlayed,
    playedAt: normalizePlayedAt(raw),
    format,
  };
}

async function findJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function prepareSource(inputPath) {
  const stat = await fs.stat(inputPath);
  if (stat.isDirectory()) return { dir: inputPath, cleanupDir: null };

  if (!stat.isFile() || path.extname(inputPath).toLowerCase() !== ".zip") {
    throw new Error("Pass the Spotify export zip file or a folder containing exported JSON files.");
  }

  const cleanupDir = await fs.mkdtemp(path.join(os.tmpdir(), "spotify-streaming-history-"));
  await execFileAsync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Expand-Archive -LiteralPath ${psQuote(inputPath)} -DestinationPath ${psQuote(cleanupDir)} -Force`,
  ]);

  return { dir: cleanupDir, cleanupDir };
}

async function readStreamingEvents(dir) {
  const files = await findJsonFiles(dir);
  const events = [];

  for (const file of files) {
    const parsed = JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""));
    const rows = Array.isArray(parsed) ? parsed : parsed?.items || parsed?.data || [];
    for (const row of rows) {
      const event = normalizeEvent(row);
      if (event) events.push(event);
    }
  }

  return { files, events };
}

function buildStats(events) {
  const byTrackId = new Map();
  const byText = new Map();

  for (const event of events) {
    if (event.spotifyTrackId) {
      const current = byTrackId.get(event.spotifyTrackId) || createStats("spotify_track_uri");
      addStats(current, event);
      byTrackId.set(event.spotifyTrackId, current);
    }

    const fallbackKey = textKey(event.title, event.artist);
    const current = byText.get(fallbackKey) || createStats("title_artist");
    addStats(current, event);
    byText.set(fallbackKey, current);
  }

  return { byTrackId, byText };
}

function candidateKeys(track) {
  const artists = Array.isArray(track.artists) && track.artists.length ? track.artists : [track.artist];
  return [
    textKey(track.title, track.artist),
    ...artists.map((artist) => textKey(track.title, artist)),
  ];
}

function findTrackStats(track, stats) {
  const trackId = trackIdFromUri(track.spotifyUri);
  if (trackId && stats.byTrackId.has(trackId)) return stats.byTrackId.get(trackId);

  for (const key of candidateKeys(track)) {
    if (stats.byText.has(key)) return stats.byText.get(key);
  }

  return null;
}

function publicPlayStats(stats) {
  return {
    playCount: stats.playCount,
    streams30s: stats.streams30s,
    totalMs: stats.totalMs,
    totalHours: Number((stats.totalMs / 3600000).toFixed(2)),
    firstPlayedAt: stats.firstPlayedAt,
    lastPlayedAt: stats.lastPlayedAt,
    matchBasis: stats.matchBasis,
    source: "spotify_streaming_history_export",
  };
}

function zeroPlayStats() {
  return {
    playCount: 0,
    streams30s: 0,
    totalMs: 0,
    totalHours: 0,
    firstPlayedAt: null,
    lastPlayedAt: null,
    matchBasis: "no_export_event",
    source: "spotify_streaming_history_export",
  };
}

function exportKind(events) {
  const hasExtended = events.some((event) => event.format === "extended");
  const hasAccountData = events.some((event) => event.format === "account_data");
  if (hasExtended && hasAccountData) return "mixed";
  if (hasExtended) return "extended_streaming_history";
  if (hasAccountData) return "account_data_streaming_history";
  return "unknown_streaming_history";
}

async function main() {
  const playlistData = JSON.parse(await fs.readFile(playlistDataPath, "utf8"));
  const source = await prepareSource(historyPath);
  try {
    const { files, events } = await readStreamingEvents(source.dir);
    const stats = buildStats(events);
    const uniqueMatched = new Set();
    let matchedPlacements = 0;

    for (const version of playlistData.versions) {
      for (const track of version.tracks) {
        const trackStats = findTrackStats(track, stats);
        if (!trackStats) {
          track.playStats = zeroPlayStats();
          continue;
        }

        track.playStats = publicPlayStats(trackStats);
        uniqueMatched.add(track.key);
        matchedPlacements += 1;
      }
    }

    playlistData.summary.playCounts = {
      importedAt: new Date().toISOString(),
      source: "Spotify streaming history export",
      exportKind: exportKind(events),
      sourceFileName: path.basename(historyPath),
      sourceFiles: files.length,
      streamingEvents: events.length,
      matchedPlaylistPlacements: matchedPlacements,
      matchedUniquePlaylistTracks: uniqueMatched.size,
      playlistTracksWithZeroEvents: playlistData.summary.knownUniqueTrackCount - uniqueMatched.size,
      displayedCount: "playCount",
      playCountDefinition: "Every nonzero track listening event in the Spotify export.",
      streams30sDefinition: "Listening events with at least 30 seconds played are also retained as streams30s.",
    };

    if (dryRun) {
      console.log(JSON.stringify(playlistData.summary.playCounts, null, 2));
      return;
    }

    await fs.writeFile(playlistDataPath, `${JSON.stringify(playlistData, null, 2)}\n`, "utf8");
    console.log(
      `Imported ${events.length} streaming events from ${files.length} files; matched ${matchedPlacements} playlist placements.`,
    );
  } finally {
    if (source.cleanupDir) await fs.rm(source.cleanupDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
