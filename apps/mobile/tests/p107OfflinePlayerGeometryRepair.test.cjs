const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const activity = fs.readFileSync(
  path.join(root, 'plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt'),
  'utf8',
);

function section(start, end) {
  const startIndex = activity.indexOf(start);
  const endIndex = activity.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, 'missing section start: ' + start);
  assert.notEqual(endIndex, -1, 'missing section end: ' + end);
  return activity.slice(startIndex, endIndex);
}

test('P10.7 F4 separates centered transport from the bounded bottom playback strip', () => {
  assert.match(
    activity,
    /val bottom = LinearLayout\(this\)\.apply \{\s*orientation = LinearLayout\.VERTICAL\s*setPadding\(dp\(18\), dp\(4\), dp\(18\), dp\(12\)\)/,
  );
  assert.match(
    activity,
    /bottom\.addView\(seekBar, LinearLayout\.LayoutParams\(ViewGroup\.LayoutParams\.MATCH_PARENT, dp\(38\)\)\)/,
  );
  assert.match(activity, /bottom\.addView\(secondaryControls\)/);
  assert.doesNotMatch(activity, /bottom\.addView\(controls/);

  const chrome = section(
    'chrome = FrameLayout(this).apply {',
    'root.addView(chrome, FrameLayout.LayoutParams(',
  );
  assert.match(
    chrome,
    /addView\(controls, FrameLayout\.LayoutParams\(\s*ViewGroup\.LayoutParams\.WRAP_CONTENT,\s*ViewGroup\.LayoutParams\.WRAP_CONTENT,\s*Gravity\.CENTER/,
  );

  const secondary = section(
    'val secondaryControls = LinearLayout(this).apply {',
    'subtitleView = TextView(this).apply {',
  );
  assert.match(secondary, /secondaryControls\.addView\(positionView, LinearLayout\.LayoutParams\(0, dp\(40\), 1f\)\)/);
  assert.match(secondary, /secondaryControls\.addView\(speedView/);
  assert.match(secondary, /secondaryControls\.addView\(audioView/);
  assert.match(secondary, /secondaryControls\.addView\(presentationView/);
  assert.match(secondary, /secondaryControls\.addView\(subtitleButton/);
  assert.match(secondary, /secondaryControls\.addView\(lockView/);
});

test('P10.7 F4 keeps subtitles outside chrome and gives visible and hidden chrome distinct lower anchors', () => {
  const subtitleRootAdd = activity.indexOf('root.addView(subtitleView, FrameLayout.LayoutParams(');
  const chromeDeclaration = activity.indexOf('chrome = FrameLayout(this).apply {');
  assert.ok(subtitleRootAdd >= 0 && subtitleRootAdd < chromeDeclaration);

  const geometry = section(
    'private fun subtitleBottomMarginDp(): Int',
    'private fun applySubtitleAppearance()',
  );
  assert.match(
    geometry,
    /if \(chromeControlsVisible\) \{\s*when \(subtitlePosition\) \{\s*"low" -> 100\s*"high" -> 148\s*else -> 116/,
  );
  assert.match(
    geometry,
    /\} else \{\s*when \(subtitlePosition\) \{\s*"low" -> 32\s*"high" -> 84\s*else -> 52/,
  );
  assert.match(geometry, /params\.bottomMargin = dp\(subtitleBottomMarginDp\(\)\) \+ safeInsetBottom/);
  assert.match(geometry, /private fun setChromeControlsVisible\(visible: Boolean\)/);
  assert.match(geometry, /chromeControlsVisible = visible\s*updateSubtitleGeometry\(\)/);
});

test('P10.7 F4 updates subtitle geometry across insets, preferences, chrome visibility, and lock state', () => {
  const insets = section(
    'root.setOnApplyWindowInsetsListener',
    'setContentView(root)',
  );
  assert.match(insets, /safeInsetBottom = resolvedInsets\.bottom/);
  assert.match(insets, /updateSubtitleGeometry\(\)/);

  const appearance = section(
    'private fun applySubtitleAppearance()',
    '@Suppress("DEPRECATION")',
  );
  assert.match(appearance, /updateSubtitleGeometry\(\)/);

  const lock = section('private fun setControlsLocked', 'private fun showUnlockAffordance');
  assert.match(lock, /chrome\.visibility = View\.INVISIBLE\s*setChromeControlsVisible\(false\)/);
  assert.match(lock, /showChrome\(\)/);

  const show = section('private fun showChrome', 'private fun hideChrome');
  assert.match(show, /chrome\.animate\(\)\.cancel\(\)\s*setChromeControlsVisible\(true\)\s*chrome\.visibility = View\.VISIBLE/);

  const hide = section('private fun hideChrome', 'private fun alphaColor');
  assert.match(
    hide,
    /if \(reducedMotion\) \{\s*chrome\.alpha = 0f\s*chrome\.visibility = View\.INVISIBLE\s*setChromeControlsVisible\(false\)/,
  );
  assert.match(
    hide,
    /withEndAction \{[\s\S]*chrome\.visibility = View\.INVISIBLE\s*setChromeControlsVisible\(false\)/,
  );
});

test('P10.7 F4 preserves MediaPlayer, TextureView, requestSeek ownership, and OEM-neutral behavior', () => {
  assert.match(activity, /class OrionPlayerActivity : Activity\(\), TextureView\.SurfaceTextureListener/);
  assert.match(activity, /private var mediaPlayer: MediaPlayer\? = null/);
  assert.match(activity, /private fun requestSeek\(player: MediaPlayer, targetMs: Long, playWhenSettled: Boolean\)/);

  const issueSeek = section('private fun issuePendingSeek', 'private fun handleSeekComplete');
  assert.match(issueSeek, /player\.seekTo\(request\.targetMs, MediaPlayer\.SEEK_CLOSEST_SYNC\)/);
  assert.match(issueSeek, /player\.seekTo\(request\.targetMs, MediaPlayer\.SEEK_CLOSEST\)/);
  const withoutIssuedSeek = activity.replace(issueSeek, '');
  assert.doesNotMatch(withoutIssuedSeek, /player\.seekTo\(/);
  assert.doesNotMatch(
    activity,
    /Build\.(?:MANUFACTURER|BRAND|MODEL)|\b(?:Xiaomi|Redmi|Samsung|OnePlus|Pixel)\b/i,
  );
});
