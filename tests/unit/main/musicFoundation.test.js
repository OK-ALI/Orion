const test = require("node:test");
const assert = require("node:assert/strict");

const { MUSIC_EXTENSIONS, MUSIC_PROVIDER_KINDS } = require("../../../src/shared/musicConstants.cjs");
const { fileFingerprint, stableId } = require("../../../src/main/music/library/metadataReader");
const { parseLyrics } = require("../../../src/main/music/library/lyrics");
const tokens = require("../../../src/main/music/playback/tokenRegistry");
const { safeCandidate } = require("../../../src/main/music/providers/ytdlp");
const { applyMigrations } = require("../../../src/main/music/migrations");
const providerRegistry = require("../../../src/main/music/providers/registry");
const { catalog: pluginCatalog } = require("../../../src/main/music/plugins/catalog");
const { candidateScore } = require("../../../src/main/music/playback/streamResolver");
const { portableValue } = require("../../../src/main/music/database");
const { parseJsonPlaylist, parseM3uPlaylist, serializeJsonPlaylist,
  serializeM3uPlaylist } = require("../../../src/main/music/library/playlistFiles");

test("music provider kinds mirror the capability host boundary", () => {
  assert.deepEqual(Object.values(MUSIC_PROVIDER_KINDS), [
    "metadata", "streaming", "lyrics", "dashboard", "playlists", "discovery", "scrobbling",
  ]);
});

test("local music identity is stable without exposing a path", () => {
  const first = stableId("C:\\Music\\Artist\\Track.flac");
  const second = stableId("c:\\music\\artist\\track.flac");
  assert.equal(first, second);
  assert.match(first, /^local:[a-f0-9]{32}$/);
  assert.equal(first.includes("Music"), false);
  assert.ok(MUSIC_EXTENSIONS.includes(".flac"));
});

test("LRC sidecars normalize into sorted synchronized lyrics", () => {
  assert.deepEqual(parseLyrics("[00:05.00]Second\n[00:01.50]First"), {
    type: "synced", source: "local",
    lines: [{ time: 1.5, text: "First" }, { time: 5, text: "Second" }],
  });
});

test("music protocol grants are opaque and expire", () => {
  const grant = tokens.createGrant({ kind: "local", filePath: "private.flac" }, 1000);
  assert.match(grant.url, /^orion-music:\/\/media\/[A-Za-z0-9_-]+$/);
  assert.equal(grant.url.includes("private.flac"), false);
  assert.equal(tokens.resolveGrant(grant.token).filePath, "private.flac");
  tokens.revokeAll();
  assert.equal(tokens.resolveGrant(grant.token), null);
});

test("yt-dlp candidates expose metadata but not executable arguments", () => {
  assert.deepEqual(safeCandidate({ id: "abcDEF_1234", title: "Track", duration: 123, channel: "Artist" }), {
    id: "abcDEF_1234", providerId: "ytdlp-streaming", title: "Track", artistName: "Artist",
    durationMs: 123000, thumbnail: null, artworkUrl: null,
  });
  assert.equal(safeCandidate({ id: "abcDEF_1234", thumbnails: [{ url: "small" }, { url: "large" }] }).thumbnail, "large");
  assert.equal(safeCandidate({ id: "https://example.com/injection" }), null);
});

test("music candidate ranking favors matching official audio and duration", () => {
  const track = { title: "Get Lucky", artistName: "Daft Punk", durationMs: 249000 };
  const official = candidateScore(track, { title: "Daft Punk - Get Lucky (Official Audio)", artistName: "Daft Punk", durationMs: 249000 });
  const cover = candidateScore(track, { title: "Get Lucky acoustic cover", artistName: "Another Artist", durationMs: 180000 });
  assert.ok(official > cover);
});

test("music database migrations are transactional and repeatable", () => {
  const { DatabaseSync } = require("node:sqlite");
  const database = new DatabaseSync(":memory:");
  assert.equal(applyMigrations(database), 3);
  assert.equal(applyMigrations(database), 3);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
  assert.ok(tables.includes("music_tracks"));
  assert.ok(tables.includes("music_playlists"));
  database.close();
});

test("local content fingerprints survive a path rename", async (context) => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "orion-music-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const first = path.join(directory, "first.flac");
  const renamed = path.join(directory, "renamed.flac");
  fs.writeFileSync(first, Buffer.from("same audio content"));
  const before = await fileFingerprint(first);
  fs.renameSync(first, renamed);
  assert.equal(await fileFingerprint(renamed), before);
});

test("provider health classifies and redacts failures", () => {
  providerRegistry.clear();
  providerRegistry.register({ id: "test-metadata", kind: "metadata", name: "Test", capabilities: [] });
  providerRegistry.recordFailure("test-metadata", new Error("HTTP 429 https://example.test/?token=secret"), 1200);
  const descriptor = providerRegistry.publicDescriptor(providerRegistry.get("test-metadata"));
  assert.equal(descriptor.health.status, "rate_limited");
  assert.equal(descriptor.health.lastError.includes("secret"), false);
  providerRegistry.clear();
});

test("curated plugin catalog mirrors Nuclear capability coverage without loading Nuclear code", () => {
  const names = pluginCatalog.map((plugin) => plugin.name);
  for (const expected of ["OmniSource", "Discogs", "YouTube", "Bandcamp", "SoundCloud", "Spotify", "Deezer Catalog", "MusicBrainz", "ListenBrainz Dashboard", "LRCLib Lyrics", "Last.fm", "YouTube Playlists", "KHInsider"]) {
    assert.ok(names.includes(expected), `${expected} is missing`);
  }
  assert.ok(pluginCatalog.every((plugin) => Array.isArray(plugin.permissions)));
  assert.equal(pluginCatalog.some((plugin) => /nuclear-plugin/.test(plugin.id)), false);
});



test("portable Music state removes machine paths, signed URLs, and credentials", () => {
  const value = portableValue({ id: "track-1", title: "Signal", filePath: "C:\\Private\\signal.flac",
    artworkUrl: "https://signed.example/secret", headers: { Authorization: "secret" },
    nested: { token: "secret", providerTrackId: "safe-id" } });
  assert.deepEqual(value, { id: "track-1", title: "Signal", nested: { providerTrackId: "safe-id" } });
});

test("Music playlists round-trip through validated JSON and extended M3U", () => {
  const playlist = { name: "Signals", description: "Test", items: [{ id: "yt-1", provider: "youtube",
    providerTrackId: "abc", title: "Orbit", artistName: "Orion", durationMs: 123000,
    artworkUrl: "https://signed.invalid/secret" }] };
  const jsonPlaylist = parseJsonPlaylist(serializeJsonPlaylist(playlist));
  assert.equal(jsonPlaylist.items[0].providerTrackId, "abc");
  assert.equal(jsonPlaylist.items[0].artworkUrl, undefined);
  const m3u = serializeM3uPlaylist(playlist);
  assert.match(m3u, /^#EXTM3U/);
  const m3uPlaylist = parseM3uPlaylist(m3u);
  assert.equal(m3uPlaylist.name, "Signals");
  assert.equal(m3uPlaylist.items[0].title, "Orbit");
});

test("Music playlist parsers reject unrelated or malformed files", () => {
  assert.throws(() => parseJsonPlaylist('{"items":"bad"}'), /not an Orion JSON playlist/i);
  assert.throws(() => parseM3uPlaylist("track.mp3"), /not a valid extended M3U/i);
});
