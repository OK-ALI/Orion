const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { YT_DLP_RETRY_ARGS } = require("../../../src/main/downloader/retryPolicy");

test("new, explicit resume and automatic finalization recovery share bounded retries", () => {
  const ipc = fs.readFileSync(path.join(__dirname, "../../../src/main/downloader/ipc.js"), "utf8");
  assert.deepEqual([...YT_DLP_RETRY_ARGS], [
    "--retries", "2", "--fragment-retries", "2",
    "--retry-sleep", "fragment:exp=1:15", "--socket-timeout", "30",
  ]);
  assert.equal((ipc.match(/\.\.\.YT_DLP_RETRY_ARGS/g) || []).length, 2);
  assert.match(ipc, /resumeDownloadTask\(id, \{ automatic = false \} = \{\}\)/);
  assert.match(ipc, /recoverTerminalStall: \(\) => resumeDownloadTask\(id, \{ automatic: true \}\)/);
  assert.doesNotMatch(ipc, /--skip-unavailable-fragments/);
  assert.doesNotMatch(ipc, /"--retries",\s*"(?:10|12)"/);
});
