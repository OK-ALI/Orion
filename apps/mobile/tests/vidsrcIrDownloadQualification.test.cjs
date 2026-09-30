'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mobile = path.resolve(__dirname, '..');
const shared = path.resolve(mobile, '../../packages/shared');
const diagnosticSources = ['vidsrc-ir', 'vidlink', 'cinesrc', 'vidnest'];

function environment() {
  const cache = new Map();
  const calls = { binds: [], starts: [], releases: [] };
  let onCandidate;
  const mocks = {
    'react-native': {
      Platform: { OS: 'android' },
      requireNativeComponent: () => 'NativeCinema',
      DeviceEventEmitter: { addListener: (name, listener) => {
        if (name === 'OrionDownloadCandidate') onCandidate = listener;
        return { remove() {} };
      } },
      NativeModules: { OrionDownloadCapture: {
        releaseSession: (id) => calls.releases.push(id),
        bindRequestContext: async (candidateId, jobId) => {
          calls.binds.push({ candidateId, jobId });
          return { ok: true, requestContextId: 'opaque-context' };
        },
      } },
    },
    react: { forwardRef: (render) => render, useMemo: (fn) => fn(), useEffect() {}, useRef: () => ({ current: 0 }) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native-webview': { WebView: 'WebView' },
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier in mocks) return mocks[specifier];
      if (specifier === '@orion/shared/sources') return load(path.join(shared, 'src/sources/registry.ts'));
      if (specifier === '@orion/shared/cinema-block-rules') return require(path.join(shared, 'cinemaBlockRules.cjs'));
      if (specifier === './nativeDownloadEngine') return { startNativeDownloadJobV1: async (input) => {
        calls.starts.push(input); return input.job.jobId;
      } };
      if (specifier === './downloadSubtitles') return { resolveMobileDownloadSubtitleSourcesForNativeV1: () => [] };
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier);
        return load([base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(fs.existsSync));
      }
      throw new Error(`Unexpected import ${specifier}`);
    };
    new Function('exports', 'require', 'module', output)(module.exports, localRequire, module);
    return module.exports;
  }
  const capture = load(path.join(mobile, 'src/features/downloads/downloadCandidateCapture.ts'));
  const identity = load(path.join(mobile, 'src/features/downloads/downloadIdentity.ts'));
  const target = identity.createMobileDownloadTargetV1({ id: 42, mediaType: 'tv', title: 'Fixture', season: 2, episode: 1 });
  const session = (sourceId, playbackSessionId = `session-${sourceId}`) => ({
    sourceId, playbackSessionId, itemKey: target.itemKey, media: target.media, providerClass: 'candidate',
  });
  const event = (sourceId, playbackSessionId = `session-${sourceId}`) => ({
    schemaVersion: 1, sourceId, playbackSessionId, candidateId: `candidate-${sourceId}`, requestContextId: 'opaque-context',
    manifestKind: 'hls', expiry: 'stable', protection: 'clear', availableQualities: ['best'], capturedAt: 100,
    capabilities: { orionLibrary: true, deviceStorage: true, resumable: true, subtitles: false, audioSelection: false },
    preflight: { schemaVersion: 1, candidateId: `candidate-${sourceId}`, state: 'ready', reachability: 'reachable',
      resolvedManifestKind: 'hls', expiry: 'stable', protection: 'clear', requestContextReady: true, descendantCount: 10,
      requiredBytes: null, storageRequirement: 'unknown', orionLibraryFreeBytes: null, reasonCode: null, reason: null, checkedAt: 100 },
  });
  return { capture, calls, session, event, target, load, emit: (value) => onCandidate(value),
    registry: load(path.join(shared, 'src/sources/registry.ts')) };
}

test('actual descriptors preserve preparation-only policy and accepted download controls', () => {
  const { registry, capture } = environment();
  for (const id of diagnosticSources) {
    const source = registry.getRegisteredSource(id);
    assert.equal(source.supportsDownloads, false);
    assert.equal(source.releaseStatus, 'candidate');
    assert.equal(source.routingMode, 'manual-only');
    assert.equal(capture.isMobileDownloadSourceAllowedV1(id), false);
  }
  for (const id of ['vixsrc', 'vidsrc']) assert.equal(capture.isMobileDownloadSourceAllowedV1(id), true);
  assert.equal(capture.isMobileDownloadSourceAllowedV1('unknown-provider'), false);
});

