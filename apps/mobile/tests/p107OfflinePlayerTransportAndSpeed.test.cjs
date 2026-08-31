"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const player = fs.readFileSync(
  path.join(root, "plugins", "orion-cinema-webview-native", "OrionPlayerActivity.kt"),
  "utf8",
);

test("P10.7 Slice B adds centered ten-second transport controls without replacing the accepted player", () => {
  assert.match(player, /private lateinit var rewindView: TextView/);
  assert.match(player, /private lateinit var forwardView: TextView/);
  assert.match(player, /rewindView = button\("↶ 10"\)/);
  assert.match(player, /forwardView = button\("10 ↷"\)/);
  assert.match(player, /contentDescription = "Rewind 10 seconds"/);
  assert.match(player, /contentDescription = "Forward 10 seconds"/);
  assert.match(player, /controls\.addView\(rewindView/);
  assert.match(player, /controls\.addView\(playPauseView/);
  assert.match(player, /controls\.addView\(forwardView/);
  assert.match(player, /TRANSPORT_SEEK_MS = 10_000L/);
  assert.match(player, /android\.media\.MediaPlayer/);
  assert.match(player, /TextureView/);
  assert.doesNotMatch(player, /ExoPlayer|androidx\.media3/);
});

test("P10.7 Slice B funnels buttons and repeated offset seeks through requestSeek", () => {
  const offsetSeek = player.slice(
    player.indexOf("private fun seekByOffset("),
    player.indexOf("private fun requestSeek(", player.indexOf("private fun seekByOffset(")),
  );
  assert.match(offsetSeek, /val basePosition = pendingSeek\?\.targetMs \?: safePosition\(player\)/);
  assert.match(offsetSeek, /val target = \(basePosition \+ offsetMs\)\.coerceIn/);
  assert.match(offsetSeek, /pendingSeek\?\.playWhenSettled/);
  assert.match(offsetSeek, /requestSeek\(player, target, playWhenSettled = playWhenSettled\)/);
  assert.doesNotMatch(offsetSeek, /player\.seekTo/);

  const buildUi = player.slice(
    player.indexOf("private fun buildUi()"),
    player.indexOf("private fun updateProgress()"),
  );
  assert.match(buildUi, /seekByOffset\(player, -TRANSPORT_SEEK_MS\)/);
  assert.match(buildUi, /seekByOffset\(player, TRANSPORT_SEEK_MS\)/);
  assert.doesNotMatch(buildUi, /SEEK_CLOSEST_SYNC|SEEK_CLOSEST\)/);
});

test("P10.7 Slice B uses confirmed double taps on the left and right halves for ten-second seeking", () => {
  assert.match(player, /GestureDetector\.SimpleOnGestureListener/);
  assert.match(player, /override fun onSingleTapConfirmed\(event: MotionEvent\): Boolean/);
  assert.match(player, /root\.performClick\(\)/);
  assert.match(player, /override fun onDoubleTap\(event: MotionEvent\): Boolean/);
  assert.match(player, /event\.x < root\.width \/ 2f/);
  assert.match(player, /-DOUBLE_TAP_SEEK_MS else DOUBLE_TAP_SEEK_MS/);
  assert.match(player, /seekByOffset\(player, offsetMs\)/);
  assert.match(player, /DOUBLE_TAP_SEEK_MS = 10_000L/);
  assert.doesNotMatch(player, /Build\.MANUFACTURER|Build\.BRAND|Xiaomi|Redmi/);
});

test("P10.7 Slice B adds an explicit MediaPlayer playback-speed selector from 0.5x through 2x", () => {
  assert.match(player, /private var playbackSpeed = 1\.0f/);
  assert.match(player, /speedView = button\("1×"\)/);
  assert.match(player, /private fun showPlaybackSpeedSelector\(\)/);
  for (const choice of ["0.5×", "0.75×", "1×", "1.25×", "1.5×", "1.75×", "2×"]) {
    assert.match(player, new RegExp(choice.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(player, /Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.M/);
  assert.match(player, /player\.playbackParams/);
  assert.match(player, /\.setSpeed\(speed\.coerceIn\(0\.5f, 2\.0f\)\)/);
  assert.match(player, /\.setPitch\(1\.0f\)/);
  assert.match(player, /player\.playbackParams = params/);
  assert.match(player, /playbackSpeed = nextSpeed/);
  assert.match(player, /updatePlaybackSpeedLabel\(\)/);
});

test("P10.7 Slice B preserves Slice A cinematic chrome and accepted seek ownership", () => {
  assert.match(player, /background = cinematicChromeScrim\(top = true\)/);
  assert.match(player, /background = cinematicChromeScrim\(top = false\)/);
  assert.match(player, /private fun requestSeek\(/);
  assert.match(player, /OrionMediaPlayerSeekPolicy\.mode/);
  assert.match(player, /OrionMediaPlayerSeekPolicy\.beginObservation/);
  assert.match(player, /surfaceFrameGeneration/);
  assert.doesNotMatch(player, /RenderEffect|PixelCopy|textureView\.bitmap|setRenderEffect/);
});
