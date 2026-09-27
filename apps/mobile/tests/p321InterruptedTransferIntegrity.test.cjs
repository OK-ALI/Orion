'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const gateway = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt');
const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('V8.14 requires every registered HLS media route to complete before a successful process can become transfer-complete', () => {
  assert.match(gateway, /data class OrionYtDlpGatewayCompletionProof/);
  assert.match(gateway, /totalMediaRoutes > 0/);
  assert.match(gateway, /completedMediaRoutes == totalMediaRoutes/);
  assert.match(gateway, /completedMediaBytes > 0L/);

  const proof = between(gateway, 'fun completionProof()', '/**\n   * Registers only already-prepared local manifest bytes.');
  assert.match(proof, /totalMediaRoutes = providerRouteCount\.get\(\)/);
  assert.match(proof, /completedMediaRoutes = completedProviderBytes\.size/);
  assert.match(proof, /completedMediaBytes = completedProviderByteCount\.get\(\)/);
  assert.match(proof, /providerReadErrors = providerReadErrorCount\.get\(\)/);
  assert.match(proof, /providerWriteErrors = providerWriteErrorCount\.get\(\)/);
});

test('V8.14 waits briefly for gateway accounting to settle without turning provider requests into unbounded waits', () => {
  assert.match(gateway, /fun awaitCompletionProof\(/);
  assert.match(gateway, /timeoutMs\.coerceIn\(0L, COMPLETION_PROOF_WAIT_MS\)/);
  assert.match(gateway, /TimeUnit\.MILLISECONDS\.toNanos\(boundedTimeout\)/);
  assert.match(gateway, /Thread\.sleep\(COMPLETION_PROOF_POLL_MS\)/);
  assert.match(gateway, /private const val COMPLETION_PROOF_WAIT_MS = 1_500L/);
  assert.match(gateway, /private const val COMPLETION_PROOF_POLL_MS = 25L/);
});

test('V8.14 converts a zero-exit partial HLS result into retryable recovery instead of Ready Offline', () => {
  const hls = between(runtime, 'fun executeHlsGateway(', 'fun executeDashGateway(');
  assert.match(hls, /if \(outcome is OrionYtDlpOutcome\.Completed\)/);
  assert.match(hls, /gateway\.awaitCompletionProof\(\)/);
  assert.match(hls, /stage=hls-transfer-proof/);
  assert.match(hls, /if \(!proof\.complete\)/);
  assert.match(hls, /"yt-dlp-hls-transfer-incomplete"/);
  assert.match(hls, /OrionYtDlpOutcome\.Failed\([\s\S]*?true/);

  const failed = between(
    transfer,
    'is OrionYtDlpOutcome.Failed -> {',
    'OrionDownloadNotifications\n          .reconcile(context)',
  );
  assert.match(failed, /if \(outcome\.retryable\)/);
  assert.match(failed, /OrionDownloadJobStore\.markRecovering/);
  assert.match(failed, /OrionDownloadRecoveryScheduler\.schedule/);
});

test('V8.14 leaves the V8.13 in-place Pause and Resume path intact', () => {
  assert.match(runtime, /allowInPlacePause = true/);
  assert.match(runtime, /liveHlsJobs\.add\(cleanJobId\)/);
  assert.match(runtime, /liveHlsJobs\.remove\(cleanJobId\)/);
  assert.match(gateway, /private fun awaitTransferPermission\(\): Boolean/);
  assert.match(gateway, /"pause" -> \{[\s\S]*?Thread\.sleep\(PAUSE_POLL_MS\)/);
});
