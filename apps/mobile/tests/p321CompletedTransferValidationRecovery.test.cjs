const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobile = path.resolve(__dirname, '..');
const native = (name) => fs.readFileSync(path.join(mobile, 'plugins/orion-cinema-webview-native', name), 'utf8');
const app = (name) => fs.readFileSync(path.join(mobile, 'src/features/downloads', name), 'utf8');
const runtime = native('OrionDownloadTransferRuntime.kt');
const store = native('OrionDownloadJobStore.kt');
const verifier = native('OrionFinalizedMediaVerifier.kt');
const ytDlp = native('OrionDownloadYtDlpRuntime.kt');
const worker = native('OrionDownloadRecoveryWorker.kt');
const engineModule = native('OrionDownloadEngineModule.kt');
const activity = app('DownloadActivityList.tsx');
const hls = runtime.slice(runtime.indexOf('private fun runHlsYtDlp'), runtime.indexOf('private fun runHlsFragmented'));
const dash = runtime.slice(runtime.indexOf('private fun runDashYtDlp'), runtime.indexOf('private fun runDashFragmented'));
const local = runtime.slice(runtime.indexOf('private fun runCompletedYtDlpValidation'), runtime.indexOf('private fun runVerifiedYtDlpFinalization'));
const run = runtime.slice(runtime.indexOf('fun runJob('), runtime.indexOf('private fun sealCompletedTransferCheckpoint'));

