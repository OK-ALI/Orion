"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const sharedRoot = path.resolve(mobileRoot, "..", "..", "packages", "shared", "src");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readShared = (relative) => fs.readFileSync(path.join(sharedRoot, relative), "utf8");

test("P8.4 C3-B defines Watched namespace signatures and tombstones without cloud I/O", () => {
  const portable = readShared("types/portableWatchedSync.ts");
  assert.match(portable, /portableWatchedPreviewSignatureV1/);
  assert.match(portable, /portableWatchedNamespaceSignatureV1/);
  assert.match(portable, /buildPortableWatchedSteadyStateProfileV1/);
  assert.match(portable, /deletedAt: now[\s\S]*value: null/);
  assert.match(portable, /\.\.\.baseProfile\.namespaces,[\s\S]*watched:\s*\{/);
  assert.doesNotMatch(portable, /CloudProfileStore|GoogleDriveCloudProfileStore|store\.write|appDataFolder|accessToken|refreshToken/i);
});

test("P8.4 C3-B Mobile preview and apply adapter keep exact episodes portable and series summaries local", () => {
  const preview = read("src/features/library/viewingStatePortableAdapter.ts");
  const apply = read("src/features/library/watchedSyncAdapter.ts");

  assert.match(preview, /buildMobilePortableWatchedPreviewV1/);
  assert.match(preview, /if \(raw\.is_series_summary \|\| raw\.derived_from_episodes\) \{[\s\S]*?continue;[\s\S]*?\}/);
  assert.doesNotMatch(preview, /derived-series-summary/);
  assert.match(preview, /malformed-watched-record/);
  assert.match(preview, /non-portable-watched-identity/);
  assert.match(apply, /buildLocalMobileWatchedSnapshotV1/);
  assert.match(apply, /series_id: media\.id/);
  assert.match(apply, /season_number: media\.season/);
  assert.match(apply, /episode_number: media\.episode/);
  assert.doesNotMatch(apply, /is_series_summary\s*:\s*true|derived_from_episodes\s*:\s*true/);
  assert.doesNotMatch(apply, /CloudProfileStore|GoogleDriveCloudProfileStore|store\.write|mmkvStorageAdapter\.(?:set|remove)/);
});
