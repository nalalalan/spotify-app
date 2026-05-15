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

const STYLE_COLORS = {
  "K-pop bright pop": "#236b43",
  "K-pop soft/R&B": "#5d7f9d",
  "K-pop electronic": "#5f5aa2",
  "K-pop dance": "#a84d55",
  "K-pop vocal/solo": "#9b6b3d",
  "K-pop boy group": "#2f6b6a",
  Classical: "#335f7c",
  "Film score": "#8a6a2f",
  "Retro instrumental": "#7a5b9a",
  "Western/Disney pop": "#777166",
};

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
  "op",
];

const SCORE_TERMS = [
  "alan silvestri",
  "hans zimmer",
  "john williams",
  "joe hisaishi",
  "michael giacchino",
  "soundtrack",
  "score",
  "interstellar",
  "dune",
  "jurassic",
  "ost",
];

const RETRO_INSTRUMENTAL_TERMS = [
  "dana countryman",
  "focus",
  "jean jacques perrey",
  "perrey",
  "passport to the future",
  "puppet",
  "synth",
];

const KPOP_SOFT_ARTISTS = [
  "akmu",
  "bibi",
  "bol4",
  "fifty fifty",
  "illit",
  "katseye",
  "newjeans",
  "rosé",
  "rose",
  "yves",
];

const KPOP_ELECTRONIC_ARTISTS = [
  "aespa",
  "billlie",
  "itzy",
  "k/da",
  "league of legends",
  "nmixx",
  "tripleS",
  "triple s",
];

const KPOP_DANCE_ARTISTS = [
  "all day project",
  "allday project",
  "babymonster",
  "blackpink",
  "chung ha",
  "chungha",
  "everglow",
  "hwasa",
  "jeon somi",
  "jennie",
  "kiss of life",
  "le sserafim",
  "lisa",
  "mamamoo",
  "orange caramel",
  "zico",
];

const KPOP_VOCAL_ARTISTS = [
  "iu",
  "jisoo",
  "jo yuri",
  "joy",
  "seulgi",
  "taeyeon",
  "wendy",
  "yena",
];

const KPOP_BOY_GROUP_ARTISTS = [
  "bts",
  "enhypen",
  "infinite",
  "jimin",
  "nct",
  "seventeen",
  "stray kids",
  "tomorrow x together",
  "txt",
];

const KPOP_BRIGHT_ARTISTS = [
  "aoa",
  "apink",
  "chuu",
  "fromis 9",
  "gfriend",
  "girls generation",
  "got the beat",
  "hearts2hearts",
  "i d le",
  "idle",
  "ive",
  "iz one",
  "izna",
  "kep1er",
  "loossemble",
  "misamo",
  "miss a",
  "momoland",
  "nayeon",
  "oh my girl",
  "red velvet",
  "rescence",
  "rescene",
  "rocket punch",
  "say my name",
  "stayc",
  "twice",
  "viviz",
];

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

