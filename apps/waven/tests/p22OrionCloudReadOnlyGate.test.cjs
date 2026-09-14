"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const wavenRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(wavenRoot, "..", "..");
const read = (relative) => fs.readFileSync(path.join(wavenRoot, relative), "utf8");
const readShared = (relative) => fs.readFileSync(path.join(repositoryRoot, "packages", "shared", "orion-cloud-android", relative), "utf8");

test("P2.2 WAVEN registers both Orion Cloud native generators through local delegates", () => {
  const appConfig = read("app.json");
  const identityWrapper = read("plugins/withOrionGoogleIdentity.js");
  const driveWrapper = read("plugins/withOrionGoogleDriveAuthorization.js");

  assert.match(appConfig, /\.\/plugins\/withOrionGoogleIdentity\.js/);
  assert.match(appConfig, /\.\/plugins\/withOrionGoogleDriveAuthorization\.js/);
  assert.match(identityWrapper, /packages\/shared\/orion-cloud-android\/withOrionGoogleIdentity/);
  assert.match(driveWrapper, /packages\/shared\/orion-cloud-android\/withOrionGoogleDriveAuthorization/);

  assert.match(readShared("withOrionGoogleIdentity.js"), /OrionGoogleIdentityPackage/);
  assert.match(readShared("withOrionGoogleDriveAuthorization.js"), /OrionGoogleDriveAuthorizationPackage/);
});

test("P2.2 WAVEN read-only profile probe has no write capability", () => {
  const probe = read("src/infrastructure/orionCloud/orionCloudReadOnlyProbe.ts");

  assert.match(probe, /NativeModules\.OrionGoogleDriveProfileStore/);
  assert.match(probe, /readPortableProfile/);
  assert.match(probe, /PORTABLE_PROFILE_PRIMARY_KEY/);
  assert.match(probe, /normalizePortableProfileV3/);
  assert.doesNotMatch(probe, /writePortableProfile/);
  assert.doesNotMatch(probe, /\.write\s*\(/);
  assert.doesNotMatch(probe, /createPortableProfileV3/);
});

test("P2.2 WAVEN identity and Drive bridges do not expose OAuth tokens", () => {
  const identity = read("src/infrastructure/orionCloud/nativeGoogleIdentity.ts");
  const drive = read("src/infrastructure/orionCloud/nativeGoogleDriveAuthorization.ts");

  assert.match(identity, /NativeModules\.OrionGoogleIdentity/);
  assert.match(identity, /signIn\(serverClientId/);
  assert.doesNotMatch(identity, /idToken|accessToken|refreshToken/);

  assert.match(drive, /NativeModules\.OrionGoogleDriveAuthorization/);
  assert.match(drive, /drive\.appdata/);
  assert.doesNotMatch(drive, /accessToken|refreshToken/);
});

test("P2.2 preservation UI stops on a missing profile instead of creating one", () => {
  const card = read("src/features/orion-cloud/OrionCloudReadOnlyGateCard.tsx");

  assert.match(card, /STOP\. The existing Orion primary profile is not visible to WAVEN/);
  assert.match(card, /No replacement was created and no write was attempted/);
  assert.match(card, /Verify existing profile, read only/);
  assert.doesNotMatch(card, /createPortableProfileV3/);
  assert.doesNotMatch(card, /writePortableProfile/);
});

test("P2.2 leaves music namespaces and automatic sync out of scope", () => {
  const boundary = read("src/infrastructure/orionCloud/README.md");

  assert.match(boundary, /No WAVEN music namespace or automatic sync is authorized in Phase 2/);
  assert.match(boundary, /missing profile is a stop condition/i);
  assert.doesNotMatch(boundary, /auto[- ]sync enabled/i);
});
