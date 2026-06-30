const test = require("node:test");
const assert = require("node:assert/strict");
const { extractPaletteFromBitmap } = require("../../../src/main/player/ambientPalette");
const { samplingInterval } = require("../../../src/main/player/ambientSampling");

test("ambient palette returns two dominant colors without retaining frames", () => {
  const pixels = Buffer.from([
    20, 40, 220, 255, 20, 40, 220, 255,
    210, 80, 20, 255, 210, 80, 20, 255,
  ]);
  const palette = extractPaletteFromBitmap(pixels);
  assert.equal(palette.length, 2);
  assert.match(palette[0], /^#[0-9a-f]{6}$/i);
  assert.notEqual(palette[0], palette[1]);
});

test("ambient sampling adapts to profile and battery power", () => {
  assert.equal(samplingInterval("balanced", false), 750);
  assert.equal(samplingInterval("balanced", true), 2250);
  assert.equal(samplingInterval("low", true), 3000);
  assert.equal(samplingInterval("vivid", true), 1500);
});
