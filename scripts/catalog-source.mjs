import { setTimeout as wait } from "node:timers/promises";
import { normalize, safeURL } from "../catalog.js";

export function cleanTitle(title) {
  return String(title).replace(/\s+-\s+(single|ep)$/i, "").replace(/\s+ep$/i, "").trim();
}

export function releaseFormat(collection) {
  if (/\s+-\s+ep$/i.test(collection.collectionName)) return "EP";
  if (/\s+-\s+single$/i.test(collection.collectionName) || collection.trackCount === 1) return "Single";
  return collection.trackCount <= 6 ? "EP" : "Álbum";
}

export async function fetchJSON(url, attempt = 1) {
  let response;
  try {
    response = await fetch(url, {headers:{"User-Agent":"SirensenceCatalog/1.0"}, signal:AbortSignal.timeout(25000)});
  } catch (error) {
    if (attempt >= 4) throw error;
    await wait(attempt * 3000);
    return fetchJSON(url, attempt + 1);
  }
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Math.min(Number(response.headers.get("retry-after")) || attempt * 3, 30);
    await wait(retryAfter * 1000);
    return fetchJSON(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`La fuente pública respondió ${response.status}.`);
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error("Respuesta de catálogo inválida.");
  return data;
}

export function lookupURL(id, entity, market = "MX") {
  const url = new URL("https://itunes.apple.com/lookup");
  url.search = new URLSearchParams({id:String(id), entity, limit:"200", country:market.toLowerCase()});
  return url.href;
}

export function mapRelease(collection, source, links) {
  const title = cleanTitle(collection.collectionName);
  const id = String(collection.collectionId);
  return {
    source_id:`apple:${id}`,
    apple_collection_id:id,
    title,
    artist:source.artist,
    spotify_url:safeURL(links.releases?.[id], ["open.spotify.com"]),
    spotify_search_url:`https://open.spotify.com/search/${encodeURIComponent(`${source.artist} ${title}`)}`,
    spotify_artist_url:source.spotify_artist_url,
    apple_music_url:safeURL(collection.collectionViewUrl, ["music.apple.com"]),
    cover_url:safeURL(collection.artworkUrl100?.replace(/\/100x100bb(?:\.[a-z]+)?$/i, "/600x600bb.jpg"), ["mzstatic.com"]),
    format:releaseFormat(collection),
    release_date:collection.releaseDate?.slice(0, 10) || "",
    total_tracks:collection.trackCount || 0,
    tracks:[]
  };
}

export function mapTrack(track, release, links) {
  const manual = (links.tracks?.[release.apple_collection_id] || []).find(item => item.track_number === track.trackNumber && normalize(item.title) === normalize(track.trackName));
  return {
    apple_track_id:String(track.trackId),
    track_number:track.trackNumber,
    title:track.trackName,
    duration_ms:track.trackTimeMillis || 0,
    explicit:track.trackExplicitness === "explicit",
    spotify_url:safeURL(manual?.spotify_url, ["open.spotify.com"]),
    spotify_search_url:`https://open.spotify.com/search/${encodeURIComponent(`${release.artist} ${track.trackName}`)}`,
    apple_music_url:safeURL(track.trackViewUrl, ["music.apple.com"])
  };
}

export async function buildCatalog(sources, links, previous, {fetcher = fetchJSON, pause = wait, pauseMs = 3100, now = () => new Date().toISOString()} = {}) {
  if (sources.length !== 1 || sources[0].artist !== "Sirensence") throw new Error("Este sitio debe sincronizar únicamente Sirensence.");
  const market = "MX";
  const source = sources[0];
  const data = await fetcher(lookupURL(source.apple_artist_id, "album", market));
  if (!data.results.some(item => item.wrapperType === "artist" && Number(item.artistId) === Number(source.apple_artist_id))) throw new Error("No se pudo verificar la identidad del artista en la fuente.");
  const collections = data.results.filter(item => item.wrapperType === "collection" && Number(item.artistId) === Number(source.apple_artist_id) && item.collectionId && item.collectionName);
  if (!collections.length) throw new Error("La fuente no devolvió lanzamientos; se conserva el catálogo publicado.");
  const incoming = [];
  for (const collection of collections) {
    await pause(pauseMs);
    const release = mapRelease(collection, source, links);
    const trackData = await fetcher(lookupURL(collection.collectionId, "song", market));
    const tracks = trackData.results.filter(item => item.wrapperType === "track" && item.kind === "song" && Number(item.collectionId) === Number(collection.collectionId));
    if (!tracks.length || tracks.length !== release.total_tracks) throw new Error(`Lista de canciones incompleta para ${release.title}; no se publica una actualización parcial.`);
    release.tracks = tracks.map(track => mapTrack(track, release, links)).sort((a,b) => a.track_number - b.track_number);
    incoming.push(release);
  }
  // Preserve historical entries if a region/feed temporarily omits a release.
  const merged = new Map((previous?.releases || []).filter(item => item.artist === "Sirensence").map(item => [item.source_id, item]));
  for (const release of incoming) {
    // Reconcile a Spotify-first entry when the Apple feed catches up.
    const retained = merged.get(release.source_id) || [...merged.values()].find(item =>
      item.source_id.startsWith("spotify:") &&
      normalize(cleanTitle(item.title)) === normalize(release.title) &&
      item.release_date === release.release_date
    );
    if (retained) {
      if (!release.spotify_url) release.spotify_url = safeURL(retained.spotify_url, ["open.spotify.com"]);
      for (const track of release.tracks) {
        const previousTrack = (retained.tracks || []).find(item =>
          item.track_number === track.track_number && normalize(item.title) === normalize(track.title)
        );
        if (!track.spotify_url) track.spotify_url = safeURL(previousTrack?.spotify_url, ["open.spotify.com"]);
      }
      if (retained.source_id !== release.source_id) merged.delete(retained.source_id);
    }
    merged.set(release.source_id, release);
  }
  const releases = [...merged.values()].sort((a,b) => b.release_date.localeCompare(a.release_date) || a.title.localeCompare(b.title, "es"));
  const content = {schema_version:2, market, releases};
  const previousContent = previous ? {schema_version:previous.schema_version, market:previous.market, releases:previous.releases} : null;
  const changed = JSON.stringify(content) !== JSON.stringify(previousContent);
  return {...content, updated_at:changed ? now() : previous.updated_at};
}
