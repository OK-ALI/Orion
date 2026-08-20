"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..", "..");
const readMobile = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

test("V3-P8-006A C2 uses one shared first-enrollment owner and the existing CloudProfileStore contract", () => {
  const api = readRepo("packages/shared/src/api/portableViewingActivityOneShotSync.ts");
  const index = readRepo("packages/shared/src/api/index.ts");

  assert.match(api, /CloudProfileStore/);
  assert.match(api, /buildPortableViewingActivitySteadyStateProfileV1/);
  assert.match(api, /mergePortableViewingActivityRecordsV1/);
  assert.match(api, /expectedRevisionTag/);
  assert.match(api, /cloud-verification-failed/);
  assert.match(api, /local-apply-failed/);
  assert.match(index, /portableViewingActivityOneShotSync/);
  assert.doesNotMatch(api, /GoogleDrive|MMKV|localStorage|SecureStore/);
});

test("V3-P8-006A C2 keeps first enrollment explicit and does not activate a second steady-state owner", () => {
  const control = readMobile("src/features/settings/ViewingActivitySyncControl.tsx");

  assert.match(control, /Check Viewing Activity/);
  assert.match(control, /Keep this device/);
  assert.match(control, /Keep Orion Cloud/);
  assert.match(control, /Combine recent activity/);
  assert.match(control, /Automatic Viewing Activity sync is not enabled yet/);
  assert.match(control, /executePortableViewingActivityOneShotSyncV1/);
  assert.doesNotMatch(control, /SyncPolicyContext|useOrionSyncPolicy|SteadyStateSync|setAutomatic|Auto sync/i);
});

test("V3-P8-006A C2 checkpoints are account-scoped and are created only from verified shared results", () => {
  const checkpoint = readMobile("src/features/account/viewingActivitySyncCheckpoint.ts");
  const control = readMobile("src/features/settings/ViewingActivitySyncControl.tsx");

  assert.match(checkpoint, /encodeURIComponent\(normalized\)/);
  assert.match(checkpoint, /profileId/);
  assert.match(checkpoint, /localTruthSignature/);
  assert.match(checkpoint, /cloudNamespaceSignature/);
  assert.match(control, /result\.state === 'verified'[\s\S]*saveViewingActivitySyncCheckpointV1\(result\.checkpoint\)/);
});

test("V3-P8-006A C2 extends the existing Mobile Library owner for atomic History + Progress apply", () => {
  const library = readMobile("src/context/LibraryContext.tsx");

  assert.match(library, /replaceViewingActivityFromSync/);
  assert.match(library, /previousHistory[\s\S]*previousProgress/);
  assert.match(library, /STORAGE_KEYS\.HISTORY[\s\S]*STORAGE_KEYS\.PROGRESS/);
  assert.match(library, /historyRef\.current = nextHistory[\s\S]*progressRef\.current = nextProgress/);
});

test("V3-P8-006A C2 ignores local-only unverified evidence but blocks malformed verified activity", () => {
  const mobileAdapter = readMobile("src/features/library/viewingStatePortableAdapter.ts");
  const desktopAdapter = readRepo("apps/desktop/src/renderer/features/library/viewingStatePortableAdapter.js");

  assert.match(mobileAdapter, /MOBILE_ACTIVITY_IGNORED_HISTORY_REASONS[\s\S]*unverified-history/);
  assert.match(mobileAdapter, /MOBILE_ACTIVITY_IGNORED_PROGRESS_REASONS[\s\S]*unverified-progress/);
  assert.match(mobileAdapter.match(/MOBILE_ACTIVITY_IGNORED_PROGRESS_REASONS = new Set\(\[[\s\S]*?\]\);/)?.[0] || "", /watched-truth-supersedes-progress/);
  assert.match(desktopAdapter, /legacy-unverified-history/);
  assert.match(desktopAdapter, /legacy-unverified-progress/);
});

test("V3-P8-006A C2 Desktop apply updates real resume state transactionally and notifies the existing Library owner", () => {
  const localStore = readRepo("apps/desktop/src/renderer/services/viewingActivityOneShotLocalStore.js");
  const library = readRepo("apps/desktop/src/renderer/app/hooks/useLibraryState.js");

  assert.match(localStore, /progressDetails/);
  assert.match(localStore, /dlTime_/);
  assert.match(localStore, /assertStoredValue/);
  assert.match(localStore, /restoreStorageValue/);
  assert.match(localStore, /VIEWING_ACTIVITY_SYNC_APPLIED_EVENT/);
  assert.match(library, /VIEWING_ACTIVITY_SYNC_APPLIED_EVENT/);
});

test("V3-P8-006A C2 makes only the compulsory Desktop History retention amendment", () => {
  const library = readRepo("apps/desktop/src/renderer/app/hooks/useLibraryState.js");
  assert.match(library, /nextEntry[\s\S]*slice\(0, 250\)/);
});

test("V3-P8-006A C2 fences in-flight enrollment when the account surface unmounts", () => {
  const mobile = readMobile("src/features/settings/ViewingActivitySyncControl.tsx");
  const desktop = readRepo("apps/desktop/src/renderer/features/settings/components/ViewingActivitySyncCard.jsx");

  assert.match(mobile, /activeRef\.current = false/);
  assert.match(mobile, /shouldProceed: \(\) => activeRef\.current/);
  assert.match(desktop, /activeRef\.current = false/);
  assert.match(desktop, /shouldProceed: \(\) => activeRef\.current/);
});

test("V3-P8-006A C2.1 treats absent pre-domain History/Progress namespaces as empty without weakening malformed-cloud safety", () => {
  const core = readRepo("packages/shared/src/types/portableViewingActivity.ts");
  const coordinator = readRepo("packages/shared/src/api/portableViewingActivityOneShotSync.ts");

  assert.match(core, /if \(value == null\) return undefined/);
  assert.match(core, /history === null \|\| progress === null/);
  assert.match(core, /history: history[\s\S]*state: 'missing'/);
  assert.match(core, /previousHistory = history \?\? emptyNamespaceFor\(baseProfile\)/);
  assert.match(core, /previousProgress = progress \?\? emptyNamespaceFor\(baseProfile\)/);
  assert.match(coordinator, /return value \?\? \{ schemaVersion: 1, revision: 0, updatedAt: profile\.updatedAt, records: \{\} \}/);
});
