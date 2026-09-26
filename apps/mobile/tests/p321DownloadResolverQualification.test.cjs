'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '..');

function loadTs(relative, mocks = {}) {
  const filename = path.join(mobileRoot, relative);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, (specifier) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected import ${specifier}`);
    return mocks[specifier];
  }, module);
  return module.exports;
}

const candidate = (sourceId, state, kind = 'hls', ready = false) => ({
  itemKey: 'series:1408:s1:e1',
  candidate: {
    candidateId: `${sourceId}-${state}-${kind}`,
    sourceId,
    capabilities: { orionLibrary: true },
    preflight: {
      state,
      requestContextReady: ready,
      resolvedManifestKind: kind,
      protection: 'clear',
      descendantCount: ready ? 12 : 0,
    },
  },
});

test('download source qualification keeps candidate failure separate from provider failure and accepts ready HLS or Direct media', () => {
  const capture = loadTs('src/features/downloads/downloadCandidateCapture.ts', {
    'react-native': {
      DeviceEventEmitter: { addListener: () => ({ remove() {} }) },
      NativeModules: {},
      Platform: { OS: 'android' },
    },
  });
  const key = 'series:1408:s1:e1';
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', []), 'empty');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'checking')]), 'checking');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'unreachable')]), 'checking');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'unsupported', 'unknown')]), 'checking');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'unreachable'), candidate('vixsrc', 'checking')]), 'checking');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'ready', 'hls', true)]), 'ready');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'ready', 'direct', true)]), 'ready');
});

test('temporary download resolution stays on the user-selected provider and returns only on a ready candidate', () => {
  const player = fs.readFileSync(path.join(mobileRoot, 'src/features/playback/PlayerScreen.tsx'), 'utf8');
  const autoReturn = fs.readFileSync(path.join(mobileRoot, 'src/features/downloads/useDownloadSourceAutoReturn.ts'), 'utf8');
  assert.doesNotMatch(player, /DOWNLOAD_SOURCE_WATCHDOG_MS/);
  assert.doesNotMatch(player, /DOWNLOAD_TERMINAL_GRACE_MS/);
  assert.doesNotMatch(player, /getNextMobileDownloadSource/);
  assert.doesNotMatch(player, /failMobileDownloadSourceResolutionV1/);
  assert.match(player, /getMobileDownloadSourceResolutionIntentV1\(downloadItemKey\)[\s\S]{0,120}\? false : changeSource/);
  assert.match(autoReturn, /subscribeMobileDownloadCandidatesV1/);
  assert.match(autoReturn, /selectMobileDownloadCandidateForItemV1/);
  assert.match(autoReturn, /markMobileDownloadSourceAutoReturnIssuedV1/);
  assert.match(autoReturn, /router\.back\(\)/);
  assert.match(autoReturn, /no timer-based provider guess or[\s\S]*source switching/i);
});

test('native capture publishes checking before asynchronous preflight so one early rejection cannot hide another in-flight candidate', () => {
  const broker = fs.readFileSync(path.join(mobileRoot, 'plugins/orion-cinema-webview-native/OrionDownloadRequestContextBroker.kt'), 'utf8');
  const checking = broker.indexOf('state = "checking"');
  const preflight = broker.indexOf('executor.execute { preflightAndEmit(reactContext, context) }');
  assert.ok(checking >= 0, 'expected native checking publication');
  assert.ok(preflight > checking, 'checking must publish before asynchronous preflight starts');
});
