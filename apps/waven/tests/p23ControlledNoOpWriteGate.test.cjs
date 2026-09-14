"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const wavenRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(wavenRoot, relative), "utf8");

const controlledGate = read("src/infrastructure/orionCloud/orionCloudControlledNoOpWriteGate.ts");
const readOnlyProbe = read("src/infrastructure/orionCloud/orionCloudReadOnlyProbe.ts");
const lifecycleCard = read("src/features/orion-cloud/OrionCloudReadOnlyGateCard.tsx");
const driveBridge = read("src/infrastructure/orionCloud/nativeGoogleDriveAuthorization.ts");
const identityBridge = read("src/infrastructure/orionCloud/nativeGoogleIdentity.ts");

test("P2.3D keeps the ordinary read-only probe untouched by write capability", () => {
  assert.match(readOnlyProbe, /readPortableProfile/);
  assert.doesNotMatch(readOnlyProbe, /writePortableProfile/);
  assert.doesNotMatch(readOnlyProbe, /createPortableProfile|updatePortableProfile|deletePortableProfile/);
});

test("P2.3D controlled gate exposes no arbitrary payload and can only write the captured preimage", () => {
  assert.match(controlledGate, /writePortableProfile\(/);
  assert.match(controlledGate, /pending\.rawProfileJson/);
  assert.match(controlledGate, /pending\.revisionTag/);
  assert.match(controlledGate, /PORTABLE_PROFILE_PRIMARY_KEY/);
  assert.doesNotMatch(controlledGate, /export async function .*profileJson/);
  assert.doesNotMatch(controlledGate, /createPortableProfile|deletePortableProfile|updatePortableProfile/);
});

test("P2.3D requires exact raw bytes, SHA-256, validation and conditional revision before writing", () => {
  assert.match(controlledGate, /profileJson !== profileJson\.trim\(\)/);
  assert.match(controlledGate, /normalizePortableProfileV3/);
  assert.match(controlledGate, /sha256Utf8/);
  assert.match(controlledGate, /e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/);
  assert.match(controlledGate, /ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad/);
  assert.match(controlledGate, /justBeforeWrite\.revisionTag !== pending\.revisionTag/);
  assert.match(controlledGate, /justBeforeWrite\.profileJson !== pending\.rawProfileJson/);
  assert.match(controlledGate, /justBeforeDigest\.hash !== pending\.rawSha256/);
});

test("P2.3D uses conflict-safe native write and exact read-back verification", () => {
  assert.match(
    controlledGate,
    /writePortableProfile\(\s*email,\s*PORTABLE_PROFILE_PRIMARY_KEY,\s*pending\.rawProfileJson,\s*pending\.revisionTag/s,
  );
  assert.match(controlledGate, /writeResult\.state === 'conflict'/);
  assert.match(controlledGate, /result\.profileJson !== context\.rawProfileJson/);
  assert.match(controlledGate, /digest\.hash !== context\.rawSha256/);
  assert.doesNotMatch(
    controlledGate,
    /result\.revisionTag !== context\.writtenRevisionTag/,
  );
  assert.match(
    controlledGate,
    /afterRevisionTag: result\.revisionTag/,
  );
  assert.match(controlledGate, /retryControlledNoOpReadBack/);
});

test("P2.3D UI is explicitly two-step and never auto-executes the mutation", () => {
  assert.match(lifecycleCard, /4\. Prepare controlled no-op write/);
  assert.match(lifecycleCard, /5\. EXECUTE identical conditional write/);
  assert.match(lifecycleCard, /ARMED, NOT WRITTEN/);
  assert.match(lifecycleCard, /Expected semantic delta: ZERO/);
  assert.match(lifecycleCard, /Retry read-back verification only/);
  assert.match(lifecycleCard, /No create path and no arbitrary payload input/);
  assert.doesNotMatch(lifecycleCard, /useEffect\s*\(/);
});

test("P2.3D does not leak OAuth tokens or introduce WAVEN music synchronization", () => {
  const sources = [controlledGate, lifecycleCard, driveBridge, identityBridge].join("\n");
  assert.doesNotMatch(identityBridge, /accessToken|refreshToken|idToken/);
  assert.doesNotMatch(driveBridge, /accessToken|refreshToken|idToken/);
  assert.doesNotMatch(
    sources,
    /wavenFavorites|wavenPlaylists|wavenListeningHistory|wavenPlaybackState|wavenPreferences/,
  );
  assert.doesNotMatch(sources, /automatic\s+sync|auto[- ]sync/i);
});
