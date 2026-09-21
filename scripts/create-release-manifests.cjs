const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

const map = readJson(path.join(root, "config", "orion-release-map-v1.json"));
const output = path.resolve(process.argv[2] || path.join(root, "release", `publish-${map.productVersion}`));
const privateKeyPath = process.env.ORION_RELEASE_ED25519_PRIVATE_KEY
  || path.join(os.homedir(), ".orion", "signing", "orion-release-ed25519-private.pem");
const windowsSigner = "99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5";
const androidSigner = "4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd";
const keyId = "orion-release-2026-01";

const verificationPath = path.join(output, "orion-artifact-verification.json");
if (!fs.existsSync(verificationPath)) {
  throw new Error("Verified artifact report is required before release manifests can be created.");
}
const verification = readJson(verificationPath);
if (verification.productVersion !== map.productVersion || !Array.isArray(verification.artifacts)) {
  throw new Error("Verified artifact report does not match the release map.");
}
const verifiedByName = new Map(verification.artifacts.map((entry) => [entry.name, entry]));

const definitions = [
  {
    platform: "windows",
    name: `Orion.Setup.${map.productVersion}.exe`,
    productId: "com.orion.musicplanet",
    buildNumber: null,
    expectedSignerSha256: windowsSigner,
  },
  {
    platform: "windows",
    name: `Orion-${map.productVersion}-win.zip`,
    productId: "com.orion.musicplanet",
    buildNumber: null,
    expectedSignerSha256: windowsSigner,
  },
  {
    platform: "android",
    name: `orion-mobile-v${map.productVersion}.apk`,
    productId: "com.okali.orion",
    buildNumber: map.androidVersionCode,
    expectedSignerSha256: androidSigner,
  },
];

function artifact(definition) {
  const filePath = path.join(output, definition.name);
  if (!fs.existsSync(filePath)) throw new Error(`Missing release artifact: ${definition.name}`);
  const bytes = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const verified = verifiedByName.get(definition.name);
  if (!verified
    || verified.size !== bytes.length
    || verified.sha256 !== sha256
    || verified.signerSha256 !== definition.expectedSignerSha256
    || verified.productId !== definition.productId
    || verified.buildNumber !== definition.buildNumber) {
    throw new Error(`Artifact verification report does not match ${definition.name}.`);
  }
  return {
    platform: definition.platform,
    name: definition.name,
    productId: definition.productId,
    buildNumber: definition.buildNumber,
    size: bytes.length,
    sha256,
    signerSha256: verified.signerSha256,
  };
}

if (!fs.existsSync(privateKeyPath)) {
  throw new Error("Protected Orion release metadata key is unavailable.");
}
const artifacts = definitions.map(artifact);
const v1 = {
  schemaVersion: 1,
  tag: map.gitTag,
  version: map.productVersion,
  artifacts: artifacts.map(({ name, size, sha256, signerSha256 }) => ({
    name,
    size,
    sha256,
    signerSha256,
  })),
};
const payload = {
  schemaVersion: 2,
  sequence: Number(process.env.ORION_RELEASE_SEQUENCE || Date.now()),
  tag: map.gitTag,
  version: map.productVersion,
  channel: "stable",
  publishedAt: new Date().toISOString(),
  minimumUpdaterVersion: map.minimumDirectUpgradeVersion,
  rolloutPercentage: Number(process.env.ORION_MOBILE_ROLLOUT || 100),
  artifacts,
};
if (!Number.isInteger(payload.rolloutPercentage) || payload.rolloutPercentage < 0 || payload.rolloutPercentage > 100) {
  throw new Error("ORION_MOBILE_ROLLOUT must be an integer from 0 to 100.");
}
const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
const signature = crypto.sign(null, payloadBytes, privateKey);
const v2 = {
  schemaVersion: 2,
  algorithm: "Ed25519",
  keyId,
  payload: payloadBytes.toString("base64url"),
  signature: signature.toString("base64url"),
};

fs.writeFileSync(path.join(output, "orion-release-integrity-v1.json"), JSON.stringify(v1, null, 2) + "\n");
fs.writeFileSync(path.join(output, "orion-release-integrity-v2.json"), JSON.stringify(v2, null, 2) + "\n");
console.log(`Created signed Orion ${map.productVersion} release manifests in ${output}`);
