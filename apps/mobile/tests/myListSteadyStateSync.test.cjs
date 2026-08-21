"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const sharedRoot = path.resolve(mobileRoot, "..", "..", "packages", "shared", "src");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readShared = (relative) => fs.readFileSync(path.join(sharedRoot, relative), "utf8");

test("P8.3 Candidate 3 mounts steady-state My List sync globally inside the existing provider boundary", () => {
  const layout = read("app/_layout.tsx");
  assert.match(layout, /<AccountProvider>[\s\S]*<ThemedApplication \/>/);
  assert.match(layout, /<LibraryProvider[^>]*>[\s\S]*<MyListSteadyStateSyncProvider>[\s\S]*<GestureHandlerRootView/);
  assert.equal((layout.match(/<MyListSteadyStateSyncProvider>/g) || []).length, 1);
});

test("P8.3 Candidate 3 checkpoint is local reconciliation evidence, not a persisted Synced boolean", () => {
  const checkpoint = read("src/features/account/myListSyncCheckpoint.ts");
  assert.match(checkpoint, /localSignature: string/);
  assert.match(checkpoint, /cloudNamespaceSignature: string/);
  assert.match(checkpoint, /verifiedAt: number/);
  assert.doesNotMatch(checkpoint, /isSynced|synced:\s*(?:true|boolean)|cloudProfileJson|accessToken|refreshToken/);
});

test("P8.3 Candidate 3 distinguishes local-only, cloud-only and two-sided changes from the last verified checkpoint", () => {
  const sync = read("src/features/account/MyListSteadyStateSync.tsx");
  assert.match(sync, /const localChanged = operationLocalSignature !== checkpoint\.localSignature/);
  assert.match(sync, /const cloudChanged = cloudNamespaceSignature !== checkpoint\.cloudNamespaceSignature/);
  assert.match(sync, /if \(localChanged && cloudChanged\)/);
  assert.match(sync, /if \(localChanged && !cloudChanged\)/);
  assert.match(sync, /if \(!localChanged && cloudChanged\)/);
  assert.match(sync, /stopped instead of merging or overwriting either copy/);
});

test("P8.3 Candidate 3 writes local-only changes conditionally and requires Drive read-back verification", () => {
  const sync = read("src/features/account/MyListSteadyStateSync.tsx");
  assert.match(sync, /buildPortableMyListSteadyStateProfileV1/);
  assert.match(sync, /expectedRevisionTag: remote\.revisionTag/);
  assert.match(sync, /write\.state === 'conflict'/);
  assert.match(sync, /readBackCloudProfileUntilVerified/);
  assert.match(sync, /readBack\.profile\.revision === candidate\.revision/);
  assert.match(sync, /readBack\.profile\.updatedAt === candidate\.updatedAt/);
  assert.match(sync, /unrelatedNamespacesMatch\(candidate, readBack\.profile\)/);
  assert.match(sync, /portableMyListActiveMatchesPreviewV1\(readBack\.profile, start\.preview\)/);
  assert.doesNotMatch(sync, /verify\.revisionTag === write\.revisionTag/);
});

test("P8.3 Candidate 3 portable mutation preserves unrelated namespaces and turns removals into tombstones", () => {
  const portable = readShared("types/portableMyList.ts");
  const start = portable.indexOf("export function buildPortableMyListSteadyStateProfileV1");
  const body = portable.slice(start);
  assert.match(body, /\.\.\.baseProfile\.namespaces,\s*myList,/s);
  assert.match(body, /deletedAt: now/);
  assert.match(body, /value: null/);
  assert.match(body, /revision: existing\.revision \+ 1/);
  assert.doesNotMatch(body, /namespaces\.(?:history|watched|progress|preferences)\s*=/);
});

test("P8.3 Candidate 3 compares only the My List namespace so later unrelated profile writes do not fabricate conflicts", () => {
  const portable = readShared("types/portableMyList.ts");
  const sync = read("src/features/account/MyListSteadyStateSync.tsx");
  assert.match(portable, /portableMyListNamespaceSignatureV1/);
  assert.match(portable, /const namespace = profile\.namespaces\.myList/);
  assert.match(sync, /cloudNamespaceSignature !== checkpoint\.cloudNamespaceSignature/);
});

