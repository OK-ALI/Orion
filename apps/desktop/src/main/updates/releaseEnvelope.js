const crypto = require("node:crypto");
const { ORION_WINDOWS_RELEASE_SIGNER_SHA256 } = require("./integrity");

const RELEASE_PUBLIC_KEYS = Object.freeze({
  "orion-release-2026-01": "SuLjyzOgmmaEQcLLZ4BezrAJ8TVODzad/KRDbpGaflI=",
});
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function compareVersions(left, right) {
  const parse = (value) => String(value || "0.0.0").replace(/^v/i, "").split(/-(.*)/s);
  const [a, preA] = parse(left);
  const [b, preB] = parse(right);
  const partsA = a.split(".").map(Number), partsB = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const difference = (partsA[i] || 0) - (partsB[i] || 0);
    if (difference) return Math.sign(difference);
  }
  if (preA === preB) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;
  const as = preA.split("."), bs = preB.split(".");
  for (let i = 0; i < Math.max(as.length, bs.length); i += 1) {
    if (as[i] === bs[i]) continue;
    if (as[i] === undefined) return -1;
    if (bs[i] === undefined) return 1;
    const numericA = /^\d+$/.test(as[i]), numericB = /^\d+$/.test(bs[i]);
    if (numericA && numericB) return Math.sign(Number(as[i]) - Number(bs[i]));
    if (numericA !== numericB) return numericA ? -1 : 1;
    return as[i].localeCompare(bs[i]);
  }
  return 0;
}

// Re-verify exact signed bytes at the privileged install boundary. IPC callers
// cannot replace artifact metadata after the renderer has checked a release.
function verifyReleaseEnvelope(input, currentVersion, trustedKeys = RELEASE_PUBLIC_KEYS) {
  const fail = () => { throw new Error("We couldn't verify this update. Nothing was installed."); };
  const envelope = input?.releaseEnvelope;
  if (!envelope || envelope.schemaVersion !== 2 || envelope.algorithm !== "Ed25519") return fail();
  const key = Object.hasOwn(trustedKeys, envelope.keyId) && trustedKeys[envelope.keyId];
  if (!key || typeof envelope.payload !== "string" || envelope.payload.length > 512 * 1024
    || !/^[A-Za-z0-9_-]+$/.test(envelope.payload)
    || typeof envelope.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)) return fail();
  const bytes = Buffer.from(envelope.payload, "base64url");
  const publicKey = crypto.createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key, "base64")]),
    type: "spki", format: "der",
  });
  if (!crypto.verify(null, bytes, publicKey, Buffer.from(envelope.signature, "base64url"))) return fail();
  let payload;
  try { payload = JSON.parse(bytes.toString("utf8")); } catch { return fail(); }
  if (!payload || payload.schemaVersion !== 2 || !VERSION.test(payload.version)
    || payload.version !== input.targetVersion || payload.tag !== `v${payload.version}`
    || !VERSION.test(payload.minimumUpdaterVersion) || !VERSION.test(currentVersion)
    || compareVersions(currentVersion, payload.minimumUpdaterVersion) < 0
    || compareVersions(payload.version, currentVersion) <= 0
    || !["stable", "preview"].includes(payload.channel)
    || !Number.isSafeInteger(payload.sequence) || payload.sequence <= 0
    || !Number.isFinite(Date.parse(payload.publishedAt))
    || !Number.isInteger(payload.rolloutPercentage) || payload.rolloutPercentage < 0 || payload.rolloutPercentage > 100
    || !Array.isArray(payload.artifacts)) return fail();
  const matches = payload.artifacts.filter((artifact) => artifact?.name === input.assetName);
  const artifact = matches[0];
  if (matches.length !== 1 || artifact.platform !== "windows" || artifact.productId !== "com.orion.musicplanet"
    || artifact.name !== `Orion.Setup.${payload.version}.exe` || artifact.buildNumber !== null
    || !Number.isSafeInteger(artifact.size) || artifact.size <= 0 || artifact.size !== input.expectedSize
    || !/^[a-f0-9]{64}$/.test(artifact.sha256) || artifact.sha256 !== input.expectedSha256
    || artifact.signerSha256 !== ORION_WINDOWS_RELEASE_SIGNER_SHA256
    || artifact.signerSha256 !== input.expectedSignerSha256 || input.format !== "exe") return fail();
  let url;
  try { url = new URL(input.url); } catch { return fail(); }
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password
    || url.search || url.hash
    || url.pathname !== `/OK-ALI/Orion/releases/download/${payload.tag}/${artifact.name}`) return fail();
  return payload;
}

module.exports = { compareVersions, verifyReleaseEnvelope, RELEASE_PUBLIC_KEYS };
