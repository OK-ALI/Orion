"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("P8.2 Android Drive authorization requests only the private app-data scope", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveAuthorizationModule.kt");
  assert.match(native, /https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/);
  assert.match(native, /AuthorizationRequest\.builder\(\)/);
  assert.match(native, /setRequestedScopes\(listOf\(Scope\(DRIVE_APPDATA_SCOPE\)\)\)/);
  assert.match(native, /setAccount\(Account\(email, GOOGLE_ACCOUNT_TYPE\)\)/);
  assert.doesNotMatch(native, /drive\.file|drive\.readonly|drive\.metadata|drive"/);
});

test("P8.2 Drive authorization resolves Google consent without exposing OAuth tokens to JavaScript", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveAuthorizationModule.kt");
  const bridge = read("src/features/account/nativeGoogleDriveAuthorization.ts");

  assert.match(native, /Identity\.getAuthorizationClient\(activity\)/);
  assert.match(native, /result\.hasResolution\(\)/);
  assert.match(native, /startIntentSenderForResult/);
  assert.match(native, /getAuthorizationResultFromIntent/);
  assert.match(native, /override fun onActivityResult\(\s*activity: Activity,\s*requestCode: Int,\s*resultCode: Int,\s*data: Intent\?,\s*\)/s);
  assert.doesNotMatch(native, /activity: Activity\?/);
  assert.match(native, /result\.accessToken/);
  assert.match(native, /The OAuth access token stays native-only and in memory/);
  assert.doesNotMatch(native, /putString\("accessToken"|putString\("serverAuthCode"/);
  assert.doesNotMatch(bridge, /accessToken|serverAuthCode|SecureStore|AsyncStorage|MMKV/);
});

test("P8.2 Drive authorization is generated and standalone-build synchronized without prebuild", () => {
  const plugin = read("plugins/withOrionGoogleDriveAuthorization.js");
  const appConfig = read("app.json");
  const build = read("scripts/build-android-standalone.cjs");

  assert.match(plugin, /com\.google\.android\.gms:play-services-auth:21\.6\.0/);
  assert.match(plugin, /OrionGoogleDriveAuthorizationPackage/);
  assert.match(appConfig, /\.\/plugins\/withOrionGoogleDriveAuthorization/);
  assert.match(build, /syncGoogleDriveAuthorizationNativeSources/);
  assert.match(build, /ensureGoogleDriveAuthorizationGradleDependencies/);
  assert.match(build, /ensureGoogleDriveAuthorizationPackageRegistration/);
  assert.match(build, /play-services-auth:21\.6\.0/);
});

test("P8.2 Drive authorization stays separate from sync and library mutation", () => {
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");
  const bridge = read("src/features/account/nativeGoogleDriveAuthorization.ts");

  assert.match(accountUi, /Google Drive/);
  assert.match(accountUi, /private Google Drive storage/);
  assert.match(accountUi, /Sync starts only when you explicitly confirm it/);
  assert.match(accountUi, /This does not upload anything by itself/);
  assert.doesNotMatch(bridge, /LibraryContext|playbackRepository|watchedState|savedOrder|history|progress|PortableProfileV3|CloudProfileStore/);
});

test("P8.2 account disconnect clears cached Drive tokens without implicitly revoking the Drive grant", () => {
  const context = read("src/context/AccountContext.tsx");
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveAuthorizationModule.kt");

  assert.match(context, /clearGoogleDriveAuthorizationCache/);
  assert.doesNotMatch(context, /revokeGoogleDriveAppData/);
  assert.match(native, /ClearTokenRequest\.builder\(\)/);
  assert.match(native, /fun clearAuthorizationCache/);
});

test("P8.2 Drive authorization can explicitly revoke only Orion's app-data grant", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveAuthorizationModule.kt");
  const bridge = read("src/features/account/nativeGoogleDriveAuthorization.ts");

  assert.match(native, /RevokeAccessRequest\.builder\(\)/);
  assert.match(native, /setAccount\(Account\(email, GOOGLE_ACCOUNT_TYPE\)\)/);
  assert.match(native, /setScopes\(listOf\(Scope\(DRIVE_APPDATA_SCOPE\)\)\)/);
  assert.match(native, /\.revokeAccess\(request\)/);
  assert.match(native, /GOOGLE_DRIVE_REVOKE_FAILED/);
  assert.match(native, /OrionGoogleDriveTokenVault\.clear\(\)/);
  assert.doesNotMatch(native, /drive\.file|drive\.readonly|drive\.metadata|drive"/);

  assert.match(bridge, /revokeAppData\(accountEmail: string\)/);
  assert.match(bridge, /revokeGoogleDriveAppData/);
  assert.doesNotMatch(bridge, /accessToken|serverAuthCode|SecureStore|AsyncStorage|MMKV/);
});

test("P8.2 Drive Ready state exposes an explicit confirmed removal action", () => {
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");

  assert.match(accountUi, /Remove Drive access/);
  assert.match(accountUi, /Remove Google Drive access\?/);
  assert.match(accountUi, /Remove access/);
  assert.match(accountUi, /role: 'destructive'/);
  assert.match(accountUi, /revokeGoogleDriveAppData\(profile\.email\)/);
  assert.match(accountUi, /Drive access was removed\. Your local library was not changed\./);
  assert.match(accountUi, /Drive access could not be removed\. Orion still considers Drive access active\./);
});

test("P8.2 Drive authorization silently restores an existing app-data grant after process restart", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveAuthorizationModule.kt");
  const bridge = read("src/features/account/nativeGoogleDriveAuthorization.ts");

  const checkStart = native.indexOf("fun checkAppDataAuthorization");
  const authorizeStart = native.indexOf("fun authorizeAppData", checkStart);
  assert.ok(checkStart >= 0 && authorizeStart > checkStart, "silent Drive authorization check should stay separate from interactive authorization");
  const checkMethod = native.slice(checkStart, authorizeStart);

  assert.match(checkMethod, /Identity\.getAuthorizationClient\(reactContext\)/);
  assert.match(checkMethod, /\.authorize\(request\)/);
  assert.match(checkMethod, /!result\.hasResolution\(\)/);
  assert.match(checkMethod, /OrionGoogleDriveTokenVault\.store\(email, token!!\)/);
  assert.match(checkMethod, /putBoolean\("interactionRequired", result\.hasResolution\(\)\)/);
  assert.doesNotMatch(checkMethod, /startIntentSenderForResult|getAuthorizationResultFromIntent/);

  assert.match(bridge, /checkAppDataAuthorization\(accountEmail: string\)/);
  assert.match(bridge, /checkGoogleDriveAppDataAuthorization/);
  assert.doesNotMatch(bridge, /accessToken|serverAuthCode|SecureStore|AsyncStorage|MMKV/);
});

