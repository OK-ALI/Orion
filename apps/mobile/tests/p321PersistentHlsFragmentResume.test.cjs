'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
const gateway = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt');
const hls = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpHlsGateway.kt');
const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('V8.19 keeps the accepted production HLS path and V8.17 stale-output fence', () => {
  const runHls = between(transfer, 'private fun runHls(', 'private fun runHlsYtDlp(');
  assert.match(runHls, /runHlsFragmented/);
  assert.match(runHls, /runHlsYtDlp/);

  const execute = between(runtime, 'fun executeHlsGateway(', 'fun executeDashGateway(');
  assert.match(execute, /OrionDownloadYtDlpHlsGateway/);
  assert.match(execute, /allowInPlacePause = true/);
  assert.match(runtime, /private fun prepareHlsExecutionOutput/);
  assert.match(runtime, /if \(!output\.delete\(\)\)/);
  assert.match(runtime, /recovery=staging-reset outcome=discarded/);
});

test('V8.19 scopes resume storage to the private HLS staging tree only', () => {
  const hlsExecute = between(runtime, 'fun executeHlsGateway(', 'fun executeDashGateway(');
  assert.match(hlsExecute, /\.start\(cleanJobId, onMeasuredMediaProgress\)/);
  assert.match(
    hlsExecute,
    /configureHlsResumeRoot\(\s*File\(stagingDir\(context, cleanJobId\), "hls-resume-v1"\)/,
  );

  const dashExecute = between(runtime, 'fun executeDashGateway(', 'fun execute(');
  assert.doesNotMatch(dashExecute, /hlsResumeRoot/);
  assert.match(runtime, /File\(context\.filesDir, "orion-downloads\/partial\/\$\{cleanJobId\(jobId\) \?: "invalid"\}-ytdlp"\)/);
});

test('V8.19 never persists AES key bytes and re-acquires keys through the accepted gateway', () => {
  assert.match(gateway, /if \(isKey\) null else resumeFingerprint/);
  assert.match(gateway, /!route\.isKey &&\s*writeVerifiedResumeFragment/);

  const keyBranch = between(gateway, 'if (route.isKey) {', 'val headers =');
  assert.match(keyBranch, /key\.size != 16/);
  assert.match(keyBranch, /"Cache-Control" to "no-store"/);
  assert.doesNotMatch(keyBranch, /ResumeCapture|\.fragment|\.proof|writeText/);

  assert.match(hls, /route\(resolved\.url, keyUrl, isKey = true\)/);
  assert.match(hls, /route\(resolvedVideo\.url, keyUrl, isKey = true\)/);
  assert.match(hls, /route\(resolvedAudio\.url, keyUrl, isKey = true\)/);
});

test('V8.19 binds cached ciphertext to exact request and media-playlist context without persisting provider coordinates', () => {
  const fingerprint = between(gateway, 'private fun resumeFingerprint(', 'private fun openResumeCapture(');
  assert.match(fingerprint, /bound\.requestContextId/);
  assert.match(fingerprint, /bound\.candidateId/);
  assert.match(fingerprint, /bound\.sourceId/);
  assert.match(fingerprint, /parentUrl/);
  assert.match(fingerprint, /childUrl/);
  assert.match(fingerprint, /resumeScope\.orEmpty\(\)/);
  assert.match(fingerprint, /sha256\(material\.toByteArray/);

  assert.match(hls, /resumeScope = resolved\.body/);
  assert.match(hls, /resumeScope = resolvedVideo\.body/);
  assert.match(hls, /resumeScope = resolvedAudio\.body/);

  const commit = between(gateway, 'private fun commitResumeCapture(', 'private fun abortResumeCapture(');
  assert.match(commit, /proofTemp\.writeText\("v1\\n\$sizeBytes\\n\$digest\\n"/);
  assert.doesNotMatch(commit, /parentUrl|childUrl|requestContextId|candidateId|sourceId|resumeScope|cookie|header|token/);
});

test('V8.19 verifies every reused fragment by size and SHA-256 and falls back to provider transfer on a miss', () => {
  const verify = between(gateway, 'private fun verifiedResumeFile(', 'private fun markMediaComplete(');
  assert.match(verify, /proof\.sizeBytes != data\.length\(\)/);
  assert.match(verify, /sha256File\(data\) != proof\.sha256/);
  assert.match(verify, /proofFile\.delete\(\)/);
  assert.match(verify, /data\.delete\(\)/);

  const provider = between(gateway, 'private fun writeProvider(', 'private data class ResumeProof(');
  assert.match(provider, /writeVerifiedResumeFragment/);
  assert.match(provider, /OrionDownloadAuthorizedHttp\s*\.openFollowingRedirects/);
  assert.match(provider, /status == HttpURLConnection\.HTTP_OK/);
  assert.match(provider, /!clientRangeRequested/);
  assert.match(provider, /route\.rangeStart == null/);
  assert.match(provider, /route\.rangeEndInclusive == null/);
  assert.match(provider, /commitResumeCapture/);
});

test('V8.19 cached replay preserves truthful recovery presentation until fresh provider media arrives', () => {
  const replay = between(gateway, 'private fun writeVerifiedResumeFragment(', 'private fun verifiedResumeFile(');
  assert.match(replay, /markMediaComplete\(routeKey, size, notifyProgress = false\)/);

  const provider = between(gateway, 'private fun writeProvider(', 'private data class ResumeProof(');
  assert.match(provider, /completedProviderBytes\.putIfAbsent\(routeKey, deliveredBytes\) == null/);
  assert.match(provider, /onMediaProgress\(bytes, completedProviderBytes\.size, providerRouteCount\.get\(\)\)/);

  const measured = between(transfer, 'onMeasuredMediaProgress = { bytes, completed, total ->', '},');
  assert.match(measured, /setState\(jobId, "downloading"\)/);
  assert.match(measured, /setGatewayMediaProgress\(jobId, bytes, completed, total\)/);
});

test('V8.19 cache is an optional fail-open layer with bounded fragment and free-space guards', () => {
  assert.match(gateway, /MAX_RESUME_FRAGMENT_BYTES = 128L \* 1024L \* 1024L/);
  assert.match(gateway, /MIN_RESUME_FREE_BYTES = 512L \* 1024L \* 1024L/);
  assert.match(gateway, /if \(resumeSpaceLow\(\)\) \{\s*purgeResumeCache\(\)/);
  assert.match(gateway, /readBytes > MAX_RESUME_FRAGMENT_BYTES/);
  assert.match(gateway, /abortResumeCapture\(capture\)/);

  // Existing unsupported HLS shapes remain rejected by the accepted gateway.
  assert.match(hls, /#EXT-X-BYTERANGE/);
  assert.match(hls, /#EXT-X-PART:/);
  assert.match(hls, /#EXT-X-PRELOAD-HINT:/);
  assert.match(hls, /#EXT-X-RENDITION-REPORT:/);
});
