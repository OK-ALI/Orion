const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scriptPath = path.resolve(__dirname, "..", "scripts", "build-android-standalone.cjs");
const source = fs.readFileSync(scriptPath, "utf8");

test("standalone Android build embeds JavaScript before assembling Debug", () => {
  assert.match(source, /export:embed/);
  assert.match(source, /index\.android\.bundle/);
  assert.match(source, /assembleDebug/);
});

test("standalone Android build rejects an APK without the embedded bundle", () => {
  assert.match(source, /archiveListing\.stdout/);
  assert.match(source, /assets\/index\.android\.bundle/);
  assert.match(source, /Standalone APK validation failed/);
});

test("standalone Android build publishes a clearly named artifact", () => {
  assert.match(source, /orion-mobile-standalone\.apk/);
  assert.match(source, /copyFileSync\(debugApk, standaloneApk\)/);
});
