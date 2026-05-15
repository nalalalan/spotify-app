import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const publicDir = path.join(appDir, "public");
const outputPath = path.join(publicDir, "playlist-data.json");
const dateOverridesPath = path.join(__dirname, "playlist-dates.json");
const envPaths = [path.join(appDir, ".env.local"), path.join(appDir, ".env")];

const SOURCE_PROFILE_URL = "https://open.spotify.com/user/1245603146?si=ac25e33ff71d4393";

const PLAYLISTS = [
  { version: 1, id: "3Jj7M4vjtZBoxqLBgyJ0Ok", sourceName: "driving v1" },
  { version: 2, id: "4VQlSx8DyH4ocXCDIyx0VA", sourceName: "driving v2" },
  { version: 3, id: "36Xci7HoBicMoUMK896cKV", sourceName: "driving v3" },
  { version: 4, id: "1CG2TxnmNfKPTUUFtJPLtq", sourceName: "driving v4 likes" },
  { version: 5, id: "1YFhzVUlSfDL9Lra0nGWWb", sourceName: "driving v5" },
  { version: 6, id: "4nkNtdWTbfmIeiyBj9akUn", sourceName: "driving v6" },
  { version: 7, id: "4EoYpWkv6NEYAJNu1nwRsy", sourceName: "driving v7" },
  { version: 8, id: "5z9NCWJSJxWcCIj7nle3nL", sourceName: "driving v8" },
  { version: 9, id: "5N0eo1NYQZaSrGzfZlKNbl", sourceName: "driving v9 likes" },
  { version: 10, id: "0ZZ1MRnVbjFxfHWPfWe7b1", sourceName: "driving v10" },
  { version: 11, id: "6lZ8EoFJG1vrIKxTWbEPO5", sourceName: "driving v11" },
  { version: 12, id: "7CoSJelKCnGZa48iL0dJON", sourceName: "driving v12" },
  { version: 13, id: "3OOFyRG3WloBREqgz9C2MX", sourceName: "driving v13" },
];

const KPOP_ARTISTS = [
  "aespa",
  "newjeans",
  "le sserafim",
  "red velvet",
  "itzy",
  "ive",
  "nmixx",
  "stayc",
  "illit",
  "twice",
  "fifty fifty",
  "i-dle",
  "(g)i-dle",
  "girls' generation",
  "blackpink",
  "babymonster",
  "jo yuri",
  "kiss of life",
  "loossemble",
  "hearts2hearts",
  "yena",
  "iu",
  "wendy",
  "joy",
  "seulgi",
  "taeyeon",
  "stray kids",
  "bts",
  "nct dream",
  "chungha",
  "kep1er",
  "fromis_9",
  "loossemble",
  "iz*one",
  "izna",
];

const CLASSICAL_TERMS = [
  "bach",
  "beethoven",
  "brahms",
  "chopin",
  "debussy",
  "dvorak",
  "liszt",
  "mahler",
  "mendelssohn",
  "mozart",
  "paganini",
  "prokofiev",
  "rachmaninoff",
  "ravel",
  "schubert",
  "schumann",
  "sibelius",
  "tchaikovsky",
  "vivaldi",
  "violin concerto",
  "concerto",
  "symphony",
  "sonata",
  "adagio",
  "allegro",
  "andante",
];

const SCORE_TERMS = [
  "hans zimmer",
  "john williams",
  "joe hisaishi",
  "soundtrack",
  "score",
  "interstellar",
  "dune",
  "ost",
];

