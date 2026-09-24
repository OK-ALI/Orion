const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { appendPreflightDiagnostic, safeRecord } = require("../../../src/main/downloader/preflightDiagnostics");

test("persisted preflight metadata excludes signed URLs and credential values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "orion-preflight-test-"));
  try {
    const candidate = { sourceId: "vixsrc", url: "https://cdn.example/secret/path?token=private" };
    const result = { ok: false, code: "http_403", diagnostic: {
      stage: "first_media", host: "cdn.example", statusCode: 403, bytesRead: 0,
      requestHeaderNames: ["Authorization", "Cookie"], authorizationPresent: true,
      cookiePresent: true, signedUrl: candidate.url, credential: "private-value",
    } };
    const target = appendPreflightDiagnostic(directory, candidate, "candidate-1", result);
    const content = fs.readFileSync(target, "utf8");
    assert.equal(path.basename(target), "download-preflight.jsonl");
    assert.equal(JSON.parse(content).stage, "first_media");
    assert.doesNotMatch(content, /secret\/path|token=|private-value|signedUrl|credential/);
    assert.equal(safeRecord(candidate, "candidate-1", result).authorizationPresent, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("preflight log is bounded", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "orion-preflight-test-"));
  try {
    let target;
    for (let index = 0; index < 500; index += 1) {
      target = appendPreflightDiagnostic(directory, { sourceId: "vixsrc" }, `candidate-${index}`, {
        ok: false, code: "empty_media", diagnostic: { stage: "first_media", host: "cdn.example" },
      });
    }
    assert.ok(fs.statSync(target).size <= 64 * 1024);
    assert.ok(fs.readFileSync(target, "utf8").trim().split("\n").every((line) => JSON.parse(line)));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
