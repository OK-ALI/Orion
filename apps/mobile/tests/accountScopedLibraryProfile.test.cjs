"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("V3-P8-004 scopes the existing LibraryProvider instead of creating a parallel library owner", () => {
  const layout = read("app/_layout.tsx");
  const library = read("src/context/LibraryContext.tsx");
  const profile = read("src/features/account/LibraryProfileContext.tsx");

  assert.match(layout, /<AccountProvider>[\s\S]*<LibraryProfileProvider>[\s\S]*<OrionSyncPolicyProvider>/);
  assert.match(layout, /<LibraryProvider key=\{libraryProfile\.scopeId\} storage=\{libraryProfile\.storage\}>/);
  assert.equal((layout.match(/<LibraryProvider\b/g) || []).length, 1);
  assert.match(library, /storage: IStorageAdapter/);
  assert.doesNotMatch(library, /mmkvStorageAdapter/);
  assert.doesNotMatch(profile, /createContext<[^>]*(?:saved|watched|history|progress)/i);
});

test("V3-P8-004 preserves the five legacy library keys as a non-destructive recovery source", () => {
  const storage = read("src/features/library/libraryProfileStorage.ts");

  assert.match(storage, /LEGACY_LIBRARY_KEYS = \['saved', 'savedOrder', 'history', 'watched', 'progress'\] as const/);
  assert.match(storage, /legacy keys are a recovery source only/i);
  assert.match(storage, /captureLibrarySnapshot\(storage, \(key\) => key\)/);
  assert.doesNotMatch(storage, /storage\.remove\(key\)/);
  assert.doesNotMatch(storage, /storage\.set\(key,\s*(?:value|source|legacy)/);
});

test("V3-P8-004 creates account namespaces from stable account ids without email or cloud identifiers", () => {
  const storage = read("src/features/library/libraryProfileStorage.ts");

  assert.match(storage, /scopeId: `google:\$\{encodeURIComponent\(normalized\)\}`/);
  assert.match(storage, /profileId: normalized/);
  assert.doesNotMatch(storage, /\bemail\b|accessToken|refreshToken|driveId|deviceId/i);
  assert.match(storage, /p8\.libraryProfile\.v1:data:/);
  assert.match(storage, /p8\.libraryProfile\.v1:manifest:/);
  assert.match(storage, /LIBRARY_PROFILE_MANIFEST_INVALID/);
});

test("V3-P8-004 commits account profile readiness only after exact local copy verification and checkpoint retirement", () => {
  const storage = read("src/features/library/libraryProfileStorage.ts");
  const profile = read("src/features/account/LibraryProfileContext.tsx");

  const prepareStart = storage.indexOf("export function prepareGoogleLibraryProfileV1");
  const finalizeStart = storage.indexOf("export function finalizeGoogleLibraryProfileV1");
  assert.ok(prepareStart >= 0 && finalizeStart > prepareStart);
  const prepare = storage.slice(prepareStart, finalizeStart);
  assert.match(prepare, /copySnapshotIntoScope\(storage, sourceSnapshot, scope\)/);
  assert.match(prepare, /writeManifest\(storage, scope, 'staging'/);
  assert.doesNotMatch(prepare, /writeManifest\(storage, scope, 'ready'/);

  const clearMyList = profile.indexOf("clearMyListSyncCheckpointV1(accountProfileId)");
  const watchedCarry = profile.indexOf("canCarryWatchedSyncCheckpointToScopedLibraryV1(");
  const clearWatched = profile.indexOf("if (!carryWatchedCheckpoint) clearWatchedSyncCheckpointV1(accountProfileId)");
  const finalize = profile.indexOf("finalizeGoogleLibraryProfileV1(mmkvStorageAdapter, accountProfileId)");
  assert.ok(clearMyList >= 0 && watchedCarry > clearMyList && clearWatched > watchedCarry && finalize > clearWatched);
  assert.match(storage.slice(finalizeStart), /snapshotsMatch\(sourceSnapshot, accountSnapshot\)/);
  assert.match(storage.slice(finalizeStart), /writeManifest\(storage, scope, 'ready'/);
});

test("V3-P8-004 never makes the preserved local profile another cloud sync participant", () => {
  const profile = read("src/features/account/LibraryProfileContext.tsx");
  const myList = read("src/features/account/MyListSteadyStateSync.tsx");
  const watched = read("src/features/account/WatchedSteadyStateSync.tsx");

  assert.match(profile, /cloudEligible = ready[\s\S]*bound\.kind === 'google'[\s\S]*bound\.profileId === accountProfileId/);
  assert.match(myList, /libraryProfileReady: libraryProfile\.cloudEligible/);
  assert.match(myList, /start\.libraryProfileId !== profile\.accountId/);
  assert.match(watched, /libraryProfileReady: libraryProfile\.cloudEligible/);
  assert.match(watched, /start\.libraryProfileId !== profile\.accountId/);
});

test("V3-P8-004 reuses existing cloud enrollment and conflict engines rather than duplicating merge logic", () => {
  const storage = read("src/features/library/libraryProfileStorage.ts");
  const profile = read("src/features/account/LibraryProfileContext.tsx");
  const combined = `${storage}\n${profile}`;

  assert.doesNotMatch(combined, /GoogleDriveCloudProfileStore|CloudProfileStore|PortableProfileV3/);
  assert.doesNotMatch(combined, /Combine both|keep-cloud|keep-local|store\.write|store\.read/);
  assert.doesNotMatch(combined, /portableMyList|portableWatched/i);
});

test("V3-P8-004 switches storage by remounting the existing LibraryProvider and fences stale account transitions", () => {
  const layout = read("app/_layout.tsx");
  const profile = read("src/features/account/LibraryProfileContext.tsx");
  const myList = read("src/features/account/MyListSteadyStateSync.tsx");
  const watched = read("src/features/account/WatchedSteadyStateSync.tsx");

  assert.match(layout, /key=\{libraryProfile\.scopeId\}/);
  assert.match(profile, /bound\.targetKey === targetKey/);
  assert.match(profile, /A previous profile is never considered ready after AccountContext switches/);
  assert.match(myList, /latestRef\.current\.libraryProfileId === operationProfileId/);
  assert.match(watched, /latestRef\.current\.libraryProfileId === operationProfileId/);
});


test("V3-P8-004 C1.1 carries an enrolled Watched checkpoint only across semantically identical scoped migration", () => {
  const profile = read("src/features/account/LibraryProfileContext.tsx");
  const checkpoint = read("src/features/account/watchedSyncCheckpoint.ts");
  const steady = read("src/features/account/WatchedSteadyStateSync.tsx");

  assert.match(checkpoint, /canCarryWatchedSyncCheckpointToScopedLibraryV1/);
  assert.match(checkpoint, /buildMobilePortableWatchedPreviewV1/);
  assert.match(checkpoint, /portableWatchedTruthSignatureV1\(preview\) === checkpoint\.localTruthSignature/);
  assert.match(checkpoint, /preview\.rejectedKeys\.length > 0\) return false/);
  assert.match(profile, /if \(!carryWatchedCheckpoint\) clearWatchedSyncCheckpointV1\(accountProfileId\)/);
  assert.doesNotMatch(profile, /if \(carryWatchedCheckpoint\) saveWatchedSyncCheckpointV1/);
  assert.match(steady, /if \(!hasCheckpoint\) \{[\s\S]*phase: 'unenrolled'/);
});
