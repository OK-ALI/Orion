const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.5 routes finalized SAF files and legacy fragments through the asset-id native surface', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const offline = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');

  assert.match(screen, /offlineAssetId\?: string/);
  assert.match(screen, /offlineAssetId && offlineSource \? \([\s\S]*<OrionOfflinePlayerSurface/);
  assert.doesNotMatch(screen, /<NativePlayerSurface/);
  assert.match(screen, /assetId=\{offlineAssetId\}/);
  assert.match(screen, /\) : \(\s*<EmbedPlayerSurface/);
  assert.match(screen, /resolveNativeOfflinePlaybackV1\(offlineAssetId\)/);
  assert.doesNotMatch(screen, /offlineUri/);
  assert.match(offline, /requireNativeComponent<NativeOfflinePlayerProps>\('OrionOfflinePlayerView'\)/);
  assert.match(offline, /assetId=\{assetId\}/);
  assert.doesNotMatch(offline, /streamUrl|offlineUri|https?:\/\/|localhost/);
});

test('P10.5-C5 native authority deep-validates exact P10.4 ownership before Media3 preparation', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const view = read('plugins', 'orion-cinema-webview-native', 'OrionOfflinePlayerView.kt');
  const policy = read('plugins', 'orion-cinema-webview-native', 'OrionOfflineMediaSourcePolicy.kt');

  const start = manager.indexOf('fun resolveOfflinePlayerAsset(');
  const end = manager.indexOf('fun deleteSelected(', start);
  const resolver = manager.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(resolver, /reconcile\(context, setOf\(clean\)\)/);
  assert.match(resolver, /destination"\) != "orion-library"/);
  assert.match(resolver, /availability"\) != "verified"/);
  assert.match(resolver, /validateManagedFragmentBundle\(bundleDir\)/);
  assert.match(resolver, /canonicalContained\(bundleDir, file\)/);
  assert.match(resolver, /file\.length\(\) != part\.sizeBytes/);
  assert.match(resolver, /OrionOfflineMediaSourcePolicy\.build/);
  assert.match(view, /resolveOfflinePlayerAsset\(reactContext, requestedAssetId\)/);
  assert.match(policy, /video-init/);
  assert.match(policy, /audio-init/);
  assert.match(policy, /MAX_FRAGMENTS = 20_000/);
});

test('P10.5-C5.1 maps local role streams and modern subtitle configurations into controller-free Media3', () => {
  const factory = read('plugins', 'orion-cinema-webview-native', 'OrionOfflineMediaSourceFactory.kt');
  const view = read('plugins', 'orion-cinema-webview-native', 'OrionOfflinePlayerView.kt');
  const combined = `${factory}\n${view}`;

  assert.match(factory, /ProgressiveMediaSource\.Factory\(fragmentFactory\)/);
  assert.match(factory, /DefaultMediaSourceFactory\(routedFactory\)/);
  assert.match(factory, /DefaultDataSource\.Factory\(context, fragmentFactory\)/);
  assert.match(factory, /subtitle\.document\?\.uri \?: subtitle\.file\?\.let\(Uri::fromFile\)/);
  assert.match(factory, /OrionOfflineDocumentDataSource/);
  assert.match(factory, /openFileDescriptor\(dataSpec\.uri, "r"\)/);
  assert.match(factory, /\.setSubtitleConfigurations\(subtitleConfigurations\)/);
  assert.doesNotMatch(factory, /experimentalParseSubtitlesDuringExtraction\(false\)/);
  assert.doesNotMatch(factory, /SingleSampleMediaSource/);
  assert.match(factory, /MergingMediaSource\(\s*OrionOfflineMediaSourcePolicy\.ADJUST_SEPARATE_AV_PERIOD_TIME_OFFSETS,\s*OrionOfflineMediaSourcePolicy\.CLIP_SEPARATE_AV_DURATIONS,/);
  assert.match(factory, /\.setId\(subtitle\.id\)/);
  assert.match(factory, /\.setLanguage\(subtitle\.language\)/);
  assert.match(factory, /\.setLabel\(subtitle\.label\)/);
  assert.match(factory, /C\.SELECTION_FLAG_DEFAULT/);
  assert.match(factory, /OrionOfflineFragmentDataSource/);
  assert.match(factory, /streams\[videoUri\.toString\(\)\] = asset\.videoParts/);
  assert.match(factory, /streams\[uri\.toString\(\)\] = asset\.audioParts/);
  assert.match(view, /useController = false/);
  assert.doesNotMatch(combined, /OrionPortableCadence|OrionOfflinePlaybackTimeline|prepareOfflinePlaybackPresentation|MediaMuxer|portable\.mp4/);
  assert.doesNotMatch(combined, /https?:\/\/|localhost|provider|fallback/i);
});

test('P10.5-C5 shares Orion controls, Retry and Back and owns route orientation before preparation', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const embed = read('src', 'features', 'playback', 'EmbedPlayerSurface.tsx');
  const offline = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');
  const overlay = read('src', 'components', 'player', 'PlayerStateOverlay.tsx');

  assert.match(screen, /ScreenOrientation\.getOrientationLockAsync\(\)/);
  assert.match(screen, /ScreenOrientation\.lockAsync\(ScreenOrientation\.OrientationLock\.LANDSCAPE\)/);
  assert.match(screen, /const lifecycle = ScreenOrientation\.getOrientationLockAsync\(\)/);
  assert.match(screen, /lifecycle\.then\(\(\) =>/);
  assert.ok(screen.indexOf('ScreenOrientation.getOrientationLockAsync()') < screen.indexOf('const surface ='));
  assert.doesNotMatch(embed, /ScreenOrientation\.getOrientationLockAsync\(\)/);
  assert.match(offline, /<PlayerHUD/);
  assert.match(offline, /<PlayerStateOverlay/);
  assert.match(offline, /onBack=\{nativeState\.state === 'failed' \? \(\) => router\.back\(\)/);
  assert.match(offline, /onRetry=\{nativeState\.state === 'failed' \? \(\) => facade\.retry\(\)/);
  assert.match(offline, /controller\.setLoading\(next\.state === 'failed' \? 'failed'/);
  assert.match(overlay, /onBack\?: \(\) => void/);
  assert.match(overlay, /onRetry\?: \(\) => void/);
});

test('P10.5-C5 keeps bounded native diagnostics and synchronization sources', () => {
  const view = read('plugins', 'orion-cinema-webview-native', 'OrionOfflinePlayerView.kt');
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  const packageSource = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewPackage.kt');

  for (const field of ['stage', 'sourceKind', 'videoRoleCount', 'audioRoleCount', 'fragmentCount', 'failedFragmentIndex', 'category']) {
    assert.match(view, new RegExp(`put\\("${field}"`));
  }
  assert.match(view, /offline-media3-\$category/);
  assert.doesNotMatch(view, /credential|requestHeader|authorization|subtitleProviderUrl/i);
  assert.match(packageSource, /OrionOfflinePlayerViewManager\(\)/);
  for (const file of [
    'OrionOfflineMediaSourcePolicy.kt',
    'OrionOfflineMediaSourceFactory.kt',
    'OrionOfflinePlayerView.kt',
    'OrionOfflinePlayerViewManager.kt',
    'OrionOfflineMediaSourcePolicyTest.kt',
  ]) assert.match(plugin, new RegExp(file.replace('.', '\\.')));
  assert.match(plugin, /androidx\.media3:media3-exoplayer:1\.9\.0/);
  assert.match(plugin, /androidx\.media3:media3-ui:1\.9\.0/);
});
