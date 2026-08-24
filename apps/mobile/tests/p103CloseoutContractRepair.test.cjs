const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.3 exposes native retry-all without inventing JS transfer ownership', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const adapter = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  assert.match(module, /fun retryAllJobs\(promise: Promise\)/);
  assert.match(module, /state !in setOf\("failed", "recovering", "storage-blocked", "action-required", "expired"\)/);
  assert.match(module, /OrionDownloadTransferRuntime\.ensure\(candidateId, jobId\)/);
  assert.match(module, /putInt\("restarted", restarted\)/);
  assert.match(adapter, /retryAllJobs\(\): Promise<\{ restarted\?: number; actionRequired\?: number \}>/);
  assert.match(adapter, /retryAllNativeDownloadJobsV1/);
});

test('P10.3 recovery policy waits for network, non-low battery and non-low storage', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  assert.match(worker, /setRequiredNetworkType\(NetworkType\.CONNECTED\)/);
  assert.match(worker, /setRequiresBatteryNotLow\(true\)/);
  assert.match(worker, /setRequiresStorageNotLow\(true\)/);
  assert.match(runtime, /StatFs\(context\.filesDir\.absolutePath\)\.availableBytes/);
  assert.match(runtime, /markStorageBlocked/);
});

test('P10.3 bridges optional completion failure and action-needed events into Phase 9 Downloads notifications', () => {
  const coordinator = read('src', 'features', 'notifications', 'MobileNotificationCoordinator.tsx');
  const notifications = read('src', 'services', 'mobileNotifications.ts');
  assert.match(coordinator, /subscribeMobileDownloadRepositoryV1/);
  assert.match(coordinator, /category: 'downloads'/);
  assert.match(coordinator, /download-completed:/);
  assert.match(coordinator, /download-failed:/);
  assert.match(coordinator, /download-action:/);
  assert.match(coordinator, /target: \{ target: 'downloads' \}/);
  assert.match(notifications, /downloads: Object\.freeze\(/);
  assert.match(notifications, /description: 'Completion and problem alerts\.'/);
  assert.match(notifications, /if \(category === 'downloads'\) return 'orion-downloads'/);
});

test('P10.3 active foreground progress remains native and independent of optional alert preference delivery', () => {
  const nativeNotifications = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotifications.kt');
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
  assert.match(service, /startForeground\(OrionDownloadNotifications\.notificationId\(\)/);
  assert.match(nativeNotifications, /NotificationCompat\.Builder\(context, CHANNEL_ID\)/);
  assert.doesNotMatch(nativeNotifications, /getMobileNotificationPreferencesV1|shouldDeliverMobileNotificationV1/);
});

test('P10.3 keeps the accepted fragment-only production boundary while retaining safe unsupported truth', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  assert.match(module, /transfer\.transferKind != "hls" && transfer\.transferKind != "dash"/);
  assert.match(runtime, /"direct" -> OrionDownloadJobStore\.markActionRequired\(jobId, "direct-retired"/);
  assert.match(runtime, /hls-live-refresh-not-active/);
});
