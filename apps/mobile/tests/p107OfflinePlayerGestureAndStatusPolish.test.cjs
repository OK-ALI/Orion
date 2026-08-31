const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const activity = fs.readFileSync(
  path.join(root, 'plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt'),
  'utf8',
);

test('Slice D adds left brightness and right volume vertical gestures without creating a horizontal seek path', () => {
  assert.match(activity, /audioManager = getSystemService\(Context\.AUDIO_SERVICE\) as AudioManager/);
  assert.match(activity, /override fun onScroll\(/);
  assert.match(activity, /abs\(totalY\) <= abs\(totalX\) \* 1\.15f/);
  assert.match(activity, /verticalGestureMode = if \(start\.x < root\.width \/ 2f\) "brightness" else "volume"/);
  assert.match(activity, /private fun applyBrightnessGesture\(verticalFraction: Float\)/);
  assert.match(activity, /attributes\.screenBrightness = brightness/);
  assert.match(activity, /private fun applyVolumeGesture\(verticalFraction: Float\)/);
  assert.match(activity, /audioManager\.setStreamVolume\(AudioManager\.STREAM_MUSIC, target, 0\)/);
  const onScroll = activity.slice(
    activity.indexOf('override fun onScroll('),
    activity.indexOf('override fun onDoubleTap', activity.indexOf('override fun onScroll(')),
  );
  assert.doesNotMatch(onScroll, /requestSeek\(|seekTo\(/);
  assert.doesNotMatch(activity, /Build\.MANUFACTURER|Build\.BRAND/);
});

test('Slice D keeps locked playback gesture-safe and exposes only temporary feedback', () => {
  const onScroll = activity.slice(
    activity.indexOf('override fun onScroll('),
    activity.indexOf('override fun onDoubleTap', activity.indexOf('override fun onScroll(')),
  );
  assert.match(onScroll, /if \(controlsLocked\)[\s\S]*showUnlockAffordance\(\)[\s\S]*return true/);
  assert.match(activity, /private val hideGestureFeedbackRunnable = Runnable \{ hideGestureFeedback\(\) \}/);
  assert.match(activity, /mainHandler\.postDelayed\(hideGestureFeedbackRunnable, GESTURE_FEEDBACK_HIDE_MS\)/);
  assert.match(activity, /GESTURE_FEEDBACK_HIDE_MS = 900L/);
  assert.match(activity, /if \(locked\) \{\s*hideSeekPreview\(\)\s*hideGestureFeedback\(\)\s*verticalGestureMode = null/);
});

test('Slice D adds a thumb-following timestamp preview without changing seek ownership', () => {
  assert.match(activity, /seekPreviewView = TextView\(this\)/);
  assert.match(activity, /private fun showSeekPreview\(progress: Int, targetMs: Long\)/);
  assert.match(activity, /val thumbCenter = seekBar\.x \+ seekBar\.paddingLeft \+ usableTrackWidth \* \(progress\.coerceIn\(0, 1000\) \/ 1000f\)/);
  assert.match(activity, /seekPreviewView\.x = \(thumbCenter - seekPreviewView\.width \/ 2f\)\.coerceIn\(minX, maxX\)/);
  assert.match(activity, /showSeekPreview\(progress, target\)/);
  assert.match(activity, /hideSeekPreview\(\)/);
  const offsetStart = activity.indexOf('private fun seekByOffset(');
  const requestStart = activity.indexOf('private fun requestSeek(', offsetStart);
  assert.ok(offsetStart >= 0 && requestStart > offsetStart);
  assert.match(activity.slice(offsetStart, requestStart), /requestSeek\(player, target, playWhenSettled = playWhenSettled\)/);
});

test('Slice D surfaces real buffering and delayed seek settlement with one subtle status overlay', () => {
  assert.match(activity, /playbackStatusSpinner = ProgressBar\(this\)/);
  assert.match(activity, /playbackStatusText = TextView\(this\)/);
  assert.match(activity, /private fun updatePlaybackStatus\(\)/);
  assert.match(activity, /buffering -> "Buffering…"/);
  assert.match(activity, /seekingLongEnough -> "Seeking…"/);
  assert.match(activity, /SEEKING_STATUS_DELAY_MS = 350L/);
  assert.match(activity, /OrionMediaPlayerSeekPolicy\.remainingMs\(request, SystemClock\.elapsedRealtime\(\)\)/);
  assert.match(activity, /MediaPlayer\.MEDIA_INFO_BUFFERING_START[\s\S]*buffering = true[\s\S]*updatePlaybackStatus\(\)/);
  assert.match(activity, /MediaPlayer\.MEDIA_INFO_BUFFERING_END[\s\S]*buffering = false[\s\S]*updatePlaybackStatus\(\)/);
  assert.match(activity, /updateSubtitle\(actualPosition\)\s*updatePlaybackStatus\(\)/);
});

test('Slice D preserves MediaPlayer TextureView and the accepted Redmi-compatible seek core', () => {
  assert.match(activity, /val player = MediaPlayer\(\)/);
  assert.match(activity, /TextureView\(this\)/);
  assert.match(activity, /MediaPlayer\.SEEK_CLOSEST_SYNC/);
  assert.match(activity, /OrionMediaPlayerSeekPolicy\.beginObservation\([\s\S]*surfaceFrameGeneration/);
  assert.match(activity, /private fun requestSeek\(player: MediaPlayer, targetMs: Long, playWhenSettled: Boolean\)/);
  assert.doesNotMatch(activity, /ExoPlayer|androidx\.media3|RenderEffect|PixelCopy/);
});
