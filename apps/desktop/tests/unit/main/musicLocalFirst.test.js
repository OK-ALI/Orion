const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const vm = require("node:vm");

function load(relative, mocks) {
  const filename = path.resolve(__dirname, "../../../src/main/music", relative);
  const module = { exports: {} };
  const realRequire = Module.createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module, exports: module.exports, require: (id) => id in mocks ? mocks[id] : realRequire(id),
    Buffer, URL, Headers, AbortController, AbortSignal,
    fetch: async () => ({ status: 206, headers: new Headers({ "content-type": "audio/mpeg" }), body: { cancel: async () => {} } }),
    setTimeout, clearTimeout,
  }, { filename });
  return module.exports;
}

const localTrack = { id: "local:fixture", provider: "local", title: "Signal", artistName: "Orion" };
const remoteTrack = { id: "remote:fixture", provider: "ytmusic", title: "Signal", artistName: "Orion" };

function fixture({ missing = false, remoteMode = "success" } = {}) {
  const calls = [];
  const row = { id: localTrack.id, provider: "local", file_path: __filename, title: "Signal", missing,
    artwork_path: __filename, lyrics_text: "[00:01]Local words" };
  const database = { getPrivateTrack: (id) => id === localTrack.id ? row : null,
    listTracks: () => [localTrack], getState: (_, fallback) => fallback };
  const local = load("providers/local.js", { "../database": database }).createLocalProviders();
  const remote = { id: "ytmusic-streaming", kind: "streaming", name: "Remote",
    async searchForTrack() {
      calls.push("remote-search");
      if (remoteMode === "hang") return new Promise(() => {});
      if (remoteMode === "fail") throw new Error("Provider unavailable");
      return [{ ...remoteTrack, id: "remote-candidate" }];
    },
    async resolveCandidate() { calls.push("remote-resolve"); return { kind: "remote", url: "https://audio.test/song" }; },
  };
  const metadata = { id: "remote-metadata", kind: "metadata", name: "Remote", async search() {
    calls.push("remote-metadata");
    if (remoteMode === "fail") throw new Error("Provider unavailable");
    return { tracks: [], artists: [], albums: [], playlists: [] };
  } };
  const remoteLyrics = { id: "remote-lyrics", kind: "lyrics", name: "Remote lyrics", async getLyrics() {
    calls.push("remote-lyrics"); throw new Error("Lyrics provider unavailable");
  } };
  const all = [...local, remote, metadata, remoteLyrics];
  const registry = { list: (kind) => all.filter((provider) => !kind || provider.kind === kind),
    get: (id, kind) => all.find((provider) => provider.id === id && (!kind || provider.kind === kind)),
    getActive: (kind) => kind === "lyrics" ? remoteLyrics : remote,
    recordSuccess() {}, recordFailure() {}, cleanError: (message) => String(message) };
  const tokens = { createGrant: (resource) => { calls.push(`grant:${resource.kind}`); return { url: "http://127.0.0.1:1234/music/opaque", expiresAt: 99 }; } };
  const resolver = load("playback/streamResolver.js", { "../providers/registry": registry, "../database": database,
    "./tokenRegistry": tokens });
  const handlers = new Map();
  const broker = { async queryProviders(providers, method, args) {
    const results = [], errors = [];
    for (const provider of providers) {
      try { results.push({ providerId: provider.id, value: await provider[method](...args) }); }
      catch (error) { errors.push(`${provider.id}: ${error.message}`); }
    }
    return { results, errors };
  } };
  const artwork = { artworkUrlFor: (track) => track.artworkUrl,
    cacheRemoteArtwork: async (_, options) => {
      if (options?.localOnly) throw new Error("Artwork requires a connection.");
      calls.push("remote-artwork"); throw new Error("Unavailable");
    } };
  const ipc = load("ipc.js", { electron: { dialog: {}, ipcMain: { handle: (key, callback) => handlers.set(key, callback) } },
    "./database": database, "./providers/registry": registry, "./providers/requestBroker": broker,
    "./library/scanner": {}, "./library/watcher": {}, "./playback/streamResolver": resolver,
    "./playback/tokenRegistry": tokens, "./library/artworkCache": artwork,
    "../ipc/storageIpc": {}, "./plugins/manager": {} });
  ipc.register();
  const sender = {};
  const invoke = (channel, ...args) => handlers.get(channel)({ sender }, ...args);
  invoke("music:connection:set", "online");
  return { calls, resolver, invoke, handlers, row, database, registry };
}

