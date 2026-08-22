const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
);
const buildGradle = fs.readFileSync(
  path.join(mobileRoot, "android", "app", "build.gradle"),
  "utf8",
);
const standaloneScript = fs.readFileSync(
  path.join(mobileRoot, "scripts", "build-android-standalone.cjs"),
  "utf8",
);
const releaseModule = require(path.join(
  mobileRoot,
  "scripts",
  "build-android-release.cjs",
));
const releaseScript = fs.readFileSync(
  path.join(mobileRoot, "scripts", "build-android-release.cjs"),
  "utf8",
);

test("keeps standalone validation separate from permanent release distribution", () => {
  assert.equal(
    packageJson.scripts["build:android:standalone"],
    "node scripts/build-android-standalone.cjs",
  );
  assert.equal(
    packageJson.scripts["build:android:release"],
    "node scripts/build-android-release.cjs",
  );
  assert.match(standaloneScript, /"assembleDebug"/);
  assert.match(standaloneScript, /--prepare-only/);
  assert.match(releaseScript, /"assembleRelease"/);
  assert.doesNotMatch(releaseScript, /assembleDebug/);
});

test("patches generated Gradle to use Orion release signing without source passwords", () => {
  const patched = releaseModule.patchReleaseGradleText(buildGradle);
  assert.match(patched, /\.orion\/signing\/orion-mobile-release\.jks/);
  assert.match(patched, /ORION_ANDROID_RELEASE_STORE_PASSWORD/);
  assert.match(patched, /ORION_ANDROID_RELEASE_KEY_PASSWORD/);
  assert.match(patched, /keyAlias 'orion-mobile'/);
  assert.match(patched, /signingConfig signingConfigs\.release/);
  const buildTypes = patched.slice(
    patched.indexOf("    buildTypes {"),
    patched.indexOf("    packagingOptions {"),
  );
  assert.doesNotMatch(
    buildTypes,
    /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/,
  );
  assert.equal(releaseModule.patchReleaseGradleText(patched), patched);
});

test("enforces the permanent certificate and same-drive Windows short-path release pipeline", () => {
  assert.equal(
    releaseModule.expectedCertificateSha256,
    "4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD",
  );
  assert.doesNotMatch(releaseScript, /subst\.exe/);
  assert.match(releaseScript, /fs\.symlinkSync\(repositoryRoot, junctionRoot, "junction"\)/);
  assert.match(releaseScript, /NODE_ENV: "production"/);
  assert.match(releaseScript, /-Porion\.useEmbeddedReleaseBundle=true/);
  assert.match(releaseScript, /assets\/index\.android\.bundle/);
  assert.match(releaseScript, /orion-mobile-v\$\{packageJson\.version\}\.apk/);
  assert.equal(typeof releaseModule.verifySigning, "function");
  assert.match(releaseScript, /lib["'], ["']apksigner\.jar/);
  assert.match(releaseScript, /["']-jar["'], apksignerJar/);
  assert.match(releaseScript, /shell: false/);
  assert.doesNotMatch(
    releaseScript,
    /spawnSync\(apksigner[\s\S]{0,250}shell:\s*process\.platform\s*===\s*["']win32["']/,
  );
});
