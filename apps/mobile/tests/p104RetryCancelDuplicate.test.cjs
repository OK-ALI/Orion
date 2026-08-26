'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function loadPureTypeScript(relative) {
  const filePath = path.join(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', output)(module.exports, () => { throw new Error('Pure fixture unexpectedly imported runtime code.'); }, module);
  return module.exports;
}

test('live finalization elapsed timer advances from the current stage start', () => {
  const { downloadElapsedSecondsV1 } = loadPureTypeScript('src/features/downloads/downloadTelemetry.ts');
  const job = { state: 'finalizing', startedAt: 1_000, completedAt: null, updatedAt: 2_000, progress: { finalizationStageStartedAt: 10_000 } };
  assert.equal(downloadElapsedSecondsV1(job, 12_000), 2);
  assert.equal(downloadElapsedSecondsV1(job, 15_500), 5.5);
  const completed = { ...job, state: 'completed', completedAt: 8_000, updatedAt: 9_000 };
  assert.equal(downloadElapsedSecondsV1(completed, 99_000), 7);
});

test('sealed retry validates local hashes and schedules finalization without network authority', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const manifest = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadFinalizationManifest.kt');
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  assert.match(runtime, /validateLocalProofs/);
  assert.match(runtime, /OrionDownloadFinalizationManifest\.validate/);
  assert.match(runtime, /local-fragments-invalid/);
  assert.match(runtime, /sealFinalizationPlan/);
  assert.match(manifest, /SHA-256|MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(worker, /localOnly/);
  assert.match(worker, /if \(!localOnly\)/);
});

test('native duplicate creation and Cancel completion use atomic store fences', () => {
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const fence = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadExecutionFence.kt');
  assert.match(store, /@Synchronized[\s\S]{0,80}fun createJob/);
  assert.match(store, /OrionDownloadOwnershipPolicy\.blocksDuplicate/);
  assert.match(store, /fun cancelAndFence/);
  assert.match(store, /_executionGeneration/);
  assert.match(store, /OrionDownloadExecutionFence\.canCommit/);
  assert.match(runtime, /if \(!OrionDownloadJobStore\.markCompleted\(jobId, generation, asset, offline\)\)/);
  assert.match(runtime, /outcome\.publishedUris\.forEach/);
  assert.match(fence, /expectedGeneration == currentGeneration/);
});

test('finalization notification contract is stage-only and transfer metrics are suppressed', () => {
  const contract = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotificationContract.kt');
  const notifications = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotifications.kt');
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  assert.match(contract, /indeterminate = true, showTransferMetrics = false/);
  assert.match(contract, /Creating portable MP4/);
  assert.match(notifications, /OrionDownloadNotificationContract\.presentation/);
  assert.match(notifications, /presentation\.showTransferMetrics/);
  assert.match(notifications, /transitionFinalizationStage/);
  assert.match(contract, /"finalizing" -> 0[\s\S]*"downloading" -> 1[\s\S]*"queued" -> 3[\s\S]*"paused" -> 4/);
  assert.match(contract, /createdAt[\s\S]*jobId/);
  assert.match(notifications, /Orion Downloads · \$\{jobs\.size\} active/);
  assert.match(notifications, /NotificationCompat\.InboxStyle/);
  assert.match(notifications, /setUsesChronometer\(true\)/);
  assert.match(notifications, /fun reconcile\(context: Context\)/);
  assert.doesNotMatch(notifications, /fun notify\(context: Context, job:/);
  assert.match(service, /OrionDownloadNotifications\.foreground\(applicationContext\)/);
  assert.match(service, /OrionDownloadNotifications\.reconcile\(applicationContext\)/);
  assert.doesNotMatch(runtime, /OrionDownloadNotifications\.notify/);
});
