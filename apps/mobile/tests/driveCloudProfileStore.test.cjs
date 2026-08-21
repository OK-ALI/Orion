"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("P8.2 Drive CloudProfileStore uses appDataFolder and a hidden deterministic profile file", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");

  assert.match(native, /spaces=appDataFolder/);
  assert.match(native, /parents[\s\S]*appDataFolder/);
  assert.match(native, /orion-portable-profile-v3-/);
  assert.match(native, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(native, /alt=media/);
  assert.match(native, /uploadType=multipart/);
  assert.match(native, /uploadType=media/);
  assert.doesNotMatch(native, /drive\.file|drive\.readonly|drive\.metadata/);
});

test("P8.2 Drive profile I/O keeps the OAuth token native-only", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");
  const store = read("src/features/account/googleDriveCloudProfileStore.ts");

  assert.match(native, /OrionGoogleDriveTokenVault\.tokenFor\(accountEmail\)/);
  assert.match(native, /Authorization[\s\S]*Bearer \$token/);
  assert.doesNotMatch(store, /accessToken|refreshToken|serverAuthCode|SecureStore|AsyncStorage|MMKV/);
  assert.doesNotMatch(native, /putString\("accessToken"|putString\("refreshToken"/);
});

test("P8.2 GoogleDriveCloudProfileStore implements the backend-neutral contract and validates V3", () => {
  const store = read("src/features/account/googleDriveCloudProfileStore.ts");

  assert.match(store, /class GoogleDriveCloudProfileStore implements CloudProfileStore/);
  assert.match(store, /normalizePortableProfileV3/);
  assert.match(store, /readPortableProfile/);
  assert.match(store, /writePortableProfile/);
  assert.match(store, /expectedRevisionTag/);
  assert.match(store, /state === 'conflict'/);
});

test("P8.2 Drive writes are atomic for both ETag and version revision tokens", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");

  assert.match(native, /DRIVE_V2_API = "https:\/\/www\.googleapis\.com\/drive\/v2"/);
  assert.match(native, /DRIVE_V2_UPLOAD_API = "https:\/\/www\.googleapis\.com\/upload\/drive\/v2"/);
  assert.match(native, /fetchV2ConditionalMetadata/);
  assert.match(native, /expectedRevisionTag\.startsWith\("version:"\)/);
  assert.match(native, /conditional\.version != expectedVersion[\s\S]*conflictResult\("version:\$\{conditional\.version\}"\)/);
  assert.match(native, /updateApi = DRIVE_V2_UPLOAD_API[\s\S]*updateMethod = "PUT"/);
  assert.match(native, /mutableMapOf\("If-Match" to strongIfMatch\)/);
  assert.match(native, /strongIfMatch\.isBlank\(\) \|\| strongIfMatch\.startsWith\("W\/"\)/);
  assert.match(native, /GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE/);
  assert.match(native, /error\.status == 412/);
  assert.match(native, /conflictResult/);
  assert.doesNotMatch(native, /version remains the conservative compare-before-write token/);
});

test("P8.2 Drive writes verify one unique profile after create and update", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveProfileStoreModule.kt");

  assert.match(native, /val createdId = createProfile[\s\S]*val afterMatches = findProfileFiles\(token, key\)[\s\S]*afterMatches\.size != 1 \|\| afterMatches\.first\(\) != createdId/);
  assert.match(native, /updateProfile\([\s\S]*val afterMatches = findProfileFiles\(token, key\)[\s\S]*afterMatches\.size != 1 \|\| afterMatches\.first\(\) != current\.id/);
  assert.match(native, /GOOGLE_DRIVE_PROFILE_DUPLICATE/);
});

test("P8.2 standalone and Expo generation synchronize the Drive profile store native module", () => {
  const packageSource = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveAuthorizationPackage.kt");
  const plugin = read("plugins/withOrionGoogleDriveAuthorization.js");
  const build = read("scripts/build-android-standalone.cjs");

  assert.match(packageSource, /OrionGoogleDriveProfileStoreModule\(context\)/);
  assert.match(plugin, /OrionGoogleDriveProfileStoreModule\.kt/);
  assert.match(build, /OrionGoogleDriveProfileStoreModule\.kt/);
  assert.match(build, /syncGoogleDriveAuthorizationNativeSources/);
});

test("P8.2 storage probe remains available internally without enrolling the local library or surfacing development UI", () => {
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");
  const store = read("src/features/account/googleDriveCloudProfileStore.ts");
  const library = read("src/context/LibraryContext.tsx");

  assert.match(accountUi, /runP82DriveStorageProbeForDiagnostics/);
  assert.match(accountUi, /p8\.2-storage-probe/);
  assert.match(accountUi, /createPortableProfileV3\('p8\.2-storage-probe'\)/);
  assert.match(accountUi, /expectedRevisionTag: existing\.revisionTag/);
  assert.match(accountUi, /write\.state === 'conflict'/);
  assert.match(accountUi, /verify\.state === 'found'/);

  assert.doesNotMatch(
    accountUi,
    /Cloud profile storage check|Verify Drive storage|Development validation only|Checking appDataFolder|Cloud profile created and read back/,
  );
  assert.doesNotMatch(store, /LibraryContext|playbackRepository|watchedState|savedOrder|history|progress/);
  assert.doesNotMatch(library, /GoogleDriveCloudProfileStore|OrionGoogleDriveProfileStore|appDataFolder/);
});