for (const remoteMode of ["success", "fail", "hang"]) {
  test(`selected local track bypasses all remote discovery (${remoteMode})`, { timeout: 1000 }, async () => {
    const f = fixture({ remoteMode });
    const result = await f.resolver.resolveTrack(localTrack);
    assert.equal(result.candidate.providerId, "orion-local-streaming");
    assert.deepEqual(f.calls, ["grant:local"]);
    assert.match(result.url, /^http:\/\/127\.0\.0\.1/);
  });
}

test("missing local tracks fail locally even with an explicit remote override", async () => {
  const f = fixture({ missing: true });
  await assert.rejects(f.resolver.resolveTrack(localTrack, "ytmusic-streaming"), /local music file is missing/i);
  assert.deepEqual(f.calls, []);
});

test("unknown local records cannot be substituted by similarly named remote songs", async () => {
  const f = fixture();
  await assert.rejects(f.resolver.resolveTrack({ ...localTrack, id: "local:gone" }), /local music file is missing/i);
  assert.deepEqual(f.calls, []);
});

test("remote identity keeps remote discovery and excludes local candidates", async () => {
  const f = fixture();
  const result = await f.resolver.discoverCandidates(remoteTrack);
  assert.deepEqual(f.calls, ["remote-search"]);
  assert.equal(result.candidates[0].providerId, "ytmusic-streaming");
});

test("offline IPC resolves local grants but refuses remote playback and candidates", async () => {
  const f = fixture();
  f.invoke("music:connection:set", "offline");
  assert.equal((await f.invoke("music:tracks:stream", localTrack)).ok, true);
  assert.match((await f.invoke("music:tracks:stream", remoteTrack)).error, /connection/i);
  assert.match((await f.invoke("music:tracks:candidates", remoteTrack)).error, /connection/i);
  assert.deepEqual(f.calls, ["grant:local"]);
});

test("offline search queries local metadata only; unavailable remote is distinct from local empty", async () => {
  const f = fixture();
  f.invoke("music:connection:set", "offline");
  const result = await f.invoke("music:search", "Signal");
  assert.equal(result.results[0].value.tracks[0].id, localTrack.id);
  assert.equal(result.availability, "local-only");
  f.database.listTracks = () => [];
  const empty = await f.invoke("music:search", "Absent");
  assert.equal(empty.results.length, 0);
  assert.match(empty.errors.join(" "), /connection/i);
  assert.deepEqual(f.calls, []);
});

test("provider failure online is distinct from successful empty; local metadata survives", async () => {
  const failed = fixture({ remoteMode: "fail" });
  failed.invoke("music:connection:set", "online");
  const response = await failed.invoke("music:search", "Signal");
  assert.equal(response.results[0].value.tracks[0].provider, "local");
  assert.match(response.errors.join(" "), /Provider unavailable/);
  assert.notEqual(response.availability, "local-only");
  const successful = fixture();
  successful.database.listTracks = () => [];
  const empty = await successful.invoke("music:search", "Absent");
  assert.equal(empty.errors.length, 0);
  assert.equal(empty.results[0].value.tracks.length, 0);
});

test("local lyrics win before a preferred failing remote provider and offline asset fallbacks are truthful", async () => {
  const f = fixture();
  assert.equal((await f.invoke("music:lyrics:get", localTrack)).lyrics.lines[0].text, "Local words");
  assert.deepEqual(f.calls, []);
  f.invoke("music:connection:set", "offline");
  assert.equal((await f.invoke("music:artwork:get", localTrack)).ok, true);
  assert.match((await f.invoke("music:lyrics:get", remoteTrack)).error, /connection/i);
  assert.match((await f.invoke("music:artwork:get", { ...remoteTrack, artworkUrl: "https://ytimg.com/art.png" })).error, /connection/i);
  assert.deepEqual(f.calls, ["grant:artwork"]);
});

