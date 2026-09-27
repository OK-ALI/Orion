'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('V8.17 removes only an unsealed HLS media.mp4 before a fresh yt-dlp process starts', () => {
  const execute = between(runtime, 'fun execute(', 'fun isLiveHls(');
  assert.match(execute, /executionPhase = "staging-recovery"/);
  assert.match(execute, /prepareHlsExecutionOutput\(cleanJobId, authority, workDir\)/);
  assert.match(execute, /"yt-dlp-staging-reset-failed"/);
  assert.ok(
    execute.indexOf('prepareHlsExecutionOutput(cleanJobId, authority, workDir)') <
      execute.indexOf('val request = buildRequest(rootUrl, authority, workDir)'),
    'stale-output cleanup must happen before yt-dlp builds/starts the fresh request',
  );

  const cleanup = between(runtime, 'private fun prepareHlsExecutionOutput(', 'fun isLiveHls(');
  assert.match(cleanup, /authority\.transferKind != "hls"/);
  assert.match(cleanup, /OrionDownloadJobStore\.ytDlpTransferCompletion\(jobId\) != null/);
  assert.match(cleanup, /File\([\s\S]*?workDir,[\s\S]*?"media\.mp4"/);
  assert.match(cleanup, /if \(!output\.exists\(\)\) return true/);
  assert.match(cleanup, /if \(!output\.delete\(\)\)/);
  assert.match(cleanup, /recovery=staging-reset outcome=discarded/);
  assert.doesNotMatch(cleanup, /deleteRecursively/);
});

test('V8.17 keeps V8.16 durable completion proof as the authority that protects a valid staging MP4', () => {
  assert.match(store, /fun sealYtDlpTransferCompletion\(/);
  assert.match(store, /fun ytDlpTransferCompletion\(jobId: String\): JSONObject\?/);

  const cleanup = between(runtime, 'private fun prepareHlsExecutionOutput(', 'fun isLiveHls(');
  const proofCheck = cleanup.indexOf('OrionDownloadJobStore.ytDlpTransferCompletion(jobId) != null');
  const deleteCheck = cleanup.indexOf('output.delete()');
  assert.ok(proofCheck >= 0 && deleteCheck > proofCheck);

  const hls = between(transfer, 'private fun runHlsYtDlp(', 'private fun runHlsFragmented(');
  assert.match(hls, /sealYtDlpTransferCompletion\([\s\S]*?jobId,[\s\S]*?"hls",[\s\S]*?verifiedBytes/);
});

test('V8.17 does not alter the V8.13 live in-place Pause and Resume process path', () => {
  assert.match(runtime, /allowInPlacePause = true/);
  assert.match(runtime, /liveHlsJobs\.add\(cleanJobId\)/);
  assert.match(runtime, /liveHlsJobs\.remove\(cleanJobId\)/);
  assert.match(runtime, /fun isLiveHls\(jobId: String\): Boolean/);

  const execute = between(runtime, 'fun execute(', 'fun isLiveHls(');
  assert.match(execute, /prepareHlsExecutionOutput\(cleanJobId, authority, workDir\)/);
});

test('V8.17 retains V8.14 incomplete-transfer proof instead of treating cleanup as completion evidence', () => {
  const hlsGateway = between(runtime, 'fun executeHlsGateway(', 'fun executeDashGateway(');
  assert.match(hlsGateway, /gateway\.awaitCompletionProof\(\)/);
  assert.match(hlsGateway, /if \(!proof\.complete\)/);
  assert.match(hlsGateway, /"yt-dlp-hls-transfer-incomplete"/);
});

test('V8.17 records privacy-safe evidence if yt-dlp ever short-circuits on an existing output again', () => {
  assert.match(runtime, /"has already been downloaded" in line -> "existing-output-short-circuit"/);
  assert.doesNotMatch(runtime, /Log\.[idwve]\([^)]*rootUrl/);
});

test('V8.17 tracked and generated yt-dlp runtime remain byte-for-byte synchronized', () => {
  assert.equal(
    read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt'),
    read('android', 'app', 'src', 'main', 'java', 'com', 'okali', 'orion', 'playback', 'OrionDownloadYtDlpRuntime.kt'),
  );
});