const NOVELTY_TERMS = [
  "jean-jacques perrey",
  "perrey",
  "synth",
  "polka",
  "puppet",
  "passport to the future",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function loadLocalEnv() {
  for (const envPath of envPaths) {
    try {
      const parsed = parseEnv(await fs.readFile(envPath, "utf8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function durationLabel(ms) {
  const totalSeconds = Math.round((ms || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function largestImageUrl(sources = []) {
  return [...sources]
    .filter((source) => source?.url)
    .sort((a, b) => (b.width || b.height || 0) - (a.width || a.height || 0))[0]?.url || null;
}

function extractNextData(html, playlistId) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Missing Spotify embed data for ${playlistId}`);
  }
  return JSON.parse(decodeHtmlEntities(match[1]));
}

function extractInitialState(html, playlistId) {
  const match = html.match(/<script id="initialState" type="text\/plain">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Missing Spotify playlist page state for ${playlistId}`);
  }
  return JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
}

function normalizeTrack(track, index) {
  const trackId = String(track.uri || "").split(":").pop();
  return {
    index: index + 1,
    title: track.title,
    artist: track.subtitle,
    key: `${track.title}:::${track.subtitle}`.toLowerCase(),
    spotifyUri: track.uri,
    spotifyUrl: trackId ? `https://open.spotify.com/track/${trackId}` : null,
    durationMs: track.duration || 0,
    duration: durationLabel(track.duration || 0),
    previewUrl: track.audioPreview?.url || null,
    explicit: Boolean(track.isExplicit),
  };
}

function normalizeApiPlaylistItem(item, index) {
  const track = item.track || item.item;
  if (!track || track.type === "episode") return null;
  const artists = (track.artists || []).map((artist) => artist.name).filter(Boolean);
  const title = track.name || "Untitled";
  const artistLine = artists.join(", ") || "Unknown artist";
  const spotifyUrl = track.external_urls?.spotify || (track.id ? `https://open.spotify.com/track/${track.id}` : null);

  return {
    index: index + 1,
    title,
    artist: artistLine,
    artists,
    album: track.album?.name || null,
    albumImage: largestImageUrl(track.album?.images),
    key: `${title}:::${artistLine}`.toLowerCase(),
    spotifyUri: track.uri || null,
    spotifyUrl,
    durationMs: track.duration_ms || 0,
    duration: durationLabel(track.duration_ms || 0),
    previewUrl: track.preview_url || null,
    explicit: Boolean(track.explicit),
    addedAt: item.added_at || null,
    dateAdded: item.added_at ? item.added_at.slice(0, 10) : null,
  };
}

function hasSpotifyCredentials() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getSpotifyAccessToken() {
  if (!hasSpotifyCredentials()) return null;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const body = process.env.SPOTIFY_REFRESH_TOKEN
    ? new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
      })
    : new URLSearchParams({
        grant_type: "client_credentials",
      });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Spotify token request failed: ${response.status}`);
  }
  if (!payload.access_token) {
    throw new Error("Spotify token response did not include an access token.");
  }
  return {
    token: payload.access_token,
    authMode: process.env.SPOTIFY_REFRESH_TOKEN ? "Spotify Web API user authorization" : "Spotify Web API client credentials",
  };
}

async function fetchSpotifyJson(url, accessToken) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") || attempt);
      await delay(Math.max(retryAfter, 1) * 1000);
      continue;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || `Spotify API request failed: ${response.status}`);
    }
    return payload;
  }

  throw new Error("Spotify API rate limit did not clear after retries.");
}

function includesAny(value, terms) {
  const haystack = value.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function trackGenre(track) {
  const haystack = `${track.title} ${track.artist}`;
  if (includesAny(haystack, CLASSICAL_TERMS)) return "Classical";
  if (includesAny(haystack, NOVELTY_TERMS)) return "Retro instrumental";
  if (includesAny(haystack, ["disney", "frozen", "high school musical", "mulan", "tangled"])) return "Disney/theater pop";
  if (includesAny(haystack, SCORE_TERMS)) return "Film score";
  if (includesAny(track.artist, KPOP_ARTISTS)) return "K-pop";
  if (track.durationMs >= 420000) return "Long-form instrumental";
  return "Western pop/rock";
}

async function fetchPublicPlaylistPreview(playlist) {
  let entity = null;
  const url = `https://open.spotify.com/embed/playlist/${playlist.id}`;
  const pageUrl = `https://open.spotify.com/playlist/${playlist.id}`;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify embed fetch failed for v${playlist.version}: ${response.status}`);
    }

    const html = new TextDecoder("utf-8").decode(await response.arrayBuffer());
    const nextData = extractNextData(html, playlist.id);
    entity = nextData.props?.pageProps?.state?.data?.entity;
    if (entity?.trackList?.length) break;
    await delay(750 * attempt);
  }

  if (!entity?.trackList?.length) {
    throw new Error(`No trackList found for v${playlist.version}`);
  }

  const pageResponse = await fetch(pageUrl, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    },
  });

  if (!pageResponse.ok) {
    throw new Error(`Spotify playlist page fetch failed for v${playlist.version}: ${pageResponse.status}`);
  }

  const pageHtml = new TextDecoder("utf-8").decode(await pageResponse.arrayBuffer());
  const pageState = extractInitialState(pageHtml, playlist.id);
  const pageEntity = pageState.entities?.items?.[`spotify:playlist:${playlist.id}`] || {};
  const verifiedTrackCount = pageEntity.content?.totalCount || entity.trackList.length;
  const tracks = entity.trackList.map(normalizeTrack);

  return {
    version: playlist.version,
    label: `v${playlist.version}`,
    sourceName: playlist.sourceName,
    spotifyName: entity.name || playlist.sourceName,
    id: playlist.id,
    spotifyUrl: `https://open.spotify.com/playlist/${playlist.id}`,
    embedUrl: url,
    owner: pageEntity.ownerV2?.data?.name || entity.subtitle || "Alan",
    coverArt: largestImageUrl(pageEntity.images?.items?.[0]?.sources) || largestImageUrl(entity.coverArt?.sources),
    trackCount: verifiedTrackCount,
    recoveredTrackCount: tracks.length,
    trackRowsComplete: tracks.length >= verifiedTrackCount,
    countBasis: "Spotify public playlist page totalCount",
    trackRowsBasis: "Spotify public embed track rows",
    tracks,
  };
}

async function fetchSpotifyApiPlaylist(playlist, accessToken) {
  const metaFields = "name,owner(display_name),images(url,width,height),items(total)";
  const itemsFields =
    "total,next,offset,limit,items(added_at,item(type,id,uri,name,duration_ms,explicit,external_urls.spotify,preview_url,album(name,images(url,width,height)),artists(name)))";
  const meta = await fetchSpotifyJson(
    `https://api.spotify.com/v1/playlists/${playlist.id}?fields=${encodeURIComponent(metaFields)}`,
    accessToken,
  );

  const items = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${playlist.id}/items?limit=50&offset=0&fields=${encodeURIComponent(itemsFields)}`;
  let verifiedTrackCount = meta.items?.total || 0;

  while (nextUrl) {
    const page = await fetchSpotifyJson(nextUrl, accessToken);
    verifiedTrackCount = page.total || verifiedTrackCount;
    items.push(...(page.items || []));
    nextUrl = page.next;
  }

  const tracks = items
    .map((item, index) => normalizeApiPlaylistItem(item, index))
    .filter(Boolean);

  return {
    version: playlist.version,
    label: `v${playlist.version}`,
    sourceName: playlist.sourceName,
    spotifyName: meta.name || playlist.sourceName,
    id: playlist.id,
    spotifyUrl: `https://open.spotify.com/playlist/${playlist.id}`,
    embedUrl: `https://open.spotify.com/embed/playlist/${playlist.id}`,
    owner: meta.owner?.display_name || "Alan",
    coverArt: largestImageUrl(meta.images),
    trackCount: verifiedTrackCount || tracks.length,
    recoveredTrackCount: tracks.length,
    trackRowsComplete: tracks.length >= (verifiedTrackCount || tracks.length),
    countBasis: "Spotify Web API playlist items total",
    trackRowsBasis: "Spotify Web API playlist items pagination",
    tracks,
  };
}

async function fetchPlaylist(playlist, accessToken = null) {
  if (accessToken) return fetchSpotifyApiPlaylist(playlist, accessToken);
  return fetchPublicPlaylistPreview(playlist);
}

async function readDateOverrides() {
  try {
    return JSON.parse(await fs.readFile(dateOverridesPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function earliestAddedAt(version) {
  const timestamps = version.tracks
    .map((track) => track.addedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps)).toISOString();
}

function playlistProfile(version, previous, dateOverride) {
  const artistCounts = countBy(version.tracks, (track) => track.artist);
  const genreCounts = countBy(version.tracks, trackGenre);
  const recoveredTotal = version.tracks.length || 1;
  const topGenre = genreCounts[0]?.name || "mixed";
  const topArtist = artistCounts[0]?.name || "mixed";
  const classicalShare = (genreCounts.find((genre) => genre.name === "Classical")?.count || 0) / recoveredTotal;
  const kpopShare = (genreCounts.find((genre) => genre.name === "K-pop")?.count || 0) / recoveredTotal;
  const scoreShare = (genreCounts.find((genre) => genre.name === "Film score")?.count || 0) / recoveredTotal;
  const noveltyShare = (genreCounts.find((genre) => genre.name === "Retro instrumental")?.count || 0) / recoveredTotal;
  const averageDurationSeconds = Math.round(
    version.tracks.reduce((sum, track) => sum + track.durationMs, 0) / recoveredTotal / 1000,
  );
  const tags = [];

  if (classicalShare >= 0.28) tags.push("classical-heavy");
  if (kpopShare >= 0.55) tags.push("K-pop core");
  if (scoreShare >= 0.08) tags.push("score texture");
  if (noveltyShare >= 0.08) tags.push("retro instrumental");
  if (averageDurationSeconds >= 260) tags.push("long-form");
  if (averageDurationSeconds <= 205) tags.push("short high-rotation songs");
  if (previous && version.trackCount < previous.trackCount) tags.push("tightened");
  if (previous && version.trackCount > previous.trackCount) tags.push("expanded");

  const genreMix = genreCounts.map((genre) => ({
    ...genre,
    percent: Math.round((genre.count / recoveredTotal) * 100),
  }));
  const apiDateMade = earliestAddedAt(version);
  const dateMade = apiDateMade || dateOverride?.dateMade || null;
  const dateStatus = apiDateMade ? "spotify_added_at_first_row" : dateOverride?.dateStatus || "needs_account_added_at";
  const dateBasis = apiDateMade
    ? "Earliest added_at row returned by Spotify Web API playlist items."
    : dateOverride?.dateBasis ||
      "Needs Spotify added_at rows from the logged-in account or an official Spotify playlist export.";

  return {
    dateMade,
    dateStatus,
    dateBasis,
    dateLabel: dateMade ? dateLabel(dateMade) : "Date pending",
    topGenre,
    topArtist,
    averageDuration: durationLabel(averageDurationSeconds * 1000),
    genreBasis: version.trackRowsComplete
      ? `all ${version.trackCount} songs`
      : `${version.recoveredTrackCount} of ${version.trackCount} shown rows`,
    genreMix,
    topArtists: artistCounts.slice(0, 8),
    vibeTags: tags.slice(0, 5),
    reading: buildPlaylistReading(version, {
      topGenre,
      topArtist,
      classicalShare,
      kpopShare,
      noveltyShare,
      averageDurationSeconds,
      previous,
    }),
  };
}

function buildPlaylistReading(version, profile) {
  const base = [];
  if (profile.classicalShare >= 0.28) {
    base.push("classical and long-form instrumental structure");
  }
  if (profile.kpopShare >= 0.55) {
    base.push("K-pop momentum and polished hooks");
  }
  if (profile.noveltyShare >= 0.08) {
    base.push("bright novelty-instrumental texture");
  }
  if (!base.length) {
    base.push(`${profile.topArtist} and ${profile.topGenre}`);
  }

  const motion =
    profile.previous && version.trackCount > profile.previous.trackCount
      ? "expanded"
      : profile.previous && version.trackCount < profile.previous.trackCount
        ? "tightened"
        : "held steady";

  return `This chapter ${motion} around ${base.slice(0, 2).join(" with ")}.`;
}

function diffVersions(previous, current) {
  const previousMap = new Map(previous.tracks.map((track) => [track.key, track]));
  const currentMap = new Map(current.tracks.map((track) => [track.key, track]));
  const added = current.tracks.filter((track) => !previousMap.has(track.key));
  const removed = previous.tracks.filter((track) => !currentMap.has(track.key));
  const kept = current.tracks.filter((track) => previousMap.has(track.key));
  const moved = kept
    .map((track) => ({
      ...track,
      fromIndex: previousMap.get(track.key).index,
      toIndex: track.index,
      delta: previousMap.get(track.key).index - track.index,
    }))
    .filter((track) => track.fromIndex !== track.toIndex);

  const addedArtists = countBy(added, (track) => track.artist).slice(0, 6);
  const removedArtists = countBy(removed, (track) => track.artist).slice(0, 6);
  const retainedArtists = countBy(kept, (track) => track.artist).slice(0, 6);
  const focus = [];

  if (addedArtists[0]) focus.push(`${addedArtists[0].name} added ${addedArtists[0].count}`);
  if (removedArtists[0]) focus.push(`${removedArtists[0].name} removed ${removedArtists[0].count}`);
  if (retainedArtists[0]) focus.push(`${retainedArtists[0].name} retained ${retainedArtists[0].count}`);

  return {
    from: previous.version,
    to: current.version,
    label: `v${previous.version} -> v${current.version}`,
    fromName: previous.spotifyName,
    toName: current.spotifyName,
    addedCount: added.length,
    removedCount: removed.length,
    keptCount: kept.length,
    movedCount: moved.length,
    netChange: current.trackCount - previous.trackCount,
    added: added.slice(0, 24),
    removed: removed.slice(0, 24),
    moved: moved
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 16),
    addedArtists,
    removedArtists,
    retainedArtists,
    focus,
  };
}

function buildSummary(versions, changes) {
  const allTracks = versions.flatMap((version) => version.tracks);
  const uniqueTracks = new Map(allTracks.map((track) => [track.key, track]));
  const artistCounts = countBy(allTracks, (track) => track.artist).slice(0, 12);
  const latest = versions.at(-1);
  const verifiedTrackPlacements = versions.reduce((sum, version) => sum + version.trackCount, 0);
  const recoveredTrackPlacements = versions.reduce((sum, version) => sum + version.tracks.length, 0);
  const allRowsComplete = versions.every((version) => version.trackRowsComplete);

  const largestAddition = [...changes].sort((a, b) => b.addedCount - a.addedCount)[0] || null;
  const largestRemoval = [...changes].sort((a, b) => b.removedCount - a.removedCount)[0] || null;

  return {
    versionCount: versions.length,
    latestVersion: latest.version,
    latestTrackCount: latest.trackCount,
    verifiedTrackPlacements,
    recoveredTrackPlacements,
    totalTrackPlacements: verifiedTrackPlacements,
    knownUniqueTrackCount: uniqueTracks.size,
    uniqueTrackCountBasis: allRowsComplete
      ? "Computed from all Spotify playlist rows in this snapshot."
      : "Computed only from Spotify rows shown in this snapshot.",
    topArtists: artistCounts,
    analysis: buildLongitudinalAnalysis(versions, changes, artistCounts),
    largestAddition: largestAddition
      ? {
          label: largestAddition.label,
          addedCount: largestAddition.addedCount,
          removedCount: largestAddition.removedCount,
          keptCount: largestAddition.keptCount,
        }
      : null,
    largestRemoval: largestRemoval
      ? {
          label: largestRemoval.label,
          addedCount: largestRemoval.addedCount,
          removedCount: largestRemoval.removedCount,
          keptCount: largestRemoval.keptCount,
        }
      : null,
  };
}

function buildLongitudinalAnalysis(versions, changes, artistCounts) {
  const early = versions.slice(0, 4);
  const late = versions.slice(-4);
  const earlyGenres = countBy(early.flatMap((version) => version.tracks), trackGenre).slice(0, 3);
  const lateGenres = countBy(late.flatMap((version) => version.tracks), trackGenre).slice(0, 3);
  const resets = changes
    .filter((change) => change.addedCount >= 55 || change.removedCount >= 55)
    .map((change) => change.label);

  return {
    headline: "A shift from long-form structure into compact, high-rotation pop chapters.",
    points: [
      `The early chain is led by ${earlyGenres.map((genre) => genre.name).join(", ")}; the latest chain is led by ${lateGenres.map((genre) => genre.name).join(", ")}.`,
      `${artistCounts.slice(0, 4).map((artist) => artist.name).join(", ")} are the strongest repeat artists across the full record.`,
      resets.length
        ? `${resets.slice(0, 5).join(", ")} are reset points, not small edits.`
        : "The chain changes gradually rather than through large resets.",
      "The pattern reads like a private listening journal: keep the emotional engine, rotate the surface language.",
    ],
    sourceBoundary:
      "Dates use local Spotify account-cache estimates where available; unresolved dates stay marked instead of guessed.",
  };
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });
  await loadLocalEnv();
  const dateOverrides = await readDateOverrides();
  const spotifyAuth = await getSpotifyAccessToken();
  const fetched = [];
  for (const playlist of PLAYLISTS) {
    fetched.push(await fetchPlaylist(playlist, spotifyAuth?.token || null));
    await delay(350);
  }

  for (let index = 0; index < fetched.length; index += 1) {
    fetched[index].profile = playlistProfile(
      fetched[index],
      fetched[index - 1] || null,
      dateOverrides[fetched[index].id],
    );
  }

  const changes = fetched.slice(1).map((version, index) => diffVersions(fetched[index], version));
  const payload = {
    generatedAt: new Date().toISOString(),
    provenance: {
      profileUrl: SOURCE_PROFILE_URL,
      playlistIdsRecoveredFrom: "Spotify public profile rendered in the in-app browser on 2026-05-12",
      trackRowsRecoveredFrom: spotifyAuth
        ? `${spotifyAuth.authMode}; paginated playlist-items endpoint.`
        : "Spotify public embed __NEXT_DATA__ payloads",
      dateRowsRecoveredFrom: spotifyAuth
        ? `${spotifyAuth.authMode}; earliest added_at row per playlist.`
        : "Local Spotify account cache after opening playlists in the installed Spotify app; Spotify public embeds do not include added_at rows.",
    },
    versions: fetched,
    changes,
    summary: buildSummary(fetched, changes),
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(appDir, outputPath)} with ${fetched.length} versions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
