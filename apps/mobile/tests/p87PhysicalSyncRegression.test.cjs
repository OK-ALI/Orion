"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "..", "..");
const readMobile = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

test("P8.7 physical regression repair serializes complete shared PortableProfileV3 transactions per profile", () => {
  const coordinator = readMobile("src/features/account/portableProfileCloudTransactionCoordinator.ts");
  const providers = [
    readMobile("src/features/account/MyListSteadyStateSync.tsx"),
    readMobile("src/features/account/WatchedSteadyStateSync.tsx"),
    readMobile("src/features/account/ViewingActivitySteadyStateSync.tsx"),
  ];

  assert.match(coordinator, /const transactionTails = new Map<string, Promise<void>>\(\)/);
  assert.match(coordinator, /const previous = transactionTails\.get\(key\) \?\? Promise\.resolve\(\)/);
  assert.match(coordinator, /await previous\.catch\(\(\) => \{\}\)/);
  assert.match(coordinator, /try \{[\s\S]*return await transaction\(\)[\s\S]*finally \{[\s\S]*release\(\)/);
  assert.match(coordinator, /transactionTails\.get\(key\) === tail/);

  for (const provider of providers) {
    assert.match(provider, /runPortableProfileCloudTransaction/);
    assert.match(provider, /await runPortableProfileCloudTransaction\(operationProfileId, async \(\) =>/);
  }
});

test("P8.7 heartbeat cannot queue an automatic retry storm or erase an actionable review", () => {
  const providers = [
    readMobile("src/features/account/MyListSteadyStateSync.tsx"),
    readMobile("src/features/account/WatchedSteadyStateSync.tsx"),
    readMobile("src/features/account/ViewingActivitySteadyStateSync.tsx"),
  ];

  for (const provider of providers) {
    assert.match(provider, /requestHeartbeatReconcile/);
    assert.match(provider, /statusRef\.current\.phase === 'needs-review'/);
    assert.match(provider, /statusRef\.current\.phase === 'error'/);
    assert.match(provider, /reportGoogleDriveCloudFailure/);
    assert.match(provider, /describeGoogleDriveCloudFailure/);
    assert.match(provider, /activeLocalSignatureRef\.current != null/);
    assert.match(provider, /pendingModeRef\.current = 'manual'/);
    assert.match(provider, /pendingModeRef\.current = 'automatic'/);
    assert.match(provider, /startPortableProfileAutoSyncHeartbeat\([\s\S]*requestHeartbeatReconcile/);
    assert.match(provider, /AppState\.addEventListener\([\s\S]*requestHeartbeatReconcile/);
    assert.doesNotMatch(provider, /startPortableProfileAutoSyncHeartbeat\([\s\S]*?'(?:myList|watched|viewingActivity)'[\s\S]*?requestAutomaticReconcile,/);
  }
});

test("P8.7 read-back verification proves only the domain written while pre-write revision concurrency remains mandatory", () => {
  const myListProvider = readMobile("src/features/account/MyListSteadyStateSync.tsx");
  const myListConflict = readRepo("packages/shared/src/api/portableMyListSteadyStateConflict.ts");
  const watchedOneShot = readRepo("packages/shared/src/api/portableWatchedOneShotSync.ts");
  const watchedConflict = readRepo("packages/shared/src/api/portableWatchedSteadyStateConflict.ts");
  const viewingSteady = readRepo("packages/shared/src/api/portableViewingActivitySteadyStateSync.ts");
  const viewingConflict = readRepo("packages/shared/src/api/portableViewingActivitySteadyStateConflict.ts");
  const viewingOneShot = readRepo("packages/shared/src/api/portableViewingActivityOneShotSync.ts");

  assert.match(myListProvider, /expectedRevisionTag: remote\.revisionTag/);
  assert.match(myListProvider, /verifiedNamespaceSignature === candidateNamespaceSignature/);
  assert.match(myListProvider, /portableMyListActiveMatchesPreviewV1\(readBack\.profile, start\.preview\)/);
  assert.doesNotMatch(myListProvider, /unrelatedNamespacesMatch/);
  assert.doesNotMatch(myListProvider, /freshPull\.revisionTag !== remote\.revisionTag/);

  assert.match(myListConflict, /expectedRevisionTag: remote\.revisionTag/);
  assert.match(myListConflict, /readBackNamespaceSignature === candidateNamespaceSignature/);
  assert.doesNotMatch(myListConflict, /unrelatedNamespacesMatch/);

  for (const watched of [watchedOneShot, watchedConflict]) {
    assert.match(watched, /expectedRevisionTag(?:\s*:|\s*[,}])/);
    assert.match(watched, /portableWatchedNamespaceSignatureV1\(readBack\.profile\) === candidateNamespaceSignature/);
    assert.match(watched, /portableWatchedTruthMatchesPreviewV1\(readBack\.profile,/);
    assert.doesNotMatch(watched, /unrelatedNamespacesMatch/);
    assert.doesNotMatch(watched, /portableProfilesSemanticallyMatch/);
    assert.doesNotMatch(watched, /stable\.revisionTag !== (?:fresh\.remote|remote)\.revisionTag/);
  }

  for (const viewing of [viewingSteady, viewingConflict, viewingOneShot]) {
    assert.match(viewing, /expectedRevisionTag(?:\s*:|\s*[,}])/);
    assert.match(viewing, /portableViewingActivityNamespaceSignatureV1\(readBack\.profile\) === candidate/);
    assert.match(viewing, /portableViewingActivityTruthSignatureV1\(readBackState\) === candidateTruthSignature/);
    assert.doesNotMatch(viewing, /unrelatedNamespacesMatch/);
    assert.doesNotMatch(viewing, /stable\.revisionTag !== (?:fresh\.remote|remote)\.revisionTag/);
  }
});

test("P8.7 portable My List cards fall back to the synced portable year instead of rendering Unknown", () => {
  const card = readMobile("src/components/MediaCard.tsx");
  const adapter = readMobile("src/features/library/myListPortableAdapter.ts");

  assert.match(adapter, /year: item\.year \?\? ''/);
  assert.match(card, /normalizeDisplayYear/);
  assert.match(card, /year\?: string \| number/);
  assert.match(card, /normalizeDisplayYear\(isMovie \? item\.release_date : item\.first_air_date\) \?\? portableYear/);
  assert.match(card, /\{year \|\| 'Unknown'\}/);
});
