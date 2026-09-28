'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
const moduleSource = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
const list = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
const telemetry = read('src', 'features', 'downloads', 'downloadTelemetry.ts');
const modal = read('src', 'components', 'DownloadModal.tsx');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('V8.12 restores whole-download HLS percentage speed and ETA without trusting yt-dlp fragment percent', () => {
  const gatewayProgress = between(store, 'fun setGatewayMediaProgress(', 'fun setFinalizationStage(');
  assert.match(gatewayProgress, /safeCompleted\.toDouble\(\) \* 100\.0 \/ safeTotal\.toDouble\(\)/);
  assert.match(gatewayProgress, /coerceIn\(0\.0, 99\.0\)/);
  assert.match(gatewayProgress, /safeRate\(/);
  assert.match(gatewayProgress, /estimateGatewayEtaSeconds\(/);
  assert.match(gatewayProgress, /progress\.put\("totalBytes", JSONObject\.NULL\)/);
  assert.match(gatewayProgress, /progress\.put\("bytesPerSecond", speed\?\.takeIf/);
  assert.match(gatewayProgress, /progress\.put\("etaSeconds", etaSeconds \?: JSONObject\.NULL\)/);

  const hls = between(runtime, 'fun executeHlsGateway(', 'fun executeDashGateway(');
  assert.match(hls, /onProgress = \{\}/);
  assert.doesNotMatch(hls, /setProcessProgress/);
});

test('V8.12 keeps elapsed time live for running work and preserves the existing Orion progress presentation', () => {
  assert.match(telemetry, /job\.state === 'downloading' \|\| job\.state === 'recovering' \|\| job\.state === 'verifying'/);
  assert.match(telemetry, /finalizing \? nowMs : running \? nowMs : job\.completedAt \?\? job\.updatedAt/);
  assert.match(list, /const hasLiveTimingWork = jobs\.some/);
  assert.match(list, /setInterval\(\(\) => setNowMs\(Date\.now\(\)\), 1_000\)/);
  assert.match(list, /statusLabel\}\{percent !== null \? ` · \$\{percent\}%` : ''\}/);
  assert.match(list, /width: `\$\{percent\}%`/);
  assert.match(list, /speed \? `\$\{speed\}\/s` : null/);
  assert.match(list, /eta \? `\$\{eta\} left` : null/);
});

test('V8.13 keeps live HLS paused in place while preserving stop-and-serialize fallback for other execution paths', () => {
  const pause = between(moduleSource, 'fun pauseJob(jobId: String)', 'private fun hasRetainedPausedHlsProgress');
  assert.match(pause, /requestControl\(clean, "pause"\)/);
  assert.match(pause, /setState\(clean, "paused"\)/);
  assert.match(pause, /if \(!OrionDownloadYtDlpRuntime\.isLiveHls\(clean\)\)[\s\S]*?OrionDownloadYtDlpRuntime\.stop\(clean\)/);

  const servicePause = between(service, 'ACTION_PAUSE -> {', 'ACTION_CANCEL -> {');
  assert.match(servicePause, /requestControl\(jobId, "pause"\)/);
  assert.match(servicePause, /if \(!OrionDownloadYtDlpRuntime\.isLiveHls\(jobId\)\)[\s\S]*?OrionDownloadYtDlpRuntime\.stop\(jobId\)/);

  assert.match(service, /queuedExplicitResumes/);
  assert.match(service, /val liveHls = activeJobs\.contains\(jobId\) && OrionDownloadYtDlpRuntime\.isLiveHls\(jobId\)/);
  assert.match(service, /if \(liveHls\)[\s\S]*?prepareLiveHlsResume\(jobId\)[\s\S]*?return START_NOT_STICKY/);
  assert.match(service, /if \(activeJobs\.contains\(jobId\)\)[\s\S]*?requestControl\(jobId, "pause"\)[\s\S]*?OrionDownloadYtDlpRuntime\.stop\(jobId\)/);
  assert.match(service, /executor\.execute \{[\s\S]*?prepareExplicitResume\(jobId\)[\s\S]*?activeJobs\.add\(jobId\)/);
  assert.match(service, /fun resume\(context: Context, jobId: String\)[\s\S]*?action = ACTION_RESUME/);

  const resume = between(moduleSource, 'fun resumeJob(jobId: String, promise: Promise)', '@ReactMethod\n  fun retryJob');
  assert.match(resume, /OrionDownloadForegroundService\.resume\(reactContext, clean\)/);
  assert.doesNotMatch(resume, /clearControl\(clean\)/);
});

test('V8.12+ Download Modal keeps manual provider choice visible and uses product-safe three-step preparation language', () => {
  assert.match(modal, />Provider<\/Text>/);
  assert.match(modal, /preparedSourceIds\.has\(source\.id\)/);
  assert.match(modal, /Ready ✓/);
  assert.match(modal, /Not available/);
  assert.match(modal, /Orion will check this source and return here automatically when it is ready/);
  assert.match(modal, /'Start Download'/);
  assert.doesNotMatch(modal, />Open player<|Open player to resolve download source|Download method|HLS stream ready|DASH stream ready/);
});
