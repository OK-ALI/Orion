"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("P8.1 activates Account without prematurely exposing Sync", () => {
  const architecture = read("src/features/settings/settingsArchitecture.ts");
  assert.match(architecture, /\{ id: 'account', label: 'Account', status: 'active' \}/);
  assert.match(architecture, /\{ id: 'sync', label: 'Sync', status: 'reserved' \}/);
  const settings = read("app/(tabs)/settings.tsx");
  assert.match(settings, /sectionId="account"/);
  assert.match(settings, /<AccountSettingsContent \/>/);
});

test("P8.1 account session uses SecureStore and does not own portable library state", () => {
  const store = read("src/features/account/accountSessionStore.ts");
  assert.match(store, /expo-secure-store/);
  assert.doesNotMatch(store, /mmkvStorageAdapter|LibraryContext|watched|history|progress|saved/i);

  const context = read("src/context/AccountContext.tsx");
  assert.doesNotMatch(context, /LibraryContext|useLibrary|playbackRepository|watchedState|mmkvStorageAdapter/);
  assert.match(context, /clearAccountSession/);
  assert.match(context, /Your local Orion data was not changed/);
});

test("P8.1 native Google bridge exposes profile identity but not the ID token", () => {
  const native = read("plugins/orion-google-identity-native/OrionGoogleIdentityModule.kt");
  assert.match(native, /GetSignInWithGoogleOption/);
  assert.match(native, /google\.uniqueId/);
  assert.match(native, /google\.email/);
  assert.doesNotMatch(native, /putString\("idToken"/);
  assert.match(native, /Deliberately do not expose or persist the Google ID token/);
});

test("P8.1 uses stable Credential Manager dependencies through an Expo config plugin", () => {
  const plugin = read("plugins/withOrionGoogleIdentity.js");
  assert.match(plugin, /androidx\.credentials:credentials:1\.6\.0/);
  assert.match(plugin, /androidx\.credentials:credentials-play-services-auth:1\.6\.0/);
  assert.match(plugin, /googleid:1\.2\.0/);
  assert.match(plugin, /OrionGoogleIdentityPackage/);

  const appConfig = read("app.json");
  assert.match(appConfig, /\.\/plugins\/withOrionGoogleIdentity/);
});

test("P8.1 keeps OAuth configuration Orion-owned and out of committed source", () => {
  const context = read("src/context/AccountContext.tsx");
  assert.match(context, /EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID/);
  assert.doesNotMatch(context, /\.apps\.googleusercontent\.com/);

  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");
  assert.match(accountUi, /Connect Google to use the same Orion identity across devices/);
  assert.match(accountUi, /Keep your Orion library in sync across devices/);
  assert.match(accountUi, /<MyListEnrollmentPreflight/);
  assert.match(accountUi, /<WatchedSyncControl/);
  assert.match(accountUi, /<ViewingActivitySyncControl/);
  assert.match(accountUi, /keeping local Orion data on this device/i);
});

test("P8.1 sign-out is explicit, busy-safe and preserves the local-library boundary", () => {
  const types = read("src/features/account/accountTypes.ts");
  const context = read("src/context/AccountContext.tsx");
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");

  assert.match(types, /'signing-out'/);
  assert.match(context, /phase: 'signing-out'/);
  assert.match(context, /await clearAccountSession\(\)/);
  assert.match(context, /Orion could not disconnect Google securely\. Nothing was removed/);
  assert.match(accountUi, /state\.phase === 'signing-out'/);
  assert.match(accountUi, /Disconnecting\.\.\./);
});

test("P8.1 Account copy is user-facing and does not expose internal phase language", () => {
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");
  const settings = read("app/(tabs)/settings.tsx");
  assert.doesNotMatch(accountUi, /P8\.1|portable-profile|portable profiles/i);
  assert.doesNotMatch(settings, /portable-profile|portable profiles/i);
  assert.match(accountUi, /use the same Orion identity across devices/);
  assert.match(settings, /Your Orion identity and account connection/);
  assert.match(accountUi, /Google connected/);
  assert.match(accountUi, />Orion Cloud</);
  assert.doesNotMatch(accountUi, /Google connects your Orion identity\. Orion Cloud is a separate connection/);
});


test("P8.1 Google action uses the supplied multicolor G asset instead of a theme-tinted glyph", () => {
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");
  const logoPath = path.join(mobileRoot, "assets", "google-g-logo.png");
  const logo = fs.readFileSync(logoPath);

  assert.match(accountUi, /require\('\.\.\/\.\.\/\.\.\/assets\/google-g-logo\.png'\)/);
  assert.doesNotMatch(accountUi, /name="logo-google"/);
  assert.deepEqual(Array.from(logo.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(logo.length > 1000, "Google G asset should be a real PNG, not an empty placeholder");
});


test("P8.1 native Google bridge uses the React activity context required by Credential Manager", () => {
  const native = read("plugins/orion-google-identity-native/OrionGoogleIdentityModule.kt");
  assert.match(native, /val activity = reactContext\.currentActivity/);
  assert.match(native, /CredentialManager\.create\(reactContext\)/);
  assert.match(native, /context = activity/);
  assert.doesNotMatch(native, /val activity = currentActivity(?:\r?\n|$)/);
});


test("P8.1 profile identity stays zoom-safe without a redundant Connected badge", () => {
  const accountUi = read("src/features/settings/AccountSettingsContent.tsx");
  assert.match(accountUi, /<Text style=\{\[styles\.profileMeta[^>]*>Google connected<\/Text>/);
  assert.doesNotMatch(accountUi, /styles\.statusRow|styles\.statusChip/);
  assert.doesNotMatch(accountUi, /profileTitleRow/);
  assert.doesNotMatch(accountUi, /<Text numberOfLines=\{1\} style=\{\[styles\.profileEmail/);
  assert.match(accountUi, /profileRow: \{ flexDirection: 'row', alignItems: 'center', gap: spacing\[2\] \}/);
  assert.match(accountUi, /avatar: \{ width: 48, height: 48, borderRadius: 24 \}/);
  assert.match(accountUi, /profileName: \{ fontSize: fontSizes\.sm/);
  assert.match(accountUi, /profileMeta: \{ marginTop: 1, fontSize: 10, lineHeight: 14/);
});


test("P8.1 drawer exposes account identity separately from device network status", () => {
  const drawer = read("src/components/SidebarDrawer.tsx");

  assert.match(drawer, /useOrionAccount/);
  assert.match(drawer, /accountProfile\?\.avatarUrl/);
  assert.match(drawer, /Google connected/);
  assert.match(drawer, /Google not connected/);
  assert.match(drawer, /onPress=\{\(\) => handleNavigate\('\/settings'\)\}/);
  assert.match(drawer, /styles\.accountCard[\s\S]*styles\.footerCard/);
  assert.match(drawer, /Orion Mobile/);
  assert.match(drawer, /Online\$\{pingMs !== null/);
});