test("P8.3 Candidate 3 applies cloud-only changes through the My List-only LibraryContext action", () => {
  const sync = read("src/features/account/MyListSteadyStateSync.tsx");
  const library = read("src/context/LibraryContext.tsx");
  assert.match(sync, /buildLocalMyListSnapshotV1\(cloudPreview, start\.saved\)/);
  assert.match(sync, /replaceMyListFromSync\(snapshot\.saved, snapshot\.savedOrder\)/);
  const adapter = read("src/features/library/myListPortableAdapter.ts");
  assert.match(adapter, /\{ \.\.\.existing, \.\.\.portableFields\(item\) \}/);
  assert.match(adapter, /Existing local-only metadata is preserved/);
  assert.match(library, /const replaceMyListFromSync = useCallback/);
  assert.match(library, /STORAGE_KEYS\.SAVED/);
  assert.match(library, /STORAGE_KEYS\.SAVED_ORDER/);
  const replacementStart = library.indexOf("const replaceMyListFromSync");
  const replacementEnd = library.indexOf("\n\n  const ", replacementStart + 1);
  assert.ok(replacementStart >= 0 && replacementEnd > replacementStart);
  const replacement = library.slice(replacementStart, replacementEnd);
  assert.doesNotMatch(replacement, /WATCHED|HISTORY|PROGRESS|markWatched|recordPlayback/);
});

test("P8.3 Candidate 3 never overwrites a local change that occurs while a cloud pull is in flight", () => {
  const sync = read("src/features/account/MyListSteadyStateSync.tsx");
  const pullStart = sync.indexOf("if (!localChanged && cloudChanged)");
  const pull = sync.slice(pullStart);
  assert.match(pull, /const freshPull = await store\.read\(PORTABLE_PROFILE_PRIMARY_KEY\)/);
  assert.match(pull, /freshPull\.revisionTag !== remote\.revisionTag/);
  assert.match(pull, /freshPullSignature !== cloudNamespaceSignature/);
  const guard = pull.indexOf("latestRef.current.localSignature !== operationLocalSignature");
  const replace = pull.indexOf("replaceMyListFromSync");
  assert.ok(guard >= 0 && replace > guard);
});

test("P8.3 Candidate 3 offers explicit cloud restore only for an empty local My List and re-reads before replacement", () => {
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");
  assert.match(preflight, /phase: 'ready-restore'/);
  assert.match(preflight, /preview\.orderedKeys\.length === 0/);
  assert.match(preflight, /title=\{readyRestore \? 'Restore My List from Orion\?' : 'Start My List sync\?'\}/);
  assert.match(preflight, /const fresh = await store\.read\(PORTABLE_PROFILE_PRIMARY_KEY\)/);
  assert.match(preflight, /fresh\.revisionTag !== readyState\.baselineRevisionTag/);
  assert.match(preflight, /cloudNamespaceSignature !== readyState\.cloudNamespaceSignature/);
  assert.match(preflight, /replaceMyListFromSync\(snapshot\.saved, snapshot\.savedOrder\)/);
});

test("P8.3 Candidate 3 remains My List-only and does not open viewing-state sync", () => {
  const sync = read("src/features/account/MyListSteadyStateSync.tsx");
  const checkpoint = read("src/features/account/myListSyncCheckpoint.ts");
  assert.doesNotMatch(sync, /markWatched|markUnwatched|recordPlayback|clearHistory|removeProgress|ContinueWatching/);
  assert.doesNotMatch(checkpoint, /history|watched|progress|preferences/i);
});

test("P8.3 Candidate 3.1 uses bounded backend-neutral semantic read-back convergence for future sync domains", () => {
  const helper = read("src/features/account/cloudProfileReadBackVerification.ts");
  assert.match(helper, /CloudProfileStore/);
  assert.match(helper, /CloudProfileReadResult/);
  assert.match(helper, /DEFAULT_READ_BACK_DELAYS_MS = \[0, 250, 750, 1500\]/);
  assert.match(helper, /store\.read\(profileKey\)/);
  assert.match(helper, /result\.state === 'found' && verify\(result\)/);
  assert.doesNotMatch(helper, /myList|watched|history|progress|preferences/i);
});