test("P8.2 Account restores Drive readiness without automatically launching consent UI", () => {
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");

  const effectStart = accountUi.indexOf("setDrivePhase('checking')");
  const authorizeStart = accountUi.indexOf("const authorizeDrive", effectStart);
  assert.ok(effectStart >= 0 && authorizeStart > effectStart, "Drive restoration effect should precede the explicit authorization action");
  const restoreEffect = accountUi.slice(effectStart, authorizeStart);

  assert.match(restoreEffect, /checkGoogleDriveAppDataAuthorization\(profile\.email\)/);
  assert.match(restoreEffect, /setDrivePhase\(result\.authorized \? 'ready' : 'idle'\)/);
  assert.doesNotMatch(restoreEffect, /authorizeGoogleDriveAppData|startIntentSenderForResult/);

  assert.match(accountUi, /Checking Drive\.\.\./);
  assert.match(accountUi, /const driveStatus = driveReady[\s\S]{0,260}\? 'Checking'[\s\S]{0,260}: 'Off'/);
});

test("P8.2 silent Drive restoration preserves explicit revocation and library boundaries", () => {
  const native = read("plugins/orion-google-drive-authorization-native/OrionGoogleDriveAuthorizationModule.kt");
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");

  assert.match(native, /putBoolean\("authorized", alreadyGranted\)/);
  assert.match(native, /putBoolean\("interactionRequired", result\.hasResolution\(\)\)/);
  assert.match(accountUi, /setDrivePhase\(result\.authorized \? 'ready' : 'idle'\)/);
  assert.doesNotMatch(
    accountUi,
    /checkGoogleDriveAppDataAuthorization\(profile\.email\)[\s\S]{0,900}(savedOrder|watchedState|playbackRepository|LibraryContext)/,
  );
});
