"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const sharedRoot = path.resolve(mobileRoot, "..", "..", "packages", "shared", "src");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readShared = (relative) => fs.readFileSync(path.join(sharedRoot, relative), "utf8");

test("P8.4 Candidate 1 defines provider-neutral portable watched, history and progress contracts", () => {
  const portable = readShared("types/portableViewingState.ts");
  const index = readShared("types/index.ts");

  assert.match(portable, /PORTABLE_VIEWING_STATE_SCHEMA_VERSION = 1/);
  assert.match(portable, /interface PortableWatchedValueV1/);
  assert.match(portable, /interface PortableHistoryValueV1/);
  assert.match(portable, /interface PortableProgressValueV1/);
  assert.match(portable, /verified: true/);
  assert.match(index, /export \* from "\.\/portableViewingState"/);

  assert.doesNotMatch(portable, /sourceId|sessionId|accessToken|refreshToken|resolvedUrl|providerUrl/);
  assert.doesNotMatch(portable, /mmkv|localStorage|CloudProfileStore|GoogleDrive/i);
});

test("P8.4 Candidate 1 keeps Continue Watching derived instead of creating another cloud namespace", () => {
  const profile = readShared("types/portableProfile.ts");
  const portable = readShared("types/portableViewingState.ts");

  assert.match(profile, /"history"[\s\S]*"watched"[\s\S]*"progress"/);
  assert.doesNotMatch(profile, /"continueWatching"/);
  assert.doesNotMatch(portable, /PortableContinueWatching/);
});

test("P8.4 Candidate 1 canonicalizes exact TV episode identity across Desktop and Mobile key shapes", () => {
  const portable = readShared("types/portableViewingState.ts");
  const mobile = read("src/features/library/viewingStatePortableAdapter.ts");

  assert.match(portable, /`tv_\$\{String\(id\)\}_s\$\{safeSeason\}_e\$\{safeEpisode\}`/);
  assert.match(portable, /Whole-series watched[\s\S]*derived locally/);
  assert.match(mobile, /portableViewingKey\(/);

  // Whole-series summaries are derived local state. They must remain outside
  // the portable Watched namespace without being classified as unsafe data.
  assert.match(
    mobile,
    /if \(raw\.is_series_summary \|\| raw\.derived_from_episodes\) \{[\s\S]*?continue;[\s\S]*?\}/,
  );
  assert.doesNotMatch(mobile, /derived-series-summary/);
});

test("P8.4 Candidate 1 Mobile preview exports only verified playback truth and strips device evidence", () => {
  const adapter = read("src/features/library/viewingStatePortableAdapter.ts");

  assert.match(adapter, /isVerifiedPlaybackEvidence\(raw\?\.evidence\)/);
  assert.match(adapter, /!text\(raw\?\.sessionId\)/);
  assert.match(adapter, /isVerifiedPlaybackEvidence\(normalized\.evidence\)/);
  assert.match(adapter, /watched-truth-supersedes-progress/);
  assert.match(adapter, /unverified-history/);
  assert.match(adapter, /unverified-progress/);

  const portableValueBuilds = adapter.slice(adapter.indexOf("function historyPreview"));
  assert.doesNotMatch(portableValueBuilds, /sourceId:\s*normalized\.sourceId|sessionId:\s*normalized\.sessionId|evidence:\s*normalized\.evidence/);
});

test("P8.4 Candidate 1 does not activate viewing-state cloud mutation on Mobile", () => {
  const adapter = read("src/features/library/viewingStatePortableAdapter.ts");
  assert.doesNotMatch(adapter, /CloudProfileStore|store\.write|GoogleDriveCloudProfileStore|mmkvStorageAdapter\.(?:set|remove)/);
});
