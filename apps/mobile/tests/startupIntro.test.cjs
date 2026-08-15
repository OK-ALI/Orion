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

test("Phase 7.9.1c native Android launch surface uses Orion branding instead of the legacy grid bitmap", () => {
  const styles = read("android/app/src/main/res/values/styles.xml");
  const colors = read("android/app/src/main/res/values/colors.xml");
  const launchBackground = read("android/app/src/main/res/drawable/orion_launch_background.xml");
  const appConfig = JSON.parse(read("app.json"));
  const splashPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  );

  assert.match(styles, /android:windowBackground\">@drawable\/orion_launch_background/);
  assert.doesNotMatch(styles, /android:windowBackground\">@drawable\/splashscreen_logo/);
  assert.match(colors, /<color name="splashscreen_background">#07070C<\/color>/);
  assert.match(launchBackground, /@color\/splashscreen_background/);
  assert.match(launchBackground, /@drawable\/orion_splash_mark/);

  for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
    assert.equal(
      fs.existsSync(path.join(mobileRoot, `android/app/src/main/res/drawable-${density}/orion_splash_mark.png`)),
      true,
      `missing ${density} Orion splash mark`,
    );
  }

  assert.ok(splashPlugin, "expo-splash-screen must remain explicitly configured");
  assert.equal(splashPlugin[1].backgroundColor, "#07070C");
  assert.equal(splashPlugin[1].image, "./assets/brand-mark.png");
  assert.equal(splashPlugin[1].imageWidth, 96);
  assert.equal(splashPlugin[1].resizeMode, "contain");
});
