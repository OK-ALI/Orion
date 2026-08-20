const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('V3-P8-006A C3 enrolls Viewing Activity into the existing shared SyncPolicy and global provider boundary', () => {
  const policy = read('apps/mobile/src/features/account/SyncPolicyContext.tsx');
  const layout = read('apps/mobile/app/_layout.tsx');
  assert.match(policy, /ORION_SYNC_DOMAINS = \['myList', 'watched', 'viewingActivity'\]/);
  assert.match(layout, /<WatchedSteadyStateSyncProvider>[\s\S]*<ViewingActivitySteadyStateSyncProvider>[\s\S]*<GestureHandlerRootView/);
});

test('V3-P8-006A C3 uses one shared event-time coordinator and keeps Continue Watching out of Cloud ownership', () => {
  const shared = read('packages/shared/src/api/portableViewingActivitySteadyStateSync.ts');
  assert.match(shared, /mergePortableViewingActivityRecordsV1/);
  assert.match(shared, /two-sided-removal-ambiguity/);
  assert.match(shared, /expectedRevisionTag: remote\.revisionTag/);
  assert.match(shared, /unrelatedNamespacesMatch/);
  assert.doesNotMatch(shared, /continueWatching|Continue Watching/);
  const recovery = read('packages/shared/src/api/portableViewingActivitySteadyStateConflict.ts');
  assert.match(recovery, /keep-local.*keep-cloud|keep-cloud.*keep-local/s);
  assert.doesNotMatch(recovery, /resolution === ['\"]combine/);
});

test('V3-P8-006A C3 fences automatic Mobile work by account, profile readiness, policy and AppState', () => {
  const provider = read('apps/mobile/src/features/account/ViewingActivitySteadyStateSync.tsx');
  assert.match(provider, /libraryProfileReady[\s\S]*libraryProfileId/);
  assert.match(provider, /automaticStillAllowed/);
  assert.match(provider, /shouldProceed: canMutate/);
  assert.match(provider, /mountedRef\.current/);
  assert.match(provider, /AppState\.addEventListener/);
});

test('V3-P8-006A C3 upgrades the existing Viewing Activity control instead of creating a second settings surface', () => {
  const control = read('apps/mobile/src/features/settings/ViewingActivitySyncControl.tsx');
  assert.match(control, /useViewingActivitySteadyStateSync/);
  assert.match(control, /getAutomatic\('viewingActivity'\)/);
  assert.match(control, /setAutomatic\('viewingActivity'/);
  assert.match(control, /Check now|Sync now/);
  assert.match(control, /Keep this device/);
  assert.match(control, /Keep Orion Cloud/);
  assert.match(control, /const \[reviewResolution, setReviewResolution\] = useState<['\"]device['\"] \| ['\"]cloud['\"] \| null>/);
  assert.match(control, /const steadyReview = steady\.phase === ['\"]needs-review['\"][\s\S]*steady\.review\?\.reason === ['\"]two-sided-divergence['\"]/);
});