test("online remote lyrics failure is not reported as absent lyrics", async () => {
  const f = fixture();
  const result = await f.invoke("music:lyrics:get", remoteTrack);
  assert.match(result.error, /unavailable/i);
  assert.doesNotMatch(result.error, /no lyrics/i);
});

test("remote tracks retain their resolver, probe and grant path online", async () => {
  const f = fixture();
  const result = await f.resolver.resolveTrack(remoteTrack);
  assert.equal(result.candidate.providerId, "ytmusic-streaming");
  assert.deepEqual(f.calls, ["remote-search", "remote-resolve", "grant:remote"]);
});

test("offline remote actions return connection-required without provider work", async () => {
  const f = fixture();
  f.invoke("music:connection:set", "offline");
  for (const [channel, ...args] of [
    ["music:dashboard:get"], ["music:radio:get", remoteTrack], ["music:playlists:remote-list"],
    ["music:search:suggestions", "Signal"], ["music:search:continue", "Signal", "next"],
    ["music:details:get", "album", { id: "remote:album" }], ["music:playlists:import", "remote", "url"],
  ]) assert.match((await f.invoke(channel, ...args)).error, /connection/i, channel);
  const localDetails = await f.invoke("music:details:get", "artist", { name: "Orion", source: { provider: "orion-local-metadata" } });
  assert.equal(localDetails.value.tracks[0].id, localTrack.id);
  assert.deepEqual(f.calls, []);
});

test("a remote search completing after offline cannot publish remote results", async () => {
  const f = fixture();
  let complete;
  f.registry.get("remote-metadata").search = () => new Promise((resolve) => { complete = resolve; });
  const pending = f.invoke("music:search", "Signal");
  await new Promise((resolve) => setImmediate(resolve));
  f.invoke("music:connection:set", "offline");
  complete({ tracks: [remoteTrack] });
  const response = await pending;
  assert.equal(response.availability, "local-only");
  assert.equal(response.results[0].value.tracks.length, 1);
  assert.equal(response.results[0].value.tracks[0].provider, "local");
});

test("a failed remote search plus an empty local library is not a successful empty result", async () => {
  const f = fixture({ remoteMode: "fail" });
  f.database.listTracks = () => [];
  const response = await f.invoke("music:search", "Absent");
  assert.equal(response.results.length, 0);
  assert.match(response.errors.join(" "), /Provider unavailable/);
});

test("search keeps local and remote tracks with identical metadata as distinct identities", async () => {
  const f = fixture();
  f.registry.get("remote-metadata").search = async () => ({ tracks: [remoteTrack] });
  const response = await f.invoke("music:search", "Signal");
  const tracks = response.results[0].value.tracks;
  assert.equal(tracks.length, 2);
  assert.deepEqual(new Set(tracks.map((track) => track.provider)), new Set(["local", "ytmusic"]));
});

for (const state of ["checking", "reconnecting", "unknown"]) {
  test(`${state} is accepted without enabling remote Music; local grants and metadata survive`, async () => {
    const f = fixture();
    assert.equal(f.invoke("music:connection:set", state).ok, true);
    assert.equal((await f.invoke("music:tracks:stream", localTrack)).ok, true);
    assert.match((await f.invoke("music:tracks:stream", remoteTrack)).error, /connection/i);
    assert.match((await f.invoke("music:dashboard:get")).error, /connection/i);
    const result = await f.invoke("music:search", "Signal");
    assert.equal(result.availability, "local-only");
    assert.deepEqual(f.calls, ["grant:local"]);
    f.invoke("music:connection:set", "degraded");
    await f.invoke("music:search", "Signal");
    assert.ok(f.calls.includes("remote-metadata"));
  });
}
