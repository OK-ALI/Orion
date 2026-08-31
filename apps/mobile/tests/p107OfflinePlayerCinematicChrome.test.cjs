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

test("P10.7 Slice A gives the finalized offline player TextureView-safe cinematic chrome", () => {
  assert.match(player, /Keep the decoded TextureView pristine/);
  assert.match(player, /background = cinematicChromeScrim\(top = true\)/);
  assert.match(player, /background = cinematicChromeScrim\(top = false\)/);
  assert.match(player, /private fun cinematicChromeScrim\(top: Boolean\): GradientDrawable/);
  assert.match(player, /GradientDrawable\(GradientDrawable\.Orientation\.TOP_BOTTOM, colors\)/);
  assert.match(player, /Color\.TRANSPARENT/);
  assert.doesNotMatch(player, /RenderEffect|PixelCopy|textureView\.bitmap|setRenderEffect/);
  assert.doesNotMatch(player, /setBackgroundColor\(chromeFillColor\)/);
});

test("P10.7 Slice A quiets Offline identity and controls without hiding the existing actions", () => {
  assert.match(player, /text = "ORION OFFLINE"/);
  assert.match(player, /setTextColor\(alphaColor\(accentColor, 232\)\)/);
  assert.match(player, /alphaColor\(panelFillColor, 112\)/);
  assert.match(player, /alphaColor\(accentColor, 92\)/);
  assert.match(player, /LinearLayout\.LayoutParams\(dp\(44\), dp\(44\)\)/);
  assert.match(player, /LinearLayout\.LayoutParams\(dp\(88\), dp\(40\)\)/);
  assert.match(player, /alphaColor\(accentColor, 48\)/);
  assert.match(player, /alphaColor\(accentColor, 154\)/);
  assert.match(player, /alphaColor\(panelFillColor, 108\)/);
  assert.match(player, /alphaColor\(contentTextColor, 36\)/);
  assert.match(player, /presentationView = button\("Fit"\)/);
  assert.match(player, /subtitleButton = button\("CC Off"\)/);
});

test("P10.7 Slice A preserves playback, seek, subtitle and auto-hide ownership", () => {
  assert.match(player, /android\.media\.MediaPlayer/);
  assert.match(player, /TextureView/);
  assert.match(player, /private fun requestSeek\(/);
  assert.match(player, /OrionMediaPlayerSeekPolicy\.mode/);
  assert.match(player, /private fun updateSubtitle\(/);
  assert.match(player, /private fun showSubtitleSelector\(/);
  assert.match(player, /private fun showPresentationSelector\(/);
  assert.match(player, /private fun showChrome\(autoHide: Boolean = true\)/);
  assert.match(player, /private fun hideChrome\(\)/);
  assert.match(player, /CHROME_AUTO_HIDE_MS = 2_800L/);
  assert.match(player, /CHROME_FADE_MS = 180L/);
  assert.doesNotMatch(player, /Build\.MANUFACTURER|Build\.BRAND|Xiaomi|Redmi/);
});
