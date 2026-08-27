const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");

function read(...parts) {
  return fs.readFileSync(path.join(mobileRoot, ...parts), "utf8");
}

test("P10.5 Candidate 4 extracts one broker-backed authorized HTTP execution owner without routing yt-dlp", () => {
  const plugin = read("plugins", "withOrionCinemaWebView.js");
  const broker = read("plugins", "orion-cinema-webview-native", "OrionDownloadRequestContextBroker.kt");
  const http = read("plugins", "orion-cinema-webview-native", "OrionDownloadAuthorizedHttp.kt");
  const transfer = read("plugins", "orion-cinema-webview-native", "OrionDownloadTransferRuntime.kt");

  assert.match(plugin, /'OrionDownloadAuthorizedHttp\.kt'/);

  assert.match(http, /internal object OrionDownloadAuthorizedHttp/);
  assert.match(http, /fun fetchText\(/);
  assert.match(http, /fun authorizedChild\(/);
  assert.match(http, /fun openRequest\(/);

  assert.match(http, /OrionDownloadRequestContextBroker\.resolveForJob\(/);
  assert.match(http, /OrionDownloadRequestContextBroker\.authorizeDiscoveredDescendant\(/);

  assert.match(http, /instanceFollowRedirects = false/);
  assert.match(http, /requestMethod = "GET"/);
  assert.match(http, /setRequestProperty\(\s*"Cookie"/);
  assert.match(http, /setRequestProperty\(\s*"Range"/);
  assert.match(http, /bytes=\$rangeStart-\$rangeEndInclusive/);
  assert.match(http, /bytes=\$rangeStart-/);

  assert.doesNotMatch(
    http,
    /@ReactMethod|ReactApplicationContext|NativeModules|OrionDownloadYtDlpRuntime/,
  );

  assert.match(transfer, /OrionDownloadAuthorizedHttp\.fetchText\(/);
  assert.match(transfer, /OrionDownloadAuthorizedHttp\.authorizedChild\(/);
  assert.match(transfer, /OrionDownloadAuthorizedHttp\.openRequest\(/);

  assert.match(
    transfer,
    /val resumeStart = existing\.takeIf \{ it > 0L && bound\.resumable \}/,
  );

  assert.doesNotMatch(transfer, /private fun fetchAuthorizedText\(/);
  assert.doesNotMatch(transfer, /private fun authorizedChild\(/);
  assert.doesNotMatch(transfer, /private fun openRequest\(/);
  assert.doesNotMatch(transfer, /private fun replayHeader\(/);

  assert.doesNotMatch(transfer, /setRequestProperty\(\s*"Cookie"/);
  assert.doesNotMatch(transfer, /instanceFollowRedirects = false/);

  assert.doesNotMatch(
    transfer,
    /OrionDownloadYtDlpRuntime|OrionDownloadYtDlpAuthorityBroker/,
  );

  assert.match(broker, /internal fun resolveForJob\(/);
  assert.match(broker, /internal fun authorizeDiscoveredDescendant\(/);
});
