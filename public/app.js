const state = {
  data: null,
  selectedVersion: 13,
};

const els = {
  currentCover: document.querySelector("#currentCover"),
  rangeLabel: document.querySelector("#rangeLabel"),
  currentTitle: document.querySelector("#currentTitle"),
  currentDate: document.querySelector("#currentDate"),
  currentTracks: document.querySelector("#currentTracks"),
  currentArtists: document.querySelector("#currentArtists"),
  openSpotify: document.querySelector("#openSpotify"),
  mixCoverage: document.querySelector("#mixCoverage"),
  mixBar: document.querySelector("#mixBar"),
  mixLegend: document.querySelector("#mixLegend"),
  styleChart: document.querySelector("#styleChart"),
  artistRankList: document.querySelector("#artistRankList"),
  versionCount: document.querySelector("#versionCount"),
  songCount: document.querySelector("#songCount"),
  timeline: document.querySelector("#timeline"),
  songsTitle: document.querySelector("#songsTitle"),
  songsCoverage: document.querySelector("#songsCoverage"),
  songsList: document.querySelector("#songsList"),
};

const genreColors = {
  "K-pop bright pop": "#236b43",
  "K-pop soft/R&B": "#5d7f9d",
  "K-pop electronic": "#5f5aa2",
  "K-pop dance": "#a84d55",
  "K-pop vocal/solo": "#9b6b3d",
  "K-pop boy group": "#2f6b6a",
  Classical: "#335f7c",
  "Film score": "#8a6a2f",
  "Retro instrumental": "#7a5b9a",
  "Disney/theater pop": "#8a6a2f",
  "Western pop/rock": "#777166",
};

const artistPalette = [
  "#667f9e",
  "#b95d6d",
  "#7b68b8",
  "#2f7775",
  "#d98b65",
  "#9d7b3d",
  "#d46e9d",
  "#5d986b",
  "#8f6ba8",
  "#c25f4a",
  "#4d6f8f",
  "#caa243",
];
const artistThemeColors = {
  "aespa": "#735cc8",
  "akmu": "#5aa879",
  "aoa": "#2f6f8f",
  "apink": "#ec8bb6",
  "babymonster": "#2c3037",
  "bibi": "#433b46",
  "billlie": "#7c8bc7",
  "blackpink": "#e4579b",
  "bol4": "#d46278",
  "bts": "#7b61c8",
  "chuu": "#f08bb7",
  "everglow": "#6658b7",
  "fifty fifty": "#d2a53f",
  "fromis_9": "#f18aad",
  "gfriend": "#6abf93",
  "girls' generation": "#ed8bae",
  "got the beat": "#8a5fb2",
  "hans zimmer": "#506578",
  "hearts2hearts": "#f197b8",
  "illit": "#a58add",
  "infinite": "#9d7b3d",
  "itzy": "#d45283",
  "iu": "#947ec0",
  "ive": "#416db4",
  "i-dle": "#8a62b5",
  "iz*one": "#d78ec4",
  "jean-jacques perrey": "#8f6ba8",
  "jennie": "#d8709c",
  "jeon somi": "#ef8a73",
  "jisoo": "#df7fa2",
  "john williams": "#566f8a",
  "joy": "#72a85f",
  "jo yuri": "#7eb6d2",
  "katseye": "#c94f82",
  "kiss of life": "#b65c42",
  "le sserafim": "#3b4048",
  "lea salonga": "#8b6f4f",
  "lee chaeyeon": "#b987c9",
  "lisa": "#25252b",
  "ludwig van beethoven": "#6f5f43",
  "misamo": "#e59384",
  "miss a": "#9f4f64",
  "momoland": "#e1679c",
  "nayeon": "#f08c62",
  "nct": "#5cac61",
  "nct 127": "#579f5d",
  "nct dream": "#6dbb63",
  "newjeans": "#5f8fbd",
  "niccolo paganini": "#7a6846",
  "nmixx": "#178b8b",
  "oh my girl": "#82b99a",
  "orange caramel": "#e58a45",
  "red velvet": "#a83246",
  "rose": "#f25b91",
  "say my name": "#80a8d8",
  "seulgi": "#9d4238",
  "seventeen": "#92a7d9",
  "soyeon": "#a64d73",
  "stayc": "#ee8477",
  "stray kids": "#2f3138",
  "tfn": "#c96b40",
  "triples": "#5f69c8",
  "twice": "#eda15f",
  "viviz": "#b36bc0",
  "yena": "#e2b63f",
  "zico": "#a76b48",
};
const artistLineLimit = 19;
const artistRankLimit = 30;
const artistMixLimit = 16;

