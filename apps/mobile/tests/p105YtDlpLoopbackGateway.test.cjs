const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(...parts) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

test("P10.5 Candidate 5 routes yt-dlp HLS and DASH execution through a strict broker-backed loopback gateway", () => {
  const plugin = read("plugins", "withOrionCinemaWebView.js");
  const http = read("plugins", "orion-cinema-webview-native", "OrionDownloadAuthorizedHttp.kt");
  const gateway = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpGateway.kt");
  const hls = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpHlsGateway.kt");
  const dash = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpDashGateway.kt");
  const authority = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpAuthority.kt");
  const runtime = read("plugins", "orion-cinema-webview-native", "OrionDownloadYtDlpRuntime.kt");
  const transfer = read("plugins", "orion-cinema-webview-native", "OrionDownloadTransferRuntime.kt");

  assert.match(plugin, /'OrionDownloadYtDlpGateway\.kt'/);
  assert.match(plugin, /'OrionDownloadYtDlpHlsGateway\.kt'/);
  assert.match(plugin, /'OrionDownloadYtDlpDashGateway\.kt'/);
  assert.match(plugin, /'OrionDownloadYtDlpDashGatewayTest\.kt'/);

  assert.match(http, /fun openFollowingRedirects\(/);
  assert.match(http, /authorizeDiscoveredDescendant\(/);
  assert.match(http, /resolveForJob\(/);

  assert.match(gateway, /fun registerProvider\(/);
  assert.match(gateway, /OrionDownloadAuthorizedHttp[\s\S]{0,160}\.openFollowingRedirects\(/);
  assert.doesNotMatch(gateway, /OrionDownloadRequestContextBroker/);

  assert.match(hls, /fun prepare\(/);
  assert.match(hls, /OrionDownloadAuthorizedHttp\.fetchText\(/);
  assert.match(hls, /OrionDownloadFragmentPlanner\.selectHlsMaster\(/);
  assert.match(hls, /session\.registerProvider\(/);
  assert.match(hls, /session\.registerManifest\(/);

  // Candidate 3 raw authority remains provider-oriented and fail-closed.
  assert.match(authority, /networkEnforcementRequired = true/);
  assert.match(authority, /scopedCredentialsRequired/);

  // Only a strict 127.0.0.1 HTTP gateway may clear enforcement.
  assert.match(authority, /fun enforceViaLoopbackGateway\(/);
  assert.match(authority, /authority\.transferKind !in[\s\S]{0,120}"hls"[\s\S]{0,120}"dash"/);
  assert.match(authority, /authority\.networkEnforcementRequired/);
  assert.match(authority, /local\.protocol\.lowercase\(Locale\.US\) != "http"/);
  assert.match(authority, /local\.host != "127\.0\.0\.1"/);
  assert.match(authority, /local\.port !in 1\.\.65535/);
  assert.match(authority, /safeGlobalHeaders = emptyMap\(\)/);
  assert.match(authority, /scopedCredentialsRequired = false/);
  assert.match(authority, /networkEnforcementRequired = false/);

  // Runtime owns the whole gateway lifetime around the blocking yt-dlp call.
  assert.match(runtime, /fun executeHlsGateway\(/);
  assert.match(runtime, /OrionDownloadYtDlpAuthorityBroker[\s\S]{0,100}\.issue\(bound\)/);
  assert.match(runtime, /OrionDownloadYtDlpGatewaySession[\s\S]{0,80}\.start\(cleanJobId\)/);
  assert.match(runtime, /OrionDownloadYtDlpHlsGateway[\s\S]{0,100}\.prepare\(/);
  assert.match(runtime, /\.enforceViaLoopbackGateway\(/);
  assert.match(runtime, /execute\([\s\S]{0,180}authority =\s*executionAuthority/);
  assert.match(runtime, /finally \{\s*gateway\.close\(\)/);
  assert.match(runtime, /fun executeDashGateway\(/);
  assert.match(runtime, /OrionDownloadYtDlpDashGateway[\s\S]{0,100}\.prepare\(/);

  // Existing raw execute boundary still refuses unenforced/provider authority.
  assert.match(runtime, /if \(authority\.scopedCredentialsRequired\)/);
  assert.match(runtime, /if \(authority\.networkEnforcementRequired\)/);

  // Orion Library HLS, including selected subtitles, now uses the gateway-backed yt-dlp owner.
  assert.match(transfer, /private fun runHlsYtDlp\(/);
  assert.match(transfer, /OrionDownloadYtDlpRuntime[\s\S]{0,120}\.executeHlsGateway\(/);
  assert.match(transfer, /setProcessProgress\(/);
  assert.match(transfer, /runVerifiedYtDlpFinalization\(/);
  assert.match(transfer, /OrionDownloadSubtitleRuntime\.prepare\(/);
  assert.match(transfer, /\.hasLocalSelection\(/);
  assert.match(transfer, /directManagedArtifacts\(/);

  // Existing fragmented HLS state remains compatible; Device Storage subtitle jobs stay on the proven path.
  assert.match(transfer, /hasLegacyHlsPlan/);
  assert.match(transfer, /selectedSubtitleCount > 0[\s\S]{0,80}destination == "device-storage"/);
  assert.match(transfer, /runHlsFragmented\(/);

  // TransferEngine never bypasses the enforced gateway.
  assert.doesNotMatch(transfer, /OrionDownloadYtDlpRuntime\.execute\(/);

  // New Orion Library DASH jobs use the same enforced gateway architecture.
  assert.match(transfer, /private fun runDashYtDlp\(/);
  assert.match(transfer, /OrionDownloadYtDlpRuntime[\s\S]{0,120}\.executeDashGateway\(/);
  assert.match(transfer, /hasLegacyDashPlan/);
  assert.match(transfer, /runDashFragmented\(/);
  assert.match(transfer, /selectedSubtitleCount > 0[\s\S]{0,80}destination == "device-storage"/);

  assert.match(dash, /internal object OrionDownloadYtDlpDashGateway/);
  assert.match(dash, /OrionDownloadFragmentPlanner[\s\S]{0,100}\.selectDashRepresentations\(/);
  assert.match(dash, /OrionDownloadFragmentPlanner\.parseDash\(/);
  assert.match(dash, /session\.registerProvider\(/);
  assert.match(dash, /session\.registerManifest\(/);
});
