'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
const gateway = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt');
const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
const moduleSource = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
const list = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('V8.13 keeps a live HLS FFmpeg execution alive across Pause and Resume', () => {
  assert.match(runtime, /private val liveHlsJobs = ConcurrentHashMap\.newKeySet<String>\(\)/);
  assert.match(runtime, /liveHlsJobs\.add\(cleanJobId\)[\s\S]*?allowInPlacePause = true[\s\S]*?liveHlsJobs\.remove\(cleanJobId\)/);
  assert.match(runtime, /fun isLiveHls\(jobId: String\): Boolean/);
  assert.match(runtime, /HLS_LOOPBACK_SOCKET_TIMEOUT_SECONDS = 24 \* 60 \* 60/);
  assert.match(runtime, /authority\.transferKind == "hls"\) HLS_LOOPBACK_SOCKET_TIMEOUT_SECONDS else SOCKET_TIMEOUT_SECONDS/);

  const execute = between(runtime, 'fun execute(', 'fun isLiveHls(');
  assert.match(execute, /"cancel" -> YoutubeDL\.getInstance\(\)\.destroyProcessById\(processId\)/);
  assert.match(execute, /"pause" -> if \(!allowInPlacePause\) YoutubeDL\.getInstance\(\)\.destroyProcessById\(processId\)/);
  assert.match(execute, /response\.exitCode != 0[\s\S]*?"pause" -> OrionYtDlpOutcome\.Paused/);

  const resume = between(service, 'ACTION_RESUME -> {', 'ACTION_RECOVER -> {');
  assert.match(resume, /val liveHls = activeJobs\.contains\(jobId\) && OrionDownloadYtDlpRuntime\.isLiveHls\(jobId\)/);
  assert.match(resume, /if \(liveHls\)[\s\S]*?prepareLiveHlsResume\(jobId\)[\s\S]*?return START_NOT_STICKY/);
  assert.doesNotMatch(
    between(resume, 'if (liveHls) {', 'val pausedJob'),
    /enqueueRun|stop\(jobId\)|requestControl\(jobId, "pause"\)/,
  );
});

test('V8.13 pauses the HLS loopback gateway instead of consuming provider media in the background', () => {
  assert.match(gateway, /private fun awaitTransferPermission\(\): Boolean/);
  assert.match(gateway, /"pause" -> \{[\s\S]*?Thread\.sleep\(PAUSE_POLL_MS\)/);
  assert.match(gateway, /if \(!awaitTransferPermission\(\)\) return[\s\S]*?openFollowingRedirects/);

  const body = between(gateway, 'while (!closed.get()) {', 'if (read < 0)');
  assert.match(body, /if \(!awaitTransferPermission\(\)\) break[\s\S]*?source\.read\(buffer\)/);

  assert.match(gateway, /readBytes \+= read[\s\S]*?if \(!awaitTransferPermission\(\)\) break[\s\S]*?output\.write/);
  assert.match(gateway, /private const val PAUSE_POLL_MS = 75L/);
});

test('V8.13 preserves visible progress while Resuming and only returns to Downloading after media activity', () => {
  assert.match(list, /const resuming = job\.state === 'recovering' && progress\.bytesDownloaded > 0 && progress\.completedFragments !== null/);
  assert.match(list, /const statusLabel = resuming[\s\S]*?'Resuming…'/);
  assert.match(list, /const canPause = job\.state === 'downloading';/);
  assert.doesNotMatch(list, /const canPause = job\.state === 'downloading' \|\| resuming/);
  assert.match(list, /const canRetry = job\.state === 'recovering' \|\| \(FAILED_STATES\.has\(job\.state\) && job\.failure\?\.retryable\);/);
  assert.match(list, /const showRetry = canRetry && !resuming;/);

  const measured = between(transfer, 'onMeasuredMediaProgress = { bytes, completed, total ->', '},');
  assert.match(measured, /current\?\.optString\("state"\) == "recovering"/);
  assert.match(measured, /OrionDownloadJobStore\.control\(jobId\) != "pause"/);
  assert.match(measured, /OrionDownloadJobStore\.setState\(jobId, "downloading"\)/);
  assert.match(measured, /setGatewayMediaProgress\(jobId, bytes, completed, total\)/);
});

test('V8.13 never silently restarts a progressed paused HLS job after the live session is gone', () => {
  const resumeJob = between(moduleSource, 'fun resumeJob(jobId: String, promise: Promise)', '@ReactMethod\n  fun retryJob');
  assert.match(resumeJob, /hasRetainedPausedHlsProgress\(job\)/);
  assert.match(resumeJob, /!OrionDownloadYtDlpRuntime\.isLiveHls\(clean\)/);
  assert.match(resumeJob, /"paused-session-ended"/);
  assert.match(resumeJob, /"DOWNLOAD_RESUME_UNAVAILABLE"/);

  const serviceResume = between(service, 'ACTION_RESUME -> {', 'ACTION_RECOVER -> {');
  assert.match(serviceResume, /hasRetainedPausedHlsProgress\(pausedJob\)/);
  assert.match(serviceResume, /"paused-session-ended"/);
  assert.match(serviceResume, /return START_NOT_STICKY/);
});
