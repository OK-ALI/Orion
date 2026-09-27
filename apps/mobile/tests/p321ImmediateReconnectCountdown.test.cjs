const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('V8.18 consumes the established shared network owner without creating another network authority', () => {
  const coordinator = read('src', 'features', 'downloads', 'MobileDownloadEngineCoordinator.tsx');
  const adapter = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');

  assert.match(coordinator, /useNetworkStatus/);
  assert.match(coordinator, /const \{ online \} = useNetworkStatus\(\)/);
  assert.match(coordinator, /setNativeDownloadForegroundNetworkAvailableV1\(online\)/);
  assert.doesNotMatch(coordinator, /NetInfo/);

  assert.match(adapter, /setForegroundNetworkAvailable\(available: boolean\): void/);
  assert.match(adapter, /setNativeDownloadForegroundNetworkAvailableV1/);
  assert.match(module, /fun setForegroundNetworkAvailable\(available: Boolean\)/);
  assert.match(module, /OrionDownloadForegroundRecoveryCoordinator\.onNetworkAvailabilityChanged/);
});

test('V8.18 native foreground recovery owns the real 3, 5, 8 second retry schedule', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');

  assert.match(worker, /retryDelaysSeconds = intArrayOf\(3, 5, 8\)/);
  assert.match(worker, /Executors\.newSingleThreadScheduledExecutor\(\)/);
  assert.match(worker, /scheduler\.schedule\(retryTask@\{/);
  assert.match(worker, /delaySeconds\.toLong\(\), TimeUnit\.SECONDS/);
  assert.match(worker, /OrionDownloadJobStore\.markForegroundRetryScheduled\(jobId, attempt, delaySeconds\)/);
  assert.match(worker, /OrionDownloadForegroundService\.start\(appContext, jobId, recovery = true\)/);

  assert.match(store, /auto-retry-scheduled-\$\{boundedDelay\}-attempt-\$\{boundedAttempt\}/);
  assert.match(store, /_foregroundRetryAttempt/);
  assert.match(store, /_foregroundRetryDelaySeconds/);
});

test('V8.18 cancels countdown when network disappears and preserves WorkManager as background safety net', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');

  assert.match(worker, /if \(!available\) \{/);
  assert.match(worker, /pending\.remove\(jobId\)\?\.cancel\(false\)/);
  assert.match(worker, /"network-interrupted"/);
  assert.match(worker, /setRequiredNetworkType\(NetworkType\.CONNECTED\)/);
  assert.match(worker, /setInitialDelay\(delayMinutes\.coerceAtLeast\(1L\), TimeUnit\.MINUTES\)/);
  assert.match(worker, /setBackoffCriteria\(BackoffPolicy\.EXPONENTIAL, 30L, TimeUnit\.SECONDS\)/);
});

test('V8.18 bounds foreground automatic attempts and leaves a deterministic manual Retry state', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const screen = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(worker, /if \(nextAttempt > retryDelaysSeconds\.size\)/);
  assert.match(worker, /OrionDownloadRecoveryScheduler\.cancel\(context, jobId\)/);
  assert.match(worker, /OrionDownloadJobStore\.markForegroundRetryExhausted\(jobId\)/);
  assert.match(store, /"auto-retry-exhausted"/);
  assert.match(screen, /retryExhausted/);
  assert.match(screen, /'Download interrupted'/);
  assert.match(screen, /retryLabel: 'Retry now'/);
});

test('V8.18 manual Retry bypasses foreground countdown and Pause or Cancel cannot leave one armed', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');

  assert.match(module, /fun resumeJob\(jobId: String, promise: Promise\)[\s\S]*OrionDownloadForegroundRecoveryCoordinator\.cancel\(clean\)[\s\S]*OrionDownloadRecoveryScheduler\.cancel\(reactContext, clean\)/);
  assert.match(module, /fun retryJob\(jobId: String, promise: Promise\)[\s\S]*resumeJob\(clean, promise\)/);
  assert.match(module, /fun pauseJob\(jobId: String\)[\s\S]*OrionDownloadForegroundRecoveryCoordinator\.cancel\(clean\)/);
  assert.match(module, /fun cancelJob\(jobId: String\)[\s\S]*OrionDownloadForegroundRecoveryCoordinator\.cancel\(clean\)/);

  assert.match(service, /ACTION_PAUSE -> \{[\s\S]*OrionDownloadForegroundRecoveryCoordinator\.cancel\(jobId\)/);
  assert.match(service, /ACTION_CANCEL -> \{[\s\S]*OrionDownloadForegroundRecoveryCoordinator\.cancel\(jobId\)/);
});

test('V8.18 chains a short next attempt only after a real foreground recovery execution fails', () => {
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');

  assert.match(service, /OrionDownloadTransferEngine\.runJob\(applicationContext, jobId\)[\s\S]*finally \{[\s\S]*OrionDownloadForegroundRecoveryCoordinator\.afterExecution\(applicationContext, jobId\)/);
  assert.match(worker, /val attempt = OrionDownloadJobStore\.foregroundRetryAttempt\(jobId\)/);
  assert.match(worker, /val nextAttempt = if \(attempt == null\) 1 else attempt \+ 1/);
  assert.match(worker, /if \(!foregroundNetworkAvailable\) return/);
});

test('V8.18 renders a real native schedule as a live countdown instead of a decorative fixed timer', () => {
  const screen = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(screen, /downloadRecoveryCountdownV1/);
  assert.match(screen, /\^auto-retry-scheduled-\(\\d\+\)-attempt-\(\\d\+\)\$/);
  assert.match(screen, /\(nowMs - job\.updatedAt\) \/ 1_000/);
  assert.match(screen, /`Retrying in \$\{recoveryCountdown\.remainingSeconds\}s`/);
  assert.match(screen, /'Retrying now…'/);
  assert.match(screen, /Automatic retry \$\{attempt\} of 3 is scheduled/);
});

test('V8.18 preserves the V8.17 safe dead-process HLS restart boundary', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');

  assert.match(runtime, /recovery=staging-reset outcome=discarded/);
  assert.match(runtime, /"yt-dlp-staging-reset-failed"/);
  assert.match(transfer, /hasCompleteLocalYtDlpFinalization/);
  assert.match(transfer, /sealYtDlpTransferCompletion/);
});
