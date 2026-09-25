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

test('download source qualification waits through checking, accepts ready HLS or Direct media, and fails over only when all candidates are terminal', () => {
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
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'unreachable')]), 'terminal');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'unreachable'), candidate('vixsrc', 'checking')]), 'checking');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'ready', 'hls', true)]), 'ready');
  assert.equal(capture.getMobileDownloadSourceResolutionStateV1(key, 'vixsrc', [candidate('vixsrc', 'ready', 'direct', true)]), 'ready');
});

test('temporary download resolution is event-driven with an eight-second watchdog and no 30-second source stall', () => {
  const player = fs.readFileSync(path.join(mobileRoot, 'src/features/playback/PlayerScreen.tsx'), 'utf8');
  assert.match(player, /DOWNLOAD_SOURCE_WATCHDOG_MS = 8_000/);
  assert.match(player, /DOWNLOAD_TERMINAL_GRACE_MS = 1_200/);
  assert.match(player, /subscribeMobileDownloadCandidatesV1/);
  assert.match(player, /getMobileDownloadSourceResolutionStateV1/);
  assert.match(player, /state === 'terminal' \? DOWNLOAD_TERMINAL_GRACE_MS : DOWNLOAD_SOURCE_WATCHDOG_MS/);
  assert.doesNotMatch(player, /30_000/);
  assert.doesNotMatch(player, /Try another download source\?/);
});
