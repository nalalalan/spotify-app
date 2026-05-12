const state = {
  data: null,
  selectedVersion: 13,
  selectedChange: 12,
  changeTab: "added",
  query: "",
};

const els = {
  versionCount: document.querySelector("#versionCount"),
  latestCount: document.querySelector("#latestCount"),
  uniqueCount: document.querySelector("#uniqueCount"),
  placementCount: document.querySelector("#placementCount"),
  sourceTime: document.querySelector("#sourceTime"),
  analysisHeadline: document.querySelector("#analysisHeadline"),
  analysisPoints: document.querySelector("#analysisPoints"),
  analysisBoundary: document.querySelector("#analysisBoundary"),
  versionButtons: document.querySelector("#versionButtons"),
  versionRange: document.querySelector("#versionRange"),
  coverArt: document.querySelector("#coverArt"),
  selectedLabel: document.querySelector("#selectedLabel"),
  selectedName: document.querySelector("#selectedName"),
  openSpotify: document.querySelector("#openSpotify"),
  showLatest: document.querySelector("#showLatest"),
  selectedTrackCount: document.querySelector("#selectedTrackCount"),
  selectedDate: document.querySelector("#selectedDate"),
  selectedAdded: document.querySelector("#selectedAdded"),
  selectedKept: document.querySelector("#selectedKept"),
  artistBand: document.querySelector("#artistBand"),
  playlistReading: document.querySelector("#playlistReading"),
  vibeTags: document.querySelector("#vibeTags"),
  genreMix: document.querySelector("#genreMix"),
  trackSearch: document.querySelector("#trackSearch"),
  trackList: document.querySelector("#trackList"),
  changeLabel: document.querySelector("#changeLabel"),
  addedCount: document.querySelector("#addedCount"),
  removedCount: document.querySelector("#removedCount"),
  keptCount: document.querySelector("#keptCount"),
  movedCount: document.querySelector("#movedCount"),
  changeFocus: document.querySelector("#changeFocus"),
  changeList: document.querySelector("#changeList"),
  changeChain: document.querySelector("#changeChain"),
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

function sourceTime(value) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return formatter.format(new Date(value));
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

function selectedChange() {
  return state.data.changes.find((change) => change.to === state.selectedChange + 1 || change.to === state.selectedVersion);
}

function changeForVersion(versionNumber) {
  return state.data.changes.find((change) => change.to === versionNumber);
}

function renderSummary() {
  const { summary, versions, generatedAt } = state.data;
  els.versionCount.textContent = number(summary.versionCount);
  els.latestCount.textContent = number(summary.latestTrackCount);
  els.uniqueCount.textContent = number(summary.uniqueTrackCount);
  els.placementCount.textContent = number(summary.totalTrackPlacements);
  els.versionRange.textContent = `v${versions[0].version}-v${versions.at(-1).version}`;
  els.sourceTime.textContent = sourceTime(generatedAt);
  els.analysisHeadline.textContent = summary.analysis.headline;
  els.analysisPoints.innerHTML = summary.analysis.points
    .map((point, index) => {
      return `<div class="analysis-point"><span>${index + 1}</span><p>${escapeHtml(point)}</p></div>`;
    })
    .join("");
  els.analysisBoundary.textContent = summary.analysis.sourceBoundary;
}

function renderVersionButtons() {
  els.versionButtons.innerHTML = state.data.versions
    .map((version) => {
      const active = version.version === state.selectedVersion ? " active" : "";
      return `
        <button class="version-button${active}" type="button" data-version="${version.version}">
          <span class="version-num">v${version.version}</span>
          <span class="version-name">${escapeHtml(version.spotifyName)}</span>
          <span class="version-count">${version.trackCount}</span>
        </button>
      `;
    })
    .join("");
}

function renderArtistBand(version) {
  els.artistBand.innerHTML = byArtist(version.tracks)
    .slice(0, 8)
    .map((artist) => `<span class="artist-chip"><strong>${escapeHtml(artist.name)}</strong> ${artist.count}</span>`)
    .join("");
}

function renderPlaylistProfile(version) {
  const profile = version.profile;
  els.playlistReading.textContent = profile.reading;
  els.selectedDate.textContent = profile.dateLabel;
  els.vibeTags.innerHTML = profile.vibeTags.length
    ? profile.vibeTags.map((tag) => `<span class="vibe-tag">${escapeHtml(tag)}</span>`).join("")
    : `<span class="vibe-tag">mixed</span>`;
  els.genreMix.innerHTML = profile.genreMix
    .slice(0, 5)
    .map((genre) => {
      return `<span class="genre-pill"><strong>${escapeHtml(genre.name)}</strong> ${genre.percent}%</span>`;
    })
    .join("");
}

function renderTrackList(version) {
  const query = state.query.trim().toLowerCase();
  const tracks = query
    ? version.tracks.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(query))
    : version.tracks;

  if (!tracks.length) {
    els.trackList.innerHTML = `<div class="empty">No matching tracks.</div>`;
    return;
  }

  els.trackList.innerHTML = tracks
    .map(
      (track) => `
        <a class="track-row" href="${track.spotifyUrl}" target="_blank" rel="noreferrer">
          <span class="track-index">${track.index}</span>
          <span>
            <span class="track-title">${escapeHtml(track.title)}</span>
            <span class="track-artist">${escapeHtml(track.artist)}</span>
          </span>
          <span class="track-duration">${escapeHtml(track.duration)}</span>
        </a>
      `,
    )
    .join("");
}

