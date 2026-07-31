const test = require("node:test");
const assert = require("node:assert/strict");
const { FALLBACK_SHORTCUTS } = require("../../../src/main/player/mediaControls");

test("media fallback excludes Windows-owned volume controls", () => {
  assert.deepEqual(Object.keys(FALLBACK_SHORTCUTS).sort(), [
    "MediaNextTrack", "MediaPlayPause", "MediaPreviousTrack", "MediaStop",
  ]);
  assert.equal(Object.keys(FALLBACK_SHORTCUTS).some((key) => key.toLowerCase().includes("volume")), false);
});
