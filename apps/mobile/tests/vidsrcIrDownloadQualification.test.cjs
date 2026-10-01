'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mobile = path.resolve(__dirname, '..');
const shared = path.resolve(mobile, '../../packages/shared');
const diagnosticSources = ['vidnest'];
const downloadableSources = ['vixsrc', 'vidsrc', 'vidsrc-ir', 'vidlink', 'cinesrc'];

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
      if (specifier === '../../services/sourceHealth') return { getMobileSourceHealth: () => null, getMobileSourceHealthV2: () => null };
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

test('actual descriptors admit the qualified manual candidates while preserving preparation-only controls', () => {
  const { registry, capture } = environment();
  for (const id of diagnosticSources) {
    const source = registry.getRegisteredSource(id);
    assert.equal(source.supportsDownloads, false);
    assert.equal(source.releaseStatus, 'candidate');
    assert.equal(source.routingMode, 'manual-only');
    assert.equal(capture.isMobileDownloadSourceAllowedV1(id), false);
  }
  for (const id of downloadableSources) assert.equal(capture.isMobileDownloadSourceAllowedV1(id), true);
  const qualification = registry.getRegisteredSource('vidsrc-ir');
  assert.equal(qualification.supportsDownloads, true);
  assert.equal(qualification.releaseStatus, 'candidate');
  assert.equal(qualification.routingMode, 'manual-only');
  assert.deepEqual(qualification.allowedNavigationOrigins, ['https://vidsrc.ir']);
  assert.deepEqual(qualification.requiredRequestOrigins, ['https://vidsrc.ir']);
  assert.deepEqual(qualification.requestManifest.mediaOrigins, []);

  const vidlink = registry.getRegisteredSource('vidlink');
  assert.equal(vidlink.supportsDownloads, true);
  assert.equal(vidlink.releaseStatus, 'candidate');
  assert.equal(vidlink.routingMode, 'manual-only');
  assert.deepEqual(vidlink.allowedNavigationOrigins, ['https://vidlink.pro']);
  assert.deepEqual(vidlink.requiredRequestOrigins, ['https://vidlink.pro']);
  assert.deepEqual(vidlink.requestManifest.mediaOrigins, []);
  const cinesrc = registry.getRegisteredSource('cinesrc');
  assert.equal(cinesrc.supportsDownloads, true);
  assert.equal(cinesrc.releaseStatus, 'candidate');
  assert.equal(cinesrc.routingMode, 'manual-only');
  assert.deepEqual(cinesrc.allowedNavigationOrigins, ['https://cinesrc.st']);
  assert.deepEqual(cinesrc.requiredRequestOrigins, ['https://cinesrc.st']);
  assert.deepEqual(cinesrc.requestManifest.mediaOrigins, []);
  assert.equal(registry.getRegisteredSource('vixsrc').routingMode, 'automatic');
  assert.equal(registry.getRegisteredSource('vidsrc').routingMode, 'manual-only');
  assert.equal(capture.isMobileDownloadSourceAllowedV1('unknown-provider'), false);
});

