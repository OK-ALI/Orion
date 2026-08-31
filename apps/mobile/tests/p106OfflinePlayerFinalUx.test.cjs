const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-A3 completes theme-aware native player presentation across the six Orion themes', () => {
  const themeContext = read('src', 'context', 'ThemeContext.tsx');
  const surface = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const overlay = read('src', 'components', 'player', 'PlayerStateOverlay.tsx');

  for (const themeId of [
    'midnight-premiere',
    'amoled',
    'mocha',
    'slate',
    'projector-silver',
    'custom',
  ]) {
    assert.match(themeContext, new RegExp(themeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(surface, /text: theme\.text/);
  assert.match(surface, /textSecondary: theme\.textSecondary/);
  assert.match(surface, /elevated: theme\.elevated/);
  assert.match(surface, /border: theme\.border/);
  assert.match(surface, /backgroundColor: theme\.background/);
  assert.doesNotMatch(surface, /backgroundColor: '#000'/);

  assert.match(bridge, /text: string/);
  assert.match(bridge, /textSecondary: string/);
  assert.match(bridge, /elevated: string/);
  assert.match(bridge, /border: string/);
  assert.match(bridge, /normalizeRgbaArgb/);
  assert.match(bridge, /border: normalizeRgbaArgb\(value\?\.border, '#1AFFFFFF'\)/);

  const launch = module.slice(
    module.indexOf('fun launchFinalizedPlayer('),
    module.indexOf('fun locateAsset('),
  );
  assert.match(launch, /themeText: String\?/);
  assert.match(launch, /themeTextSecondary: String\?/);
  assert.match(launch, /themeElevated: String\?/);
  assert.match(launch, /themeBorder: String\?/);
  assert.match(launch, /safeThemeText/);
  assert.match(launch, /safeThemeTextSecondary/);
  assert.match(launch, /safeThemeElevated/);
  assert.match(launch, /safeThemeBorder/);
  assert.doesNotMatch(launch, /Uri|content:\/\/|filePath|mediaDocument|mediaFile/);

  assert.match(activity, /EXTRA_THEME_TEXT/);
  assert.match(activity, /EXTRA_THEME_TEXT_SECONDARY/);
  assert.match(activity, /EXTRA_THEME_ELEVATED/);
  assert.match(activity, /EXTRA_THEME_BORDER/);
  assert.match(activity, /setTextColor\(chromeTextColor\)/);
  assert.match(activity, /setTextColor\(contentTextColor\)/);
  assert.match(activity, /setTextColor\(secondaryTextColor\)/);
  assert.match(activity, /alphaColor\(accentColor, 48\)/);
  assert.match(activity, /alphaColor\(accentColor, 154\)/);
  assert.match(activity, /alphaColor\(panelFillColor, 108\)/);
  assert.match(activity, /alphaColor\(contentTextColor, 36\)/);
  assert.match(activity, /cinematicChromeScrim\(top = true\)/);
  assert.match(activity, /cinematicChromeScrim\(top = false\)/);
  assert.match(activity, /setTextColor\(if \(selected\) onAccentColor else contentTextColor\)/);
  assert.doesNotMatch(activity, /setTextColor\(if \(primary\) onAccentColor else contentTextColor\)/);
  assert.doesNotMatch(activity, /setBackgroundColor\(chromeFillColor\)/);
  assert.match(activity, /progressBackgroundTintList = ColorStateList\.valueOf\(alphaColor\(chromeTextColor, 85\)\)/);
  assert.match(activity, /private var subtitleBackground = "medium"/);
  assert.match(activity, /private fun applySubtitleAppearance\(\)/);
  assert.match(activity, /val backgroundAlpha = when \(subtitleBackground\)/);
  assert.match(activity, /"low" -> 126/);
  assert.match(activity, /"high" -> 238/);
  assert.match(activity, /else -> 188/);
  assert.match(activity, /subtitleView\.background = roundedBackground\(\s*alphaColor\(panelFillColor, backgroundAlpha\),\s*borderColor,/);

  assert.match(overlay, /backgroundColor: theme\.elevated/);
  assert.match(overlay, /borderColor: theme\.border/);
  assert.match(overlay, /color=\{theme\.accent\}/);
  assert.match(overlay, /color: theme\.text/);
  assert.match(overlay, /color: theme\.textSecondary/);
});

test('P10.6-A3 replaces blind subtitle and sizing cycling with explicit accessible selectors', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const preferences = read('src', 'features', 'playback', 'presentationPreferences.ts');

  const buildUi = activity.slice(
    activity.indexOf('private fun buildUi()'),
    activity.indexOf('private fun updateProgress()'),
  );

  const presentationControl = buildUi.slice(
    buildUi.indexOf('presentationView = button("Fit")'),
    buildUi.indexOf('subtitleButton = button("CC Off")'),
  );
  assert.match(presentationControl, /setOnClickListener \{ showPresentationSelector\(\) \}/);
  assert.doesNotMatch(presentationControl, /presentation = when \(presentation\)/);

  const subtitleControl = buildUi.slice(
    buildUi.indexOf('subtitleButton = button("CC Off")'),
    buildUi.indexOf('controls\.addView\(playPauseView'),
  );
  assert.match(subtitleControl, /showSubtitleSelector\(\)/);
  assert.doesNotMatch(subtitleControl, /selectedSubtitleIndex = if \(selectedSubtitleIndex/);

  assert.match(activity, /private fun showPresentationSelector\(\)/);
  assert.match(activity, /"fit" to "Fit"/);
  assert.match(activity, /"fill" to "Fill"/);
  assert.match(activity, /"stretch" to "Stretch"/);
  assert.match(activity, /private fun showSubtitleSelector\(\)/);
  assert.match(activity, /mutableListOf\("-1" to "Off"\)/);
  assert.match(activity, /friendlySubtitleLabel/);
  assert.match(activity, /"english" -> "CC EN"/);
  assert.match(activity, /"urdu" -> "CC UR"/);
  assert.match(activity, /"korean" -> "CC KO"/);
  assert.match(activity, /"japanese" -> "CC JA"/);
  assert.match(activity, /"chinese" -> "CC ZH"/);
  assert.match(activity, /contentDescription = if \(selected\) "\$label, selected" else label/);
  assert.doesNotMatch(activity, /announceForAccessibility/);
  assert.match(
    activity,
    /sendAccessibilityEvent\(AccessibilityEvent\.TYPE_VIEW_SELECTED\)/,
  );

  const backPressed = activity.slice(
    activity.indexOf('override fun onBackPressed()'),
    activity.indexOf('override fun onSurfaceTextureAvailable'),
  );
  assert.match(backPressed, /selectorOverlay\.visibility == View\.VISIBLE/);
  assert.match(backPressed, /dismissChoicePanel\(\)/);

  assert.match(
    preferences,
    /const MODES = new Set<MobilePlayerPresentation>\(\['fit', 'fill', 'stretch', 'provider'\]\)/,
  );
});

test('P10.6-A3 makes the native landscape layout cutout-aware without touching playback ownership', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');

  assert.match(activity, /setOnApplyWindowInsetsListener/);
  assert.match(activity, /private fun resolveSafeInsets\(insets: WindowInsets\): PlayerSafeInsets/);
  assert.match(activity, /WindowInsets\.Type\.systemBars\(\) or WindowInsets\.Type\.displayCutout\(\)/);
  assert.match(activity, /Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.R/);
  assert.match(activity, /@Suppress\("DEPRECATION"\)/);
  assert.match(activity, /insets\.displayCutout/);
  assert.match(activity, /safeInsetLeft/);
  assert.match(activity, /safeInsetRight/);
  assert.match(activity, /safeInsetTop/);
  assert.match(activity, /safeInsetBottom/);
  assert.match(activity, /subtitleView\.maxWidth/);
  assert.match(activity, /ellipsize = TextUtils\.TruncateAt\.END/);
  assert.match(activity, /leftMargin = dp\(32\) \+ safeInsetLeft/);
  assert.match(activity, /rightMargin = dp\(32\) \+ safeInsetRight/);

  assert.match(activity, /val player = MediaPlayer\(\)/);
  assert.match(activity, /TextureView\(this\)/);
  assert.match(
    activity,
    /OrionDownloadArtifactManager\.resolveFinalizedPlayerAsset\(applicationContext, assetId\)/,
  );
  assert.match(activity, /player\.prepareAsync\(\)/);
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

test('P10.6-A3 preserves seek, subtitle parsing, result bridge and asset-id-only media authority', () => {
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');

  const seekListener = activity.slice(
    activity.indexOf('setOnSeekBarChangeListener'),
    activity.indexOf('bottom.addView(seekBar'),
  );
  assert.match(seekListener, /val player = mediaPlayer \?: return/);
  assert.match(seekListener, /OrionMediaPlayerSeekPolicy\.targetMs\(duration, seekBar\?\.progress \?: 0\)/);
  assert.match(seekListener, /val playWhenSettled = pendingSeek\?\.playWhenSettled/);
  assert.match(seekListener, /player\.isPlaying/);
  assert.match(seekListener, /requestSeek\(player, target, playWhenSettled = playWhenSettled\)/);
  assert.match(activity, /MediaPlayer\.SEEK_CLOSEST_SYNC/);

  const subtitlePreparation = activity.slice(
    activity.indexOf('private fun prepareSubtitle('),
    activity.indexOf('private fun readBoundedText('),
  );
  assert.match(subtitlePreparation, /OrionPlayerSubtitleParser\.parse\(subtitle\.format, content\)/);
  assert.match(subtitlePreparation, /PreparedSubtitle\(subtitle\.id, subtitle\.label, subtitle\.isDefault, cues\)/);

  assert.match(activity, /\.putExtra\(RESULT_POSITION_MS, safePosition\(player\)\)/);
  assert.match(activity, /\.putExtra\(RESULT_DURATION_MS, safeDuration\(player\)\)/);
  assert.match(activity, /\.putExtra\(RESULT_COMPLETED, completed\)/);
  assert.match(activity, /\.putExtra\(RESULT_PRESENTATION, presentation\)/);

  const launch = bridge.slice(
    bridge.indexOf('export async function launchNativeFinalizedPlayerV1'),
    bridge.indexOf('export async function resolveNativeOfflinePlaybackV1'),
  );
  assert.match(launch, /assetId: string/);
  assert.doesNotMatch(launch, /uri:|filePath:|mediaDocument:|mediaFile:|subtitleContent:/);
});
