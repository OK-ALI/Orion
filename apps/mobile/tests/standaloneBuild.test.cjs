const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scriptPath = path.resolve(__dirname, "..", "scripts", "build-android-standalone.cjs");
const source = fs.readFileSync(scriptPath, "utf8");

const cinemaPluginPath = path.resolve(__dirname, "..", "plugins", "withOrionCinemaWebView.js");
const cinemaPluginSource = fs.readFileSync(cinemaPluginPath, "utf8");

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


test("standalone Android build synchronizes the Google Identity native bridge without regenerating the native project", () => {
  assert.match(source, /syncGoogleIdentityNativeSources/);
  assert.match(source, /OrionGoogleIdentityModule\.kt/);
  assert.match(source, /OrionGoogleIdentityPackage\.kt/);
  assert.match(source, /ORION_GOOGLE_IDENTITY_DEPENDENCIES/);
  assert.match(source, /androidx\.credentials:credentials:1\.6\.0/);
  assert.match(source, /credentials-play-services-auth:1\.6\.0/);
  assert.match(source, /googleid:googleid:1\.2\.0/);
  assert.match(source, /add\(OrionGoogleIdentityPackage\(\)\)/);
  assert.doesNotMatch(source, /expo[^\n]*prebuild/i);
});

test("standalone Android release prep consumes the authoritative Cinema native source manifest", () => {
  assert.match(cinemaPluginSource, /const CINEMA_NATIVE_FILES = Object\.freeze\(\[/);
  assert.match(cinemaPluginSource, /module\.exports\.CINEMA_NATIVE_FILES = CINEMA_NATIVE_FILES/);
  assert.match(source, /cinemaConfigPlugin\.CINEMA_NATIVE_FILES/);
  assert.match(source, /cinemaConfigPlugin\.CINEMA_ANDROID_DEPENDENCIES/);
  assert.match(source, /ensureCinemaGradleDependencies/);
  assert.doesNotMatch(source, /const cinemaNativeFiles = \[/);
  for (const fileName of [
    "OrionDownloadEngineModule.kt",
    "OrionDownloadForegroundService.kt",
    "OrionDownloadJobStore.kt",
    "OrionDownloadArtifactManager.kt",
    "OrionDownloadFinalizationManifest.kt",
    "OrionDownloadExecutionFence.kt",
    "OrionDownloadNotificationContract.kt",
    "OrionDownloadOwnershipPolicy.kt",
    "OrionPortableCadence.kt",
    "OrionDownloadPortableFinalizer.kt",
    "OrionDownloadRecoveryWorker.kt",
    "OrionDownloadSubtitleRuntime.kt",
    "OrionDownloadTransferRuntime.kt",
  ]) {
    assert.match(cinemaPluginSource, new RegExp(fileName.replace(".", "\\.")));
  }
  assert.match(cinemaPluginSource, /OrionDownloadManagementPolicyTest\.kt/);
  assert.match(cinemaPluginSource, /androidx\.media3:media3-exoplayer:1\.9\.0/);
  assert.match(cinemaPluginSource, /androidx\.media3:media3-ui:1\.9\.0/);
  assert.match(source, /--sync-native-only/);
  assert.match(source, /createHash\("sha256"\)/);
});
