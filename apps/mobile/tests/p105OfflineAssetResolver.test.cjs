const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.5 legacy full resolver stays fail-closed while PlayerScreen uses the classification-only route boundary', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');

  assert.match(module, /fun resolveOfflinePlayback\(assetId: String, promise: Promise\)/);
  assert.match(module, /OrionDownloadArtifactManager\.resolveOfflinePlayback\(reactContext, assetId\)/);
  assert.match(module, /fun classifyOfflinePlayback\(assetId: String, promise: Promise\)/);
  assert.match(manager, /reconcile\(context, setOf\(clean\)\)/);
  assert.match(manager, /fun classifyOfflinePlaybackRoute\(assetId: String\)/);
  assert.match(manager, /asset\.optString\("destination"\) != "orion-library"/);
  assert.match(manager, /storageMode !in setOf\("orion-library", "user-folder"\)/);
  assert.match(manager, /when \(primary\.optString\("availability"\)\)/);
  assert.match(manager, /"verified" -> Unit/);
  assert.match(manager, /locatorKind !in setOf\("managed", "managed-relative"\)/);
  assert.match(manager, /validateManagedFragmentBundle\(bundleDir\)/);
  assert.match(manager, /entry\.optString\("name"\) != expectedName/);
  assert.match(manager, /file\.length\(\) != expectedSize/);

  assert.match(bridge, /resolveNativeOfflinePlaybackV1/);
  assert.match(bridge, /uri\.startsWith\('content:\/\/'\)/);
  assert.match(bridge, /uri\.startsWith\('file:\/\/'\)/);
  const bridgeStart = bridge.indexOf('export async function resolveNativeOfflinePlaybackV1');
  const bridgeEnd = bridge.indexOf('async function runNativeAssetAction', bridgeStart);
  assert.ok(bridgeStart >= 0 && bridgeEnd > bridgeStart);
  assert.doesNotMatch(bridge.slice(bridgeStart, bridgeEnd), /writeMobileDownloadRepositoryV1/);

  assert.match(bridge, /export async function classifyNativeOfflinePlaybackV1/);
  assert.match(screen, /classifyNativeOfflinePlaybackV1\(offlineAssetId\)/);
  assert.doesNotMatch(screen, /resolveNativeOfflinePlaybackV1\(offlineAssetId\)|offlineUri/);
});

test('P10.5 offline presentation uses its playback timeline and never invokes MP4 remux', () => {
  const finalizer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadPortableFinalizer.kt');
  const resolverStart = finalizer.indexOf('fun prepareOfflinePlaybackPresentation(');
  const resolverEnd = finalizer.indexOf('fun finalizeToDeviceStorage(', resolverStart);
  assert.ok(resolverStart >= 0 && resolverEnd > resolverStart);
  const resolver = finalizer.slice(resolverStart, resolverEnd);

  assert.match(resolver, /collectRoleSource\(bundleDir, roles, "video"\)/);
  assert.match(resolver, /inspectOfflineRole\(videoSource, videoPlan\)/);
  assert.match(resolver, /OrionOfflinePlaybackTimeline\.withinAvDrift/);
  assert.match(finalizer, /#EXT-X-PLAYLIST-TYPE:VOD/);
  assert.match(finalizer, /#EXT-X-MAP:URI=/);
  assert.match(finalizer, /#EXT-X-MEDIA:TYPE=AUDIO/);
  assert.match(finalizer, /#EXT-X-ENDLIST/);
  assert.doesNotMatch(resolver, /MediaMuxer|portable\.mp4|finalizeToDeviceStorage/);
  assert.doesNotMatch(resolver, /https?:\/\//);
});

test('P10.5 reconciliation deep-validates managed fragment bundles before keeping Verified', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  assert.match(manager, /artifact\.optString\("role"\) == "primary" && target\.isDirectory/);
  assert.match(manager, /val validated = validateManagedFragmentBundle\(target\)/);
  assert.match(manager, /validated == null \|\| expectedSize <= 0L \|\| validated\.primaryBytes != expectedSize/);
  assert.match(manager, /artifact\.optLong\("expectedSizeBytes", -1L\)/);
  assert.match(manager, /fragmentCount !in 1\.\.MAX_FRAGMENT_COUNT/);
  assert.match(manager, /videoSegments == 0/);
  assert.match(manager, /subtitles\.length\(\) > 2/);
});
