const test = require("node:test");
const assert = require("node:assert/strict");
const { temporaryExecutableName } = require("../../../src/main/downloader/tools");

test("managed Windows tool staging keeps an executable extension", () => {
  const temporaryName = temporaryExecutableName(
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
  );

  if (process.platform === "win32") {
    assert.equal(temporaryName, "yt-dlp.download.exe");
  } else {
    assert.equal(temporaryName, "yt-dlp.download");
  }
});
