import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const publicDir = path.join(appDir, "public");
const outputPath = path.join(publicDir, "playlist-data.json");
const dateOverridesPath = path.join(__dirname, "playlist-dates.json");

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
  "op.",
  "major",
  "minor",
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

function extractNextData(html, playlistId) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Missing Spotify embed data for ${playlistId}`);
  }
  return JSON.parse(decodeHtmlEntities(match[1]));
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

function includesAny(value, terms) {
  const haystack = value.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function trackGenre(track) {
  const haystack = `${track.title} ${track.artist}`;
  if (includesAny(haystack, CLASSICAL_TERMS)) return "classical";
  if (includesAny(haystack, SCORE_TERMS)) return "score";
  if (includesAny(haystack, NOVELTY_TERMS)) return "novelty instrumental";
  if (includesAny(track.artist, KPOP_ARTISTS)) return "K-pop";
  if (track.durationMs >= 420000) return "long-form instrumental";
  return "pop/other";
}

async function fetchPlaylist(playlist) {
  let entity = null;
  const url = `https://open.spotify.com/embed/playlist/${playlist.id}`;

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

  return {
    version: playlist.version,
    label: `v${playlist.version}`,
    sourceName: playlist.sourceName,
    spotifyName: entity.name || playlist.sourceName,
    id: playlist.id,
    spotifyUrl: `https://open.spotify.com/playlist/${playlist.id}`,
    embedUrl: url,
    owner: entity.subtitle || "Alan",
    coverArt: entity.coverArt?.sources?.[0]?.url || null,
    trackCount: entity.trackList.length,
    tracks: entity.trackList.map(normalizeTrack),
  };
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

function playlistProfile(version, previous, dateOverride) {
  const artistCounts = countBy(version.tracks, (track) => track.artist);
  const genreCounts = countBy(version.tracks, trackGenre);
  const total = version.trackCount || 1;
  const topGenre = genreCounts[0]?.name || "mixed";
  const topArtist = artistCounts[0]?.name || "mixed";
  const classicalShare = (genreCounts.find((genre) => genre.name === "classical")?.count || 0) / total;
  const kpopShare = (genreCounts.find((genre) => genre.name === "K-pop")?.count || 0) / total;
  const scoreShare = (genreCounts.find((genre) => genre.name === "score")?.count || 0) / total;
  const noveltyShare = (genreCounts.find((genre) => genre.name === "novelty instrumental")?.count || 0) / total;
  const averageDurationSeconds = Math.round(
    version.tracks.reduce((sum, track) => sum + track.durationMs, 0) / total / 1000,
  );
  const tags = [];

  if (classicalShare >= 0.28) tags.push("classical-heavy");
  if (kpopShare >= 0.55) tags.push("K-pop core");
  if (scoreShare >= 0.08) tags.push("score texture");
  if (noveltyShare >= 0.08) tags.push("novelty instrumental");
  if (averageDurationSeconds >= 260) tags.push("long-form");
  if (averageDurationSeconds <= 205) tags.push("short high-rotation songs");
  if (previous && version.trackCount < previous.trackCount) tags.push("tightened");
  if (previous && version.trackCount > previous.trackCount) tags.push("expanded");

  const genreMix = genreCounts.map((genre) => ({
    ...genre,
    percent: Math.round((genre.count / total) * 100),
  }));

  return {
    dateMade: dateOverride?.dateMade || null,
    dateStatus: dateOverride?.dateStatus || "needs_account_added_at",
    dateBasis:
      dateOverride?.dateBasis ||
      "Needs Spotify added_at rows from the logged-in account or an official Spotify playlist export.",
    dateLabel: dateOverride?.dateMade ? dateLabel(dateOverride.dateMade) : "Date pending",
    topGenre,
    topArtist,
    averageDuration: durationLabel(averageDurationSeconds * 1000),
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

  const largestAddition = [...changes].sort((a, b) => b.addedCount - a.addedCount)[0] || null;
  const largestRemoval = [...changes].sort((a, b) => b.removedCount - a.removedCount)[0] || null;

  return {
    versionCount: versions.length,
    latestVersion: latest.version,
    latestTrackCount: latest.trackCount,
    totalTrackPlacements: allTracks.length,
    uniqueTrackCount: uniqueTracks.size,
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
      "Dates use local Spotify account-cache estimates where recovered; unresolved dates stay marked instead of guessed.",
  };
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true });
  const dateOverrides = await readDateOverrides();
  const fetched = [];
  for (const playlist of PLAYLISTS) {
    fetched.push(await fetchPlaylist(playlist));
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
      trackRowsRecoveredFrom: "Spotify public embed __NEXT_DATA__ payloads",
      dateRowsRecoveredFrom:
        "Local Spotify account cache after opening playlists in the installed Spotify app; Spotify public embeds do not include added_at rows.",
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
