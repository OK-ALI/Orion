const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repo = path.resolve(__dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(repo, relative), "utf8");

function requireMethod(source, method, label) {
  assert.match(
    source,
    new RegExp(`\\b(?:async\\s+)?${method}\\s*\\(`),
    `${label} must preserve ${method}() evidence`,
  );
}

test("P3.2 models the executable capability surface proven by Local/Core and YouTube Music", () => {
  const shared = read("packages/shared/src/music/capabilities.ts");
  const local = read("apps/desktop/src/main/music/providers/local.js");
  const ytmusic = read("apps/desktop/src/main/music/providers/ytmusic.js");

  for (const contract of [
    "MusicSearchCapability",
    "MusicSearchContinuationCapability",
    "MusicSearchSuggestionCapability",
    "MusicArtistDetailCapability",
    "MusicAlbumDetailCapability",
    "MusicPlaylistDetailCapability",
    "MusicRadioCapability",
    "MusicDashboardCapability",
    "MusicLyricsCapability",
    "MusicStreamingCapability",
    "MusicMetadataProvider",
    "MusicLyricsProvider",
    "MusicDashboardProvider",
    "MusicStreamingProvider",
  ]) {
    assert.match(shared, new RegExp(`export interface ${contract}\\b`));
  }

  for (const method of ["search", "getArtist", "getAlbum"]) {
    requireMethod(local, method, "Local/Core metadata");
  }
  for (const method of ["searchForTrack", "resolveCandidate"]) {
    requireMethod(local, method, "Local/Core streaming");
  }
  requireMethod(local, "getLyrics", "Local/Core lyrics");

  for (const method of [
    "search",
    "continueSearch",
    "getSuggestions",
    "getArtist",
    "getAlbum",
    "getPlaylist",
    "getRadio",
    "searchForTrack",
    "resolveCandidate",
    "getDashboard",
  ]) {
    requireMethod(ytmusic, method, "YouTube Music");
  }
});

test("P3.2 locks LRCLib lyrics and Spotify Charts dashboard into shared capability contracts", () => {
  const shared = read("packages/shared/src/music/capabilities.ts");
  const lrclib = read("apps/desktop/src/main/music/providers/lrclib.js");
  const spotify = read("apps/desktop/src/main/music/providers/spotifyCharts.js");

  requireMethod(lrclib, "getLyrics", "LRCLib");
  requireMethod(spotify, "getDashboard", "Spotify Charts");

  assert.match(shared, /getLyrics\([\s\S]*?Promise<MusicLyrics \| null>/);
  assert.match(shared, /getDashboard\([\s\S]*?Promise<MusicDashboardResult>/);
});

test("P3.2 keeps streaming resolution generic so Phase 3 does not own playback transport", () => {
  const shared = read("packages/shared/src/music/capabilities.ts");

  assert.match(shared, /TResolved = unknown/);
  assert.match(shared, /resolveCandidate\([\s\S]*?\): Promise<TResolved>/);
  assert.match(shared, /export interface MusicStreamCandidate\b/);

  assert.doesNotMatch(
    shared,
    /filePath|encryptedMediaUrl|http_headers|playbackUrl|NativeModules|child_process|fetch\s*\(|axios|writePortableProfile|AudioEngine/i,
  );
});

test("P3.2 publishes capability contracts through the existing shared music owner only", () => {
  const index = read("packages/shared/src/music/index.ts");
  const waven = read("apps/waven/src/domain/music.ts");

  assert.match(index, /export \* from "\.\/capabilities";/);
  assert.equal(
    waven.trim(),
    '/** WAVEN consumes the ecosystem-owned, platform-neutral music contracts. */\nexport * from "@orion/shared/music";',
  );
  assert.doesNotMatch(waven, /interface\s+Music|type\s+Music|class\s+Music/);
});
