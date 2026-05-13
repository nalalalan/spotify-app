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
  versionCount: document.querySelector("#versionCount"),
  songCount: document.querySelector("#songCount"),
  timeline: document.querySelector("#timeline"),
  songsTitle: document.querySelector("#songsTitle"),
  songsCoverage: document.querySelector("#songsCoverage"),
  songsList: document.querySelector("#songsList"),
};

const genreColors = {
  "K-pop": "#236b43",
  classical: "#335f7c",
  "pop/other": "#a84d55",
  score: "#8a6a2f",
  "novelty instrumental": "#7a5b9a",
  "long-form instrumental": "#4f6966",
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

function rankedTracks(version) {
  return [...version.tracks].sort((a, b) => {
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
  return `${number(version.recoveredTrackCount)} shown / ${number(version.trackCount)} verified`;
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
  renderGenreMix(version);
  renderSongs(version);
}

function renderGenreMix(version) {
  const mix = version.profile.genreMix.filter((genre) => genre.count > 0);
  els.mixCoverage.textContent = version.profile.genreBasis;
  els.mixBar.innerHTML = mix
    .map((genre) => {
      const color = genreColors[genre.name] || "#777166";
      return `<span style="--w:${genre.percent}%; --c:${color}" title="${escapeHtml(`${genre.name}: ${genre.percent}%`)}"></span>`;
    })
    .join("");
  els.mixLegend.innerHTML = mix
    .slice(0, 5)
    .map((genre) => {
      const color = genreColors[genre.name] || "#777166";
      return `
        <span class="mix-chip">
          <i style="--c:${color}"></i>
          ${escapeHtml(genre.name)} ${genre.percent}%
        </span>
      `;
    })
    .join("");
}

function renderSongs(version) {
  els.songsTitle.textContent = `${version.spotifyName} / ${version.profile.dateLabel}`;
  els.songsCoverage.textContent = coverageLine(version);
  const rows = rankedTracks(version)
    .map(
      (track, rankIndex) => `
        <a class="song-row" href="${track.spotifyUrl}" target="_blank" rel="noreferrer">
          <span class="song-index">${number(rankIndex + 1)}</span>
          <span class="song-main">
            <strong>${escapeHtml(track.title)}</strong>
            <span>${escapeHtml(track.artist)}</span>
          </span>
          <span class="song-duration">${escapeHtml(track.duration)}</span>
        </a>
      `,
    )
    .join("");
  const remaining = version.trackCount - version.recoveredTrackCount;
  const pending = remaining > 0 ? `<div class="song-row pending-row">${number(remaining)} more verified on Spotify</div>` : "";
  els.songsList.innerHTML = rows + pending;
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
