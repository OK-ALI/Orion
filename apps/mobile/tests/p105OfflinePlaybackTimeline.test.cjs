const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.5-C4 gives offline playback a bounded timing owner independent of portable cadence', () => {
  const timeline = read('plugins', 'orion-cinema-webview-native', 'OrionOfflinePlaybackTimeline.kt');
  const executableTimeline = timeline.replace(/\/\*[\s\S]*?\*\//g, '');
  const finalizer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadPortableFinalizer.kt');
  const inspectStart = finalizer.indexOf('private fun inspectOfflineRole(');
  const inspectEnd = finalizer.indexOf('private fun writeOfflineMediaPlaylist(', inspectStart);
  const offlineInspect = finalizer.slice(inspectStart, inspectEnd);

  assert.ok(inspectStart >= 0 && inspectEnd > inspectStart);
  assert.match(timeline, /MAX_SAMPLES_PER_SEGMENT = 20_000/);
  assert.match(timeline, /MAX_SAMPLE_BYTES = 16L \* 1024L \* 1024L/);
  assert.match(timeline, /MAX_SEGMENT_DURATION_US = 6L/);
  assert.match(timeline, /timestampsUs\.copyOf\(\)/);
  assert.match(timeline, /hasDuplicatePresentationTimes/);
  assert.match(timeline, /fun withinAvDrift/);
  assert.doesNotMatch(executableTimeline, /OrionPortableCadence|MediaMuxer|portable\.mp4/);
  assert.match(offlineInspect, /OrionOfflinePlaybackTimeline\.analyze/);
  assert.match(offlineInspect, /OrionOfflinePlaybackTimeline\.totalDurationUs/);
  assert.doesNotMatch(offlineInspect, /OrionPortableCadence|\.place\(/);

  assert.match(finalizer, /OrionPortableCadence\.analyze/);
  assert.match(finalizer, /OrionPortableCadence\.place/);
  assert.match(finalizer, /MediaMuxer/);
});

test('P10.5-C4 keeps offline presentation local, ID-authoritative and remux-free', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const finalizer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadPortableFinalizer.kt');
  const resolverStart = finalizer.indexOf('fun prepareOfflinePlaybackPresentation(');
  const resolverEnd = finalizer.indexOf('fun finalizeToDeviceStorage(', resolverStart);
  const resolver = finalizer.slice(resolverStart, resolverEnd);

  assert.match(module, /fun resolveOfflinePlayback\(assetId: String, promise: Promise\)/);
  assert.match(manager, /validateManagedFragmentBundle\(bundleDir\)/);
  assert.match(bridge, /resolveNativeOfflinePlaybackV1\(assetId: string\)/);
  assert.match(bridge, /uri\.startsWith\('content:\/\/'\)/);
  assert.match(bridge, /uri\.startsWith\('file:\/\/'\)/);
  assert.doesNotMatch(resolver, /MediaMuxer|portable\.mp4|https?:\/\/|localhost/);
});

test('P10.5-C5 native preparation failures use the shared player state and retain Retry and Back', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const surface = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');
  const overlay = read('src', 'components', 'player', 'PlayerStateOverlay.tsx');

  assert.match(screen, /function OfflinePlaybackPreparationSurface/);
  assert.match(screen, /useMobilePlayerController\(\)/);
  assert.match(screen, /setLoading\(state\)/);
  assert.match(screen, /state = error \? 'failed' : 'preparing'/);
  assert.match(surface, /<PlayerStateOverlay/);
  assert.match(surface, /onBack=\{nativeState\.state === 'failed'/);
  assert.match(surface, /onRetry=\{nativeState\.state === 'failed'/);
  assert.match(surface, /controller\.setLoading/);
  assert.doesNotMatch(screen, /Offline playback unavailable/);
  assert.doesNotMatch(screen, /offlineUri/);
  assert.match(overlay, /onBack\?: \(\) => void/);
  assert.match(overlay, />Back<\/Text>/);
});

test('P10.5-C4 native sync includes the playback timing production and JVM sources', () => {
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  assert.match(plugin, /'OrionOfflinePlaybackTimeline\.kt'/);
  assert.match(plugin, /'OrionOfflinePlaybackTimelineTest\.kt'/);
});
