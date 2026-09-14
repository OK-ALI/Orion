"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const wavenRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(wavenRoot, relative), "utf8");

const driveBridge = read("src/infrastructure/orionCloud/nativeGoogleDriveAuthorization.ts");
const identityBridge = read("src/infrastructure/orionCloud/nativeGoogleIdentity.ts");
const lifecycleCard = read("src/features/orion-cloud/OrionCloudReadOnlyGateCard.tsx");
const readOnlyProbe = read("src/infrastructure/orionCloud/orionCloudReadOnlyProbe.ts");

test("P2.3A exposes native Drive revocation through an intentional lifecycle wrapper", () => {
  assert.match(driveBridge, /revokeAppData\(accountEmail: string\): Promise<boolean>/);
  assert.match(driveBridge, /export async function revokeOrionDriveAccess/);
  assert.match(driveBridge, /nativeModule\.revokeAppData\(requireAccountEmail\(accountEmail\)\)/);
  assert.match(driveBridge, /const normalizedEmail = accountEmail\.trim\(\)/);
  assert.match(driveBridge, /GOOGLE_DRIVE_ACCOUNT_MISSING/);
});

test("P2.3A keeps Drive revocation distinct from local authorization cache clearing", () => {
  assert.match(driveBridge, /await nativeModule\.revokeAppData/);
  assert.match(driveBridge, /await nativeModule\.clearAuthorizationCache\(\)/);

  assert.match(
    lifecycleCard,
    /Clear local test session \(does not revoke\)/,
  );

  assert.match(
    lifecycleCard,
    /Google Drive grant and Orion Cloud data were not revoked or changed/,
  );
});

test("P2.3A lifecycle UI still requires reauthorization after Drive revocation", () => {
  assert.match(lifecycleCard, /Revoke private Drive access/);
  assert.match(lifecycleCard, /Drive access revoked/);
  assert.match(
    lifecycleCard,
    /profile and its data were not deleted or modified/,
  );

  assert.match(lifecycleCard, /setDriveAuthorized\(false\)/);

  assert.match(
    lifecycleCard,
    /disabled=\{!profile \|\| busy \|\| driveAuthorized\}/,
  );

  assert.match(
    lifecycleCard,
    /disabled=\{!profile \|\| !driveAuthorized \|\| phase !== 'authorized' \|\| busy\}/,
  );

  assert.match(
    lifecycleCard,
    /Reauthorize private Drive data to repeat the preservation checks/,
  );

  assert.match(lifecycleCard, /Existing profile visible/);
  assert.match(lifecycleCard, /PortableProfileV3/);
});

test("P2.3A ordinary profile probe remains absolutely read-only", () => {
  assert.match(readOnlyProbe, /readPortableProfile/);

  assert.doesNotMatch(
    readOnlyProbe,
    /writePortableProfile/,
  );

  assert.doesNotMatch(
    readOnlyProbe,
    /createPortableProfile|updatePortableProfile|deletePortableProfile/,
  );

  assert.doesNotMatch(
    readOnlyProbe,
    /\.(?:create|update|delete)\s*\(/,
  );

  // P2.3D may import its separately guarded controlled-write adapter,
  // but the UI must never reach the native profile store directly.
  assert.doesNotMatch(
    lifecycleCard,
    /NativeModules\.OrionGoogleDriveProfileStore/,
  );

  assert.doesNotMatch(
    lifecycleCard,
    /\.writePortableProfile\s*\(/,
  );
});

test("P2.3A introduces neither music synchronization nor JavaScript OAuth tokens", () => {
  const lifecycleSources = [
    driveBridge,
    lifecycleCard,
    readOnlyProbe,
  ].join("\n");

  assert.doesNotMatch(
    lifecycleSources,
    /wavenFavorites|wavenPlaylists|wavenListeningHistory|wavenPlaybackState|wavenPreferences/,
  );

  assert.doesNotMatch(
    lifecycleSources,
    /automatic\s+sync|auto[- ]sync/i,
  );

  assert.doesNotMatch(
    identityBridge,
    /accessToken|refreshToken|idToken/,
  );

  assert.doesNotMatch(
    driveBridge,
    /accessToken|refreshToken|idToken/,
  );
});
