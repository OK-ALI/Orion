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

test("native Android launch surface follows the current Expo splash contract and Orion brand config", () => {
  const styles = read("android/app/src/main/res/values/styles.xml");
  const colors = read("android/app/src/main/res/values/colors.xml");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const mainActivity = read("android/app/src/main/java/com/okali/orion/MainActivity.kt");
  const appConfig = JSON.parse(read("app.json"));
  const splashPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  );

  assert.match(styles, /<style name="Theme\.App\.SplashScreen" parent="Theme\.SplashScreen">/);
  assert.match(styles, /<item name="windowSplashScreenBackground">@color\/splashscreen_background<\/item>/);
  assert.match(styles, /<item name="windowSplashScreenAnimatedIcon">@drawable\/splashscreen_logo<\/item>/);
  assert.match(styles, /<item name="postSplashScreenTheme">@style\/AppTheme<\/item>/);
  assert.match(colors, /<color name="splashscreen_background">#07070C<\/color>/);
  assert.match(manifest, /android:name="\.MainActivity"[\s\S]*android:theme="@style\/Theme\.App\.SplashScreen"/);
  assert.match(mainActivity, /SplashScreenManager\.registerOnActivity\(this\)/);

  for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
    assert.equal(
      fs.existsSync(path.join(mobileRoot, `android/app/src/main/res/drawable-${density}/splashscreen_logo.png`)),
      true,
      `missing ${density} Expo splash logo`,
    );
  }

  assert.ok(splashPlugin, "expo-splash-screen must remain explicitly configured");
  assert.equal(splashPlugin[1].backgroundColor, "#07070C");
  assert.equal(splashPlugin[1].image, "./assets/brand-mark.png");
  assert.equal(splashPlugin[1].imageWidth, 96);
  assert.equal(splashPlugin[1].resizeMode, "contain");
});
