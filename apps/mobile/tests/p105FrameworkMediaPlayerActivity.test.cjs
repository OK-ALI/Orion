const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.5 v2.2.3 native foundation owns finalized MP4 playback through framework MediaPlayer + TextureView', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');

  assert.match(activity, /class OrionPlayerActivity : Activity\(\), TextureView\.SurfaceTextureListener/);
  assert.match(activity, /MediaPlayer\(\)/);
  assert.match(activity, /TextureView\(this\)/);
  assert.match(activity, /mediaPlayer\?\.setSurface\(null\)/);
  assert.match(activity, /OrionDownloadArtifactManager\.resolveFinalizedPlayerAsset\(applicationContext, assetId\)/);
  assert.match(activity, /contentResolver\.openAssetFileDescriptor\(document\.uri, "r"\)/);
  assert.match(activity, /player\.setDataSource\(it\.fileDescriptor, it\.startOffset\.coerceAtLeast\(0L\), length\)/);
  assert.match(activity, /FileInputStream\(file\)/);
  assert.doesNotMatch(activity, /ExoPlayer|androidx\.media3|OrionFinalizedMediaSourceFactory/);
  assert.match(manager, /fun resolveFinalizedPlayerAsset/);
});

test('Orion Player launch stays asset-ID-only and returns bounded playback result state to RN', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');

  assert.match(module, /fun launchFinalizedPlayer\(/);
  assert.match(module, /OrionPlayerActivity\.createIntent\(/);
  assert.match(module, /private const val REQUEST_ORION_PLAYER = 45104/);
  assert.match(module, /REQUEST_ORION_PLAYER/);
  assert.match(module, /RESULT_POSITION_MS/);
  assert.match(module, /RESULT_DURATION_MS/);
  assert.match(module, /RESULT_COMPLETED/);

  const method = module.slice(module.indexOf('fun launchFinalizedPlayer('), module.indexOf('fun locateAsset('));
  assert.match(method, /assetId: String/);
  assert.match(method, /initialPositionSeconds: Double/);
  assert.match(method, /presentation: String\?/);
  assert.doesNotMatch(method, /Uri|content:\/\/|filePath|mediaDocument|mediaFile/);
});

test('native Activity owns bounded VTT/SRT/ASS subtitle overlay parsing and player presentation', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const parser = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerSubtitleParser.kt');

  assert.match(activity, /OrionPlayerSubtitleParser\.parse/);
  assert.match(activity, /OrionPlayerSubtitleParser\.activeCue/);
  assert.match(activity, /MAX_SUBTITLE_CHARS = 10 \* 1024 \* 1024/);
  assert.match(activity, /presentation != "stretch"/);
  assert.match(activity, /presentation == "fill"/);
  assert.match(parser, /MAX_CUES = 20_000/);
  assert.match(parser, /parseAss/);
  assert.match(parser, /parseBlocks/);
  assert.match(parser, /Dialogue:/);
  assert.doesNotMatch(parser, /\.removeLast\(/);
  assert.match(parser, /removeAt\(parts\.lastIndex\)/);
});

test('durable config and generated-Android synchronization register the Orion Player Activity', () => {
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  const sync = read('scripts', 'build-android-standalone.cjs');

  for (const name of ['OrionPlayerActivity.kt', 'OrionPlayerSubtitleParser.kt']) {
    assert.match(plugin, new RegExp(name.replace('.', '\\.')));
  }
  assert.match(plugin, /OrionPlayerSubtitleParserTest\.kt/);
  assert.match(plugin, /com\.okali\.orion\.playback\.OrionPlayerActivity/);
  assert.match(plugin, /'android:exported': 'false'/);
  assert.match(plugin, /'android:hardwareAccelerated': 'true'/);
  assert.match(plugin, /'android:screenOrientation': 'sensorLandscape'/);

  assert.match(sync, /function ensureCinemaPlayerActivity\(\)/);
  assert.match(sync, /ensureCinemaPlayerActivity\(\)/);
  assert.match(sync, /Orion Player Activity manifest verified/);
});

test('this foundation slice does not retire legacy fragment Media3 ownership or mutate Play Locally', () => {
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  const packageSource = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewPackage.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');

  assert.match(plugin, /androidx\.media3:media3-exoplayer:1\.9\.0/);
  assert.match(packageSource, /OrionOfflinePlayerViewManager\(\)/);
  assert.match(module, /fun playAssetLocally\(assetId: String, promise: Promise\)/);
  assert.match(module, /OrionDownloadArtifactManager\.open\(reactContext, assetId\.trim\(\), locate = false\)/);
});



test('offline route preflight is classification-only and cannot expose finalized locators or subtitle payloads to RN', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');

  const nativeMethod = module.slice(
    module.indexOf('fun classifyOfflinePlayback('),
    module.indexOf('fun chooseDeviceStorageTarget('),
  );
  assert.match(nativeMethod, /classifyOfflinePlaybackRoute\(clean\)/);
  assert.match(nativeMethod, /putString\("sourceKind"/);
  assert.doesNotMatch(nativeMethod, /resolveFinalizedPlayerAsset|resolveOfflinePlayerAsset|reconcile\(/);
  assert.doesNotMatch(nativeMethod, /putString\("uri"|subtitle|content:\/\/|filePath/);

  const jsMethod = bridge.slice(
    bridge.indexOf('export async function classifyNativeOfflinePlaybackV1'),
    bridge.indexOf('export interface NativeOfflineSubtitleV1'),
  );
  assert.match(jsMethod, /module\.classifyOfflinePlayback\(clean\)/);
  assert.match(jsMethod, /sourceKind/);
  assert.doesNotMatch(jsMethod, /uri|subtitles|content:\/\/|file:\/\//);

  assert.match(screen, /classifyNativeOfflinePlaybackV1\(offlineAssetId\)/);
  assert.doesNotMatch(screen, /resolveNativeOfflinePlaybackV1\(offlineAssetId\)/);
});

test('framework Activity streams bounded progress through the existing download-engine bridge', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');

  assert.match(activity, /data class OrionFinalizedPlayerProgress/);
  assert.match(activity, /PROGRESS_EVENT_INTERVAL_MS = 1_000L/);
  assert.match(activity, /publishProgress\("preparing", force = true\)/);
  assert.match(activity, /publishProgress\("buffering", force = true\)/);
  assert.match(activity, /publishProgress\("ended", force = true\)/);
  assert.match(activity, /prepared && !completed && !isFinishing/);
  assert.match(activity, /RESULT_PRESENTATION/);
  assert.match(module, /PLAYER_PROGRESS_EVENT_NAME = "OrionFinalizedPlayerProgress"/);
  assert.match(module, /OrionPlayerActivity\.setProgressListener/);
  assert.match(module, /emitPlayerProgress\(progress\)/);
  assert.match(bridge, /PLAYER_PROGRESS_EVENT_NAME = 'OrionFinalizedPlayerProgress'/);
  assert.match(bridge, /subscribeNativeFinalizedPlayerProgressV1/);
  assert.match(bridge, /launchNativeFinalizedPlayerV1/);
});

test('PlayerScreen finalized-file product route cuts over to OrionPlayerActivity while legacy fragments stay embedded', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const activitySurface = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');
  const legacySurface = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');

  assert.match(screen, /offlineSource\.sourceKind === 'file' \? \([\s\S]*<OrionFinalizedPlayerActivitySurface/);
  assert.match(screen, /\) : \(\s*<OrionOfflinePlayerSurface/);
  assert.doesNotMatch(screen, /OrionFinalizedPlayerSurface/);
  assert.match(activitySurface, /launchNativeFinalizedPlayerV1/);
  assert.match(activitySurface, /subscribeNativeFinalizedPlayerProgressV1/);
  assert.match(activitySurface, /usePlaybackTelemetryController/);
  assert.match(activitySurface, /evidence: 'native-video-event'/);
  assert.match(activitySurface, /event\.state === 'failed' \? 'error'/);
  assert.match(activitySurface, /telemetry\.flush\(\)/);
  assert.match(activitySurface, /router\.back\(\)/);
  assert.match(legacySurface, /requireNativeComponent<NativeOfflinePlayerProps>\('OrionOfflinePlayerView'\)/);
});
test('framework Activity defers MediaPlayer timeline polling until onPrepared', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');

  const openPlayer = activity.slice(
    activity.indexOf('private fun openPlayer('),
    activity.indexOf('private fun configureVerifiedDataSource('),
  );

  const preparedListener = openPlayer.slice(
    openPlayer.indexOf('player.setOnPreparedListener'),
    openPlayer.indexOf('player.setOnCompletionListener'),
  );

  const afterPrepareAsync = openPlayer.slice(
    openPlayer.indexOf('player.prepareAsync()'),
  );

  const errorListener = openPlayer.slice(
    openPlayer.indexOf('player.setOnErrorListener'),
    openPlayer.indexOf('    try {', openPlayer.indexOf('player.setOnErrorListener')),
  );

  assert.match(
    preparedListener,
    /prepared = true[\s\S]*mainHandler\.post\(progressTicker\)/,
  );

  assert.doesNotMatch(
    afterPrepareAsync,
    /mainHandler\.post\(progressTicker\)/,
  );

  assert.match(
    errorListener,
    /prepared = false[\s\S]*mainHandler\.removeCallbacks\(progressTicker\)[\s\S]*fail\(/,
  );

  assert.match(
    activity,
    /private fun updateProgress\(\) \{\s*if \(!prepared\) return/,
  );

  assert.match(
    activity,
    /private fun safePosition\(player: MediaPlayer\?\): Long \{\s*if \(!prepared \|\| player == null\) return 0L/,
  );

  assert.match(
    activity,
    /private fun safeDuration\(player: MediaPlayer\?\): Long \{\s*if \(!prepared \|\| player == null\) return 0L/,
  );

  assert.match(
    activity,
    /private fun releasePlayer\(\) \{\s*mainHandler\.removeCallbacks\(progressTicker\)\s*prepared = false/,
  );
});