function renderSelectedVersion() {
  const version = selectedVersion();
  const change = changeForVersion(version.version);

  els.coverArt.src = version.coverArt;
  els.coverArt.alt = `${version.spotifyName} cover`;
  els.selectedLabel.textContent = `v${version.version}`;
  els.selectedName.textContent = version.spotifyName;
  els.openSpotify.href = version.spotifyUrl;
  els.selectedTrackCount.textContent = number(version.trackCount);
  els.selectedAdded.textContent = change ? number(change.addedCount) : "0";
  els.selectedKept.textContent = change ? number(change.keptCount) : "0";

  renderArtistBand(version);
  renderPlaylistProfile(version);
  renderTrackList(version);
}

function renderChangeStats(change) {
  els.changeLabel.textContent = change ? change.label : "v1";
  els.addedCount.textContent = change ? number(change.addedCount) : "0";
  els.removedCount.textContent = change ? number(change.removedCount) : "0";
  els.keptCount.textContent = change ? number(change.keptCount) : "0";
  els.movedCount.textContent = change ? number(change.movedCount) : "0";
  els.changeFocus.innerHTML = change?.focus?.length
    ? change.focus.map((line) => `<div class="focus-line">${escapeHtml(line)}</div>`).join("")
    : `<div class="focus-line">Starting version</div>`;
}

function renderChangeList(change) {
  if (!change) {
    els.changeList.innerHTML = `<div class="empty">No previous version.</div>`;
    return;
  }

  const items = change[state.changeTab] || [];
  if (!items.length) {
    els.changeList.innerHTML = `<div class="empty">No ${state.changeTab} tracks.</div>`;
    return;
  }

  els.changeList.innerHTML = items
    .map((track) => {
      const tag =
        state.changeTab === "moved"
          ? `${track.fromIndex}->${track.toIndex}`
          : state.changeTab === "added"
            ? `+${track.index}`
            : `-${track.index}`;
      return `
        <div class="change-item">
          <span class="change-tag">${tag}</span>
          <span>
            <strong>${escapeHtml(track.title)}</strong>
            <span>${escapeHtml(track.artist)}</span>
          </span>
        </div>
      `;
    })
    .join("");
}

function renderChain() {
  els.changeChain.innerHTML = state.data.changes
    .map((change) => {
      const active = change.to === state.selectedVersion ? " active" : "";
      return `
        <button class="chain-button${active}" type="button" data-chain-version="${change.to}">
          <strong>${change.label}</strong>
          <span>+${change.addedCount} / -${change.removedCount} / kept ${change.keptCount}</span>
        </button>
      `;
    })
    .join("");
}

function renderChangePanel() {
  const change = changeForVersion(state.selectedVersion);
  renderChangeStats(change);
  renderChangeList(change);
  renderChain();
}

function render() {
  renderSummary();
  renderVersionButtons();
  renderSelectedVersion();
  renderChangePanel();
}

document.addEventListener("click", (event) => {
  const versionButton = event.target.closest("[data-version]");
  if (versionButton) {
    state.selectedVersion = Number(versionButton.dataset.version);
    state.query = "";
    els.trackSearch.value = "";
    render();
    return;
  }

  const chainButton = event.target.closest("[data-chain-version]");
  if (chainButton) {
    state.selectedVersion = Number(chainButton.dataset.chainVersion);
    state.query = "";
    els.trackSearch.value = "";
    render();
    return;
  }

  const tabButton = event.target.closest("[data-change-tab]");
  if (tabButton) {
    state.changeTab = tabButton.dataset.changeTab;
    document.querySelectorAll("[data-change-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.changeTab === state.changeTab);
    });
    renderChangePanel();
  }
});

els.trackSearch.addEventListener("input", () => {
  state.query = els.trackSearch.value;
  renderTrackList(selectedVersion());
});

els.showLatest.addEventListener("click", () => {
  state.selectedVersion = state.data.summary.latestVersion;
  state.query = "";
  els.trackSearch.value = "";
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
    document.body.innerHTML = `<main class="empty">Playlist snapshot failed to load: ${error.message}</main>`;
  });