test('782-of-782 equivalent gateway proof is the HLS completed-transfer boundary', () => {
  const gateway = native('OrionDownloadYtDlpGateway.kt');
  assert.match(gateway, /totalMediaRoutes > 0 &&\s*completedMediaRoutes == totalMediaRoutes &&\s*completedMediaBytes > 0L/);
  assert.match(ytDlp, /val proof =\s*gateway\.awaitCompletionProof\(\)/);
  assert.match(ytDlp, /if \(!proof\.complete\) \{/);
});

test('provider 2xx accounting and zero network-error diagnostics remain separate from local validation', () => {
  const gateway = native('OrionDownloadYtDlpGateway.kt');
  assert.match(gateway, /in 200\.\.299 -> provider2xxCount\.incrementAndGet\(\)/);
  assert.match(gateway, /providerReadErrors=\$\{providerReadErrorCount\.get\(\)\}/);
  assert.match(gateway, /providerWriteErrors=\$\{providerWriteErrorCount\.get\(\)\}/);
});

test('only one owned finalized MP4 can be accepted from yt-dlp output', () => {
  assert.match(hls, /outputs\.size != 1 \|\|\s*media == null/);
  assert.match(hls, /canonicalContained\(\s*staging,\s*media/);
});

test('MP4 inspection recognizes separate video and audio MIME tracks', () => {
  assert.match(verifier, /mime\.startsWith\("video\/"\) -> "video"/);
  assert.match(verifier, /mime\.startsWith\("audio\/"\) -> "audio"/);
  assert.match(verifier, /if \(requireAudio && audio\.isEmpty\(\)\)/);
});

test('tail seek uses the track duration with a positive bounded margin', () => {
  assert.match(verifier, /val marginUs = \(durationUs \/ 100L\)\.coerceIn\(1L, 1_000_000L\)/);
  assert.match(verifier, /val playableEndUs = durationUs - marginUs/);
  assert.match(verifier, /val tailUs = minOf\(maximumTimeUs\.coerceAtLeast\(beginningUs\), playableEndUs\)/);
});

test('beginning middle and tail probes replace exact observed-end seeking', () => {
  assert.match(verifier, /linkedSetOf\(beginningUs, beginningUs \+ \(tailUs - beginningUs\) \/ 2L, tailUs\)/);
  assert.doesNotMatch(verifier, /extractor\.seekTo\(probe\.maximumTimeUs/);
  assert.match(verifier, /extractor\.seekTo\(sampleTime, MediaExtractor\.SEEK_TO_PREVIOUS_SYNC\)/);
});

test('normal endpoint EOS is avoided while unreadable in-range samples remain rejection evidence', () => {
  assert.match(verifier, /if \(beginningUs > playableEndUs\) return null/);
  assert.match(verifier, /probe\.representativeSamplesReadable = false/);
  assert.match(verifier, /"yt-dlp-media-payload-invalid"/);
});

test('malformed containers and missing video or required audio still fail closed', () => {
  assert.match(verifier, /hasIsoBmffFileType\(prefix, sizeBytes\)/);
  assert.match(verifier, /"yt-dlp-media-video-missing"/);
  assert.match(verifier, /"yt-dlp-media-audio-missing"/);
});

test('zero or insane durations and unreadable samples still fail closed', () => {
  assert.match(verifier, /it\.durationUs <= 0L \|\| it\.durationUs > MAX_MEDIA_DURATION_US/);
  assert.match(verifier, /!it\.representativeSamplesReadable/);
  assert.match(verifier, /bytesRead <= 0 \|\| bytesRead\.toLong\(\) != sampleSize/);
});

test('HLS and DASH seal a generation-bound hashed transfer checkpoint before validation', () => {
  for (const [body, kind] of [[hls, 'hls'], [dash, 'dash']]) {
    assert.ok(body.indexOf(`sealCompletedTransferCheckpoint(jobId, "${kind}", media)`) < body.indexOf('OrionFinalizedMediaVerifier.verify'));
  }
  assert.match(store, /\.put\("generation", generation\)/);
  assert.match(store, /\.put\("sha256", sha256\)/);
});

test('validation failure becomes post-transfer attention and retains the staging artifact', () => {
  assert.match(hls, /postTransferValidationFailed\(context, jobId, job\.optLong\("_executionGeneration", 0L\), mediaVerification\.code\)/);
  assert.match(runtime, /markCompletedTransferAttention\(jobId, generation, "completed-transfer-validation-failed"/);
  assert.doesNotMatch(local, /staging\.deleteRecursively\(\)/);
});

test('local retry checks size digest ownership and media samples before verified finalization', () => {
  assert.match(local, /media\.length\(\) != expectedSize/);
  assert.match(local, /canonicalContained\(staging, media\)/);
  assert.match(local, /sha256\(media\) != expectedDigest/);
  assert.match(local, /OrionFinalizedMediaVerifier\.verify\(media, requireAudio = true\)/);
  assert.ok(local.indexOf('sealYtDlpTransferCompletion') < local.indexOf('runVerifiedYtDlpFinalization'));
});

test('runJob finishes local checkpoints before any candidate binding or provider execution', () => {
  assert.ok(run.indexOf('runCompletedYtDlpValidation(context, jobId)') < run.indexOf('OrionDownloadTransferRuntime.ensure(candidateId, jobId)'));
  assert.match(run, /if \(OrionDownloadJobStore\.hasPostTransferCheckpoint\(jobId\)\) \{/);
  assert.match(ytDlp, /OrionDownloadJobStore\.hasPostTransferCheckpoint\(jobId\)\) return false/);
});

test('Worker and manual Retry choose local completion without a request context', () => {
  assert.match(worker, /OrionDownloadJobStore\.hasPostTransferCheckpoint\(jobId\)/);
  const resume = engineModule.slice(engineModule.indexOf('fun resumeJob('), engineModule.indexOf('fun retryJob('));
  assert.ok(resume.indexOf('hasPostTransferCheckpoint(clean)') < resume.indexOf('OrionDownloadTransferRuntime.ensure(candidateId, clean)'));
  assert.match(engineModule, /fun retryJob\(jobId: String, promise: Promise\)[\s\S]*resumeJob\(clean, promise\)/);
});

test('fresh authority rebind cannot replace a completed local transfer', () => {
  assert.match(store, /if \(job\.optJSONObject\("_ytDlpCompletedTransfer"\) != null\) return rejectFreshRebind/);
  assert.match(engineModule, /hasPostTransferCheckpoint\(clean\)/);
});

test('cancel and stale generation retire the checkpoint and staging', () => {
  const cancel = runtime.slice(runtime.indexOf('fun cancelJob('), runtime.indexOf('private fun runHls('));
  assert.match(cancel, /stagingDir\(context, jobId\)\.deleteRecursively\(\)/);
  assert.match(store, /job\.remove\("_ytDlpCompletedTransfer"\)/);
  assert.match(run, /retireStaleCompletedYtDlpTransfer\(jobId, generation\)/);
  assert.match(run, /staging\.deleteRecursively\(\)/);
});

test('a completed transfer alone cannot create Ready Offline or bypass completion fences', () => {
  assert.ok(local.indexOf('OrionFinalizedMediaVerifier.verify') < local.indexOf('sealYtDlpTransferCompletion'));
  assert.match(runtime, /OrionDownloadJobStore\.markCompleted\(/);
  assert.match(store, /OrionDownloadExecutionFence\.canCommit\(/);
  assert.match(store, /job\.remove\("_ytDlpCompletedTransfer"\)/);
});

test('UI names the post-transfer phase and offers local finishing rather than source retry', () => {
  assert.match(activity, /Finishing download needs attention/);
  assert.match(activity, /retryLabel: 'Retry finishing'/);
  assert.match(activity, /job\.failure\?\.code\?\.startsWith\('completed-transfer-'\) \? null : fragmentPercent/);
  assert.match(activity, /recoveryCode !== 'completed-transfer-generation-stale'/);
});
