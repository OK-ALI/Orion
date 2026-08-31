const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-A2 carries active Orion theme presentation tokens across the asset-ID-only native boundary', () => {
  const surface = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');

  assert.match(surface, /useOrionTheme/);
  assert.match(surface, /const \{ theme, preferences \} = useOrionTheme\(\)/);
  assert.match(surface, /useRef/);
  assert.match(surface, /const nativePlayerThemeRef = useRef\(\{/);
  assert.match(surface, /nativePlayerThemeRef\.current = \{/);
  assert.match(surface, /accent: theme\.accent/);
  assert.match(surface, /onAccent: theme\.onAccent/);
  assert.match(surface, /mediaScrim: theme\.mediaScrim/);
  assert.match(surface, /surface: theme\.surface/);
  assert.match(surface, /reducedMotion: preferences\.reducedMotion/);
  assert.match(surface, /theme: nativePlayerThemeRef\.current/);
  assert.doesNotMatch(surface, /#E50914/);

  const launchEffect = surface.slice(
    surface.indexOf('useEffect(() => {'),
    surface.indexOf('  return (', surface.indexOf('useEffect(() => {')),
  );
  const launchDependencies = launchEffect.slice(launchEffect.lastIndexOf('}, ['));
  assert.doesNotMatch(
    launchDependencies,
    /theme\.accent|theme\.onAccent|theme\.mediaScrim|theme\.surface|preferences\.reducedMotion/,
  );

  assert.match(bridge, /export interface NativeFinalizedPlayerThemeV1/);
  assert.match(bridge, /normalizeMediaScrimArgb/);
  assert.match(bridge, /normalizeFinalizedPlayerThemeV1/);
  assert.match(bridge, /safeTheme\.accent/);
  assert.match(bridge, /safeTheme\.onAccent/);
  assert.match(bridge, /safeTheme\.mediaScrim/);
  assert.match(bridge, /safeTheme\.surface/);
  assert.match(bridge, /safeTheme\.reducedMotion/);

  const launch = module.slice(
    module.indexOf('fun launchFinalizedPlayer('),
    module.indexOf('fun locateAsset('),
  );
  assert.match(launch, /themeAccent: String\?/);
  assert.match(launch, /themeOnAccent: String\?/);
  assert.match(launch, /themeMediaScrim: String\?/);
  assert.match(launch, /themeSurface: String\?/);
  assert.match(launch, /reducedMotion: Boolean/);
  assert.match(launch, /\^#\[0-9A-F\]\{6\}\$/);
  assert.match(launch, /\^#\[0-9A-F\]\{8\}\$/);
  assert.doesNotMatch(launch, /Uri|content:\/\/|filePath|mediaDocument|mediaFile/);

  assert.match(activity, /applyPresentationThemeFromIntent\(\)\s*buildUi\(\)/);
  assert.match(activity, /EXTRA_THEME_ACCENT/);
  assert.match(activity, /EXTRA_THEME_ON_ACCENT/);
  assert.match(activity, /EXTRA_THEME_MEDIA_SCRIM/);
  assert.match(activity, /EXTRA_THEME_SURFACE/);
  assert.match(activity, /EXTRA_REDUCED_MOTION/);
  assert.match(activity, /setTextColor\(contentTextColor\)/);
  assert.match(activity, /setTextColor\(if \(selected\) onAccentColor else contentTextColor\)/);
  assert.match(activity, /alphaColor\(accentColor, 48\)/);
  assert.match(activity, /alphaColor\(accentColor, 154\)/);
  assert.match(activity, /cinematicChromeScrim\(top = true\)/);
  assert.match(activity, /cinematicChromeScrim\(top = false\)/);
  assert.match(activity, /alphaColor\(chromeFillColor, 188\)/);
  assert.doesNotMatch(activity, /setBackgroundColor\(chromeFillColor\)/);
});

test('P10.6-A2 keeps watching-first chrome while P10.7 waits for confirmed seek completion', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');

  assert.match(activity, /CHROME_AUTO_HIDE_MS = 2_800L/);
  assert.match(activity, /CHROME_FADE_MS = 180L/);
  assert.match(activity, /private val hideChromeRunnable = Runnable \{ hideChrome\(\) \}/);
  assert.match(activity, /private fun showChrome\(autoHide: Boolean = true\)/);
  assert.match(activity, /private fun hideChrome\(\)/);
  assert.match(activity, /private fun shouldAutoHideChrome\(\): Boolean/);
  assert.match(activity, /if \(reducedMotion\) \{/);
  assert.match(activity, /mainHandler\.postDelayed\(hideChromeRunnable, CHROME_AUTO_HIDE_MS\)/);
  assert.match(activity, /setOnClickListener \{[\s\S]*hideChrome\(\)[\s\S]*showChrome\(\)/);

  const seekListener = activity.slice(
    activity.indexOf('setOnSeekBarChangeListener'),
    activity.indexOf('bottom.addView(seekBar'),
  );
  assert.match(seekListener, /seekingByUser = true[\s\S]*showChrome\(autoHide = false\)/);
  assert.match(seekListener, /val player = mediaPlayer \?: return/);
  assert.match(seekListener, /OrionMediaPlayerSeekPolicy\.targetMs/);
  assert.match(seekListener, /val playWhenSettled = pendingSeek\?\.playWhenSettled/);
  assert.match(seekListener, /player\.isPlaying/);
  assert.match(seekListener, /requestSeek\(player, target, playWhenSettled = playWhenSettled\)/);
  assert.doesNotMatch(seekListener, /seekingByUser = false/);
  assert.match(activity, /setOnSeekCompleteListener[\s\S]{0,150}handleSeekComplete/);

  const playControl = activity.slice(
    activity.indexOf('playPauseView = button("Play", primary = true)'),
    activity.indexOf('positionView = TextView'),
  );
  assert.match(playControl, /player\.pause\(\)[\s\S]*showChrome\(autoHide = false\)/);
  assert.match(playControl, /player\.start\(\)[\s\S]*showChrome\(\)/);
});

test('P10.6-A2 keeps the physically proven MediaPlayer lifecycle and finalized SAF ownership frozen', () => {
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

  assert.match(activity, /val player = MediaPlayer\(\)/);
  assert.match(activity, /TextureView\(this\)/);
  assert.match(
    activity,
    /OrionDownloadArtifactManager\.resolveFinalizedPlayerAsset\(applicationContext, assetId\)/,
  );
  assert.match(
    activity,
    /player\.setDataSource\(it\.fileDescriptor, it\.startOffset\.coerceAtLeast\(0L\), length\)/,
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
    activity,
    /private fun safePosition\(player: MediaPlayer\?\): Long \{\s*if \(!prepared \|\| player == null\) return 0L/,
  );
  assert.match(
    activity,
    /private fun safeDuration\(player: MediaPlayer\?\): Long \{\s*if \(!prepared \|\| player == null\) return 0L/,
  );
  assert.doesNotMatch(activity, /ExoPlayer|androidx\.media3|OrionFinalizedMediaSourceFactory/);
});
