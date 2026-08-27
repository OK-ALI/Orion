const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(...parts) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

test("P10.5 Candidate 5 preserves selected DASH metadata while replacing provider segments with opaque loopback routes", () => {
  const plugin = read("plugins", "withOrionCinemaWebView.js");
  const planner = read("plugins", "orion-cinema-webview-native", "OrionDownloadFragmentPlanner.kt");
  const dash = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpDashGateway.kt");
  const dashTest = read("plugins", "orion-cinema-webview-native-tests", "OrionDownloadYtDlpDashGatewayTest.kt");
  const authority = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpAuthority.kt");
  const runtime = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpRuntime.kt");
  const transfer = read("plugins", "orion-cinema-webview-native", "OrionDownloadTransferRuntime.kt");

  assert.match(plugin, /'OrionDownloadYtDlpDashGateway\.kt'/);
  assert.match(plugin, /'OrionDownloadYtDlpDashGatewayTest\.kt'/);

  assert.match(planner, /internal data class OrionDashRepresentationCoordinate/);
  assert.match(planner, /internal data class OrionDashSelection/);
  assert.match(planner, /fun selectDashRepresentations\(/);
  assert.match(planner, /chooseRepresentation\(/);
  assert.match(planner, /fun parseDash\(/);
  assert.match(planner, /mediaRange/);
  assert.match(planner, /SegmentTimeline/);

  assert.match(dash, /internal object OrionDownloadYtDlpDashGateway/);
  assert.match(dash, /fun prepare\(/);
  assert.match(dash, /selectDashRepresentations\(/);
  assert.match(dash, /OrionDownloadFragmentPlanner\.parseDash\(/);
  assert.match(dash, /rewriteSelectedMpd\(/);
  assert.match(dash, /output\.importNode\(\s*adaptation,\s*false/);
  assert.match(dash, /output\.importNode\(\s*representation,\s*false/);
  assert.match(dash, /createElement\(\s*"SegmentList"/);
  assert.match(dash, /createElement\(\s*"Initialization"/);
  assert.match(dash, /createElement\(\s*"SegmentURL"/);
  assert.match(dash, /rangeStart = fragment\.rangeStart/);
  assert.match(dash, /rangeEndInclusive =\s*fragment\.rangeEndInclusive/);
  assert.match(dash, /type"\)[\s\S]{0,80}"dynamic"/);
  assert.match(dash, /"ContentProtection"/);
  assert.match(dash, /session\.registerManifest\(\s*"dash"/);

  assert.doesNotMatch(dash, /OrionDownloadRequestContextBroker/);
  assert.doesNotMatch(dash, /ReactApplicationContext|@ReactMethod/);

  assert.match(authority, /authority\.transferKind !in[\s\S]{0,120}"hls"[\s\S]{0,120}"dash"/);
  assert.match(runtime, /fun executeDashGateway\(/);
  assert.match(runtime, /bound\.transferKind != "dash"/);
  assert.match(runtime, /OrionDownloadYtDlpDashGateway[\s\S]{0,100}\.prepare\(/);

  assert.match(transfer, /private fun runDashYtDlp\(/);
  assert.match(transfer, /\.executeDashGateway\(/);
  assert.match(transfer, /hasLegacyDashPlan/);
  assert.match(transfer, /runDashFragmented\(/);
  assert.doesNotMatch(transfer, /OrionDownloadYtDlpRuntime\.execute\(/);

  assert.match(dashTest, /selectsSourceRepresentationsAndRewritesTemplateMpdToOpaqueRoutes/);
  assert.match(dashTest, /segmentListRangesBecomeRouteOwnedAndProviderCoordinatesDisappear/);
  assert.match(dashTest, /dynamicAndProtectedMpdFailClosed/);
});
