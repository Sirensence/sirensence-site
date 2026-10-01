export function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[char]));
}

export function safeURL(value, allowedHosts) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") return "";
    if (allowedHosts && !allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return "";
    return url.href;
  } catch { return ""; }
}

export function filterReleases(releases, query = "", format = "all") {
  const search = normalize(query);
  return releases.filter(release => (format === "all" || release.format === format) && (!search || normalize([release.title, ...(release.tracks || []).map(track => track.title)].join(" ")).includes(search)));
}

export function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  return new Intl.DateTimeFormat("es-MX", {year:"numeric", month:"short", day:"numeric", timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
}

export function durationLabel(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "";
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatLabel(format) {
  return format === "Single" ? "Sencillo" : format === "EP" ? "EP" : "Álbum";
}

export function totalTracks(releases) {
  return releases.reduce((count, release) => count + (Number(release.total_tracks) || (release.tracks || []).length), 0);
}
