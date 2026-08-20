"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const sharedRoot = path.resolve(mobileRoot, "..", "..", "packages", "shared", "src");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readShared = (relative) => fs.readFileSync(path.join(sharedRoot, relative), "utf8");

test("P8.4 C3-C shared Watched planner is first-enrollment safe and checkpoint-driven", () => {
  const watched = readShared("types/portableWatchedSync.ts");
  assert.match(watched, /portableWatchedTruthSignatureV1/);
  assert.match(watched, /buildPortableWatchedFirstEnrollmentPreviewV1/);
  assert.match(watched, /tombstone-conflict/);
  assert.match(watched, /localChanged && cloudChanged/);
  assert.match(watched, /action: 'pull'/);
  assert.match(watched, /action: 'push'/);
  assert.match(watched, /localOnly\.length > 0 && cloudOnly\.length > 0 \? 'merge' : 'push'/);
  assert.match(watched, /profile-missing-after-checkpoint/);
});

test("P8.4 C3-C one-shot coordinator revalidates, conditionally writes and semantically reads back", () => {
  const sync = readShared("api/portableWatchedOneShotSync.ts");
  assert.match(sync, /expectedConfirmationKey/);
  assert.match(sync, /fresh\.confirmationKey !== input\.expectedConfirmationKey/);
  assert.match(sync, /expectedRevisionTag: fresh\.remote\.revisionTag/);
  assert.match(sync, /write\.state === 'conflict'/);
  assert.match(sync, /DEFAULT_READ_BACK_DELAYS_MS = \[0, 250, 750, 1500\]/);
  assert.match(sync, /unrelatedNamespacesMatch\(candidate, readBack\.profile\)/);
  assert.match(sync, /portableWatchedTruthMatchesPreviewV1\(readBack\.profile, targetPreview\)/);
  assert.match(sync, /portableProfilesSemanticallyMatch\(candidate, readBack\.profile\)/);
  assert.doesNotMatch(sync, /readBack\.revisionTag === write\.revisionTag/);
  assert.match(sync, /revision tags are optimistic-concurrency tokens/i);
  assert.match(sync, /canonicalJson\(withoutWatched\(expected\)\)/);
  assert.match(sync, /local-changed-during-sync/);
});

test("P8.4 C3-D keeps first Watched enrollment explicit while exposing steady-state controls after a checkpoint", () => {
  const account = read("src/features/settings/AccountSettingsContent.tsx");
  const control = read("src/features/settings/WatchedSyncControl.tsx");
  assert.match(account, /drivePhase === 'ready'[\s\S]*<WatchedSyncControl/);
  assert.match(control, />Watched</);
  assert.match(control, /checkpoint: null/);
  assert.match(control, /Confirm sync/);
  assert.match(control, /First sync is confirmed once/i);
  assert.match(control, /<Switch/);
  assert.match(control, /syncPolicy\.setAutomatic\('watched', enabled\)/);
  assert.match(control, /if \(steadyActive\) steady\.refresh\(\);/);
  assert.match(control, /else void checkEnrollment\(\);/);
});

test("P8.4 C3-C Mobile checkpoint stores signatures only, never a persisted synced flag or cloud token", () => {
  const checkpoint = read("src/features/account/watchedSyncCheckpoint.ts");
  assert.match(checkpoint, /localTruthSignature/);
  assert.match(checkpoint, /cloudNamespaceSignature/);
  assert.match(checkpoint, /verifiedAt/);
  assert.doesNotMatch(checkpoint, /revisionTag|accessToken|refreshToken|synced:\s*true/);
});

test("P8.4 C3-C Mobile local pull replaces Watched only and leaves playback domains outside the apply path", () => {
  const library = read("src/context/LibraryContext.tsx");
  const start = library.indexOf("const replaceWatchedFromSync");
  const end = library.indexOf("const isSaved", start);
  const apply = library.slice(start, end);
  assert.match(apply, /STORAGE_KEYS\.WATCHED/);
  assert.match(apply, /watchedRef\.current = nextWatched/);
  assert.match(apply, /setWatched\(nextWatched\)/);
  assert.doesNotMatch(apply, /STORAGE_KEYS\.(?:HISTORY|PROGRESS|SAVED)/);
  assert.doesNotMatch(apply, /setHistory|setProgress|setSaved/);
});

test("P8.4 C3-D enrolls Watched into the existing local SyncPolicy and mounts one global Mobile steady-state owner", () => {
  const policy = read("src/features/account/SyncPolicyContext.tsx");
  const layout = read("app/_layout.tsx");
  const steady = read("src/features/account/WatchedSteadyStateSync.tsx");
  assert.match(policy, /ORION_SYNC_DOMAINS = \[[^\]]*'myList'[^\]]*'watched'[^\]]*\] as const/);
  assert.match(policy, /watched: \{ automatic: true \}/);
  assert.match(layout, /<MyListSteadyStateSyncProvider>[\s\S]*<WatchedSteadyStateSyncProvider>[\s\S]*<GestureHandlerRootView/);
  assert.match(steady, /mode === 'automatic' && !start\.watchedAutomatic/);
  assert.match(steady, /requestManualReconcile/);
  assert.match(steady, /shouldProceed: canMutate/);
  assert.doesNotMatch(steady, /History|Progress|ContinueWatching|recordPlayback|clearHistory|removeProgress/);
});

test("P8.4 C3-D shared steady-state coordinator is checkpoint-gated and composes the C3-C coordinator", () => {
  const steady = readShared("api/portableWatchedSteadyStateSync.ts");
  const oneShot = readShared("api/portableWatchedOneShotSync.ts");
  assert.match(steady, /if \(!input\.checkpoint\) return \{ state: 'unenrolled' \}/);
  assert.match(steady, /inspectPortableWatchedOneShotSyncV1/);
  assert.match(steady, /executePortableWatchedOneShotSyncV1/);
  assert.match(steady, /shouldProceed: input\.shouldProceed/);
  assert.doesNotMatch(steady, /planPortableWatchedReconciliationV1|buildPortableWatchedSteadyStateProfileV1/);
  assert.match(oneShot, /shouldProceed\?: \(\) => boolean \| Promise<boolean>/);
  assert.match(oneShot, /reason: 'cancelled'/);
});


test("P8 post-checkpoint Watched divergence requires an explicit device-or-cloud choice and never auto-unions conflicting Watched intent", () => {
  const steady = read("src/features/account/WatchedSteadyStateSync.tsx");
  const ui = read("src/features/settings/WatchedSyncControl.tsx");
  const shared = readShared("api/portableWatchedSteadyStateConflict.ts");

  assert.match(steady, /resolvePortableWatchedSteadyStateConflictV1/);
  assert.match(steady, /reason === 'both-changed'/);
  assert.match(steady, /resolution === 'device' \? 'keep-local' : 'keep-cloud'/);
  assert.match(ui, /Keep this device/);
  assert.match(ui, /Keep Orion Cloud/);
  assert.match(ui, /Resolve Watched conflict\?/);
  assert.match(shared, /Watched and Unwatched are competing intentions|intentional unwatch/i);
  assert.match(shared, /decision\.reason !== 'both-changed'/);
  assert.match(shared, /expectedRevisionTag: remote\.revisionTag/);
  assert.match(shared, /portableProfilesSemanticallyMatch\(candidate, readBack\.profile\)/);
});
