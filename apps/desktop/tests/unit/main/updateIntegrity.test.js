const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  normalizeSha256,
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

  const signer = "ab".repeat(32);

  const result = await verifyDownloadedUpdate(
    {
      filePath: data.filePath,
      expectedSize: data.bytes.length,
      expectedSha256: data.sha256,
      expectedSignerSha256: signer,
      format: "exe",
    },
    {
      signerVerifier: () => signer,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.sha256, data.sha256);
  assert.equal(result.signerSha256, signer);
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
  assert.doesNotMatch(downloads, /downloadAndInstallUpdate/);
});