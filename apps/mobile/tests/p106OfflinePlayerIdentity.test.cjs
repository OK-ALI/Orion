const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-A1 gives the finalized offline player a bounded Orion identity HUD', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');

  assert.match(activity, /private var accentColor = Color\.rgb\(229, 9, 20\)/);
  assert.match(activity, /text = "ORION OFFLINE"/);
  assert.match(activity, /contentDescription = "Orion offline playback"/);
  assert.match(activity, /progressTintList = ColorStateList\.valueOf\(accentColor\)/);
  assert.match(activity, /thumbTintList = ColorStateList\.valueOf\(accentColor\)/);
  assert.match(activity, /button\("Play", primary = true\)/);
  assert.match(activity, /roundedBackground\(/);
  assert.match(activity, /compactSubtitleLabel/);
  assert.match(activity, /"CC EN"/);
  assert.match(activity, /"CC UR"/);
  assert.match(activity, /"CC Off"/);
  assert.doesNotMatch(
    activity,
    /subtitleButton\.text = subtitleTracks\.getOrNull\(selectedSubtitleIndex\)\?\.label/,
  );
});

test('P10.6-A1 keeps finalized playback on the physically proven framework player core', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');

  assert.match(activity, /class OrionPlayerActivity : Activity\(\), TextureView\.SurfaceTextureListener/);
  assert.match(activity, /val player = MediaPlayer\(\)/);
  assert.match(activity, /TextureView\(this\)/);
  assert.match(
    activity,
    /OrionDownloadArtifactManager\.resolveFinalizedPlayerAsset\(applicationContext, assetId\)/,
  );
  assert.match(
    activity,
    /private fun configureVerifiedDataSource\(player: MediaPlayer, asset: OrionOfflinePlayerAsset\)/,
  );
  assert.match(
    activity,
    /player\.setDataSource\(it\.fileDescriptor, it\.startOffset\.coerceAtLeast\(0L\), length\)/,
  );
  assert.match(activity, /player\.prepareAsync\(\)/);
  assert.doesNotMatch(activity, /ExoPlayer|androidx\.media3|OrionFinalizedMediaSourceFactory/);
});

test('P10.6-A1 preserves the v2.2.4 MediaPlayer prepare-state repair', () => {
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
    /private fun releasePlayer\(\) \{[\s\S]{0,400}mainHandler\.removeCallbacks\(progressTicker\)[\s\S]{0,400}prepared = false/,
  );
});
