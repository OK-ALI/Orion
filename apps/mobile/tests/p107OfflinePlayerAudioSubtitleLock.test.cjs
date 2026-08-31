const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const activity = fs.readFileSync(
  path.join(root, 'plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt'),
  'utf8',
);

test('Slice C discovers and selects embedded MediaPlayer audio tracks without changing engines', () => {
  assert.match(activity, /refreshAudioTracks\(it\)/);
  assert.match(activity, /player\.trackInfo\.forEachIndexed/);
  assert.match(activity, /MediaPlayer\.TrackInfo\.MEDIA_TRACK_TYPE_AUDIO/);
  assert.match(activity, /player\.getSelectedTrack\(MediaPlayer\.TrackInfo\.MEDIA_TRACK_TYPE_AUDIO\)/);
  assert.match(activity, /player\.selectTrack\(requestedTrackIndex\)/);
  assert.match(activity, /private fun showAudioTrackSelector\(\)/);
  assert.doesNotMatch(activity, /ExoPlayer|androidx\.media3|FFmpeg.*audio|ffmpeg.*audio/);
});

test('Slice C keeps the Audio control quiet unless multiple embedded tracks are usable', () => {
  assert.match(activity, /audioView = button\("Audio"\)/);
  assert.match(activity, /val available = prepared && audioTracks\.size > 1/);
  assert.match(activity, /audioView\.isEnabled = available/);
  assert.match(activity, /audioView\.alpha = if \(available\) 1f else 0\.45f/);
  assert.match(activity, /if \(!prepared \|\| audioTracks\.size <= 1\) return/);
  assert.match(activity, /Audio track: \$\{selected\.label\}/);
});

test('Slice C adds subtitle size, background, and vertical position without replacing verified sidecar timing', () => {
  assert.match(activity, /SUBTITLE_APPEARANCE_VALUE to "Subtitle appearance"/);
  assert.match(activity, /private fun showSubtitleAppearanceSelector\(\)/);
  assert.match(activity, /private fun showSubtitleSizeSelector\(\)/);
  assert.match(activity, /private fun showSubtitleBackgroundSelector\(\)/);
  assert.match(activity, /private fun showSubtitlePositionSelector\(\)/);
  assert.match(activity, /"small" -> 14f/);
  assert.match(activity, /"large" -> 20f/);
  assert.match(activity, /"low" -> 126/);
  assert.match(activity, /"high" -> 238/);
  assert.match(activity, /"low" -> 112/);
  assert.match(activity, /"high" -> 196/);
  assert.match(activity, /updateSubtitle\(actualPosition\)/);
  assert.match(activity, /OrionPlayerSubtitleParser\.parse\(subtitle\.format, content\)/);
});

test('Slice C screen lock intercepts chrome, double-tap, selectors, and Back until explicitly unlocked', () => {
  assert.match(activity, /private var controlsLocked = false/);
  assert.match(activity, /lockView = button\("Lock"\)/);
  assert.match(activity, /unlockView = button\("Unlock"\)/);
  assert.match(activity, /setOnClickListener \{ setControlsLocked\(true\) \}/);
  assert.match(activity, /setOnClickListener \{ setControlsLocked\(false\) \}/);
  assert.match(activity, /if \(controlsLocked\) \{\s*setControlsLocked\(false\)\s*return\s*\}/);
  const doubleTap = activity.slice(
    activity.indexOf('override fun onDoubleTap'),
    activity.indexOf('root.setOnTouchListener'),
  );
  assert.match(doubleTap, /if \(controlsLocked\)[\s\S]*showUnlockAffordance\(\)[\s\S]*return true/);
  assert.match(activity, /if \(controlsLocked \|\| !::selectorOverlay\.isInitialized\) return/);
  assert.match(activity, /if \(controlsLocked\) \{\s*showUnlockAffordance\(\)\s*return\s*\}/);
});

test('Slice C preserves Slice B transport and accepted seek ownership', () => {
  assert.match(activity, /rewindView = button\("↶ 10"\)/);
  assert.match(activity, /forwardView = button\("10 ↷"\)/);
  assert.match(activity, /private fun seekByOffset\(player: MediaPlayer, offsetMs: Long\)/);
  const offsetStart = activity.indexOf('private fun seekByOffset(');
  const requestStart = activity.indexOf('private fun requestSeek(', offsetStart);
  assert.ok(offsetStart >= 0 && requestStart > offsetStart);
  const offsetBlock = activity.slice(offsetStart, requestStart);
  assert.match(offsetBlock, /requestSeek\(player, target, playWhenSettled = playWhenSettled\)/);
  assert.doesNotMatch(offsetBlock, /seekTo\(/);
  assert.match(activity, /MediaPlayer\.SEEK_CLOSEST_SYNC/);
  assert.match(activity, /TextureView\(this\)/);
});
