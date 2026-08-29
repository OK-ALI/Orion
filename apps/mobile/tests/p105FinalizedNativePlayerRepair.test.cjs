const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('finalized MP4 and legacy fragments have isolated product route owners after the framework-player cutover', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const finalized = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');
  const legacy = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const legacyFactory = read('plugins', 'orion-cinema-webview-native', 'OrionOfflineMediaSourceFactory.kt');

  assert.match(screen, /offlineSource\.sourceKind === 'file' \? \([\s\S]*<OrionFinalizedPlayerActivitySurface/);
  assert.match(screen, /\) : \(\s*<OrionOfflinePlayerSurface/);
  assert.doesNotMatch(screen, /OrionFinalizedPlayerSurface/);
  assert.match(finalized, /launchNativeFinalizedPlayerV1/);
  assert.match(finalized, /subscribeNativeFinalizedPlayerProgressV1/);
  assert.match(activity, /MediaPlayer\(\)/);
  assert.match(activity, /TextureView\(this\)/);
  assert.match(activity, /resolveFinalizedPlayerAsset\(applicationContext, assetId\)/);
  assert.doesNotMatch(activity, /ExoPlayer|androidx\.media3|OrionFinalizedMediaSourceFactory/);
  assert.match(legacy, /'OrionOfflinePlayerView'/);
  assert.match(manager, /fun resolveFinalizedPlayerAsset/);
  assert.match(manager, /fun resolveOfflinePlayerAsset/);
  assert.match(legacyFactory, /if \(asset\.mediaDocument != null \|\| asset\.mediaFile != null\) return null/);
});

test('finalized Activity receives identity, position, title, presentation and bounded theme tokens only', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');

  const method = module.slice(module.indexOf('fun launchFinalizedPlayer('), module.indexOf('fun locateAsset('));
  assert.match(method, /assetId: String/);
  assert.match(method, /initialPositionSeconds: Double/);
  assert.match(method, /title: String\?/);
  assert.match(method, /presentation: String\?/);
  assert.match(method, /themeAccent: String\?/);
  assert.match(method, /themeText: String\?/);
  assert.match(method, /themeBorder: String\?/);
  assert.match(method, /reducedMotion: Boolean/);
  assert.doesNotMatch(method, /Uri|content:\/\/|filePath|mediaDocument|mediaFile/);
  assert.match(activity, /EXTRA_ASSET_ID/);
  assert.match(activity, /EXTRA_INITIAL_POSITION_MS/);
  assert.match(activity, /EXTRA_PRESENTATION/);
  assert.match(activity, /EXTRA_THEME_ACCENT/);
  assert.match(activity, /EXTRA_THEME_TEXT/);
  assert.match(activity, /EXTRA_THEME_BORDER/);
  assert.match(activity, /EXTRA_REDUCED_MOTION/);
  assert.match(bridge, /const safeTheme = normalizeFinalizedPlayerThemeV1\(theme\)/);
  assert.match(bridge, /module\.launchFinalizedPlayer\(\s*clean,\s*initialPosition,\s*title\?\.trim\(\) \|\| null,\s*safePresentation,\s*safeTheme\.accent,/);
  assert.match(bridge, /safeTheme\.border,\s*safeTheme\.reducedMotion,/);
});

test('framework player progress and final result return through one bounded bridge', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const surface = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');

  assert.match(activity, /publishProgress\(currentPlaybackState\(\)\)/);
  assert.match(activity, /PROGRESS_EVENT_INTERVAL_MS = 1_000L/);
  assert.match(activity, /RESULT_POSITION_MS/);
  assert.match(activity, /RESULT_DURATION_MS/);
  assert.match(activity, /RESULT_COMPLETED/);
  assert.match(activity, /RESULT_PRESENTATION/);
  assert.match(module, /PLAYER_PROGRESS_EVENT_NAME/);
  assert.match(module, /putDouble\("currentTime"/);
  assert.match(module, /putDouble\("duration"/);
  assert.match(surface, /usePlaybackTelemetryController/);
  assert.match(surface, /evidence: 'native-video-event'/);
  assert.match(surface, /onPlaybackSnapshot/);
  assert.match(surface, /onVerifiedPlaybackCompletion/);
});

test('Activity owns native presentation and subtitles without reusing the retired finalized Media3 surface', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const parser = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerSubtitleParser.kt');
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');

  assert.match(activity, /presentation != "stretch"/);
  assert.match(activity, /presentation == "fill"/);
  assert.match(activity, /OrionPlayerSubtitleParser\.parse/);
  assert.match(activity, /OrionPlayerSubtitleParser\.activeCue/);
  assert.match(parser, /parseVtt|parseSrt|parseAss/);
  assert.doesNotMatch(screen, /OrionFinalizedPlayerSurface/);
});

test('Play Locally remains the exact independently granted artifact path', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  assert.match(manager, /Intent\(Intent\.ACTION_VIEW\)/);
  assert.match(manager, /ClipData\.newRawUri\("Orion download", uri\)/);
  assert.match(manager, /Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.doesNotMatch(manager, /Uri\.fromFile\(target\)/);
});
