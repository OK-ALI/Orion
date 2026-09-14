"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(mobileRoot, "..", "..");
const sharedRoot = path.join(repositoryRoot, "packages", "shared", "orion-cloud-android");
const wavenRoot = path.join(repositoryRoot, "apps", "waven");
const read = (file) => fs.readFileSync(file, "utf8");

test("P2.1 Orion Mobile plugin entry points delegate to one shared Orion Cloud adapter", () => {
  const identityWrapper = read(path.join(mobileRoot, "plugins", "withOrionGoogleIdentity.js"));
  const driveWrapper = read(path.join(mobileRoot, "plugins", "withOrionGoogleDriveAuthorization.js"));
  const appConfig = read(path.join(mobileRoot, "app.json"));

  assert.match(appConfig, /\.\/plugins\/withOrionGoogleIdentity/);
  assert.match(appConfig, /\.\/plugins\/withOrionGoogleDriveAuthorization/);
  assert.match(identityWrapper, /packages\/shared\/orion-cloud-android\/withOrionGoogleIdentity/);
  assert.match(driveWrapper, /packages\/shared\/orion-cloud-android\/withOrionGoogleDriveAuthorization/);
});

test("P2.1 shared native source preserves Orion Cloud service namespaces and token boundary", () => {
  const identity = read(path.join(sharedRoot, "native", "identity", "OrionGoogleIdentityModule.kt"));
  const authorization = read(path.join(sharedRoot, "native", "drive", "OrionGoogleDriveAuthorizationModule.kt"));
  const store = read(path.join(sharedRoot, "native", "drive", "OrionGoogleDriveProfileStoreModule.kt"));

  assert.match(identity, /^package com\.okali\.orion\.identity/m);
  assert.doesNotMatch(identity, /putString\("idToken"/);
  assert.match(authorization, /^package com\.okali\.orion\.cloud/m);
  assert.match(authorization, /The OAuth access token stays native-only and in memory/);
  assert.match(authorization, /https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/);
  assert.match(store, /orion-portable-profile-v3-/);
  assert.match(store, /spaces=appDataFolder/);
  assert.match(store, /If-Match/);
  assert.match(store, /error\.status == 412/);
});

test("P2.1 Expo and standalone generation both source the shared native tree", () => {
  const identityPlugin = read(path.join(sharedRoot, "withOrionGoogleIdentity.js"));
  const drivePlugin = read(path.join(sharedRoot, "withOrionGoogleDriveAuthorization.js"));
  const standalone = read(path.join(mobileRoot, "scripts", "build-android-standalone.cjs"));

  assert.match(identityPlugin, /path\.join\(__dirname, 'native', 'identity'\)/);
  assert.match(drivePlugin, /path\.join\(__dirname, 'native', 'drive'\)/);
  assert.match(standalone, /packages",\s*"shared",\s*"orion-cloud-android"/s);
  assert.match(standalone, /orionCloudAndroidDirectory,[\s\S]*"native",[\s\S]*"identity"/);
  assert.match(standalone, /orionCloudAndroidDirectory,[\s\S]*"native",[\s\S]*"drive"/);
});

test("P2.1 removes Orion Mobile-owned native duplicates", () => {
  assert.equal(fs.existsSync(path.join(mobileRoot, "plugins", "orion-google-identity-native")), false);
  assert.equal(fs.existsSync(path.join(mobileRoot, "plugins", "orion-google-drive-authorization-native")), false);
});

test("P2.1 leaves WAVEN unwired and incapable of Cloud access", () => {
  const appConfig = read(path.join(wavenRoot, "app.json"));
  assert.match(appConfig, /"package": "com\.okali\.waven"/);
  assert.doesNotMatch(appConfig, /withOrionGoogleIdentity/);
  assert.doesNotMatch(appConfig, /withOrionGoogleDriveAuthorization/);
});
