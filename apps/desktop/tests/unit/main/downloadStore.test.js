const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { cleanupTempFiles, normalize } = require("../../../src/main/downloader/store");

test("download records migrate active jobs and legacy statuses", () => {
  const records = normalize([
    { id: "active", status: "downloading", startedAt: 2 },
    { id: "error", status: "error", startedAt: 1 },
  ]);

  assert.equal(records[0].status, "paused");
  assert.equal(records[0].lastMessage, "Interrupted when Orion closed");
  assert.equal(records[1].status, "failed");
  assert.equal(records[1].schemaVersion, 3);
});

test("download records retain the newest job for the same media identity", () => {
  const records = normalize([
    {
      id: "old",
      tmdbId: 42,
      mediaType: "tv",
      season: 1,
      episode: 2,
      status: "failed",
      startedAt: 1,
    },
    {
      id: "new",
      tmdbId: 42,
      mediaType: "tv",
      season: 1,
      episode: 2,
      status: "completed",
      completedAt: 3,
    },
  ]);

  assert.equal(records.length, 1);
  assert.equal(records[0].id, "new");
});


test("task-scoped cleanup preserves another episode's partial download in the same season folder", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-download-cleanup-"));
  try {
    const first = "Episode 2 [orion-task-a]";
    const second = "Episode 3 [orion-task-b]";
    fs.writeFileSync(path.join(dir, `${first}.mp4.part`), "a");
    fs.writeFileSync(path.join(dir, `${first}.mp4.ytdl`), "a");
    fs.writeFileSync(path.join(dir, `${second}.mp4.part`), "b");
    fs.writeFileSync(path.join(dir, `${second}.mp4`), "final");

    cleanupTempFiles(dir, first);

    assert.equal(fs.existsSync(path.join(dir, `${first}.mp4.part`)), false);
    assert.equal(fs.existsSync(path.join(dir, `${first}.mp4.ytdl`)), false);
    assert.equal(fs.existsSync(path.join(dir, `${second}.mp4.part`)), true);
    assert.equal(fs.existsSync(path.join(dir, `${second}.mp4`)), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
