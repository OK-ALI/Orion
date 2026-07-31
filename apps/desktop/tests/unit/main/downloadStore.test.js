const test = require("node:test");
const assert = require("node:assert/strict");
const { normalize } = require("../../../src/main/downloader/store");

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