test("P8.3 Candidate 3.1 native Drive reads return a stable metadata-plus-body snapshot", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");
  assert.match(native, /READ_SNAPSHOT_ATTEMPTS = 3/);
  assert.match(native, /val before = fetchMetadata\(token, fileId\)/);
  assert.match(native, /val profileJson = downloadProfile\(token, fileId\)/);
  assert.match(native, /val after = fetchMetadata\(token, fileId\)/);
  assert.match(native, /before\.revisionTag\(\) == after\.revisionTag\(\)/);
  assert.match(native, /GOOGLE_DRIVE_PROFILE_SNAPSHOT_UNSTABLE/);
  assert.match(native, /Cache-Control["']?, ["']no-cache/);
});


test("P8.3 Candidate 4 mounts a reusable per-domain sync policy between Account and application state", () => {
  const layout = read("app/_layout.tsx");
  const policy = read("src/features/account/SyncPolicyContext.tsx");

  assert.match(layout, /<AccountProvider>[\s\S]*<OrionSyncPolicyProvider>[\s\S]*<ThemedApplication \/>[\s\S]*<\/OrionSyncPolicyProvider>[\s\S]*<\/AccountProvider>/);
  assert.match(policy, /ORION_SYNC_DOMAINS = \[[^\]]*'myList'[^\]]*'watched'[^\]]*\] as const/);
  assert.match(policy, /p8\.syncPolicy\.v1:/);
  assert.match(policy, /profileId/);
  assert.match(policy, /automatic: true/);
  assert.doesNotMatch(policy, /GoogleDriveCloudProfileStore|CloudProfileStore|accessToken|refreshToken/);
});

test("P8.3 Candidate 4 pauses automatic My List cloud work but preserves explicit one-shot reconciliation", () => {
  const sync = read("src/features/account/MyListSteadyStateSync.tsx");

  assert.match(sync, /mode === 'automatic' && !start\.myListAutomatic/);
  assert.match(sync, /phase: 'paused'/);
  assert.match(sync, /requestAutomaticReconcile = useCallback\(\(\) => enqueueReconcile\('automatic'\)/);
  assert.match(sync, /requestManualReconcile = useCallback\(\(\) => enqueueReconcile\('manual'\)/);
  assert.match(sync, /refresh: requestManualReconcile/);
  assert.match(sync, /const automaticStillAllowed = \(\) => mode === 'manual' \|\| latestRef\.current\.myListAutomatic/);
  assert.match(sync, /if \(!automaticStillAllowed\(\)\)[\s\S]*setPaused\(\)[\s\S]*const write = await store\.write/);
  assert.match(sync, /myListAutomatic, requestAutomaticReconcile/);
});

test("P8.3 Candidate 4 Auto sync control is local policy only and OFF does not erase either copy", () => {
  const policy = read("src/features/account/SyncPolicyContext.tsx");
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(preflight, /AccountSyncDomainRow/);
  assert.match(preflight, /accessibilityLabel: 'Auto sync My List'/);
  assert.match(preflight, /syncPolicy\.setAutomatic\('myList', enabled\)/);
  assert.match(preflight, /'Sync now'/);
  assert.match(preflight, /Automatic sync is paused/);
  assert.match(preflight, /if \(!steady\.hasCheckpoint && autoSyncEnabled\) void inspectEnrollment\(\)/);
  assert.doesNotMatch(policy, /remove\(|clearMyListSyncCheckpoint|replaceMyListFromSync|store\.write|store\.read/);
});

test("P8.4 C3-D extends the reusable policy registry without changing My List domain ownership", () => {
  const policy = read("src/features/account/SyncPolicyContext.tsx");
  const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");

  assert.match(policy, /ORION_SYNC_DOMAINS = \[[^\]]*'myList'[^\]]*'watched'[^\]]*\] as const/);
  assert.match(preflight, /syncPolicy\.setAutomatic\('myList', enabled\)/);
  assert.doesNotMatch(preflight, /setAutomatic\('watched'|markWatched|markUnwatched|recordPlayback|clearHistory|removeProgress/);
  assert.match(preflight, /uploading only My List/);
  assert.match(preflight, /AccountSyncDomainRow/);
  assert.match(preflight, /title="My List"/);
});


test("P8 post-checkpoint My List divergence exposes explicit whole-copy recovery without inventing a steady-state merge", () => {
  const steady = read("src/features/account/MyListSteadyStateSync.tsx");
  const ui = read("src/features/settings/MyListEnrollmentPreflight.tsx");
  const shared = readShared("api/portableMyListSteadyStateConflict.ts");

  assert.match(steady, /resolvePortableMyListSteadyStateConflictV1/);
  assert.match(steady, /reason: 'both-changed'/);
  assert.match(steady, /resolution === 'device' \? 'keep-local' : 'keep-cloud'/);
  assert.match(ui, /Keep this device/);
  assert.match(ui, /Keep Orion Cloud/);
  assert.match(ui, /Resolve My List conflict\?/);
  assert.match(shared, /cannot safely infer which removals were intentional/i);
  assert.match(shared, /expectedRevisionTag: remote\.revisionTag/);
  assert.match(shared, /unrelatedNamespacesMatch\(candidate, readBack\.profile\)/);
  assert.doesNotMatch(shared, /combinePortableMyListPreviewsV1/);
});
