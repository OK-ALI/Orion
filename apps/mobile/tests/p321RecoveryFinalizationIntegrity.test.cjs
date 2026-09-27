const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobile = path.resolve(__dirname, '..');
const plugin = path.join(mobile, 'plugins', 'orion-cinema-webview-native');
const read = (name) => fs.readFileSync(path.join(plugin, name), 'utf8');

const store = read('OrionDownloadJobStore.kt');
const runtime = read('OrionDownloadTransferRuntime.kt');

test('V8.16 requires durable yt-dlp transfer completion before recovery can finalize a staging MP4', () => {
  assert.match(store, /fun sealYtDlpTransferCompletion\(/);
  assert.match(store, /"_ytDlpTransferCompletion"/);
  assert.match(store, /\.put\("expectedSizeBytes", expectedSizeBytes\)/);
  assert.match(store, /fun ytDlpTransferCompletion\(jobId: String\): JSONObject\?/);

  const verifiedStart = runtime.indexOf('private fun runVerifiedYtDlpFinalization');
  const verifiedEnd = runtime.indexOf('fun hasCompleteLocalFinalization', verifiedStart);
  const verified = runtime.slice(verifiedStart, verifiedEnd);
  assert.match(verified, /ytDlpTransferCompletion\(jobId\)\s*\?: return false/);
  assert.match(verified, /availableSize != expectedSizeBytes/);
  assert.match(verified, /OrionFinalizedMediaVerifier\.verify/);
  assert.match(verified, /val verifiedBytes = expectedSizeBytes/);
  assert.doesNotMatch(verified, /val verifiedBytes = media\.length\(\)\.takeIf/);
});

test('V8.16 recovery worker local-finalization shortcut rejects an unsealed partial yt-dlp MP4', () => {
  const start = runtime.indexOf('fun hasCompleteLocalYtDlpFinalization');
  const end = runtime.indexOf('private fun runVerifiedLocalFinalization', start);
  const body = runtime.slice(start, end);
  assert.match(body, /ytDlpTransferCompletion\(jobId\) \?: return false/);
  assert.match(body, /media\.length\(\) != expectedSizeBytes/);
  assert.match(body, /pending\.optLong\("expectedSizeBytes", -1L\) == expectedSizeBytes/);
});

test('V8.16 seals HLS and DASH completion only after finalized-media verification', () => {
  const hls = runtime.slice(runtime.indexOf('private fun runHlsYtDlp'), runtime.indexOf('private fun runHlsFragmented'));
  assert.match(hls, /OrionFinalizedMediaVerifier\.verify/);
  assert.match(hls, /sealYtDlpTransferCompletion\(\s*jobId,\s*"hls",\s*verifiedBytes,/s);
  assert.ok(hls.indexOf('OrionFinalizedMediaVerifier.verify') < hls.indexOf('sealYtDlpTransferCompletion'));

  const dash = runtime.slice(runtime.indexOf('private fun runDashYtDlp'), runtime.indexOf('private fun runDashFragmented'));
  assert.match(dash, /OrionFinalizedMediaVerifier\.verify/);
  assert.match(dash, /sealYtDlpTransferCompletion\(\s*jobId,\s*"dash",\s*verifiedBytes,/s);
  assert.ok(dash.indexOf('OrionFinalizedMediaVerifier.verify') < dash.indexOf('sealYtDlpTransferCompletion'));
});

test('V8.16 private completion proof never becomes public job state and is retired on cancel/completion', () => {
  assert.match(store, /if \(key\.startsWith\("_"\)\) remove\.add\(key\)/);
  const cancel = store.slice(store.indexOf('fun cancelAndFence'), store.indexOf('@Synchronized', store.indexOf('fun cancelAndFence') + 30));
  assert.match(cancel, /job\.remove\("_ytDlpTransferCompletion"\)/);
  const completed = store.slice(store.indexOf('fun markCompleted'), store.indexOf('fun publicJob', store.indexOf('fun markCompleted')));
  assert.match(completed, /job\.remove\("_ytDlpTransferCompletion"\)/);
});


test('V8.16 hardens the shared runJob gate used by explicit manual Retry as well as automatic recovery', () => {
  const engineModule = read('OrionDownloadEngineModule.kt');
  const foregroundService = read('OrionDownloadForegroundService.kt');

  const retryStart = engineModule.indexOf('fun retryJob');
  const retryEnd = engineModule.indexOf('@ReactMethod', retryStart + 20);
  const retryBody = engineModule.slice(retryStart, retryEnd);
  assert.match(retryBody, /incrementRetry\(clean\)/);
  assert.match(retryBody, /resumeJob\(clean, promise\)/);

  assert.match(foregroundService, /OrionDownloadTransferEngine\.runJob\(applicationContext, jobId\)/);

  const runStart = runtime.indexOf('fun runJob');
  const runEnd = runtime.indexOf('private fun runVerifiedYtDlpFinalization', runStart);
  const runBody = runtime.slice(runStart, runEnd);
  assert.match(runBody, /runVerifiedYtDlpFinalization\(context, jobId\)/);

  const verifiedStart = runtime.indexOf('private fun runVerifiedYtDlpFinalization');
  const verifiedEnd = runtime.indexOf('fun hasCompleteLocalFinalization', verifiedStart);
  const verified = runtime.slice(verifiedStart, verifiedEnd);
  assert.match(verified, /ytDlpTransferCompletion\(jobId\)\s*\?: return false/);
});
