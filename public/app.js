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
  versionCount: document.querySelector("#versionCount"),
  songCount: document.querySelector("#songCount"),
  timeline: document.querySelector("#timeline"),
  selectedSummary: document.querySelector("#selectedSummary"),
  changeSummary: document.querySelector("#changeSummary"),
};

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

function renderOverview(version) {
  const change = changeForVersion(version.version);
  els.currentCover.src = version.coverArt;
  els.currentCover.alt = `${version.spotifyName} cover`;
  els.rangeLabel.textContent = dateRange();
  els.currentTitle.textContent = version.spotifyName;
  els.currentDate.textContent = version.profile.dateLabel;
  els.currentTracks.textContent = `${number(version.trackCount)} songs`;
  els.currentArtists.textContent = topArtistLine(version);
  els.openSpotify.href = version.spotifyUrl;
  els.selectedSummary.textContent = `v${version.version} / ${version.profile.dateLabel} / ${number(version.trackCount)} songs`;
  els.changeSummary.textContent = change
    ? `${number(change.addedCount)} new / ${number(change.keptCount)} carried`
    : "Starting point";
}

function renderTimeline() {
  els.versionCount.textContent = `${number(state.data.summary.versionCount)} versions`;
  els.songCount.textContent = `${number(state.data.summary.uniqueTrackCount)} songs`;
  els.timeline.innerHTML = state.data.versions
    .map((version) => {
      const active = version.version === state.selectedVersion ? " active" : "";
      return `
        <button class="timeline-card${active}" type="button" data-version="${version.version}" aria-label="Show ${escapeHtml(version.spotifyName)}">
          <img src="${version.coverArt}" alt="">
          <span class="version-id">v${version.version}</span>
          <strong>${escapeHtml(version.profile.dateLabel)}</strong>
          <span>${number(version.trackCount)} songs</span>
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
    state.selectedVersion = data.summary.latestVersion;
    render();
  })
  .catch((error) => {
    document.body.innerHTML = `<main class="empty">Playlist snapshot failed to load: ${escapeHtml(error.message)}</main>`;
  });
