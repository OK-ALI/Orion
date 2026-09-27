'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
const recovery = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('V8.15 separates waiting-for-connection from genuine resuming presentation', () => {
  assert.match(activity, /waitingForConnection/);
  assert.match(activity, /'Waiting for connection…'/);
  assert.match(activity, /phaseResuming/);
  assert.match(activity, /'Resuming…'/);
  assert.match(activity, /showLiveTransferTelemetry = job\.state === 'downloading'/);
  assert.match(activity, /const speed = showLiveTransferTelemetry \? formatBytes\(progress\.bytesPerSecond\) : null/);
  assert.match(activity, /const eta = showLiveTransferTelemetry \? formatDurationSeconds\(progress\.etaSeconds\) : null/);
});

test('V8.15 keeps HLS fragment truth authoritative during recovery and blocks false 99 percent', () => {
  assert.match(activity, /const fragmentPercent = progress\.completedFragments !== null && progress\.totalFragments !== null/);
  assert.match(activity, /const percentValue = fragmentPercent \?\? progress\.percent/);
  assert.match(activity, /const total = progress\.totalFragments !== null \? null : formatBytes\(progress\.totalBytes\)/);
  const process = between(store, 'fun setProcessProgress(', '/**\n   * HLS gateway telemetry');
  assert.match(process, /hasVerifiedHlsProgress/);
  assert.match(process, /previous\.optInt\("totalFragments", 0\) > 0/);
  assert.match(process, /progress\.put\("bytesPerSecond", JSONObject\.NULL\)/);
  assert.match(process, /return@mutateJobLocked/);
});

test('V8.15 only enters Downloading after real HLS gateway media activity during recovery', () => {
  assert.match(transfer, /val resumingHls = OrionDownloadJobStore\.getJob\(jobId\)\?\.optString\("state"\) == "recovering"/);
  assert.match(transfer, /if \(!resumingHls\)[\s\S]*?setState\([\s\S]*?"downloading"/);
  const measured = between(transfer, 'onMeasuredMediaProgress = { bytes, completed, total ->', '},');
  assert.match(measured, /current\?\.optString\("state"\) == "recovering"/);
  assert.match(measured, /setState\(jobId, "downloading"\)/);
  assert.match(measured, /setGatewayMediaProgress\(jobId, bytes, completed, total\)/);
});

test('V8.15 marks connected automatic recovery as Resuming without inventing another network owner', () => {
  assert.match(recovery, /setRequiredNetworkType\(NetworkType\.CONNECTED\)/);
  assert.match(recovery, /OrionDownloadJobStore\.markResuming\(jobId, "automatic-recovery-resuming"\)/);
  assert.match(store, /fun markResuming\(jobId: String, code: String = "recovery-resuming"\)/);
  assert.match(service, /markResuming\(jobId, "explicit-resume-resuming"\)/);
  assert.doesNotMatch(activity, /NetInfo|ConnectivityManager|addEventListener\(['"]change/);
});

test('V8.15 classifies HLS provider I-O interruption separately from a generic incomplete result', () => {
  const hls = between(runtime, 'fun executeHlsGateway(', 'fun executeDashGateway(');
  assert.match(hls, /proof\.providerReadErrors > 0L \|\| proof\.providerWriteErrors > 0L/);
  assert.match(hls, /if \(interrupted\) "network-interrupted" else "yt-dlp-hls-transfer-incomplete"/);
});

test('V8.15 exposes same-job Retry for recoverable or preserved-progress failures', () => {
  assert.match(activity, /const displayRetry = \(canRetry \|\| \(FAILED_STATES\.has\(job\.state\) && hasPreservedProgress\)\) && !phaseResuming/);
  assert.match(activity, /retryNativeDownloadJobV1\(job\.jobId\)/);
  assert.match(activity, /Retry the same source to continue\./);
  assert.match(activity, /retryLabel: 'Retry now'/);
});

test('V8.15 native recovery owners remain synchronized with generated Android source', () => {
  const names = [
    'OrionDownloadJobStore.kt',
    'OrionDownloadYtDlpRuntime.kt',
    'OrionDownloadRecoveryWorker.kt',
    'OrionDownloadForegroundService.kt',
    'OrionDownloadEngineModule.kt',
    'OrionDownloadTransferRuntime.kt',
  ];
  for (const name of names) {
    assert.equal(
      read('plugins', 'orion-cinema-webview-native', name),
      read('android', 'app', 'src', 'main', 'java', 'com', 'okali', 'orion', 'playback', name),
      `${name} generated source drifted`,
    );
  }
});
