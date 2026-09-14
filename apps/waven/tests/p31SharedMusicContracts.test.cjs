const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repo = path.resolve(__dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(repo, relative), "utf8");

function quotedValues(block) {
  return [...block.matchAll(/"([a-z0-9_-]+)"/g)].map((match) => match[1]);
}

function arrayBlock(source, constantName) {
  const match = source.match(new RegExp(`export const ${constantName} = \\[([\\s\\S]*?)\\] as const;`));
  assert.ok(match, `${constantName} must be declared as a readonly literal array`);
  return match[1];
}

test("P3.1 shares the locked Music Planet provider-kind boundary without touching runtime providers", () => {
  const shared = read("packages/shared/src/music/providers.ts");
  const desktop = read("apps/desktop/src/shared/musicConstants.cjs");

  const sharedKinds = quotedValues(arrayBlock(shared, "MUSIC_PROVIDER_KINDS"));
  const desktopBlock = desktop.match(/MUSIC_PROVIDER_KINDS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(desktopBlock, "Desktop provider-kind evidence must remain present");
  const desktopKinds = [...desktopBlock[1].matchAll(/:\s*"([a-z0-9_-]+)"/g)].map((match) => match[1]);

  assert.deepEqual(sharedKinds, desktopKinds);
  assert.deepEqual(sharedKinds, [
    "metadata", "streaming", "lyrics", "dashboard", "playlists", "discovery", "scrobbling",
  ]);
  assert.doesNotMatch(shared, /electron|react-native|NativeModules|child_process|yt-dlp|filePath|Orion Cloud/i);
});

test("P3.1 defines provider-neutral Track, Artist, Album, Playlist, artwork and source identities", () => {
  const entities = read("packages/shared/src/music/entities.ts");

  for (const contract of [
    "MusicSourceRef",
    "MusicArtworkRef",
    "MusicTrack",
    "MusicArtist",
    "MusicAlbum",
    "MusicPlaylist",
    "MusicSearchResult",
    "MusicDashboardSection",
    "MusicLyrics",
  ]) {
    assert.match(entities, new RegExp(`export interface ${contract}\\b`));
  }

  assert.match(entities, /providerTrackId\?: string \| null/);
  assert.match(entities, /providerRefs\?: readonly MusicProviderRef\[\]/);
  assert.match(entities, /source: MusicSourceRef/);
  assert.doesNotMatch(entities, /electron|react-native|NativeModules|child_process|filePath|Orion Cloud/i);
});

test("P3.1 provider descriptors preserve Music Planet public health and capability fields", () => {
  const providers = read("packages/shared/src/music/providers.ts");
  for (const field of [
    "id: string",
    "name: string",
    "kind: MusicProviderKind",
    "pluginId: string | null",
    "capabilities: readonly MusicProviderCapability[]",
    "firstParty: boolean",
    "requiresConfiguration: boolean",
    "configured: boolean",
    "pairedStreamingProviderId: string | null",
    "health: MusicProviderHealth",
  ]) assert.ok(providers.includes(field), `missing provider descriptor field: ${field}`);
});

test("P3.1 publishes one shared music owner and WAVEN consumes it instead of duplicating contracts", () => {
  const packageJson = JSON.parse(read("packages/shared/package.json"));
  const sharedIndex = read("packages/shared/src/index.ts");
  const musicIndex = read("packages/shared/src/music/index.ts");
  const wavenDomain = read("apps/waven/src/domain/music.ts");

  assert.equal(packageJson.exports["./music"], "./src/music/index.ts");
  assert.match(sharedIndex, /export \* from "\.\/music"/);
  assert.match(musicIndex, /export \* from "\.\/entities"/);
  assert.match(musicIndex, /export \* from "\.\/providers"/);
  assert.equal(wavenDomain.trim(), '/** WAVEN consumes the ecosystem-owned, platform-neutral music contracts. */\nexport * from "@orion/shared/music";');
});

test("P3.1 stays contract-only and does not introduce provider implementations, playback, persistence or Cloud sync", () => {
  const files = [
    read("packages/shared/src/music/entities.ts"),
    read("packages/shared/src/music/providers.ts"),
    read("packages/shared/src/music/index.ts"),
    read("apps/waven/src/domain/music.ts"),
  ].join("\n");

  assert.doesNotMatch(files, /fetch\s*\(|axios|sqlite|mmkv|secure-store|AudioEngine|expo-audio|writePortableProfile|NativeModules/i);
});
