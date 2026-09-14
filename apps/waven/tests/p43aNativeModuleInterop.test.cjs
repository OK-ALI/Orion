const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const nativeRoot = path.join(root, "plugins", "waven-playback-native");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("P4.3a publishes WAVEN playback through BaseReactPackage metadata", () => {
  const source = fs.readFileSync(path.join(nativeRoot, "WavenPlaybackPackage.kt"), "utf8");

  assert.match(source, /class WavenPlaybackPackage\s*:\s*BaseReactPackage\(\)/);
  assert.match(source, /override fun getModule/);
  assert.match(source, /WavenPlaybackModule\.NAME/);
  assert.match(source, /ReactModuleInfoProvider/);
  assert.match(source, /isTurboModule\s*=\s*false/);
  assert.doesNotMatch(source, /createNativeModules/);
});

test("P4.3a gives the legacy-interoperable module explicit React metadata", () => {
  const source = fs.readFileSync(path.join(nativeRoot, "WavenPlaybackModule.kt"), "utf8");

  assert.match(source, /@ReactModule\(name\s*=\s*WavenPlaybackModule\.NAME\)/);
  assert.match(source, /const val NAME\s*=\s*"WavenPlayback"/);
  assert.match(source, /override fun getName\(\): String\s*=\s*NAME/);
});

test("P4.3a resolves NativeModules lazily instead of freezing an early undefined bridge", () => {
  const source = read("src/features/playback/native/WavenPlaybackNative.ts");

  assert.doesNotMatch(
    source,
    /const bridge\s*=\s*NativeModules\.WavenPlayback[\s\S]*function requireAndroidBridge/,
  );
  assert.match(
    source,
    /function requireAndroidBridge\(\): NativePlaybackBridge[\s\S]*const bridge = NativeModules\.WavenPlayback/,
  );
});

test("P4.3a keeps one native playback owner and does not introduce a JS audio engine", () => {
  const source = read("src/features/playback/native/WavenPlaybackNative.ts");

  assert.doesNotMatch(source, /expo-audio|Audio\.Sound|createAudioPlayer|HTMLAudioElement/);
  assert.match(source, /WavenPlayback/);
});
