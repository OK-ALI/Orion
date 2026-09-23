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

test('download-only telemetry verifies playback without invoking viewing persistence or completion', () => {
  const calls = { records: 0, completions: 0, recentOpens: 0 };
  const policy = loadTs('src/features/playback/viewingPersistence.ts');
  const media = { id: 'house', mediaType: 'tv', title: 'Dr. House', season: 2, episode: 1 };
  const build = (purpose) => {
    const module = loadTs('src/features/playback/usePlaybackTelemetryController.ts', {
      react: { useRef: (value) => ({ current: value }), useCallback: (fn) => fn, useEffect: () => {} },
      '../../services/mobileDiagnostics': { clearMobileDiagnosticError: () => {}, reportMobileDiagnosticError: () => {}, updateMobileDiagnostics: () => {} },
      './playbackRepository': { recordRecentOpen: () => { calls.recentOpens++; }, removeRecentOpen: () => {} },
      './telemetryReducer': {
        createPlaybackTelemetryState: (session) => ({ session, duration: null, evidence: null }),
        reducePlaybackTelemetry: (state, event) => event.evidence === 'opened-only'
          ? { accepted: true, shouldPersist: false, state }
          : ({ accepted: true, shouldPersist: true, state: {
          session: { ...state.session, verified: true, lastVerifiedTime: 90, state: 'playing', updatedAt: event.observedAt },
          duration: 100, evidence: 'provider-video-event',
        } }),
      },
      './playbackCompletion': { isVerifiedPlaybackCompletion: () => true },
      './viewingPersistence': policy,
    });
    return module.usePlaybackTelemetryController({
      item: { id: 'house' }, media, sourceId: 'vixsrc', surface: 'embed', purpose,
      recordPlayback: () => { calls.records++; },
      onVerifiedCompletion: () => { calls.completions++; },
    });
  };
  const download = build('download-resolution');
  download.markOpenedOnly();
  download.emitTelemetry({ evidence: 'provider-video-event', state: 'playing', currentTime: 90, duration: 100 });
  assert.equal(download.getSession().verified, true);
  assert.equal(download.getVerifiedSnapshot().currentTime, 90);
  assert.equal(download.flush(), false);
  assert.deepEqual(calls, { records: 0, completions: 0, recentOpens: 0 });

  const normal = build('viewing');
  normal.markOpenedOnly();
  normal.emitTelemetry({ evidence: 'provider-video-event', state: 'playing', currentTime: 90, duration: 100 });
  assert.equal(normal.getSession().verified, true);
  assert.equal(calls.records, 1);
  assert.equal(calls.completions, 1);
  assert.equal(calls.recentOpens, 1);
});

test('download-resolution purpose is latched at route entry and passed to the embedded surface', () => {
  const screen = fs.readFileSync(path.join(mobileRoot, 'src/features/playback/PlayerScreen.tsx'), 'utf8');
  const surface = fs.readFileSync(path.join(mobileRoot, 'src/features/playback/EmbedPlayerSurface.tsx'), 'utf8');
  assert.match(screen, /useState\(downloadIntentAtOpen\)/);
  assert.match(screen, /playbackPurpose=\{downloadResolutionOnly \? 'download-resolution' : 'viewing'\}/);
  assert.match(screen, /offlineRequested \|\| downloadResolutionOnly/);
  assert.match(surface, /purpose: playbackPurpose/);
});
