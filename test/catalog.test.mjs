import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalize, escapeHTML, safeURL, filterReleases, totalTracks, durationLabel } from "../catalog.js";
import { cleanTitle, releaseFormat, buildCatalog, mapTrack } from "../scripts/catalog-source.mjs";

const catalog = JSON.parse(await readFile(new URL("../data/auto-catalog.json", import.meta.url), "utf8"));
const links = JSON.parse(await readFile(new URL("../data/manual-links.json", import.meta.url), "utf8"));
const source = {artist:"Sirensence", apple_artist_id:1792750613, spotify_artist_url:"https://open.spotify.com/artist/4KYUjMtt4WTOqNm32dv2CO"};

test("seed has only Sirensence, unique releases, and direct Spotify links", () => {
  assert.ok(catalog.releases.length >= 13);
  assert.ok(catalog.releases.every(item => item.artist === "Sirensence"));
  assert.equal(new Set(catalog.releases.map(item => item.source_id)).size, catalog.releases.length);
  assert.ok(catalog.releases.every(item => /^https:\/\/open\.spotify\.com\/(intl-es\/)?(album|search)\//.test(item.spotify_url || item.spotify_search_url)));
});

test("search also finds individual songs, without accent/case sensitivity", () => {
  assert.equal(filterReleases(catalog.releases, "sweet shooting star")[0].title, "My Little Siren");
  assert.ok(filterReleases(catalog.releases, "", "Álbum").every(item => item.format === "Álbum"));
  assert.equal(filterReleases(catalog.releases, "not-a-song-zz").length, 0);
  assert.equal(normalize("  CANCIÓN  "), "cancion");
});

test("safe markup and display helpers", () => {
  assert.equal(safeURL("javascript:alert(1)"), "");
  assert.equal(safeURL("https://open.spotify.com.evil.test/", ["open.spotify.com"]), "");
  assert.equal(escapeHTML('<script a="x">&'), "&lt;script a=&quot;x&quot;&gt;&amp;");
  assert.equal(durationLabel(193000), "3:13");
  assert.ok(totalTracks(catalog.releases) >= 54);
  assert.equal(totalTracks([{total_tracks:5},{total_tracks:20},{tracks:[{},{},{}]}]), 28);
  assert.equal(cleanTitle("My Little Siren - EP"), "My Little Siren");
  assert.equal(releaseFormat({collectionName:"Two - Single",trackCount:2}), "Single");
});

test("track links match both title and position", () => {
  const release = catalog.releases.find(item => item.title === "My Little Siren");
  const track = mapTrack({trackId:1, trackNumber:2, trackName:"Sweet Shooting Star", trackTimeMillis:161000},release,links);
  assert.match(track.spotify_url, /39msqqcYMKHGtqKyRCrnao/);
  assert.equal(mapTrack({trackId:2, trackNumber:2, trackName:"Different song"},release,links).spotify_url, "");
});

test("new releases and songs are added; feed omissions preserve published history", async () => {
  const fetcher = async url => new URL(url).searchParams.get("entity") === "album"
    ? {results:[{wrapperType:"artist",artistId:source.apple_artist_id},{wrapperType:"collection",artistId:source.apple_artist_id,collectionId:999,collectionName:"New Song - Single",trackCount:1,releaseDate:"2026-10-01T00:00:00Z"}]}
    : {results:[{wrapperType:"track",kind:"song",collectionId:999,trackId:1,trackName:"New Song",trackNumber:1,trackTimeMillis:150000}]};
  const next = await buildCatalog([source], links, catalog, {fetcher,pause:async()=>{},now:()=>"fixed"});
  assert.equal(next.releases.length, catalog.releases.length + 1);
  const added = next.releases.find(item => item.source_id === "apple:999");
  assert.equal(added.title, "New Song");
  assert.equal(added.tracks[0].title, "New Song");
  assert.equal(added.spotify_url, "");
  assert.match(added.spotify_search_url, /New%20Song/);
  const stable = await buildCatalog([source], links, next, {fetcher,pause:async()=>{},now:()=>"different"});
  assert.equal(stable.updated_at, "fixed");
});

test("bad identity, empty feeds and incomplete track lists stop the update", async () => {
  await assert.rejects(buildCatalog([source],links,catalog,{fetcher:async()=>({results:[]}),pause:async()=>{}}),/identidad/);
  await assert.rejects(buildCatalog([source],links,catalog,{fetcher:async()=>({results:[{wrapperType:"artist",artistId:source.apple_artist_id}]}),pause:async()=>{}}),/no devolvió/);
  const fetcher = async url => new URL(url).searchParams.get("entity") === "album"
    ? {results:[{wrapperType:"artist",artistId:source.apple_artist_id},{wrapperType:"collection",artistId:source.apple_artist_id,collectionId:1,collectionName:"Incomplete",trackCount:2}]}
    : {results:[{wrapperType:"track",kind:"song",collectionId:1,trackId:1,trackName:"Only track",trackNumber:1}]};
  await assert.rejects(buildCatalog([source],links,catalog,{fetcher,pause:async()=>{}}),/incompleta/);
});
