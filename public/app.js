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
  trendCoverage: document.querySelector("#trendCoverage"),
  styleChart: document.querySelector("#styleChart"),
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
  renderStyleMix(version);
  renderStyleTrend();
  renderSongs(version);
}

function renderStyleMix(version) {
  const mix = (version.profile.styleMix || version.profile.genreMix).filter((genre) => genre.count > 0);
  els.mixCoverage.textContent = version.profile.styleBasis || version.profile.genreBasis;
  els.mixBar.innerHTML = mix
    .map((genre) => {
      const color = genre.color || genreColors[genre.name] || "#777166";
      return `<span style="--w:${genre.percent}%; --c:${color}" title="${escapeHtml(`${genre.name}: ${genre.percent}%`)}"></span>`;
    })
    .join("");
  els.mixLegend.innerHTML = mix
    .slice(0, 5)
    .map((genre) => {
      const color = genre.color || genreColors[genre.name] || "#777166";
      return `
        <span class="mix-chip">
          <i style="--c:${color}"></i>
          ${escapeHtml(genre.name)} ${genre.percent}%
        </span>
      `;
    })
    .join("");
}

function trendRows() {
  return state.data.summary.styleTrend || state.data.versions.map((version) => ({
    version: version.version,
    label: `v${version.version}`,
    playMix: version.profile.playStyleMix || version.profile.styleMix || version.profile.genreMix,
  }));
}

function chartStyles(rows) {
  const totals = new Map();
  for (const row of rows) {
    for (const item of row.playMix || []) totals.set(item.name, (totals.get(item.name) || 0) + item.count);
  }
  return [...totals.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);
}

function percentFor(row, styleName) {
  return (row.playMix || []).find((item) => item.name === styleName)?.percent || 0;
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

function renderStyleTrend() {
  const rows = trendRows();
  const styles = chartStyles(rows);
  if (!rows.length || !styles.length) {
    els.styleChart.innerHTML = "";
    return;
  }

  const compactChart = window.innerWidth < 520;
  const width = compactChart ? 520 : 680;
  const height = compactChart ? 244 : 220;
  const pad = compactChart
    ? { top: 14, right: 28, bottom: 78, left: 50 }
    : { top: 14, right: 18, bottom: 50, left: 54 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const xFor = (index) => pad.left + (rows.length === 1 ? 0 : (index / (rows.length - 1)) * plotWidth);
  const yFor = (percent) => pad.top + ((100 - percent) / 100) * plotHeight;

  const guideLines = [0, 50, 100]
    .map((percent) => {
      const y = yFor(percent).toFixed(1);
      return `
        <line x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}"></line>
        <text class="tick-label" x="${pad.left - 8}" y="${Number(y) + 4}" text-anchor="end">${percent}</text>
      `;
    })
    .join("");

  const lines = styles
    .map((style) => {
      const color = genreColors[style.name] || "#777166";
      const points = rows.map((row, index) => `${xFor(index).toFixed(1)},${yFor(percentFor(row, style.name)).toFixed(1)}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
    })
    .join("");

  const dots = styles
    .map((style) => {
      const color = genreColors[style.name] || "#777166";
      return rows
        .map((row, index) => {
          const percent = percentFor(row, style.name);
          return `<circle cx="${xFor(index).toFixed(1)}" cy="${yFor(percent).toFixed(1)}" r="2.8" fill="${color}"><title>${escapeHtml(`${style.name} v${row.version} ${row.dateLabel}: ${percent}%`)}</title></circle>`;
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

  els.trendCoverage.textContent = "plays by style";
  els.styleChart.innerHTML = `
    <svg class="chart-svg${compactChart ? " compact-chart" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Play share by style across playlist versions">
      <g class="chart-guides">${guideLines}</g>
      <line class="axis-line" x1="${pad.left}" x2="${width - pad.right}" y1="${yFor(0).toFixed(1)}" y2="${yFor(0).toFixed(1)}"></line>
      <text class="axis-label" transform="translate(15 ${pad.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">Share of version plays (%)</text>
      <g>${lines}${dots}</g>
      <g>${xLabels}</g>
    </svg>
    <div class="mix-legend trend-legend">
      ${styles
        .map((style) => {
          const color = genreColors[style.name] || "#777166";
          return `<span class="mix-chip"><i style="--c:${color}"></i>${escapeHtml(style.name)}</span>`;
        })
        .join("")}
    </div>
  `;
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
      return `
        <a class="song-row song-table-row" href="${track.spotifyUrl}" target="_blank" rel="noreferrer">
          <span class="song-index">${number(rankIndex + 1)}</span>
          <strong class="song-title">${escapeHtml(track.title)}</strong>
          <span class="song-artist">${escapeHtml(track.artist)}</span>
          <span class="song-plays">${number(plays)}</span>
          <span class="song-added">${escapeHtml(added)}</span>
          <span class="song-style"><i style="--c:${genreColors[style] || "#777166"}"></i>${escapeHtml(style)}</span>
          <span class="song-duration">${escapeHtml(track.duration || "")}</span>
          <span class="song-mobile-meta">${number(plays)} plays &middot; ${escapeHtml(added)} &middot; ${escapeHtml(track.duration || "")}</span>
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
        <span>Plays</span>
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
