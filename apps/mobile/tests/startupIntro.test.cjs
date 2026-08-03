"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("native splash hands off only after the themed application has laid out", () => {
  const layout = read("app/_layout.tsx");
  assert.match(layout, /onLayout=\{revealApplication\}/);
  assert.match(layout, /SplashScreen\.hideAsync\(\)/);
  assert.match(layout, /requestAnimationFrame\(\(\) => setStartupActive\(true\)\)/);
  assert.doesNotMatch(layout, /if \(fontsLoaded\) \{\s*SplashScreen\.hideAsync/);
});

test("mobile startup uses the saved live theme and unmounts after completion", () => {
  const layout = read("app/_layout.tsx");
  const intro = read("src/components/StartupIntro.tsx");
  assert.match(intro, /useOrionTheme\(\)/);
  assert.match(intro, /preferences\.reducedMotion/);
  assert.match(intro, /brand-mark\.png/);
  assert.match(intro, /ORION_LETTERS/);
  assert.match(intro, /A universe made to be felt\./);
  assert.match(layout, /showStartup &&/);
  assert.match(layout, /onComplete=\{\(\) => setShowStartup\(false\)\}/);
});
