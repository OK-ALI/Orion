"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..", "..");
const readMobile = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

test("V3-P8-006A C1 reuses PortableProfileV3 for one History + Progress activity core", () => {
  const core = readRepo("packages/shared/src/types/portableViewingActivity.ts");
  const index = readRepo("packages/shared/src/types/index.ts");

  assert.match(core, /interface PortableViewingActivityPreviewV1[\s\S]*history[\s\S]*progress/);
  assert.match(core, /buildPortableViewingActivitySteadyStateProfileV1/);
  assert.match(core, /mergePortableViewingActivityRecordsV1/);
  assert.match(index, /export \* from "\.\/portableViewingActivity"/);
  assert.doesNotMatch(core, /CloudProfileStore|GoogleDrive|store\.write|mmkv|localStorage|SecureStore/i);
  assert.doesNotMatch(core, /continueWatching/i);
});

test("V3-P8-006A C1 keeps record revisions, tombstones and unknown namespaces in the existing profile envelope", () => {
  const core = readRepo("packages/shared/src/types/portableViewingActivity.ts");

  assert.match(core, /revision: existing\.revision \+ 1[\s\S]*deletedAt: now[\s\S]*value: null/);
  assert.match(core, /\.\.\.baseProfile\.namespaces,[\s\S]*history: nextHistory\.namespace,[\s\S]*progress: nextProgress\.namespace/);
  assert.match(core, /cannot resurrect a newer deletion/);
  assert.match(core, /ambiguous equal-time update/);
  assert.match(core, /value\.lastPlayedAt < existingValue\.lastPlayedAt/);
});

test("V3-P8-006A C1 merges offline viewing records by event time and fails safe on equal-time ambiguity", () => {
  const core = readRepo("packages/shared/src/types/portableViewingActivity.ts");

  assert.match(core, /if \(aTime !== bTime\)[\s\S]*aTime > bTime/);
  assert.match(core, /a\.deletedAt != null \|\| b\.deletedAt != null/);
  assert.match(core, /canonicalJson\(aValue\) !== canonicalJson\(bValue\)[\s\S]*conflictKeys\.push\(key\)/);
  assert.match(core, /state: 'needs-review'/);
});

test("V3-P8-006A C1 imports portable Mobile truth without forging local telemetry", () => {
  const adapter = readMobile("src/features/library/viewingStatePortableAdapter.ts");
  const library = readMobile("src/features/library/playbackLibrary.ts");
  const playbackEvidence = readMobile("src/features/playback/playbackEvidence.ts");

  assert.match(adapter, /buildLocalMobileViewingActivitySnapshotV1/);
  assert.match(adapter, /portableVerified: true/);
  assert.match(adapter, /sourceId: null[\s\S]*evidence: null[\s\S]*sessionId: null/);
  assert.match(adapter, /raw\?\.portableVerified === true/);
  assert.match(adapter, /normalized\.portableVerified !== true/);
  assert.match(library, /progress\.portableVerified === true/);
  assert.doesNotMatch(playbackEvidence, /portableVerified|portable-profile/i);
});

test("V3-P8-006A C1 Desktop apply adapter updates verified timing and real resume position without storage I/O", () => {
  const adapter = readRepo("apps/desktop/src/renderer/features/library/viewingStatePortableAdapter.js");

  assert.match(adapter, /buildLocalDesktopViewingActivitySnapshotV1/);
  assert.match(adapter, /playbackVerifiedOrigin: "portable-profile-v3"/);
  assert.match(adapter, /progressDetails\[localKey\]/);
  assert.match(adapter, /resumeTimes\[localKey\] = value\.currentTime/);
  assert.match(adapter, /resumeRemovedKeys/);
  const applySection = adapter.slice(adapter.indexOf("function desktopLocalViewingKey"));
  assert.doesNotMatch(applySection, /storage\.(?:get|set|remove)|CloudProfileStore|store\.write/);
});

test("V3-P8-006A C1 leaves locked cloud enrollment owners untouched and does not add a Continue Watching namespace", () => {
  const profile = readRepo("packages/shared/src/types/portableProfile.ts");
  const core = readRepo("packages/shared/src/types/portableViewingActivity.ts");

  assert.doesNotMatch(profile, /"continueWatching"/);
  assert.doesNotMatch(core, /MyListSteadyStateSync|WatchedSteadyStateSync|SyncPolicyContext|LibraryProfileContext/);
});
