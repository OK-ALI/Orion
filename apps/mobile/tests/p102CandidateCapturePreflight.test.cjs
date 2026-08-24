'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '..');
const sharedRoot = path.resolve(mobileRoot, '..', '..', 'packages', 'shared');
const readMobile = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');
const readShared = (...parts) => fs.readFileSync(path.join(sharedRoot, ...parts), 'utf8');

function loadTypeScriptModule(filePath, mocks = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
    throw new Error(`Unexpected runtime import in P10.2 test: ${specifier}`);
  };
  const factory = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  factory(module.exports, localRequire, module, filePath, path.dirname(filePath));
  return module.exports;
}

test('P10.2 keeps candidate and preflight contracts presentation-safe and versioned', () => {
  const contracts = readShared('src', 'types', 'mobileDownloads.ts');
  const appContracts = readMobile('src', 'features', 'downloads', 'contracts.ts');

  assert.match(contracts, /interface MobileDownloadCandidatePreflightV1/);
  assert.match(contracts, /resolvedManifestKind/);
  assert.match(contracts, /requestContextReady/);
  assert.match(contracts, /orionLibraryFreeBytes/);
  assert.match(contracts, /preflight: MobileDownloadCandidatePreflightV1/);
  assert.match(appContracts, /MobileDownloadCandidatePreflightV1/);
  assert.doesNotMatch(contracts, /rawUrl|requestHeaders|cookieHeader|authorization|signedUrl/i);
});

