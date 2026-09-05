const test = require("node:test");
const assert = require("node:assert/strict");
const { extractPaletteFromBitmap } = require("../../../src/main/player/ambientPalette");
const { ambientCaptureSize, boundedSampleRect, capAmbientProfile, samplingInterval } = require("../../../src/main/player/ambientSampling");

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
  assert.equal(samplingInterval("balanced", false), 1100);
  assert.equal(samplingInterval("balanced", true), 2600);
  assert.equal(samplingInterval("low", true), 3600);
  assert.equal(samplingInterval("vivid", true), 1800);
});

test("ambient sampling bounds fullscreen GPU readback area", () => {
  assert.deepEqual(
    boundedSampleRect({ x: 0, y: 0, width: 1920, height: 1080 }),
    { x: 800, y: 450, width: 320, height: 180 },
  );
  assert.deepEqual(
    boundedSampleRect({ x: 20, y: 30, width: 200, height: 100 }),
    { x: 20, y: 30, width: 200, height: 100 },
  );
});


test("Ambient Glow obeys the active Desktop performance ceiling", () => {
  assert.equal(capAmbientProfile("vivid", "quality"), "vivid");
  assert.equal(capAmbientProfile("vivid", "balanced"), "balanced");
  assert.equal(capAmbientProfile("balanced", "balanced"), "balanced");
  assert.equal(capAmbientProfile("vivid", "efficiency"), "low");
  assert.equal(capAmbientProfile("balanced", "efficiency"), "low");
  assert.equal(capAmbientProfile("low", "quality"), "low");
});

test("Ambient Glow readback size scales with the active Desktop performance tier", () => {
  assert.deepEqual(ambientCaptureSize("efficiency"), { width: 160, height: 90 });
  assert.deepEqual(ambientCaptureSize("balanced"), { width: 240, height: 135 });
  assert.deepEqual(ambientCaptureSize("quality"), { width: 320, height: 180 });
});
