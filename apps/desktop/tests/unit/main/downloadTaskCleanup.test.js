const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { cleanupDownloadTask } = require("../../../src/main/downloader/taskCleanup");

test("download task cleanup stops only the requested process and removes its owned artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-task-cleanup-"));
  try {
    const ownFile = path.join(dir, "own.mp4");
    const otherFile = path.join(dir, "other.mp4.part");
    const logPath = path.join(dir, "own.log");
    fs.writeFileSync(ownFile, "media");
    fs.writeFileSync(otherFile, "other");
    fs.writeFileSync(logPath, "log");

    const proc = { __orionCleanupCalled: false, __orionCleanup() { this.__orionCleanupCalled = true; } };
    const otherProc = {};
    const activeProcs = new Map([["a", proc], ["b", otherProc]]);
    const killed = [];
    const cleanupCalls = [];

    const result = cleanupDownloadTask(
      { id: "a", filePath: ownFile, logPath, downloadPath: dir, outputStem: "own" },
      {
        activeProcs,
        killProcessTree: (value) => killed.push(value),
        cleanupTempFiles: (...args) => cleanupCalls.push(args),
      },
    );

    assert.equal(result.deleted, 1);
    assert.equal(result.errors, 0);
    assert.deepEqual(killed, [proc]);
    assert.equal(proc.__orionCleanupCalled, true);
    assert.equal(activeProcs.has("a"), false);
    assert.equal(activeProcs.get("b"), otherProc);
    assert.deepEqual(cleanupCalls, [[dir, "own"]]);
    assert.equal(fs.existsSync(ownFile), false);
    assert.equal(fs.existsSync(logPath), false);
    assert.equal(fs.existsSync(otherFile), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