test('qualified candidates are manual download choices without entering Auto or automatic continuity', () => {
  const env = environment();
  const sources = env.load(path.join(mobile, 'src/features/playback/mobileSources.ts'));
  for (const mediaType of ['movie', 'tv']) {
    const choices = sources.getMobileDownloadSourceChoices(mediaType);
    for (const id of ['vidsrc-ir', 'vidlink', 'cinesrc']) {
      assert.equal(choices.find((source) => source.id === id).routingMode, 'manual-only');
      assert.equal(sources.getPreferredMobileResumeSource(id, mediaType), 'vixsrc');
      assert.equal(env.registry.AUTOMATIC_PLAYER_SOURCES.some((source) => source.id === id), false);
      assert.equal(sources.mobileSourceSupportsContinuity(id), false);
      assert.equal(sources.getMobileSourceContinuityCapability(id).automaticTarget, false);
    }
    for (const id of diagnosticSources) assert.equal(choices.some((source) => source.id === id), false);
    assert.equal(sources.getNextMobileContinuitySource('vixsrc', mediaType,
      sources.MOBILE_PLAYER_SOURCES.filter((source) => !['vidsrc-ir', 'vidlink', 'cinesrc'].includes(source.id)).map((source) => source.id)), null);
  }
  assert.equal(sources.MOBILE_DEFAULT_CINEMA_SOURCE_ID, 'vixsrc');
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
  for (const id of downloadableSources) {
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

test('qualified manual candidates and accepted controls require normalized selection binding and exact-episode job start', async () => {
  for (const id of downloadableSources) {
    const env = environment();
    const end = env.capture.beginMobileDownloadCaptureSessionV1(env.session(id));
    env.emit(env.event(id));
    const selection = env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', id);
    assert.equal(env.capture.getMobileDownloadCandidateSnapshotsV1()[0].candidate.preflight.state, 'ready');
    assert.equal(selection.candidate.capabilities.orionLibrary, true);
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

test('CineSrc selects verified HLS ahead of direct media and never borrows another source', () => {
  const env = environment();
  const end = env.capture.beginMobileDownloadCaptureSessionV1(env.session('cinesrc'));
  const direct = env.event('cinesrc');
  direct.candidateId = 'candidate-cinesrc-direct';
  direct.preflight.candidateId = direct.candidateId;
  direct.manifestKind = 'direct';
  direct.preflight.resolvedManifestKind = 'direct';
  direct.preflight.descendantCount = 0;
  env.emit(direct);
  const directSelection = env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', 'cinesrc');
  assert.equal(directSelection.candidate.candidateId, direct.candidateId);
  assert.equal(directSelection.resolvedMethod, 'direct');
  assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'fragments', undefined, 'orion-library', 'cinesrc'), null);

  const hls = env.event('cinesrc');
  hls.candidateId = 'candidate-cinesrc-hls';
  hls.preflight.candidateId = hls.candidateId;
  env.emit(hls);
  const selected = env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', 'cinesrc');
  assert.equal(selected.candidate.candidateId, hls.candidateId);
  assert.equal(selected.resolvedMethod, 'fragments');
  assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', 'vidlink'), null);
  end();
});

test('CineSrc rejects malformed, stale and unsupported media before selection', () => {
  const env = environment();
  const end = env.capture.beginMobileDownloadCaptureSessionV1(env.session('cinesrc'));
  const base = env.event('cinesrc');
  env.emit({ ...base, playbackSessionId: 'stale' });
  env.emit({ ...base, preflight: { ...base.preflight, candidateId: 'wrong-candidate' } });
  env.emit({ ...base, manifestKind: 'unknown', preflight: { ...base.preflight, resolvedManifestKind: 'unknown' } });
  assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', 'cinesrc'), null);
  env.emit({ ...base, preflight: { ...base.preflight, state: 'unsupported', reasonCode: 'invalid-media', requestContextReady: false } });
  assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', 'cinesrc'), null);
  end();
});

test('CineSrc HLS audio failure blocks direct fallback even when native reports it ready', () => {
  const env = environment();
  const end = env.capture.beginMobileDownloadCaptureSessionV1(env.session('cinesrc'));
  const hls = env.event('cinesrc');
  hls.candidateId = 'candidate-cinesrc-audio-failure';
  hls.preflight.candidateId = hls.candidateId;
  hls.preflight.state = 'unsupported';
  hls.preflight.requestContextReady = false;
  hls.preflight.reasonCode = 'hls-audio-track-missing';
  env.emit(hls);
  const direct = env.event('cinesrc');
  direct.candidateId = 'candidate-cinesrc-direct';
  direct.preflight.candidateId = direct.candidateId;
  direct.manifestKind = 'direct';
  direct.preflight.resolvedManifestKind = 'direct';
  env.emit(direct);
  assert.equal(env.capture.selectMobileDownloadCandidateForItemV1(env.target.itemKey, 'auto', undefined, 'orion-library', 'cinesrc'), null);
  end();
});

test('Mobile provider matrix keeps qualified, blocked and frozen sources out of Auto', () => {
  const env = environment();
  const sources = env.load(path.join(mobile, 'src/features/playback/mobileSources.ts'));
  const visible = sources.MOBILE_PLAYER_SOURCES.map((source) => source.id);
  assert.deepEqual(visible, ['vixsrc', 'vidsrc', 'vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc', '111movies']);
  assert.deepEqual(sources.getMobileDownloadSourceChoices('tv').map((source) => source.id),
    ['vixsrc', 'vidsrc', 'vidlink', 'vidsrc-ir', 'cinesrc', '111movies']);
  assert.equal(sources.MOBILE_DEFAULT_CINEMA_SOURCE_ID, 'vixsrc');
  for (const id of visible.filter((sourceId) => sourceId !== 'vixsrc')) {
    assert.equal(sources.mobileSourceSupportsContinuity(id), false);
    assert.equal(sources.getMobileSourceContinuityCapability(id).automaticTarget, false);
  }
  assert.equal(env.registry.getRegisteredSource('vidnest').supportsDownloads, false);
  assert.equal(env.registry.getRegisteredSource('111movies').supportsDownloads, true);
  for (const id of ['mapple', 'stellar', 'chillflix', 'vidsrc-sh', 'vidapi']) {
    assert.equal(env.registry.getRegisteredSource(id), null);
  }
});
