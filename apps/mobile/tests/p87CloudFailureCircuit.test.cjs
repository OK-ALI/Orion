"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("P8.7 Candidate 1.5 exposes only bounded safe Orion Cloud failure codes", () => {
  const store = read("src/features/account/googleDriveCloudProfileStore.ts");
  assert.match(store, /KNOWN_CLOUD_FAILURE_CODES/);
  assert.match(store, /GOOGLE_DRIVE_PROFILE_DUPLICATE/);
  assert.match(store, /GOOGLE_DRIVE_PROFILE_INVALID/);
  assert.match(store, /GOOGLE_DRIVE_PROFILE_RATE_LIMITED/);
  assert.match(store, /GOOGLE_DRIVE_PROFILE_TEMPORARY/);
  assert.match(store, /getGoogleDriveCloudFailureCode/);
  assert.match(store, /GOOGLE_DRIVE_PROFILE_UNKNOWN/);
  assert.match(store, /\[OrionCloudSync\] domain=\$\{domain\} code=\$\{code\}/);
  assert.doesNotMatch(store, /console\.warn\([^\n]*(?:accountEmail|profileJson|accessToken|token)/);
});

test("P8.7 Candidate 1.5 stops passive retry churn after a transport error while preserving manual retry", () => {
  const providers = [
    read("src/features/account/MyListSteadyStateSync.tsx"),
    read("src/features/account/WatchedSteadyStateSync.tsx"),
    read("src/features/account/ViewingActivitySteadyStateSync.tsx"),
  ];
  for (const source of providers) {
    assert.match(source, /requestHeartbeatReconcile/);
    assert.match(source, /statusRef\.current\.phase === 'needs-review'/);
    assert.match(source, /statusRef\.current\.phase === 'error'/);
    assert.match(source, /reportGoogleDriveCloudFailure/);
    assert.match(source, /describeGoogleDriveCloudFailure/);
    assert.match(source, /requestManualReconcile/);
  }
});

test("P8.7 Candidate 1.5 keeps error recovery inside the existing Account row grammar", () => {
  const controls = [
    read("src/features/settings/MyListEnrollmentPreflight.tsx"),
    read("src/features/settings/WatchedSyncControl.tsx"),
    read("src/features/settings/ViewingActivitySyncControl.tsx"),
  ];
  for (const source of controls) {
    assert.match(source, /steady\.phase === 'error'/);
    assert.match(source, /'Try again'/);
    assert.match(source, /manualSync\.runManualSync\(\)/);
    assert.match(source, /manualSync\.manualBusy/);
  }
});

test("P8.7 Candidate 1.5 native transport logs failure code without cloud content", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");
  assert.match(native, /LOG_TAG = "OrionCloudProfile"/);
  assert.match(native, /PortableProfileV3 transport failure code=\$code/);
  assert.match(native, /throw IllegalStateException\("GOOGLE_DRIVE_PROFILE_DUPLICATE"\)/);
  assert.doesNotMatch(native, /Log\.w\([^\n]*(?:responseBody|profileJson|token)/);
});


test("P8.7 Candidate 1.5 discovers the hidden profile with the documented q-free appDataFolder listing path", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");
  const start = native.indexOf("private fun findProfileFiles");
  const end = native.indexOf("private fun fetchMetadata", start);
  assert.ok(start >= 0 && end > start);
  const discovery = native.slice(start, end);

  assert.match(discovery, /spaces=appDataFolder/);
  assert.match(discovery, /nextPageToken,files\(id,name\)/);
  assert.match(discovery, /pageToken=/);
  assert.match(discovery, /name == fileName/);
  assert.match(discovery, /stage = "appdata-list"/);
  assert.doesNotMatch(discovery, /[?&]q=/);
  assert.doesNotMatch(discovery, /trashed = false/);
});

test("P8.7 Candidate 1.5 logs only the bounded Drive request stage when transport fails", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");
  assert.match(native, /val stage: String/);
  assert.match(native, /stage = "metadata"/);
  assert.match(native, /stage = "download"/);
  assert.match(native, /stage = "create"/);
  assert.match(native, /stage = updateStage/);
  assert.match(native, /http=\$\{error\.status\} stage=\$\{error\.stage\}/);
  assert.doesNotMatch(native, /Log\.w\([^\n]*(?:responseBody|profileJson|token)/);
});


test("P8.7 Candidate 1.5 update upload is API-version neutral and cannot send a v3-only fields selector to Drive v2", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");
  const start = native.indexOf("private fun updateProfile");
  const end = native.indexOf("private data class HttpResponse", start);
  assert.ok(start >= 0 && end > start);
  const update = native.slice(start, end);

  assert.match(update, /updateApi == DRIVE_V2_UPLOAD_API/);
  assert.match(update, /"update-v2"/);
  assert.match(update, /"update-v3"/);
  assert.match(update, /\?uploadType=media/);
  assert.doesNotMatch(update, /uploadType=media&fields=/);
  assert.doesNotMatch(update, /modifiedTime,version/);
  assert.doesNotMatch(update, /modifiedDate,version/);
});
