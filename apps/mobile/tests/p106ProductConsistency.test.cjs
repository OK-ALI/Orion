const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-E1 uses one short offline availability vocabulary across download surfaces', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const sheet = read('src', 'features', 'downloads', 'DownloadManagementSheet.tsx');

  assert.match(activity, /return 'On device'/);
  assert.match(activity, />Ready offline</);

  assert.match(sheet, /return 'On device'/);
  assert.match(sheet, /'Ready offline'/);
  assert.match(sheet, /'Unavailable · Fix folder'/);
  assert.match(sheet, /'Missing · Review'/);
  assert.match(sheet, />Select downloads\. Other files stay untouched\.</);
  assert.match(sheet, />No downloads\.</);

  assert.doesNotMatch(sheet, />Verified</);
  assert.doesNotMatch(sheet, /Select exact download copies/);
  assert.doesNotMatch(sheet, /Device Storage folder/);
});

test('P10.6-E1 keeps Library product copy short and removes playback-verification jargon', () => {
  const library = read('src', 'features', 'library', 'LibraryScreen.tsx');

  assert.match(library, /subtitle="Saved stories, progress and watch history\."/);
  assert.match(library, /'No watched titles', 'Finished titles appear here\.'/);
  assert.match(library, /'All caught up', 'Everything in My List is watched\.'/);
  assert.match(library, /'Watch 30 seconds to see it here\.'/);
  assert.match(library, /'No watch history', 'What you watch appears here\.'/);

  assert.doesNotMatch(library, /Verified playback appears here/);
  assert.doesNotMatch(library, /verified progress and watch history/);
  assert.doesNotMatch(library, /No verified watch history/);
  assert.doesNotMatch(library, /Orion confirms advancing playback/);
});

test('P10.6-E1 changes presentation only and preserves download management actions', () => {
  const sheet = read('src', 'features', 'downloads', 'DownloadManagementSheet.tsx');
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(sheet, /deleteNativeDownloadAssetsV1/);
  assert.match(sheet, /deleteAllNativeDownloadsV1/);
  assert.match(sheet, /removeUnavailableNativeDownloadRecordsV1/);
  assert.match(sheet, /playNativeDownloadAssetLocallyV1/);
  assert.match(sheet, /locateNativeDownloadAssetV1/);
  assert.match(sheet, /chooseNativeLibraryStorageTargetV1/);
  assert.match(sheet, /chooseNativeDeviceStorageTargetV1/);

  // D4 customer guidance stays intact.
  assert.match(activity, /function downloadFailurePresentation\(job: MobileDownloadJobV1\)/);
  assert.match(activity, /request-context-refresh-required/);
  assert.match(activity, /Orion cannot verify this saved copy right now/);
});

test('P10.6-E1 preserves Library playback/progress behavior while changing only copy', () => {
  const library = read('src', 'features', 'library', 'LibraryScreen.tsx');

  assert.match(library, /const resumeProgress = \(entry: ContinueWatchingEntry\) =>/);
  assert.match(library, /onResume=\{\(\) => resumeProgress\(item\)\}/);
  assert.match(library, /onResume=\{\(\) => resumeHistory\(item\)\}/);
  assert.match(library, /markProgressWatched/);
  assert.match(library, /removeProgress/);
});
