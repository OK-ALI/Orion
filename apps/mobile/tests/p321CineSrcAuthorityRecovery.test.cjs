'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const mobile = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(mobile, file), 'utf8');

function load(file, mocks) {
  const js = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, (name) => {
    if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
    return mocks[name];
  }, module);
  return module.exports;
}

const media = { id: 918, mediaType: 'tv', libraryKind: 'series', season: 1, episode: 4 };
const itemKey = 'series:918:s1:e4';
function fixture() {
  const calls = [];
  let subscriber;
  let cleanup;
  let retryFailure = null;
  const recovery = { jobId: 'same-job', candidateId: 'old-candidate', sourceId: 'cinesrc', transferKind: 'hls', destination: 'orion-library', media };
  const intent = { method: 'fragments', sourceId: 'cinesrc', autoReturnIssued: false, recovery };
  const job = { ...recovery, state: 'action-required', media, failure: { code: 'request-context-refresh-required' } };
  const ready = { candidateId: 'fresh-candidate', sourceId: 'cinesrc', media, playbackSessionId: 'session', requestContextId: 'context', preflight: {
    state: 'ready', requestContextReady: true, reachability: 'reachable', protection: 'clear', expiry: 'session', resolvedManifestKind: 'hls',
  } };
  const capture = {
    getMobileDownloadSourceResolutionIntentV1: () => intent,
    markMobileDownloadSourceAutoReturnIssuedV1: () => { if (intent.autoReturnIssued) return false; intent.autoReturnIssued = true; return true; },
    selectMobileDownloadCandidateForItemV1: (_key, _method, values) => values[0] && { candidate: values[0].candidate },
    subscribeMobileDownloadCandidatesV1: (fn) => { subscriber = fn; fn([]); return () => {}; },
    requestMobileDownloadSourceResolutionV1: () => calls.push('unexpected-request'),
    failMobileDownloadSourceResolutionV1: (_key, message) => { calls.push(['fail', message]); },
    cancelMobileDownloadSourceResolutionV1: () => { calls.push('cancel-intent'); },
  };
  const hook = load('src/features/downloads/useDownloadSourceAutoReturn.ts', {
    react: { useRef: (value) => ({ current: value }), useEffect: (fn) => { const result = fn(); if (result && fn.toString().includes('cancelMobileDownloadSourceResolutionV1')) cleanup = result; } },
    'expo-router': { useRouter: () => ({ back: () => calls.push('back') }) },
    './downloadRepository': { listMobileDownloadJobsV1: () => [job] },
    './downloadIdentity': { mobileDownloadItemKeyFromMediaV1: () => itemKey },
    './downloadCandidateCapture': capture,
    './nativeDownloadEngine': { retryNativeDownloadJobV1: async (id) => { calls.push(['retry', id]); if (retryFailure) throw retryFailure; } },
  });
  hook.useDownloadSourceAutoReturnV1(itemKey, 'cinesrc', media);
  return { calls, intent, job, ready, emit: (candidate) => subscriber([{ itemKey, candidate }]),
    cleanup: () => cleanup?.(), failRetry: () => { retryFailure = new Error('Native admission rejected this source.'); } };
}

test('ready exact CineSrc HLS candidate retries one durable job before returning', async () => {
  const f = fixture();
  f.emit(f.ready);
  f.emit(f.ready);
  await new Promise(setImmediate);
  assert.deepEqual(f.calls, [['retry', 'same-job'], 'back']);
  assert.equal(f.intent.autoReturnIssued, true);
});

test('wrong title, provider, kind, old candidate and incomplete preflight never trigger retry', async () => {
  const changes = [
    (c) => ({ ...c, media: { ...c.media, episode: 5 } }),
    (c) => ({ ...c, sourceId: 'vidlink' }),
    (c) => ({ ...c, preflight: { ...c.preflight, resolvedManifestKind: 'dash' } }),
    (c) => ({ ...c, candidateId: 'old-candidate' }),
    (c) => ({ ...c, preflight: { ...c.preflight, state: 'checking' } }),
    (c) => ({ ...c, preflight: { ...c.preflight, reachability: 'unreachable' } }),
    (c) => ({ ...c, requestContextId: null }),
  ];
  for (const change of changes) {
    const f = fixture();
    f.emit(change(f.ready));
    await new Promise(setImmediate);
    assert.deepEqual(f.calls, []);
  }
});

test('native rejection returns once with a truthful bounded error and no retry loop', async () => {
  const f = fixture();
  f.failRetry();
  f.emit(f.ready);
  await new Promise(setImmediate);
  f.emit(f.ready);
  assert.deepEqual(f.calls, [['retry', 'same-job'], ['fail', 'Native admission rejected this source.'], 'back']);
});

test('canceling Player before candidate readiness clears the automatic recovery intent', () => {
  const f = fixture();
  f.cleanup();
  assert.deepEqual(f.calls, ['cancel-intent']);
});

test('native authority and admission retain exact boundaries', () => {
  const broker = read('plugins/orion-cinema-webview-native/OrionDownloadRequestContextBroker.kt');
  const lease = read('plugins/orion-cinema-webview-native/OrionActiveAuthorityLeasePolicy.kt');
  const store = read('plugins/orion-cinema-webview-native/OrionDownloadJobStore.kt');
  const engine = read('plugins/orion-cinema-webview-native/OrionDownloadEngineModule.kt');
  const route = read('app/(tabs)/downloads.tsx');
  assert.match(broker, /deadline <= now && !activeLeaseValidLocked\(context, now\)/);
  assert.match(broker, /if \(!context\.authorizedUrls\.contains\(normalized\)\) return null/);
  assert.match(lease, /explicitExpiresAt == null/);
  assert.match(lease, /exactBoundRequest && foregroundOwned/);
  assert.match(store, /OrionFreshRebindNumberPolicy\.same/);
  assert.match(store, /reason=\$reason/);
  assert.match(store, /cache-retirement-failed/);
  assert.match(engine, /OrionDownloadForegroundService\.start\(reactContext, clean, recovery = true\)/);
  assert.match(route, /nextSourceId: sourceId/);
  assert.match(route, /jobId: job\.jobId, candidateId: job\.candidateId/);
});
