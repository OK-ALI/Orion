const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ORION_WINDOWS_RELEASE_SIGNER_SHA256,
  normalizeSha256,
  validateWindowsAuthenticodeResult,
  verifyDownloadedUpdate,
} = require("../../../src/main/updates/integrity");

function fixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "orion-p92-integrity-"));
  const filePath = path.join(folder, "Orion.exe");
  const bytes = Buffer.from("orion-p9.2-runtime-integrity", "utf8");
  fs.writeFileSync(filePath, bytes);

  return {
    folder,
    filePath,
    bytes,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

test("P9.2 normalizes SHA-256 fingerprints safely", () => {
  const digest = "AA:BB:" + "11".repeat(28) + ":CC:DD";
  const normalized = normalizeSha256(digest);

  assert.equal(normalized.length, 64);
  assert.equal(normalized, digest.replaceAll(":", "").toLowerCase());
  assert.equal(normalizeSha256("not-a-digest"), "");
});

test("P9.2 verifies byte size, SHA-256 and the expected Windows signer before install", async (t) => {
  const data = fixture();
  t.after(() => fs.rmSync(data.folder, { recursive: true, force: true }));

  const signer = ORION_WINDOWS_RELEASE_SIGNER_SHA256;

  const result = await verifyDownloadedUpdate(
    {
      filePath: data.filePath,
      expectedSize: data.bytes.length,
      expectedSha256: data.sha256,
      expectedSignerSha256: signer,
      expectedVersion: "3.2.0",
      format: "exe",
    },
    {
      signerVerifier: () => signer,
      productVerifier: () => true,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.sha256, data.sha256);
  assert.equal(result.signerSha256, signer);
});

test("P9.2 rejects a manifest that attempts to replace Orion's Windows signer", async (t) => {
  const data = fixture();
  t.after(() => fs.rmSync(data.folder, { recursive: true, force: true }));

  await assert.rejects(
    verifyDownloadedUpdate(
      {
        filePath: data.filePath,
        expectedSize: data.bytes.length,
        expectedSha256: data.sha256,
        expectedSignerSha256: "ab".repeat(32),
        expectedVersion: "3.2.0",
        format: "exe",
      },
      { signerVerifier: () => "ab".repeat(32) },
    ),
    /does not match Orion/i,
  );
});

test("P9.2 fails closed on artifact size drift", async (t) => {
  const data = fixture();
  t.after(() => fs.rmSync(data.folder, { recursive: true, force: true }));

  await assert.rejects(
    verifyDownloadedUpdate({
      filePath: data.filePath,
      expectedSize: data.bytes.length + 1,
      expectedSha256: data.sha256,
      format: "deb",
    }),
    /size mismatch/i,
  );
});

test("P9.2 fails closed on SHA-256 drift", async (t) => {
  const data = fixture();
  t.after(() => fs.rmSync(data.folder, { recursive: true, force: true }));

  await assert.rejects(
    verifyDownloadedUpdate({
      filePath: data.filePath,
      expectedSize: data.bytes.length,
      expectedSha256: "00".repeat(32),
      format: "deb",
    }),
    /SHA-256 verification failed/i,
  );
});

test("P9.2 refuses automatic Windows installation without signer metadata", async (t) => {
  const data = fixture();
  t.after(() => fs.rmSync(data.folder, { recursive: true, force: true }));

  await assert.rejects(
    verifyDownloadedUpdate({
      filePath: data.filePath,
      expectedSize: data.bytes.length,
      expectedSha256: data.sha256,
      format: "exe",
    }),
    /signer metadata is required/i,
  );
});

test("P9.2 update execution is exposed by Updates preload ownership, not Downloads", () => {
  const desktopRoot = path.resolve(__dirname, "../../..");
  const updates = fs.readFileSync(
    path.join(desktopRoot, "src/preload/api/updates.js"),
    "utf8",
  );
  const downloads = fs.readFileSync(
    path.join(desktopRoot, "src/preload/api/downloads.js"),
    "utf8",
  );

  assert.match(updates, /downloadAndInstallUpdate/);
  assert.match(updates, /acknowledgeUpdateTransaction/);
  assert.doesNotMatch(downloads, /downloadAndInstallUpdate/);
});

test("P9.2 updater preserves retryable partials but cleans cancellation and verification failures", () => {
  const desktopRoot = path.resolve(__dirname, "../../..");
  const updater = fs.readFileSync(path.join(desktopRoot, "src/main/updates/ipc.js"), "utf8");
  assert.match(updater, /error\?\.updateFailure === "network"/);
  assert.match(updater, /if \(!retryable\) removeFile\(partialPath\)/);
  assert.match(updater, /if \(cancelled\)[\s\S]*removeTransaction\(\)/);
  assert.match(updater, /acknowledge-update-transaction/);
  assert.match(updater, /transaction\?\.phase !== "complete"/);
});

test("P9.2 verifyWindowsAuthenticodeSigner reads signer fingerprint from signed installer", (t) => {
  if (process.platform !== "win32") return t.skip("Requires Windows.");
  const exePath = path.resolve(__dirname, "../../../release/publish-3.1.0/Orion.Setup.3.1.0.exe");
  if (!fs.existsSync(exePath)) return t.skip("Requires the signed 3.1.0 installer fixture.");

  const { verifyWindowsAuthenticodeSigner } = require("../../../src/main/updates/integrity");
  const digest = verifyWindowsAuthenticodeSigner(exePath);
  assert.equal(digest, "99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5");
});

test("Windows verification isolates system modules and bounds execution", (t) => {
  if (process.platform !== "win32") return t.skip("Requires Windows.");
  const { windowsVerificationOptions } = require("../../../src/main/updates/windowsVerification");
  const { executable, options } = windowsVerificationOptions({ ORION_TARGET_EXE: "fixture.exe" });
  assert.equal(path.isAbsolute(executable), true);
  assert.equal(options.shell, false);
  assert.equal(options.timeout, 60_000);
  assert.equal(options.env.PSModulePath, path.join(path.dirname(executable), "Modules"));
  assert.equal(options.env.ORION_TARGET_EXE, "fixture.exe");
});

test("Windows verifier checks real product metadata and rejects a modified signed installer", (t) => {
  if (process.platform !== "win32") return t.skip("Requires Windows.");
  const exePath = path.resolve(__dirname, "../../../release/publish-3.1.0/Orion.Setup.3.1.0.exe");
  if (!fs.existsSync(exePath)) return t.skip("Requires the signed 3.1.0 installer fixture.");
  const { verifyWindowsAuthenticodeSigner, verifyWindowsProductMetadata } = require("../../../src/main/updates/integrity");
  assert.equal(verifyWindowsProductMetadata(exePath, "3.1.0"), true);
  assert.throws(() => verifyWindowsProductMetadata(exePath, "3.2.0"), /product identity verification failed/);
  const data = fixture();
  t.after(() => fs.rmSync(data.folder, { recursive: true, force: true }));
  fs.copyFileSync(exePath, data.filePath);
  const descriptor = fs.openSync(data.filePath, "r+");
  try {
    const byte = Buffer.alloc(1);
    fs.readSync(descriptor, byte, 0, 1, 4096);
    byte[0] ^= 1;
    fs.writeSync(descriptor, byte, 0, 1, 4096);
  } finally {
    fs.closeSync(descriptor);
  }
  assert.throws(() => verifyWindowsAuthenticodeSigner(data.filePath), /Authenticode validation failed/);
});

test("pinned self-signed Windows identity survives only the clean-machine NotTrusted condition", () => {
  const base = {
    status: "NotTrusted",
    signerSha256: ORION_WINDOWS_RELEASE_SIGNER_SHA256,
    notBefore: "2026-08-23T00:00:00.000Z",
    notAfter: "2031-08-23T00:00:00.000Z",
    selfSigned: true,
    enhancedKeyUsage: [],
  };
  assert.equal(
    validateWindowsAuthenticodeResult(base, new Date("2026-09-21T00:00:00.000Z")),
    ORION_WINDOWS_RELEASE_SIGNER_SHA256,
  );
  for (const changed of [
    { status: "HashMismatch" },
    { status: "NotSigned" },
    { status: "UnknownError" },
    { signerSha256: "00".repeat(32) },
    { selfSigned: false },
    { enhancedKeyUsage: ["1.3.6.1.5.5.7.3.1"] },
  ]) {
    assert.throws(
      () => validateWindowsAuthenticodeResult({ ...base, ...changed }, new Date("2026-09-21T00:00:00.000Z")),
      /signature|signing|certificate|Authenticode/i,
    );
  }
  assert.throws(
    () => validateWindowsAuthenticodeResult(base, new Date("2032-01-01T00:00:00.000Z")),
    /validity period/i,
  );
});