function includesAny(value, terms) {
  const normalized = normalizeText(value);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function trackBlob(track) {
  return [
    track.title,
    track.artist,
    Array.isArray(track.artists) ? track.artists.join(" ") : "",
    track.album,
  ].join(" ");
}

function trackStyle(track) {
  const blob = trackBlob(track);
  if (includesAny(blob, CLASSICAL_TERMS)) return "Classical";
  if (includesAny(blob, SCORE_TERMS)) return "Film score";
  if (includesAny(blob, RETRO_INSTRUMENTAL_TERMS)) return "Retro instrumental";
  if (includesAny(blob, KPOP_BOY_GROUP_ARTISTS)) return "K-pop boy group";
  if (includesAny(blob, KPOP_VOCAL_ARTISTS)) return "K-pop vocal/solo";
  if (includesAny(blob, KPOP_ELECTRONIC_ARTISTS)) return "K-pop electronic";
  if (includesAny(blob, KPOP_DANCE_ARTISTS)) return "K-pop dance";
  if (includesAny(blob, KPOP_SOFT_ARTISTS)) return "K-pop soft/R&B";
  if (includesAny(blob, KPOP_BRIGHT_ARTISTS)) return "K-pop bright pop";
  return "Western/Disney pop";
}

function countBy(items, getKey, getValue = () => 1) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + getValue(item));
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function toMix(counts, total) {
  return counts.map((item) => ({
    ...item,
    color: STYLE_COLORS[item.name] || "#777166",
    percent: total > 0 ? Math.round((item.count / total) * 100) : 0,
  }));
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

function buildEventIndexes(events) {
  const byTrackId = new Map();
  const byText = new Map();

  for (const event of events) {
    if (event.spotifyTrackId) {
      const current = byTrackId.get(event.spotifyTrackId) || [];
      current.push(event);
      byTrackId.set(event.spotifyTrackId, current);
    }

    const fallbackKey = textKey(event.title, event.artist);
    const current = byText.get(fallbackKey) || [];
    current.push(event);
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

function findTrackEvents(track, eventIndexes) {
  const trackId = trackIdFromUri(track.spotifyUri);
  if (trackId && eventIndexes.byTrackId.has(trackId)) {
    return { events: eventIndexes.byTrackId.get(trackId), matchBasis: "spotify_track_uri" };
  }

  for (const key of candidateKeys(track)) {
    if (eventIndexes.byText.has(key)) {
      return { events: eventIndexes.byText.get(key), matchBasis: "title_artist" };
    }
  }

  return { events: [], matchBasis: "no_export_event" };
}

function timeMs(value) {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : null;
}

function versionStart(version) {
  const profileStart = timeMs(version.profile?.dateMade);
  if (profileStart) return profileStart;
  const trackTimes = version.tracks.map((track) => timeMs(track.addedAt)).filter((time) => time);
  return trackTimes.length ? Math.min(...trackTimes) : null;
}

function statsForWindow(events, matchBasis, startMs, endMs) {
  const stats = createStats(matchBasis);
  if (!startMs) return stats;

  for (const event of events) {
    const playedMs = timeMs(event.playedAt);
    if (!playedMs || playedMs < startMs) continue;
    if (endMs && playedMs >= endMs) continue;
    addStats(stats, event);
  }

  return stats;
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

function publicVersionPlayStats(stats, startMs, endMs) {
  return {
    ...publicPlayStats(stats),
    windowStart: startMs ? new Date(startMs).toISOString() : null,
    windowEnd: endMs ? new Date(endMs).toISOString() : null,
    windowBasis: "track_added_at_to_next_playlist_version",
  };
}

function applyStyles(playlistData) {
  for (const version of playlistData.versions) {
    if (version.profile?.dateMade) {
      version.profile.dateLabel = dateLabel(version.profile.dateMade);
    }

    for (const track of version.tracks) {
      track.style = trackStyle(track);
    }

    const styleCounts = countBy(version.tracks, (track) => track.style);
    version.profile.styleBasis = version.trackRowsComplete
      ? `${version.trackCount} songs`
      : `${version.recoveredTrackCount} shown / ${version.trackCount} verified`;
    version.profile.styleMix = toMix(styleCounts, version.tracks.length || 1);
    version.profile.genreBasis = version.profile.styleBasis;
    version.profile.genreMix = version.profile.styleMix;
    version.profile.topGenre = styleCounts[0]?.name || "mixed";
  }

  playlistData.summary.styleLabels = Object.keys(STYLE_COLORS);
  playlistData.summary.styleBasis = "Artist/title/album classifier maintained in tools/import-streaming-history.mjs.";

  const earlyStyles = countBy(playlistData.versions.slice(0, 4).flatMap((version) => version.tracks), (track) => track.style)
    .slice(0, 3)
    .map((style) => style.name);
  const lateStyles = countBy(playlistData.versions.slice(-4).flatMap((version) => version.tracks), (track) => track.style)
    .slice(0, 3)
    .map((style) => style.name);
  playlistData.summary.analysis = {
    ...(playlistData.summary.analysis || {}),
    headline: "K-pop becomes the center, then splits into softer, brighter, electronic, and dance lanes.",
    points: [
      `Early versions center on ${earlyStyles.join(", ")}; latest versions center on ${lateStyles.join(", ")}.`,
      "The big shift is v1 to v2: classical and score fall away, and K-pop becomes the stable core.",
      "After v2, the movement is mostly inside K-pop: bright pop, electronic pop, soft/R&B, dance, and vocal/solo trade places.",
    ],
  };
}

function applyVersionPlayStats(playlistData, eventIndexes) {
  const versions = playlistData.versions;
  let matchedVersionPlacements = 0;
  let versionPlacementsWithPlays = 0;

  for (let index = 0; index < versions.length; index += 1) {
    const version = versions[index];
    const baseStart = versionStart(version);
    const endMs = index < versions.length - 1 ? versionStart(versions[index + 1]) : null;

    for (const track of version.tracks) {
      const { events, matchBasis } = findTrackEvents(track, eventIndexes);
      const trackStart = Math.max(baseStart || 0, timeMs(track.addedAt) || baseStart || 0) || null;
      const stats = statsForWindow(events, matchBasis, trackStart, endMs);
      track.versionPlayStats = publicVersionPlayStats(stats, trackStart, endMs);
      if (events.length) matchedVersionPlacements += 1;
      if (stats.playCount > 0) versionPlacementsWithPlays += 1;
    }

    const totalPlays = version.tracks.reduce((sum, track) => sum + track.versionPlayStats.playCount, 0);
    const playStyleCounts = countBy(
      version.tracks,
      (track) => track.style,
      (track) => track.versionPlayStats.playCount,
    ).filter((item) => item.count > 0);
    version.profile.playStyleBasis = `${totalPlays} version plays`;
    version.profile.playStyleMix = toMix(playStyleCounts, totalPlays);
    version.profile.playWindow = {
      start: baseStart ? new Date(baseStart).toISOString() : null,
      end: endMs ? new Date(endMs).toISOString() : null,
    };
  }

  return { matchedVersionPlacements, versionPlacementsWithPlays };
}

function buildStyleTrend(versions) {
  return versions.map((version) => ({
    version: version.version,
    label: `v${version.version}`,
    dateLabel: version.profile.dateLabel,
    dateMade: version.profile.dateMade,
    songMix: version.profile.styleMix,
    playMix: version.profile.playStyleMix,
  }));
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
    const eventIndexes = buildEventIndexes(events);
    const uniqueMatched = new Set();
    let matchedPlacements = 0;

    applyStyles(playlistData);

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

    const versionStats = applyVersionPlayStats(playlistData, eventIndexes);
    playlistData.summary.styleTrend = buildStyleTrend(playlistData.versions);
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
      versionDisplayedCount: "versionPlayStats.playCount",
      versionPlayCountDefinition:
        "Every nonzero track listening event after the song was added to that playlist version and before the next Driving version date. Spotify export does not include playlist-source context.",
      matchedVersionPlacements: versionStats.matchedVersionPlacements,
      versionPlacementsWithPlays: versionStats.versionPlacementsWithPlays,
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
