const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const map = JSON.parse(fs.readFileSync(path.join(root, "config", "orion-release-map-v1.json"), "utf8"));
const qualification = JSON.parse(fs.readFileSync(
  path.join(root, "config", `release-qualification-${map.productVersion}.json`),
  "utf8",
));
const stage = path.resolve(process.argv[2] || path.join(root, "release", `publish-${map.productVersion}`));

const WINDOWS_SIGNER_SHA256 = "99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5";
const ANDROID_SIGNER_SHA256 = "4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd";
const RELEASE_KEY_ID = "orion-release-2026-01";
const RELEASE_PUBLIC_KEY = "SuLjyzOgmmaEQcLLZ4BezrAJ8TVODzad/KRDbpGaflI=";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function fail(message) {
  throw new Error(message);
}

function readJson(filename) {
  const filePath = path.join(stage, filename);
  if (!fs.existsSync(filePath)) fail(`Missing release file: ${filename}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileRecord(filename) {
  const filePath = path.join(stage, filename);
  if (!fs.existsSync(filePath)) fail(`Missing release artifact: ${filename}`);
  const bytes = fs.readFileSync(filePath);
  return {
    name: filename,
    size: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

function verifyEnvelope(envelope, expectedSchema) {
  if (!envelope || envelope.schemaVersion !== expectedSchema || envelope.algorithm !== "Ed25519"
    || envelope.keyId !== RELEASE_KEY_ID || typeof envelope.payload !== "string"
    || typeof envelope.signature !== "string") {
    fail("Signed release envelope structure is invalid.");
  }
  const payload = Buffer.from(envelope.payload, "base64url");
  const signature = Buffer.from(envelope.signature, "base64url");
  if (signature.length !== 64) fail("Signed release envelope signature length is invalid.");
  const publicKey = crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(RELEASE_PUBLIC_KEY, "base64")]),
    type: "spki",
    format: "der",
  });
  if (!crypto.verify(null, payload, publicKey, signature)) {
    fail("Signed release envelope signature verification failed.");
  }
  return JSON.parse(payload.toString("utf8"));
}

function requireArtifact(list, name) {
  const matches = list.filter((entry) => entry && entry.name === name);
  if (matches.length !== 1) fail(`Release metadata must contain exactly one ${name} artifact.`);
  return matches[0];
}

const installer = fileRecord(map.artifacts.windowsInstaller);
const archive = fileRecord(map.artifacts.windowsArchive);
const apk = fileRecord(map.artifacts.androidInstaller);
const actualByName = new Map([installer, archive, apk].map((entry) => [entry.name, entry]));

const allowedFiles = new Set([
  map.artifacts.windowsInstaller,
  map.artifacts.windowsArchive,
  map.artifacts.androidInstaller,
  map.artifacts.integrityV1,
  map.artifacts.integrityV2,
  map.artifacts.providerStatusV1,
  "orion-artifact-verification.json",
  "orion-local-candidate-evidence.json",
  `orion-${map.productVersion}-qualification.md`,
]);
for (const entry of fs.readdirSync(stage, { withFileTypes: true })) {
  if (entry.isFile() && !allowedFiles.has(entry.name)) {
    fail(`Unexpected release-bundle file: ${entry.name}`);
  }
}

const v1 = readJson(map.artifacts.integrityV1);
if (v1.schemaVersion !== 1 || v1.tag !== map.gitTag || v1.version !== map.productVersion
  || !Array.isArray(v1.artifacts)) {
  fail("V1 release integrity manifest does not match the release map.");
}
for (const [name, signer] of [
  [installer.name, WINDOWS_SIGNER_SHA256],
  [archive.name, WINDOWS_SIGNER_SHA256],
  [apk.name, ANDROID_SIGNER_SHA256],
]) {
  const metadata = requireArtifact(v1.artifacts, name);
  const actual = actualByName.get(name);
  if (metadata.size !== actual.size || metadata.sha256 !== actual.sha256 || metadata.signerSha256 !== signer) {
    fail(`V1 release integrity metadata does not match ${name}.`);
  }
}

const v2Envelope = readJson(map.artifacts.integrityV2);
const v2 = verifyEnvelope(v2Envelope, 2);
if (v2.schemaVersion !== 2 || v2.tag !== map.gitTag || v2.version !== map.productVersion
  || v2.channel !== "stable" || v2.minimumUpdaterVersion !== map.minimumDirectUpgradeVersion
  || !Number.isSafeInteger(v2.sequence) || v2.sequence <= 0
  || !Number.isFinite(Date.parse(v2.publishedAt))
  || !Number.isInteger(v2.rolloutPercentage) || v2.rolloutPercentage < 0 || v2.rolloutPercentage > 100
  || !Array.isArray(v2.artifacts)) {
  fail("V2 signed release integrity payload does not match the release map.");
}
for (const [name, platform, productId, buildNumber, signer] of [
  [installer.name, "windows", "com.orion.musicplanet", null, WINDOWS_SIGNER_SHA256],
  [archive.name, "windows", "com.orion.musicplanet", null, WINDOWS_SIGNER_SHA256],
  [apk.name, "android", "com.okali.orion", map.androidVersionCode, ANDROID_SIGNER_SHA256],
]) {
  const metadata = requireArtifact(v2.artifacts, name);
  const actual = actualByName.get(name);
  if (metadata.platform !== platform || metadata.productId !== productId
    || metadata.buildNumber !== buildNumber || metadata.size !== actual.size
    || metadata.sha256 !== actual.sha256 || metadata.signerSha256 !== signer) {
    fail(`V2 signed release integrity metadata does not match ${name}.`);
  }
}

const providerEnvelope = readJson(map.artifacts.providerStatusV1);
const providerPayload = verifyEnvelope(providerEnvelope, 1);
if (providerPayload.schemaVersion !== 1 || !Array.isArray(providerPayload.statuses)
  || !Number.isSafeInteger(providerPayload.sequence) || providerPayload.sequence <= 0
  || !Number.isFinite(Date.parse(providerPayload.publishedAt))
  || !Number.isFinite(Date.parse(providerPayload.expiresAt))) {
  fail("Signed provider-status payload is invalid.");
}

const evidence = qualification.evidence || {};
for (const [field, actual] of [
  ["mobileApkSha256", apk.sha256],
  ["desktopInstallerSha256", installer.sha256],
  ["desktopArchiveSha256", archive.sha256],
  ["mobileSignerSha256", ANDROID_SIGNER_SHA256],
  ["windowsSignerSha256", WINDOWS_SIGNER_SHA256],
]) {
  const recorded = String(evidence[field] || "").trim().toLowerCase();
  if (recorded && recorded !== actual) {
    fail(`Qualification evidence ${field} does not match the exact release bundle.`);
  }
}

console.log(`Verified Orion ${map.productVersion} release bundle at ${stage}`);
console.log(`Desktop installer SHA-256: ${installer.sha256}`);
console.log(`Desktop archive SHA-256:   ${archive.sha256}`);
console.log(`Mobile APK SHA-256:        ${apk.sha256}`);
