const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.3 Auto is HLS/DASH-only and Direct is retired from Mobile execution', () => {
  const capture = read('src', 'features', 'downloads', 'downloadCandidateCapture.ts');
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  assert.match(capture, /MobileDownloadTransferMethodV1 = 'auto' \| 'fragments'/);
  assert.doesNotMatch(capture, /MobileDownloadTransferMethodV1 = .*'direct'/);
  assert.match(capture, /candidate\.capabilities\.deviceStorage === true/);
  assert.match(capture, /resolvedManifestKind === 'hls' \|\| candidate\.preflight\.resolvedManifestKind === 'dash'/);
  assert.doesNotMatch(modal, /title: 'Direct file'/);
  assert.match(modal, /Choose the best ready HLS or DASH stream/);
  assert.match(start, /selection\.resolvedMethod !== 'fragments'/);
  assert.match(start, /Mobile downloads require a ready HLS or DASH stream/);
  assert.match(module, /DOWNLOAD_FRAGMENT_SOURCE_REQUIRED/);
});

test('P10.3 HLS planner selects quality, audio group, init media and VOD fragments', () => {
  const planner = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadFragmentPlanner.kt');
  assert.match(planner, /#EXT-X-STREAM-INF/);
  assert.match(planner, /#EXT-X-MEDIA:/);
  assert.match(planner, /#EXT-X-MAP:/);
  assert.match(planner, /#EXT-X-ENDLIST/);
  assert.match(planner, /hls-byterange-not-active/);
  assert.match(planner, /hls-encryption-not-active/);
});

test('P10.3 DASH planner handles SegmentList and SegmentTemplate with video plus audio', () => {
  const planner = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadFragmentPlanner.kt');
  assert.match(planner, /SegmentList/);
  assert.match(planner, /SegmentTemplate/);
  assert.match(planner, /SegmentTimeline/);
  assert.match(planner, /RepresentationID/);
  assert.match(planner, /Bandwidth/);
  assert.match(planner, /selectedVideo/);
  assert.match(planner, /selectedAudio/);
  assert.match(planner, /dash-segmentbase-not-active/);
});

test('P10.3 fragment engine is bounded, restart-safe per fragment and verifies before completion', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  assert.match(runtime, /MAX_FRAGMENT_CONCURRENCY = 4/);
  assert.match(runtime, /Executors\.newFixedThreadPool\(kotlin\.math\.min\(MAX_FRAGMENT_CONCURRENCY/);
  assert.match(runtime, /fragmentName\(index\) \+ "\.part"/);
  assert.match(runtime, /if \(!file\.isFile \|\| file\.length\(\) <= 0L\)/);
  assert.match(runtime, /setState\(jobId, "verifying"\)/);
  assert.match(runtime, /setState\(jobId, "finalizing"\)/);
  assert.match(runtime, /markCompleted\(jobId, asset, offline\)/);
  assert.match(runtime, /playInOrion", false/);
});

test('P10.3 job descendant expansion remains manifest-scoped but can exceed preflight preview cap', () => {
  const broker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');
  assert.match(broker, /MAX_PREFLIGHT_DESCENDANTS = 512/);
  assert.match(broker, /MAX_JOB_AUTHORIZED_URLS = 20_000/);
  assert.match(broker, /authorizeDiscoveredDescendant/);
  assert.match(broker, /if \(!context\.authorizedUrls\.contains\(parent\)\) return false/);
  assert.match(broker, /if \(!descendantAllowed\(context, child\)\) return false/);
});

test('P10.3 fragmented finalization persists no raw network locations', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  assert.match(runtime, /orion-fragment-bundle\.json/);
  assert.match(runtime, /\.put\("name", file\.name\)/);
  assert.match(runtime, /\.put\("role", fragment\.role\.take\(24\)\)/);
  assert.doesNotMatch(runtime, /\.put\("url", fragment\.url\)/);
  assert.match(store, /if \(key\.startsWith\("_"\)\) remove\.add\(key\)/);
});

test('P10.4C fragmented Mobile storage supports capability-gated Device Storage', () => {
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  const settings = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  assert.match(start, /destination === 'device-storage'/);
  assert.match(settings, /Choose Device Storage folder/);
  assert.match(module, /DOWNLOAD_DESTINATION_INVALID/);
});

test('P10.3 fragment source remains generated from tracked plugin ownership', () => {
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  assert.match(plugin, /'OrionDownloadFragmentPlanner\.kt'/);
});
