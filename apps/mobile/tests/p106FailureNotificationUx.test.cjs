const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-D4 presents failure truth as customer guidance instead of raw native messages', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  assert.match(activity, /function downloadFailurePresentation\(job: MobileDownloadJobV1\)/);
  assert.match(activity, /request-context-refresh-required/);
  assert.match(activity, /Open this title and start playback again to refresh its download source/);
  assert.match(activity, /Free up space on this device or in the selected Orion Library location/);
  assert.match(activity, /Choose the Orion Library folder again in Download settings/);
  assert.match(activity, /The downloaded media did not pass Orion’s safety check/);
  assert.doesNotMatch(activity, /\{job\.failure\?\.message \? <Text[\s\S]{0,200}\{job\.failure\.message\}/);
  assert.match(activity, /\{failurePresentation\.detail \? <Text/);
});

test('P10.6-D4 gives attention states truthful recovery guidance without a public corrupt schema', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const contracts = read('src', 'features', 'downloads', 'contracts.ts');
  assert.match(activity, /This saved copy is no longer on the device/);
  assert.match(activity, /Orion cannot verify this saved copy right now/);
  assert.match(activity, /Review download/);
  assert.match(activity, /Storage options/);
  assert.match(contracts, /recovering: 'Waiting to retry'/);
  assert.match(contracts, /'storage-blocked': 'Storage space needed'/);
  assert.match(contracts, /'action-required': 'Needs your attention'/);
  assert.doesNotMatch(contracts, /corrupt/i);
});

test('P10.6-D4 aligns in-app and Android finalization wording with Orion Library product language', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const contract = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotificationContract.kt');
  for (const copy of ['Preparing offline video', 'Checking saved video', 'Saving to Orion Library', 'Confirming saved video', 'Saving subtitles']) {
    assert.ok(contract.includes(copy), `missing notification copy: ${copy}`);
  }
  assert.match(activity, /Preparing offline video/);
  assert.match(activity, /Checking saved video/);
  assert.match(activity, /Saving to Orion Library/);
  assert.doesNotMatch(activity, /Creating portable MP4|Saving to Device Storage|building portable file/);
  assert.doesNotMatch(contract, /Creating portable MP4|Saving to Device Storage|Checking MP4|Preserving subtitles/);
});

test('P10.6-D4 makes recovery notification explanatory and removes duplicate native status copy', () => {
  const notifications = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotifications.kt');
  const contract = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotificationContract.kt');
  assert.match(contract, /"recovering" -> "Waiting to retry"/);
  assert.match(contract, /The connection was interrupted\. Orion will retry automatically\./);
  assert.match(contract, /indeterminate = true/);
  assert.match(contract, /showTransferMetrics = false/);
  assert.match(notifications, /presentation\.indeterminate \|\| percent\.isNaN\(\)/);
  assert.match(notifications, /OrionDownloadNotificationContract\.stateLabel\(state\)/);
  assert.doesNotMatch(notifications, /private fun statusText/);
});

test('P10.6-D4 preserves D1 storage, D2 recovery and D3 integrity owners', () => {
  const storage = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');
  const recovery = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  const artifact = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  assert.match(storage, /OrionSafPhysicalStoragePolicy/);
  assert.match(recovery, /OrionDownloadRecoveryPolicy\.shouldRemainIdle/);
  assert.match(recovery, /request-context-refresh-required/);
  assert.match(artifact, /OrionArtifactIntegrityPolicy/);
  assert.match(artifact, /validateDocumentIntegrity/);
});

test('P10.6-D4 keeps durable and generated notification owners synchronized', () => {
  const pairs = [
    ['plugins/orion-cinema-webview-native/OrionDownloadNotificationContract.kt', 'android/app/src/main/java/com/okali/orion/playback/OrionDownloadNotificationContract.kt'],
    ['plugins/orion-cinema-webview-native/OrionDownloadNotifications.kt', 'android/app/src/main/java/com/okali/orion/playback/OrionDownloadNotifications.kt'],
    ['plugins/orion-cinema-webview-native-tests/OrionDownloadNotificationContractTest.kt', 'android/app/src/test/java/com/okali/orion/playback/OrionDownloadNotificationContractTest.kt'],
  ];
  for (const [durable, generated] of pairs) {
    assert.equal(read(...durable.split('/')), read(...generated.split('/')), `${generated} must match durable owner`);
  }
});
