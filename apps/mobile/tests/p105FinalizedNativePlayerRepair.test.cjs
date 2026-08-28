const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('finalized MP4 and legacy fragments have isolated native route owners', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const finalized = read('src', 'features', 'playback', 'OrionFinalizedPlayerSurface.tsx');
  const shared = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const legacyFactory = read('plugins', 'orion-cinema-webview-native', 'OrionOfflineMediaSourceFactory.kt');
  const finalizedFactory = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedMediaSourceFactory.kt');

  assert.match(screen, /offlineSource\.sourceKind === 'file' \? \([\s\S]*<OrionFinalizedPlayerSurface/);
  assert.match(screen, /\) : \(\s*<OrionOfflinePlayerSurface/);
  assert.match(finalized, /OrionNativeAssetPlayerSurface[\s\S]*finalized/);
  assert.match(shared, /'OrionFinalizedPlayerView'/);
  assert.match(shared, /'OrionOfflinePlayerView'/);
  assert.match(manager, /fun resolveFinalizedPlayerAsset/);
  assert.match(manager, /asset\.mediaDocument == null && asset\.mediaFile == null/);
  assert.match(manager, /fun resolveOfflinePlayerAsset/);
  assert.match(manager, /asset\.mediaDocument != null \|\| asset\.mediaFile != null/);
  assert.match(legacyFactory, /if \(asset\.mediaDocument != null \|\| asset\.mediaFile != null\) return null/);
  assert.match(finalizedFactory, /if \(asset\.videoParts\.isNotEmpty\(\) \|\| asset\.audioParts\.isNotEmpty\(\)\) return null/);
  assert.doesNotMatch(finalizedFactory, /OrionOfflineFragmentDataSource|MediaMuxer|https?:\/\/|localhost/);
  assert.doesNotMatch(finalized, /expo-video|useVideoPlayer|uri|filePath/);
});

test('React Native supplies a non-zero-capable full-size native host', () => {
  const styles = read('src', 'features', 'playback', 'playerStyles.ts');
  const surface = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');

  assert.match(styles, /nativeVideoHost:\s*\{[\s\S]*flex: 1,[\s\S]*width: '100%'[\s\S]*alignSelf: 'stretch'/);
  assert.match(styles, /nativeVideo:\s*\{[\s\S]*position: 'absolute'[\s\S]*top: 0,[\s\S]*right: 0,[\s\S]*bottom: 0,[\s\S]*left: 0/);
  assert.match(surface, /<View style=\{styles\.nativeVideoHost\}>[\s\S]*style=\{styles\.nativeVideo\}/);
  assert.match(surface, /assetId=\{assetId\}/);
  assert.doesNotMatch(surface, /offlineUri|streamUrl/);
});

test('dedicated native finalized player proves surface, decoder, track and first-frame stages', () => {
  const view = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedPlayerView.kt');
  const policy = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedPlayerPolicy.kt');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedPlayerViewManager.kt');
  const resource = read('plugins', 'orion-cinema-webview-native-res', 'layout', 'orion_finalized_player_view.xml');

  assert.match(view, /resolveFinalizedPlayerAsset\(reactContext, requestedAssetId\)/);
  assert.match(view, /OrionFinalizedMediaSourceFactory\.build/);
  assert.match(view, /playerView\.player !== player/);
  assert.match(view, /videoSurface == null/);
  assert.match(view, /setZOrderOnTop\(false\)/);
  assert.match(view, /setZOrderMediaOverlay\(false\)/);
  assert.match(view, /SurfaceHolder\.Callback/);
  assert.match(view, /AnalyticsListener/);
  assert.match(view, /onVideoDecoderInitialized/);
  assert.match(view, /onAudioDecoderInitialized/);
  assert.match(view, /onRenderedFirstFrame/);
  for (const field of ['viewWidth', 'viewHeight', 'surfaceAvailable', 'surfaceWidth', 'surfaceHeight', 'videoTrackCount', 'audioTrackCount', 'videoDecoderInitialized', 'audioDecoderInitialized', 'firstFrameRendered']) {
    assert.match(view, new RegExp(`put(?:Int|Boolean)\\("${field}"`));
  }
  assert.match(policy, /LAYOUT_TIMEOUT_MS = 3_000L/);
  assert.match(policy, /PREPARATION_TIMEOUT_MS = 30_000L/);
  assert.match(policy, /FIRST_FRAME_TIMEOUT_MS = 10_000L/);
  assert.match(policy, /finalized-video-surface-unavailable/);
  assert.match(policy, /finalized-player-prepare-timeout/);
  assert.match(policy, /finalized-video-decoder-not-initialized/);
  assert.match(policy, /finalized-first-frame-timeout/);
  assert.match(policy, /fun resetForRetry/);
  assert.match(view, /OrionFinalizedPlayerPolicy\.resetForRetry/);
  assert.match(manager, /override fun getName\(\): String = "OrionFinalizedPlayerView"/);
  assert.match(resource, /app:surface_type="surface_view"/);
  assert.match(resource, /android:layout_width="match_parent"/);
  assert.match(resource, /android:layout_height="match_parent"/);
});

test('finalized source uses exact bounded descriptors and modern local subtitles', () => {
  const factory = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedMediaSourceFactory.kt');
  const resolver = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');

  assert.match(factory, /MediaItem\.SubtitleConfiguration\.Builder\(uri\)/);
  assert.match(factory, /\.setSubtitleConfigurations\(subtitleConfigurations\)/);
  assert.doesNotMatch(factory, /SingleSampleMediaSource|experimentalParseSubtitlesDuringExtraction\(false\)/);
  assert.match(factory, /DefaultMediaSourceFactory\(factory\)\.createMediaSource\(item\)/);
  assert.match(factory, /contentResolver\.openFileDescriptor\(dataSpec\.uri, "r"\)/);
  assert.match(factory, /dataSpec\.position > source\.sizeBytes/);
  assert.match(factory, /dataSpec\.length > available/);
  assert.match(factory, /stream\.channel\.position\(dataSpec\.position\)/);
  assert.match(factory, /remaining -= count\.toLong\(\)/);
  assert.match(factory, /DefaultDataSource\.Factory\(context\)/);
  assert.match(resolver, /artifact\.optString\("availability"\) != "verified"[\s\S]*return@forEach/);
  assert.doesNotMatch(resolver, /offline-subtitle-not-verified/);
});

test('new native code, JVM policy and PlayerView XML are synchronized and registered', () => {
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  const sync = read('scripts', 'build-android-standalone.cjs');
  const packageSource = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewPackage.kt');

  for (const file of ['OrionFinalizedMediaSourceFactory.kt', 'OrionFinalizedPlayerPolicy.kt', 'OrionFinalizedPlayerView.kt', 'OrionFinalizedPlayerViewManager.kt', 'OrionFinalizedPlayerPolicyTest.kt', 'orion_finalized_player_view.xml']) {
    assert.match(plugin, new RegExp(file.replace('.', '\\.')));
  }
  assert.match(sync, /CINEMA_NATIVE_RESOURCE_FILES/);
  assert.match(sync, /Cinema native resource did not synchronize/);
  assert.match(packageSource, /OrionFinalizedPlayerViewManager\(\)/);
  assert.match(packageSource, /OrionOfflinePlayerViewManager\(\)/);
});

test('Play Locally remains the exact independently granted artifact path', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  assert.match(manager, /Intent\(Intent\.ACTION_VIEW\)/);
  assert.match(manager, /ClipData\.newRawUri\("Orion download", uri\)/);
  assert.match(manager, /Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.doesNotMatch(manager, /Uri\.fromFile\(target\)/);
});
