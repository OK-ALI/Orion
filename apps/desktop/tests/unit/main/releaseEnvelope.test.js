const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const {
  compareVersions, verifyReleaseEnvelope, RELEASE_PUBLIC_KEYS,
} = require("../../../src/main/updates/releaseEnvelope");
const { ORION_WINDOWS_RELEASE_SIGNER_SHA256 } = require("../../../src/main/updates/integrity");

// Only ephemeral test keys sign simulated future releases. No production key access.
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const keys = { fixture: publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64") };
function fixture(overrides = {}) {
  const artifact = {
    name: "Orion.Setup.3.3.0.exe", platform: "windows", productId: "com.orion.musicplanet",
    buildNumber: null, size: 4096, sha256: "ab".repeat(32), signerSha256: ORION_WINDOWS_RELEASE_SIGNER_SHA256,
  };
  const payload = {
    schemaVersion: 2, sequence: 330, version: "3.3.0", tag: "v3.3.0", channel: "stable",
    publishedAt: "2026-09-21T00:00:00Z", minimumUpdaterVersion: "3.2.0", rolloutPercentage: 100,
    artifacts: [artifact], ...overrides,
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  return {
    format: "exe", targetVersion: "3.3.0", assetName: artifact.name,
    url: `https://github.com/OK-ALI/Orion/releases/download/v3.3.0/${artifact.name}`,
    expectedSize: artifact.size, expectedSha256: artifact.sha256, expectedSignerSha256: artifact.signerSha256,
    releaseEnvelope: {
      schemaVersion: 2, algorithm: "Ed25519", keyId: "fixture", payload: bytes.toString("base64url"),
      signature: crypto.sign(null, bytes, privateKey).toString("base64url"),
    },
  };
}

test("native installer verifies real Ed25519 signatures for compatible future releases", () => {
  assert.equal(verifyReleaseEnvelope(fixture(), "3.2.0", keys).version, "3.3.0");
  assert.throws(() => verifyReleaseEnvelope(fixture(), "3.2.0"), /couldn't verify/);
  assert.throws(() => verifyReleaseEnvelope(fixture({ minimumUpdaterVersion: "3.2.1" }), "3.2.0", keys), /couldn't verify/);
  assert.throws(() => verifyReleaseEnvelope(fixture(), "3.3.0", keys), /couldn't verify/);
  assert.throws(() => verifyReleaseEnvelope(fixture(), "3.4.0", keys), /couldn't verify/);
});

test("native installer rejects tampering, missing V2, mismatched artifacts, redirects and signer replacement", () => {
  const mutations = [
    (value) => { delete value.releaseEnvelope; },
    (value) => { value.releaseEnvelope.signature = "A".repeat(86); },
    (value) => { value.releaseEnvelope.payload = Buffer.from("{}").toString("base64url"); },
    (value) => { value.expectedSize += 1; },
    (value) => { value.expectedSha256 = "cd".repeat(32); },
    (value) => { value.expectedSignerSha256 = "cd".repeat(32); },
    (value) => { value.assetName = "Other.exe"; },
    (value) => { value.targetVersion = "3.4.0"; },
    (value) => { value.url = value.url.replace("OK-ALI", "Other"); },
    (value) => { value.url += "?redirect=1"; },
    (value) => { value.url = value.url.replace("https:", "http:"); },
    (value) => { value.url = value.url.replace("github.com", "github.com:8443"); },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    assert.throws(() => verifyReleaseEnvelope(value, "3.2.0", keys), /couldn't verify/);
  }
  for (const overrides of [{ channel: "other" }, { sequence: 0 }, { rolloutPercentage: 101 }, { tag: "v9.0.0" }]) {
    assert.throws(() => verifyReleaseEnvelope(fixture(overrides), "3.2.0", keys), /couldn't verify/);
  }
});

test("Windows and renderer pin the same release key; prerelease versions compare correctly", () => {
  const shared = fs.readFileSync(path.resolve(__dirname, "../../../../../packages/shared/src/types/orionReleaseSigning.ts"), "utf8");
  assert.ok(shared.includes(RELEASE_PUBLIC_KEYS["orion-release-2026-01"]));
  assert.equal(compareVersions("3.2.0", "3.2.0-preview.1"), 1);
  assert.equal(compareVersions("3.2.0-preview.2", "3.2.0-preview.10"), -1);
  assert.equal(compareVersions("3.2.0-preview.1", "3.2.0"), -1);
  assert.equal(compareVersions("3.3.0", "3.2.0"), 1);
});

test("installation IPC rejects unsigned renderer metadata before creating files or starting a download", async () => {
  const filename = path.resolve(__dirname, "../../../src/main/updates/ipc.js");
  const handlers = new Map();
  const runtime = { exports: {} };
  const localRequire = createRequire(filename);
  const electron = {
    app: { getVersion: () => "3.2.0", getPath: () => "unused-test-path" },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) }, shell: {},
  };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module: runtime, exports: runtime.exports, process, console,
    require: (name) => name === "electron" ? electron : name === "fs" ? {
      readFileSync: () => { throw new Error("No pending transaction"); },
      mkdirSync: () => assert.fail("Unsigned request created a download directory"),
    } : name === "https" ? { get: () => assert.fail("Unsigned request started a download") } : localRequire(name),
  }, { filename });
  runtime.exports.register(() => null);
  const input = fixture();
  delete input.releaseEnvelope;
  const result = await handlers.get("download-and-install-update")({}, input);
  assert.equal(result.ok, false);
  assert.match(result.error, /couldn't verify/);
});
