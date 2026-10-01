import { escapeHTML as esc, safeURL, filterReleases, formatDate, formatLabel, totalTracks, durationLabel } from "./catalog.js";

const grid = document.querySelector("#catalog-grid");
const status = document.querySelector("#catalog-status");
const search = document.querySelector("#catalog-search");
const filters = [...document.querySelectorAll(".filter")];
let releases = [];
let selectedFormat = "all";

function spotifyURL(item) {
  return safeURL(item.spotify_url || item.spotify_search_url, ["open.spotify.com"]);
}

function coverImage(release, loading = "lazy") {
  const src = safeURL(release.cover_url, ["mzstatic.com", "bcbits.com"]) || "./assets/cover-placeholder.svg";
  return `<img src="${esc(src)}" alt="Portada de ${esc(release.title)}" width="600" height="600" loading="${loading}" decoding="async">`;
}

function tracksHTML(release) {
  if (!(release.tracks?.length > 1)) return "";
  const tracks = release.tracks.map(track => {
    const url = spotifyURL(track) || safeURL(track.apple_music_url, ["music.apple.com"]);
    const title = `${esc(track.title)}${track.explicit ? '<span class="explicit-tag" aria-label="Contenido explícito">E</span>' : ""}`;
    const name = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(track.title)}: ${track.spotify_url ? "escuchar" : "buscar"} en Spotify">${title}</a>` : `<span>${title}</span>`;
    return `<li><span class="track-number">${esc(track.track_number)}</span>${name}<span class="track-duration">${durationLabel(track.duration_ms)}</span></li>`;
  }).join("");
  return `<details class="track-details"><summary>Ver canciones (${release.tracks.length})</summary><ol class="track-list">${tracks}</ol></details>`;
}

function releaseHTML(release) {
  const spotify = spotifyURL(release);
  const apple = safeURL(release.apple_music_url, ["music.apple.com"]);
  const primary = spotify || apple;
  const title = esc(release.title);
  const year = /^\d{4}/.test(release.release_date) ? release.release_date.slice(0, 4) : "";
  return `<article class="release-card"><a class="cover-link" href="${esc(primary)}" target="_blank" rel="noopener noreferrer" aria-label="${title}: ${release.spotify_url ? "escuchar" : "buscar"} en Spotify">${coverImage(release)}<span class="cover-play" aria-hidden="true">↗</span></a><div class="release-meta"><span class="format-tag">${formatLabel(release.format)}</span><time datetime="${esc(release.release_date)}">${formatDate(release.release_date) || year}</time></div><h3>${title}</h3><div class="release-links">${spotify ? `<a href="${esc(spotify)}" target="_blank" rel="noopener noreferrer">${release.spotify_url ? "Spotify" : "Buscar en Spotify"} ↗</a>` : ""}${apple ? `<a href="${esc(apple)}" target="_blank" rel="noopener noreferrer">Apple Music ↗</a>` : ""}</div>${tracksHTML(release)}</article>`;
}

function attachImageFallbacks(target) {
  for (const img of target.querySelectorAll("img")) img.addEventListener("error", () => {img.src = "./assets/cover-placeholder.svg";}, {once:true});
}

function renderCatalog() {
  const shown = filterReleases(releases, search.value, selectedFormat);
  grid.innerHTML = shown.map(releaseHTML).join("");
  document.querySelector("#catalog-empty").hidden = shown.length > 0;
  status.textContent = shown.length === releases.length ? `${releases.length} lanzamientos · Del más reciente al más antiguo` : `${shown.length} de ${releases.length} lanzamientos`;
  attachImageFallbacks(grid);
}

function renderLatest() {
  const latest = releases[0];
  if (!latest) return;
  const target = document.querySelector("#latest-release");
  target.innerHTML = `${coverImage(latest)}<div class="latest-meta"><p class="eyebrow">LO MÁS RECIENTE</p><h3>${esc(latest.title)}</h3></div><time class="latest-date" datetime="${esc(latest.release_date)}">${formatDate(latest.release_date)}</time><a class="text-link" href="${esc(spotifyURL(latest) || latest.apple_music_url)}" target="_blank" rel="noopener noreferrer">${latest.spotify_url ? "Escuchar" : "Buscar en Spotify"} ↗</a>`;
  target.hidden = false;
  attachImageFallbacks(target);
}

for (const button of filters) button.addEventListener("click", () => {
  selectedFormat = button.dataset.format;
  for (const filter of filters) {
    const active = filter === button;
    filter.classList.toggle("active", active);
    filter.setAttribute("aria-pressed", String(active));
  }
  renderCatalog();
});
search.addEventListener("input", renderCatalog);
document.querySelector("#year").textContent = new Date().getFullYear();

async function loadCatalog() {
  try {
    const response = await fetch(new URL("./data/auto-catalog.json", import.meta.url), {cache:"no-cache"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog.releases) || !catalog.releases.length) throw new Error("Catálogo no disponible");
    releases = [...new Map(catalog.releases.filter(item => item.artist === "Sirensence" && item.title && item.source_id).map(item => [item.source_id,item])).values()].sort((a,b) => (b.release_date || "").localeCompare(a.release_date || "") || a.title.localeCompare(b.title, "es"));
    if (!releases.length) throw new Error("Sin lanzamientos de Sirensence");
    document.querySelector("#release-count").textContent = releases.length;
    document.querySelector("#track-count").textContent = totalTracks(releases);
    const updated = new Date(catalog.updated_at);
    if (!Number.isNaN(updated.getTime())) document.querySelector("#catalog-updated").textContent = `Última modificación del catálogo: ${new Intl.DateTimeFormat("es-MX",{dateStyle:"long",timeZone:"America/Matamoros"}).format(updated)}.`;
    renderCatalog();
    renderLatest();
  } catch (error) {
    status.innerHTML = 'No pudimos cargar el catálogo. <a href="https://open.spotify.com/artist/4KYUjMtt4WTOqNm32dv2CO" target="_blank" rel="noopener noreferrer">Escucha Sirensence en Spotify ↗</a>';
    console.error("El catálogo no se pudo cargar:",error);
  }
}
loadCatalog();
