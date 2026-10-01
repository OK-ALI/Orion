'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('scheduled recovery yields to a live foreground owner before changing job state', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
  const run = worker.slice(worker.indexOf('override fun doWork(): Result'), worker.indexOf('companion object {'));
  const guard = run.indexOf('OrionDownloadForegroundService.hasActiveExecution(jobId)');
  const cancel = run.indexOf('OrionDownloadForegroundRecoveryCoordinator.cancel(jobId)');
  const localFinalization = run.indexOf('hasCompleteLocalFinalization(applicationContext, jobId)');
  const ensure = run.indexOf('OrionDownloadTransferRuntime.ensure(candidateId, jobId)');
  const resuming = run.indexOf('OrionDownloadJobStore.markResuming(jobId, "automatic-recovery-resuming")');
  assert.ok(guard > 0 && cancel > guard && localFinalization > cancel && ensure > localFinalization && resuming > ensure);
  assert.match(run.slice(0, cancel), /hasActiveExecution\(jobId\),[\s\S]*?Result\.retry\(\)/);
  assert.match(service.slice(service.indexOf('companion object {')), /private val activeJobs = Collections\.synchronizedSet/);
  assert.match(service, /activeJobs\.add\(jobId\)/);
  assert.match(service, /activeJobs\.remove\(jobId\)/);
});

test('ownerless stale work retains the existing recovery and request-context fences', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  assert.match(worker, /fun shouldDeferToForegroundOwner\(state: String, control: String, ownerActive: Boolean\): Boolean =\s*ownerActive && !shouldRemainIdle\(state, control\)/);
  assert.match(worker, /if \(runtime == null\) \{[\s\S]*?request-context-refresh-required/);
  assert.match(worker, /OrionDownloadJobStore\.markResuming\(jobId, "automatic-recovery-resuming"\)/);
  assert.match(worker, /OrionDownloadForegroundService\.start\(applicationContext, jobId, recovery = true\)/);
});