test('WebView serializes capture independently and denies missing invalid unknown or diagnostic admission', () => {
  const env = environment();
  const wrapper = env.load(path.join(mobile, 'src/features/playback/OrionCinemaWebView.tsx')).OrionCinemaWebView;
  const serialize = (id, permission, capture = true) => JSON.parse(wrapper({
    shieldManifest: env.registry.getRegisteredSource(id)?.requestManifest || { sourceId: id },
    shieldSessionId: 'session-1', downloadCaptureEnabled: capture, downloadAllowed: permission,
  }, null).props.nativeConfig.props.orionShieldSession);
  for (const id of [...diagnosticSources, 'unknown-provider']) {
    const contract = serialize(id, true);
    assert.equal(contract.downloadCaptureEnabled, true);
    assert.equal(contract.downloadAllowed, false);
  }
  for (const id of ['vixsrc', 'vidsrc']) {
    assert.equal(serialize(id, true).downloadAllowed, true);
    for (const permission of [undefined, false, 'true', 1, {}]) assert.equal(serialize(id, permission).downloadAllowed, false);
    assert.equal(serialize(id, true, false).downloadAllowed, false);
  }
});

test('preparation READY stays observable but cannot become a selected or bound download', async () => {
  for (const id of [...diagnosticSources, 'unknown-provider']) {
    const env = environment();
    const end = env.capture.beginMobileDownloadCaptureSessionV1(env.session(id));
    env.emit({ ...env.event(id), downloadAllowed: true }); // Provider/native hitchhikers cannot grant eligibility.
    const snapshots = env.capture.getMobileDownloadCandidateSnapshotsV1();
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].candidate.preflight.state, 'ready');
    assert.equal(snapshots[0].candidate.capabilities.orionLibrary, false);
    assert.equal(snapshots[0].candidate.capabilities.deviceStorage, false);
    assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey), null);
    assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'fragments', snapshots, 'device-storage', id), null);
    await assert.rejects(env.capture.bindMobileDownloadRequestContextV1(`candidate-${id}`, 'job-1'), /not authorized/);
    assert.equal(env.calls.binds.length, 0);
    end();
  }
});

test('selection rejects forged native-ready diagnostic snapshots without relying on normalization', () => {
  const env = environment();
  for (const id of [...diagnosticSources, 'unknown-provider']) {
    const snapshots = [{ itemKey: env.target.itemKey, candidate: { ...env.event(id), media: env.target.media } }];
    assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', snapshots), null);
  }
});

test('direct start cannot bypass registry admission with a forged ready candidate', async () => {
  const env = environment();
  const start = env.load(path.join(mobile, 'src/features/downloads/downloadStart.ts'));
  for (const id of [...diagnosticSources, 'unknown-provider']) {
    await assert.rejects(start.startMobileDownloadFromSelectionV1({
      target: env.target, selection: { candidate: { ...env.event(id), media: env.target.media }, resolvedMethod: 'fragments' },
      preferences: { preferredQuality: 'best', libraryStorageTarget: { mode: 'user-folder', targetId: 'owned', writable: true, persistedPermission: true } },
    }), /not authorized/);
  }
  assert.equal(env.calls.starts.length, 0);
});

test('stale or mismatched events cannot borrow an accepted session permission', () => {
  const env = environment();
  const active = env.session('vixsrc');
  assert.equal(env.capture.normalizeMobileDownloadCandidateEventV1(env.event('vidsrc-ir'), active), null);
  assert.equal(env.capture.normalizeMobileDownloadCandidateEventV1(env.event('vixsrc', 'stale'), active), null);
  const old = env.capture.beginMobileDownloadCaptureSessionV1(active);
  const end = env.capture.beginMobileDownloadCaptureSessionV1(env.session('vidsrc-ir'));
  env.emit(env.event('vixsrc'));
  assert.equal(env.capture.getMobileDownloadCandidateSnapshotsV1().length, 0);
  old(); end();
});

test('VixSrc and VidSrc retain normalized selection binding and exact-episode job start', async () => {
  for (const id of ['vixsrc', 'vidsrc']) {
    const env = environment();
    const end = env.capture.beginMobileDownloadCaptureSessionV1(env.session(id));
    env.emit(env.event(id));
    const selection = env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', id);
    assert.equal(selection.candidate.sourceId, id);
    assert.equal(selection.resolvedMethod, 'fragments');
    await env.capture.bindMobileDownloadRequestContextV1(selection.candidate.candidateId, 'job-1');
    assert.equal(env.calls.binds.length, 1);
    const start = env.load(path.join(mobile, 'src/features/downloads/downloadStart.ts'));
    await start.startMobileDownloadFromSelectionV1({ target: env.target, selection,
      preferences: { preferredQuality: 'best', libraryStorageTarget: { mode: 'user-folder', targetId: 'owned', writable: true, persistedPermission: true } } });
    assert.equal(env.calls.starts.length, 1);
    assert.equal(env.calls.starts[0].job.candidateId, `candidate-${id}`);
    end();
  }
});
