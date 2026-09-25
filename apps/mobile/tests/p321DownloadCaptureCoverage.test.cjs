const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('v3.2.1 download capture covers service-worker media requests without replacing provider responses', () => {
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  const client = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewClient.kt');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewManager.kt');
  assert.match(plugin, /implementation "androidx\.webkit:webkit:1\.15\.0"/);
  assert.match(plugin, /CINEMA_ANDROID_DEPENDENCY_MARKER[\s\S]*for \(const dependency of CINEMA_ANDROID_DEPENDENCIES\)/);
  assert.match(client, /OrionCinemaServiceWorkerDownloadObserver\.ensureInstalled\(\)/);
  assert.match(client, /setServiceWorkerClient\(object : ServiceWorkerClientCompat\(\)/);
  assert.match(client, /observationChannel = "service-worker"/);
  assert.match(client, /return null/);
  assert.doesNotMatch(client, /WebResourceResponseCompat\.setCookies/);
  assert.match(manager, /WebViewFeature\.COOKIE_INTERCEPT/);
  assert.match(manager, /setCookiesIncludedInShouldInterceptRequest\(webView\.settings, true\)/);
});

test('v3.2.1 Auto accepts verified MP4 direct media while explicit fragments stays HLS/DASH-only', () => {
  const capture = read('src', 'features', 'downloads', 'downloadCandidateCapture.ts');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  assert.match(capture, /resolvedMethod: 'fragments' \| 'direct'/);
  assert.match(capture, /kind === 'hls' \? 300 : kind === 'dash' \? 250 : kind === 'direct' \? 200/);
  assert.match(capture, /method === 'fragments' \? kind === 'hls' \|\| kind === 'dash' : kind === 'hls' \|\| kind === 'dash' \|\| kind === 'direct'/);
  assert.match(start, /selection\.resolvedMethod === 'direct'/);
  assert.match(module, /setOf\("direct", "hls", "dash"\)/);
  assert.match(transfer, /"direct" -> runDirect\(context, job, bound\)/);
  assert.doesNotMatch(store.match(/fun initialize\(context: Context\)[\s\S]*?\n  }/)?.[0] ?? '', /retireDirectExperimentalArtifactsLocked|deleteRetiredDirectFilesLocked|direct-retired/);
});

test('v3.2.1 direct preflight samples real MP4 bytes without a synthetic one-byte Range request', () => {
  const broker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');
  assert.match(broker, /probeDirectSample/);
  assert.match(broker, /bytes\[4\] == 'f'\.code\.toByte\(\)[\s\S]*bytes\[7\] == 'p'\.code\.toByte\(\)/);
  assert.match(broker, /unsupported-direct-container/);
  assert.match(broker, /openRequest\(request, null, null\)/);
  assert.doesNotMatch(broker, /bytes=0-0/);
  assert.match(broker, /requiredBytes = if \(resolvedKind == "direct"\) contentLength\(connection\) else null/);
  assert.match(broker, /deviceStorageReady = ready && resolvedKind in setOf\("hls", "dash"\)/);
});