test('P10.2 native observer captures only active non-blocked WebView requests and never exports raw request material', () => {
  const client = readMobile('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewClient.kt');
  const broker = readMobile('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');

  assert.match(client, /decision\.decision != "blocked"/);
  assert.match(client, /downloadCaptureEnabled = current\.downloadCaptureEnabled/);
  assert.match(client, /sessionId = current\.sessionId/);
  assert.match(client, /sourceId = current\.sourceId/);
  assert.match(broker, /if \(!downloadCaptureEnabled \|\| request\.isForMainFrame\) return/);
  assert.match(broker, /Raw URLs, request headers, cookies and authorization material never cross the/);

  const safeEmit = broker.slice(broker.indexOf('val preflight = Arguments.createMap()'), broker.indexOf('private fun classifyObservedRoot'));
  assert.doesNotMatch(safeEmit, /putString\("(?:url|rawUrl|cookie|authorization|headers?)"/i);
});

test('P10.2 classifies direct HLS DASH and extensionless roots while refusing media fragments as top-level candidates', () => {
  const broker = readMobile('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');

  assert.match(broker, /return "hls"/);
  assert.match(broker, /return "dash"/);
  assert.match(broker, /return "direct"/);
  assert.match(broker, /return "extensionless"/);
  assert.match(broker, /m4s\|ts\|aac\|m4a\|mp3\|vtt\|srt\|ass\|ssa/);
  assert.match(broker, /accept\.contains\("mpegurl"\)/);
  assert.match(broker, /accept\.contains\("dash\+xml"\)/);
});

test('P10.2 preflight verifies reachability shape expiry protection and storage without claiming unsupported media', () => {
  const broker = readMobile('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');

  assert.match(broker, /status == HttpURLConnection\.HTTP_UNAUTHORIZED \|\| status == HttpURLConnection\.HTTP_FORBIDDEN/);
  assert.match(broker, /#EXTM3U/);
  assert.match(broker, /<MPD/);
  assert.match(broker, /METHOD=SAMPLE-AES/);
  assert.match(broker, /<ContentProtection/);
  assert.match(broker, /Content-Length/);
  assert.match(broker, /StatFs\(reactContext\.filesDir\.absolutePath\)\.availableBytes/);
  assert.match(broker, /storage-insufficient/);
  assert.match(broker, /candidate-expired/);
  assert.match(broker, /unsupported-media-shape/);
});

test('P10.2 request-context broker is job-scoped and exact-descendant constrained instead of a general proxy', () => {
  const broker = readMobile('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');
  const module = readMobile('plugins', 'orion-cinema-webview-native', 'OrionDownloadCaptureModule.kt');

  assert.match(broker, /context\.boundJobId != jobId \|\| context\.requestContextId != requestContextId/);
  assert.match(broker, /context\.authorizedUrls\.contains\(normalized\)/);
  assert.match(broker, /context\.authorizedUrls\.contains\(parent\)/);
  assert.match(broker, /originAllowed\(context, child\)/);
  assert.match(broker, /authorizeDiscoveredDescendant/);
  assert.match(broker, /descendant-origin-not-approved/);
  assert.match(broker, /deniedCount > 0/);
  assert.doesNotMatch(module, /fun\s+\w*(?:fetch|url|header|cookie|authoriz)/i);
  assert.doesNotMatch(module, /(?:url|headers?|cookies?|authorization)\s*:\s*String/i);
  assert.match(module, /bindRequestContext\(candidateId: String, jobId: String, promise: Promise\)/);
  assert.match(module, /releaseSession\(sessionId: String\)/);
  assert.match(module, /releaseJobContext\(jobId: String\)/);
});

test('P10.2 native module is generated from the tracked Cinema plugin source', () => {
  for (const file of [
    'OrionCinemaWebViewClient.kt',
    'OrionCinemaWebViewPackage.kt',
    'OrionDownloadCaptureModule.kt',
    'OrionDownloadRequestContextBroker.kt',
  ]) {
    const plugin = readMobile('plugins', 'orion-cinema-webview-native', file);
    const generated = readMobile('android', 'app', 'src', 'main', 'java', 'com', 'okali', 'orion', 'playback', file);
    assert.equal(generated, plugin, `${file} generated Android source must match tracked plugin source`);
  }
  const plugin = readMobile('plugins', 'withOrionCinemaWebView.js');
  assert.match(plugin, /'OrionDownloadCaptureModule\.kt'/);
  assert.match(plugin, /'OrionDownloadRequestContextBroker\.kt'/);
  assert.match(readMobile('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewPackage.kt'), /OrionDownloadCaptureModule\(reactContext\)/);
});

test('P10.2 playback lifecycle scopes capture to the exact active session source and media identity', () => {
  const wrapper = readMobile('src', 'features', 'playback', 'OrionCinemaWebView.tsx');
  const surface = readMobile('src', 'features', 'playback', 'EmbedPlayerSurface.tsx');

  assert.match(wrapper, /downloadCaptureEnabled/);
  assert.match(wrapper, /providerClass: downloadProviderClass/);
  assert.match(surface, /createMobileDownloadTargetV1/);
  assert.match(surface, /beginMobileDownloadCaptureSessionV1/);
  assert.match(surface, /playbackSessionId/);
  assert.match(surface, /itemKey: downloadTarget\.itemKey/);
  assert.match(surface, /media: downloadTarget\.media/);
  assert.match(surface, /downloadCaptureEnabled=\{source\?\.supportsDownloads === true\}/);
});

test('P10.2 JavaScript normalization strips malicious native hitchhiker fields and rejects session mismatch', () => {
  const filePath = path.join(mobileRoot, 'src', 'features', 'downloads', 'downloadCandidateCapture.ts');
  const reactNative = {
    Platform: { OS: 'android' },
    NativeModules: { OrionDownloadCapture: null },
    DeviceEventEmitter: { addListener: () => ({ remove() {} }) },
  };
  const capture = loadTypeScriptModule(filePath, { 'react-native': reactNative });
  const session = {
    playbackSessionId: 'session-1',
    sourceId: 'videasy',
    providerClass: 'primary',
    itemKey: 'movie:42',
    media: {
      schemaVersion: 1,
      id: 42,
      mediaType: 'movie',
      title: 'Test Movie',
      year: 2026,
      season: null,
      episode: null,
      libraryKind: 'movie',
      seriesTitle: null,
      episodeTitle: null,
      posterPath: null,
      backdropPath: null,
    },
  };
  const payload = {
    schemaVersion: 1,
    candidateId: 'candidate-1',
    playbackSessionId: 'session-1',
    requestContextId: 'context-1',
    sourceId: 'videasy',
    providerClass: 'primary',
    manifestKind: 'hls',
    expiry: 'session',
    protection: 'clear',
    availableQualities: ['best'],
    capabilities: {
      orionLibrary: true,
      deviceStorage: false,
      resumable: true,
      subtitles: false,
      audioSelection: false,
      deviceStorageBlockedReason: 'Scoped storage pending.',
    },
    preflight: {
      schemaVersion: 1,
      candidateId: 'candidate-1',
      state: 'ready',
      reachability: 'reachable',
      resolvedManifestKind: 'hls',
      expiry: 'session',
      protection: 'clear',
      requestContextReady: true,
      descendantCount: 4,
      requiredBytes: null,
      storageRequirement: 'unknown',
      orionLibraryFreeBytes: 100000,
      reasonCode: null,
      reason: null,
      checkedAt: 100,
    },
    capturedAt: 90,
    rawUrl: 'https://secret.example/master.m3u8?token=secret',
    requestHeaders: { Authorization: 'Bearer secret' },
    cookieHeader: 'session=secret',
  };

  const normalized = capture.normalizeMobileDownloadCandidateEventV1(payload, session);
  assert.ok(normalized);
  const serialized = JSON.stringify(normalized);
  assert.doesNotMatch(serialized, /secret\.example|Bearer secret|session=secret|rawUrl|requestHeaders|cookieHeader/);
  assert.equal(normalized.candidate.media.title, 'Test Movie');
  assert.equal(normalized.candidate.preflight.state, 'ready');
  assert.equal(capture.normalizeMobileDownloadCandidateEventV1({ ...payload, playbackSessionId: 'stale' }, session), null);
});

test('P10.2 does not prematurely enable transfer execution', () => {
  const manager = readMobile('src', 'services', 'downloadManager.ts');
  assert.match(manager, /MOBILE_DOWNLOADER_AVAILABLE = false/);
  assert.match(manager, /state: 'waiting-for-engine'/);
  assert.doesNotMatch(manager, /OrionDownloadCapture|bindMobileDownloadRequestContextV1/);
});

test('P10.2 physical diagnostic is bounded and excludes request secrets', () => {
  const broker = readMobile('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');

  assert.match(broker, /DIAGNOSTIC_TAG = "OrionP102Candidate"/);
  const start = broker.indexOf('Log.i(');
  const end = broker.indexOf('reactContext.runOnUiQueueThread', start);
  assert.ok(start >= 0 && end > start);
  const diagnostic = broker.slice(start, end);

  assert.match(diagnostic, /append\("source="/);
  assert.match(diagnostic, /resolved=/);
  assert.match(diagnostic, /state=/);
  assert.match(diagnostic, /protection=/);
  assert.match(diagnostic, /descendants=/);
  assert.match(diagnostic, /contextReady=/);
  assert.doesNotMatch(diagnostic, /rawUrl|requestHeaders|cookieHeader|requestContextId|authorization|signedUrl/i);
});



test('P10.2 physical trace distinguishes manifest observer rejection and classification without leaking request material', () => {
  const client = readMobile('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewClient.kt');
  const broker = readMobile('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');

  assert.match(client, /OrionP102Trace/);
  assert.match(client, /stage=manifest/);
  assert.match(client, /capture=/);
  assert.match(broker, /stage=observer/);
  assert.match(broker, /stage=shape-rejected/);
  assert.match(broker, /stage=classified/);
  assert.match(broker, /stage=scheme-rejected/);
  assert.match(broker, /stage=method-rejected/);

  const clientTraceStart = client.indexOf('Log.i(\n        "OrionP102Trace"');
  const clientTraceEnd = client.indexOf('\n      )', clientTraceStart);
  assert.ok(clientTraceStart >= 0 && clientTraceEnd > clientTraceStart);

  const brokerTraceCalls = [...broker.matchAll(/tracePhysicalOnce\([\s\S]*?\n\s*\)/g)]
    .map((match) => match[0])
    .filter((block) => block.includes('message ='));

  assert.ok(brokerTraceCalls.length >= 5);
  const traceSource = `${client.slice(clientTraceStart, clientTraceEnd)}\n${brokerTraceCalls.join('\n')}`;

  assert.doesNotMatch(traceSource, /rawUrl|requestHeaders|cookieHeader|requestContextId|authorization|signedUrl/i);
  assert.doesNotMatch(traceSource, /https?:\/\/|uri\.toString\(\)|request\.url\.toString\(\)/i);
});

test('P10.2 physical trace repair uses 2.1.12 code14 identity', () => {
  const mobilePackage = JSON.parse(readMobile('package.json'));
  const app = JSON.parse(readMobile('app.json')).expo;
  const rootLock = JSON.parse(fs.readFileSync(path.resolve(mobileRoot, '..', '..', 'package-lock.json'), 'utf8'));

  assert.equal(mobilePackage.version, '2.1.12');
  assert.equal(app.version, '2.1.12');
  assert.equal(app.android.versionCode, 14);
  assert.equal(rootLock.packages['apps/mobile'].version, '2.1.12');
});
