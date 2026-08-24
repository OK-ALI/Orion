const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.3 native engine remains Android-owned with WorkManager and foreground service', () => {
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  const manifest = read('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const gradle = read('android', 'app', 'build.gradle');
  assert.match(plugin, /OrionDownloadForegroundService\.kt/);
  assert.match(plugin, /OrionDownloadRecoveryWorker\.kt/);
  assert.match(plugin, /androidx\.work:work-runtime-ktx:2\.10\.1/);
  assert.match(gradle, /androidx\.work:work-runtime-ktx:2\.10\.1/);
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE/);
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_DATA_SYNC/);
  assert.match(manifest, /OrionDownloadForegroundService/);
  assert.match(manifest, /foregroundServiceType="dataSync"/);
});

test('P10.3 request context root stays native and is never bridged as a URL', () => {
  const broker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  assert.match(broker, /internal fun resolveRootForJob\(/);
  assert.match(runtime, /OrionDownloadRequestContextBroker\.resolveRootForJob/);
  assert.doesNotMatch(module, /putString\("(?:url|rawUrl|cookieHeader|authorization|requestHeaders)"/i);
  assert.doesNotMatch(module, /@ReactMethod[\s\S]{0,180}rawUrl/i);
});

test('P10.3 native durable store strips private transfer fields from React snapshots', () => {
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  assert.match(store, /getSharedPreferences\(PREFS, Context\.MODE_PRIVATE\)/);
  assert.match(store, /if \(key\.startsWith\("_"\)\) remove\.add\(key\)/);
  assert.match(store, /progress\.put\("percent", 100\)/);
  assert.match(store, /coerceIn\(0\.0, 99\.0\)/);
});

test('P10.3 Candidate 1 direct transfer is resumable and does not falsely complete', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  assert.match(runtime, /Range", "bytes=\$existing-/);
  assert.match(runtime, /status != java\.net\.HttpURLConnection\.HTTP_PARTIAL/);
  assert.match(runtime, /integrity-size-mismatch/);
  assert.match(runtime, /setState\(jobId, "verifying"\)/);
  assert.match(runtime, /setState\(jobId, "finalizing"\)/);
  assert.match(runtime, /markCompleted\(jobId, asset, offline\)/);
  assert.match(runtime, /\"hls\" -> runHls/);
  assert.match(runtime, /\"dash\" -> runDash/);
});

test('P10.3 recovery fails honestly when ephemeral playback context is gone', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  assert.match(worker, /request-context-refresh-required/);
  assert.match(worker, /WorkManager\.getInstance/);
  assert.match(worker, /NetworkType\.CONNECTED/);
});

test('P10.3 scoped device storage uses ACTION_OPEN_DOCUMENT_TREE and opaque target ids', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const storage = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');
  assert.match(module, /Intent\.ACTION_OPEN_DOCUMENT_TREE/);
  assert.match(module, /val activity = reactContext\.currentActivity/);
  assert.doesNotMatch(module, /val activity = currentActivity/);
  assert.match(storage, /takePersistableUriPermission/);
  assert.match(storage, /saf-\$\{sha256\(uri\.toString\(\)\)\.take\(20\)\}/);
  assert.doesNotMatch(module, /MANAGE_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE/);
});

test('P10.3 React projection is driven from native engine snapshots', () => {
  const adapter = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const coordinator = read('src', 'features', 'downloads', 'MobileDownloadEngineCoordinator.tsx');
  const layout = read('app', '_layout.tsx');
  assert.match(adapter, /OrionDownloadEngineSnapshot/);
  assert.match(adapter, /writeMobileDownloadRepositoryV1\(snapshot\)/);
  assert.match(coordinator, /initializeNativeDownloadEngineV1/);
  assert.match(layout, /<MobileDownloadEngineCoordinator \/>/);
});
