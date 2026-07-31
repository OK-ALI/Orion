const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("v1.0.7 IPC compatibility fixture remains populated", () => {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "fixtures", "ipc-contract.json"), "utf8"),
  );
  assert.ok(fixture.preloadApi.length > 100);
  assert.ok(fixture.channels.includes("run-download"));
  assert.ok(fixture.channels.includes("query-video-progress"));
});