let historyRanks = new Map();

function number(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function byArtist(tracks) {
  const counts = new Map();
  for (const track of tracks) counts.set(track.artist, (counts.get(track.artist) || 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function primaryArtist(track) {
  if (Array.isArray(track.artists) && track.artists.length) return track.artists[0];
  return track.artist || "Unknown";
}

function normalizeArtistName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function artistColor(name, index) {
  return artistThemeColors[normalizeArtistName(name)] || artistPalette[index % artistPalette.length];
}

function artistColorMap(artists) {
  return new Map(artists.map((artist, index) => [artist.name, artistColor(artist.name, index)]));
}

function artistSongMix(version, colorByArtist, limit = artistMixLimit) {
  const total = version.tracks.length || 1;
  const artists = byArtist(version.tracks.map((track) => ({ ...track, artist: primaryArtist(track) })));
  const top = artists.slice(0, limit).map((artist, index) => ({
    ...artist,
    percent: Math.round((artist.count / total) * 100),
    color: colorByArtist.get(artist.name) || artistColor(artist.name, index),
  }));
  const otherCount = artists.slice(limit).reduce((sum, artist) => sum + artist.count, 0);
  if (otherCount > 0) {
    const remaining = artists.length - limit;
    top.push({
      name: `${remaining} more artists`,
      count: otherCount,
      percent: Math.round((otherCount / total) * 100),
      color: "#9f988d",
    });
  }
  return top;
}

function buildHistoryRanks(versions) {
  const ranks = new Map();
  for (const version of versions) {
    const seenInVersion = new Set();
    for (const track of version.tracks) {
      if (seenInVersion.has(track.key)) continue;
      seenInVersion.add(track.key);
      const current = ranks.get(track.key) || {
        count: 0,
        firstVersion: version.version,
        lastVersion: version.version,
      };
      current.count += 1;
      current.firstVersion = Math.min(current.firstVersion, version.version);
      current.lastVersion = Math.max(current.lastVersion, version.version);
      ranks.set(track.key, current);
    }
  }
  return ranks;
}

function historyRank(track) {
  return historyRanks.get(track.key) || { count: 1, firstVersion: state.selectedVersion, lastVersion: state.selectedVersion };
}

function playCount(track) {
  return track.versionPlayStats?.playCount ?? track.playStats?.playCount ?? 0;
}

function totalPlayCount(track) {
  return track.playStats?.playCount ?? 0;
}

function playsLabel(value) {
  return `${number(value)} ${value === 1 ? "play" : "plays"}`;
}

function hasPlayCounts(version) {
  return version.tracks.some((track) => playCount(track) > 0);
}

function rankedTracks(version) {
  const rankByPlays = hasPlayCounts(version);
  return [...version.tracks].sort((a, b) => {
    if (rankByPlays) {
      const playDelta = playCount(b) - playCount(a);
      if (playDelta) return playDelta;
    }

    const aRank = historyRank(a);
    const bRank = historyRank(b);
    return (
      bRank.count - aRank.count ||
      bRank.lastVersion - aRank.lastVersion ||
      aRank.firstVersion - bRank.firstVersion ||
      a.index - b.index
    );
  });
}

function selectedVersion() {
  return state.data.versions.find((version) => version.version === state.selectedVersion);
}

function changeForVersion(versionNumber) {
  return state.data.changes.find((change) => change.to === versionNumber);
}

function dateRange() {
  const datedVersions = state.data.versions.filter((version) => version.profile.dateMade);
  return `${datedVersions[0].profile.dateLabel} - ${datedVersions.at(-1).profile.dateLabel}`;
}

function topArtistLine(version) {
  return byArtist(version.tracks)
    .slice(0, 3)
    .map((artist) => artist.name)
    .join(" / ");
}

function coverageLine(version, completeWord = "songs") {
  if (version.trackRowsComplete) return `${number(version.trackCount)} ${completeWord}`;
  return `${number(version.availableTrackCount ?? version.tracks.length)} shown / ${number(version.trackCount)} verified`;
}

function renderOverview(version) {
  els.currentCover.src = version.coverArt;
  els.currentCover.alt = `${version.spotifyName} cover`;
  els.rangeLabel.textContent = dateRange();
  els.currentTitle.textContent = version.spotifyName;
  els.currentDate.textContent = version.profile.dateLabel;
  els.currentTracks.textContent = `${number(version.trackCount)} songs`;
  els.currentArtists.textContent = topArtistLine(version);
  els.openSpotify.href = version.spotifyUrl;
  const rows = trendRows();
  const artists = chartArtists(rows);
  const colorByArtist = artistColorMap(artists);
  renderArtistMix(version, colorByArtist);
  renderArtistTrend(rows, artists, colorByArtist);
  renderSongs(version);
}

function renderArtistMix(version, colorByArtist) {
  const mix = artistSongMix(version, colorByArtist).filter((artist) => artist.count > 0);
  els.mixCoverage.textContent = coverageLine(version);
  els.mixBar.innerHTML = mix
    .map((artist) => {
      const color = artist.color || "#777166";
      return `<span style="--w:${artist.percent}%; --c:${color}" title="${escapeHtml(`${artist.name}: ${artist.percent}%`)}"></span>`;
    })
    .join("");
  els.mixLegend.innerHTML = mix
    .map((artist) => {
      const color = artist.color || "#777166";
      return `
        <span class="mix-chip">
          <i style="--c:${color}"></i>
          ${escapeHtml(artist.name)} ${artist.percent}%
        </span>
      `;
    })
    .join("");
}

function trendRows() {
  return state.data.versions.map((version) => {
    const counts = new Map();
    let total = 0;

    for (const track of version.tracks) {
      const plays = playCount(track);
      if (!plays) continue;
      const artist = primaryArtist(track);
      counts.set(artist, (counts.get(artist) || 0) + plays);
      total += plays;
    }

    return {
      version: version.version,
      label: `v${version.version}`,
      dateLabel: version.profile.dateLabel,
      dateMade: version.profile.dateMade,
      total,
      playMix: [...counts.entries()]
        .map(([name, count]) => ({
          name,
          count,
          percent: total ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  });
}

function chartArtists(rows) {
  const totals = new Map();
  for (const row of rows) {
    for (const item of row.playMix || []) totals.set(item.name, (totals.get(item.name) || 0) + item.count);
  }
  return [...totals.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .filter((artist) => artist.count > 0);
}

function percentFor(row, name) {
  return (row.playMix || []).find((item) => item.name === name)?.percent || 0;
}

function formatPercent(value) {
  if (value >= 10 || Number.isInteger(value)) return Math.round(value).toString();
  return value.toFixed(1);
}

function shortDateLabel(row, compact = false) {
  const date = new Date(row.dateMade || "");
  if (Number.isFinite(date.getTime())) {
    if (compact) {
      return `${date.getUTCMonth() + 1}/${String(date.getUTCFullYear()).slice(-2)}`;
    }

    const month = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(date);
    const year = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "2-digit" }).format(date);
    return `${month} '${year}`;
  }

  return String(row.dateLabel || "").replace(/,?\s*20(\d{2})$/, " '$1");
}

function renderArtistTrend(rows = trendRows(), artists = chartArtists(rows), colorByArtist = artistColorMap(artists)) {
  if (!rows.length || !artists.length) {
    els.styleChart.innerHTML = "";
    return;
  }

  const labeledArtists = artists.slice(0, artistLineLimit);
  const rankedArtists = artists.slice(0, artistRankLimit);
  const labeledNames = new Set(labeledArtists.map((artist) => artist.name));
  const backgroundArtists = artists.filter((artist) => !labeledNames.has(artist.name));
  const compactChart = window.innerWidth < 520;
  const width = compactChart ? 520 : 680;
  const height = compactChart ? 236 : 188;
  const pad = compactChart
    ? { top: 14, right: 28, bottom: 78, left: 64 }
    : { top: 14, right: 18, bottom: 50, left: 66 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const axisLabelX = pad.left - 42;
  const maxPercent = Math.max(
    1,
    ...artists.flatMap((artist) => rows.map((row) => percentFor(row, artist.name))),
  );
  const yMax = Math.min(100, Math.max(40, Math.ceil((maxPercent + 3) / 10) * 10));
  const yTicks = [0, Math.round(yMax / 2), yMax];
  const xFor = (index) => pad.left + (rows.length === 1 ? 0 : (index / (rows.length - 1)) * plotWidth);
  const yFor = (percent) => pad.top + ((yMax - Math.min(percent, yMax)) / yMax) * plotHeight;

  const guideLines = yTicks
    .map((percent) => {
      const y = yFor(percent).toFixed(1);
      return `
        <line x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}"></line>
        <text class="tick-label" x="${pad.left - 8}" y="${Number(y) + 4}" text-anchor="end">${percent}</text>
      `;
    })
    .join("");

  const backgroundLines = backgroundArtists
    .map((artist) => {
      const color = colorByArtist.get(artist.name) || "#9f988d";
      const points = rows.map((row, index) => `${xFor(index).toFixed(1)},${yFor(percentFor(row, artist.name)).toFixed(1)}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.12"><title>${escapeHtml(artist.name)}</title></polyline>`;
    })
    .join("");

  const lines = labeledArtists
    .map((artist) => {
      const color = colorByArtist.get(artist.name) || "#777166";
      const points = rows.map((row, index) => `${xFor(index).toFixed(1)},${yFor(percentFor(row, artist.name)).toFixed(1)}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><title>${escapeHtml(artist.name)}</title></polyline>`;
    })
    .join("");

  const dots = labeledArtists
    .map((artist) => {
      const color = colorByArtist.get(artist.name) || "#777166";
      return rows
        .map((row, index) => {
          const percent = percentFor(row, artist.name);
          return `<circle cx="${xFor(index).toFixed(1)}" cy="${yFor(percent).toFixed(1)}" r="2.5" fill="${color}"><title>${escapeHtml(`${artist.name} v${row.version} ${row.dateLabel}: ${formatPercent(percent)}%`)}</title></circle>`;
        })
        .join("");
    })
    .join("");

  const xLabels = rows
    .map((row, index) => {
      const x = xFor(index).toFixed(1);
      if (compactChart) {
        const y = height - 20;
        return `
          <text class="x-label rotated-label" x="${x}" y="${y}" text-anchor="end" transform="rotate(-55 ${x} ${y})">
            v${row.version} ${escapeHtml(shortDateLabel(row, true))}
          </text>
        `;
      }

      return `
        <text class="x-label" x="${x}" y="${height - 31}" text-anchor="middle">
          <tspan x="${x}">v${row.version}</tspan>
          <tspan x="${x}" dy="13">${escapeHtml(shortDateLabel(row, compactChart))}</tspan>
        </text>
      `;
    })
    .join("");

  els.styleChart.innerHTML = `
    <div class="trend-chart-scroll">
      <svg class="chart-svg${compactChart ? " compact-chart" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Play share by artist/composer across playlist versions">
        <g class="chart-guides">${guideLines}</g>
        <line class="axis-line" x1="${pad.left}" x2="${width - pad.right}" y1="${yFor(0).toFixed(1)}" y2="${yFor(0).toFixed(1)}"></line>
        <text class="axis-label" transform="translate(${axisLabelX} ${pad.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">Artist share (%)</text>
        <g>${backgroundLines}${lines}${dots}</g>
        <g>${xLabels}</g>
      </svg>
    </div>
  `;
  els.artistRankList.innerHTML = rankedArtists
    .map((artist, index) => {
      const color = colorByArtist.get(artist.name) || "#777166";
      return `
        <li class="artist-rank-item" style="--c:${color}">
          <span class="artist-rank-number">${index + 1}</span>
          <i aria-hidden="true"></i>
          <span class="artist-rank-name">${escapeHtml(artist.name)}</span>
          <span class="artist-rank-plays">${escapeHtml(playsLabel(artist.count))}</span>
        </li>
      `;
    })
    .join("");
}

function dateAddedLabel(track) {
  if (!track.dateAdded) return "date pending";
  const [year, month, day] = track.dateAdded.split("-").map(Number);
  if (!year || !month || !day) return track.dateAdded;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function renderSongs(version) {
  els.songsTitle.textContent = `${version.spotifyName} / ${version.profile.dateLabel}`;
  els.songsCoverage.textContent = coverageLine(version);
  const rows = rankedTracks(version)
    .map((track, rankIndex) => {
      const style = track.style || "Unclassified";
      const added = dateAddedLabel(track);
      const plays = playCount(track);
      const totalPlays = totalPlayCount(track);
      return `
        <a class="song-row song-table-row" href="${track.spotifyUrl}" target="_blank" rel="noreferrer">
          <span class="song-index">${number(rankIndex + 1)}</span>
          <strong class="song-title">${escapeHtml(track.title)}</strong>
          <span class="song-artist">${escapeHtml(track.artist)}</span>
          <span class="song-plays">${number(plays)}</span>
          <span class="song-total-plays">${number(totalPlays)}</span>
          <span class="song-added">${escapeHtml(added)}</span>
          <span class="song-style">${escapeHtml(style)}</span>
          <span class="song-duration">${escapeHtml(track.duration || "")}</span>
          <span class="song-mobile-meta">${number(plays)} era &middot; ${number(totalPlays)} total &middot; ${escapeHtml(added)} &middot; ${escapeHtml(track.duration || "")}</span>
        </a>
      `;
    })
    .join("");
  const remaining = version.trackCount - (version.availableTrackCount ?? version.tracks.length);
  const pending = remaining > 0 ? `<div class="song-row pending-row">${number(remaining)} more verified on Spotify</div>` : "";
  els.songsList.innerHTML = `
    <div class="songs-table">
      <div class="song-table-head" aria-hidden="true">
        <span>#</span>
        <span>Name</span>
        <span>Artist / composer</span>
        <span>Era plays</span>
        <span>Total plays</span>
        <span>Date added</span>
        <span>Style</span>
        <span>Length</span>
      </div>
      ${rows}
      ${pending}
    </div>
  `;
}

function renderTimeline() {
  els.versionCount.textContent = `${number(state.data.summary.versionCount)} versions`;
  els.songCount.textContent = `${number(state.data.summary.verifiedTrackPlacements)} verified placements`;
  els.timeline.innerHTML = state.data.versions
    .map((version) => {
      const active = version.version === state.selectedVersion ? " active" : "";
      return `
        <button class="timeline-card${active}" type="button" data-version="${version.version}" aria-label="Show ${escapeHtml(version.spotifyName)}">
          <img src="${version.coverArt}" alt="">
          <span class="version-id">v${version.version}</span>
          <strong>${escapeHtml(version.profile.dateLabel)}</strong>
          <span>${coverageLine(version)}</span>
        </button>
      `;
    })
    .join("");
}

function render() {
  const version = selectedVersion();
  renderOverview(version);
  renderTimeline();
}

document.addEventListener("click", (event) => {
  const versionButton = event.target.closest("[data-version]");
  if (!versionButton) return;

  state.selectedVersion = Number(versionButton.dataset.version);
  render();
});

fetch("/playlist-data.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Data fetch failed: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    state.data = data;
    historyRanks = buildHistoryRanks(data.versions);
    state.selectedVersion = data.summary.latestVersion;
    render();
  })
  .catch((error) => {
    document.body.innerHTML = `<main class="empty">Playlist snapshot failed to load: ${escapeHtml(error.message)}</main>`;
  });
