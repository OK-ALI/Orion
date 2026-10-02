'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mobile = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(mobile, file), 'utf8');
function load(file, mocks = {}) {
  const filename = path.join(mobile, file);
  const js = ts.transpileModule(read(file), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, (name) => {
    if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
    return mocks[name];
  }, module);
  return module.exports;
}

const identity = load('src/features/downloads/downloadIdentity.ts');
const target = identity.createMobileDownloadTargetV1({ id: 918, mediaType: 'tv', title: 'Lanterns', season: 1, episode: 3 });
function fixture() {
  const calls = [];
  const job = {
    jobId: 'job-existing', candidateId: 'old-candidate', sourceId: 'vidlink', transferKind: 'dash',
    media: target.media, destination: 'orion-library', state: 'action-required',
    failure: { code: 'request-context-refresh-required', retryable: true },
    progress: { bytesDownloaded: 123456, completedFragments: 391, totalFragments: 1180 },
  };
  const candidate = {
    candidateId: 'new-candidate', requestContextId: 'new-context', playbackSessionId: 'new-session',
    sourceId: 'vidlink', media: target.media, preflight: {
      state: 'ready', requestContextReady: true, reachability: 'reachable', protection: 'clear',
      expiry: 'stable', resolvedManifestKind: 'dash',
    },
  };
  let currentJob = job;
  let snapshots = [{ itemKey: target.itemKey, candidate }];
  const capture = {
    getMobileDownloadCandidateSnapshotsV1: () => snapshots,
    selectMobileDownloadCandidateForItemV1: (itemKey, _method, values, _destination, sourceId) => {
      const selected = values.find((entry) => entry.itemKey === itemKey && entry.candidate.sourceId === sourceId &&
        entry.candidate.preflight.state === 'ready' && entry.candidate.preflight.requestContextReady);
      return selected ? { candidate: selected.candidate } : null;
    },
    completeMobileDownloadSourceResolutionV1: (itemKey) => calls.push(['complete', itemKey]),
  };
  const engine = load('src/features/downloads/nativeDownloadEngine.ts', {
    'react-native': { Platform: { OS: 'android' }, NativeModules: { OrionDownloadEngine: {
      retryJobWithFreshCandidate: async (...args) => { calls.push(['rebind', ...args]); return true; },
      retryJob: async (id) => { calls.push(['retry', id]); return true; },
    } }, DeviceEventEmitter: {} },
    './downloadRepository': { readMobileDownloadRepositoryV1: () => ({ jobs: [currentJob] }) },
    './downloadIdentity': identity,
    './downloadCandidateCapture': capture,
    './downloadSubtitles': {},
  });
  return { engine, job, candidate, calls,
    setJob: (value) => { currentJob = value; },
    setCandidate: (value, itemKey = target.itemKey) => { snapshots = [{ itemKey, candidate: value }]; },
  };
}

test('fresh ready VidLink DASH authority retries the same durable job without creating another', async () => {
  const f = fixture();
  await f.engine.retryNativeDownloadJobV1(f.job.jobId);
  assert.deepEqual(f.calls.map((entry) => entry[0]), ['rebind', 'complete']);
  assert.deepEqual(f.calls[0].slice(1, 4), [f.job.jobId, f.candidate.candidateId, f.candidate.playbackSessionId]);
  assert.deepEqual(JSON.parse(f.calls[0][4]), target.media);
  assert.equal(f.job.progress.completedFragments, 391, 'the interrupted job retains its verified progress until native admission');
});

test('wrong title, episode, provider, transfer kind, stale or incomplete authority fails closed', async () => {
  const changes = [
    (c) => ({ ...c, media: { ...c.media, id: 919 } }),
    (c) => ({ ...c, media: { ...c.media, episode: 4 } }),
    (c) => ({ ...c, sourceId: 'vixsrc' }),
    (c) => ({ ...c, preflight: { ...c.preflight, resolvedManifestKind: 'hls' } }),
    (c) => ({ ...c, candidateId: 'old-candidate' }),
    (c) => ({ ...c, requestContextId: null }),
    (c) => ({ ...c, preflight: { ...c.preflight, state: 'checking' } }),
    (c) => ({ ...c, preflight: { ...c.preflight, requestContextReady: false } }),
    (c) => ({ ...c, preflight: { ...c.preflight, reachability: 'unreachable' } }),
    (c) => ({ ...c, preflight: { ...c.preflight, protection: 'protected' } }),
  ];
  for (const change of changes) {
    const f = fixture();
    f.setCandidate(change(f.candidate));
    await assert.rejects(f.engine.retryNativeDownloadJobV1(f.job.jobId), /fresh source.*not ready/i);
    assert.deepEqual(f.calls, []);
  }
});

test('ordinary retained-authority retry still calls the accepted retry owner', async () => {
  const f = fixture();
  f.setJob({ ...f.job, state: 'recovering', failure: { code: 'network-interrupted', retryable: true } });
  await f.engine.retryNativeDownloadJobV1(f.job.jobId);
  assert.deepEqual(f.calls, [['retry', f.job.jobId]]);
});

test('fresh authority cannot be offered to an unrelated failed state', async () => {
  const f = fixture();
  f.setJob({ ...f.job, state: 'failed' });
  await assert.rejects(f.engine.retryNativeDownloadJobV1(f.job.jobId), /not in a state/);
  assert.deepEqual(f.calls, []);
});

test('player arms refresh only for exact media and current provider', () => {
  const requested = [];
  let job = fixture().job;
  const hook = load('src/features/downloads/useDownloadSourceAutoReturn.ts', {
    react: { useRef: (value) => ({ current: value }), useEffect: (effect) => effect() },
    'expo-router': { useRouter: () => ({ back() { throw new Error('unexpected return'); } }) },
    './downloadRepository': { listMobileDownloadJobsV1: () => [job] },
    './downloadIdentity': identity,
    './nativeDownloadEngine': { retryNativeDownloadJobV1: async () => { throw new Error('unexpected retry'); } },
    './downloadCandidateCapture': {
      getMobileDownloadSourceResolutionIntentV1: () => null,
      requestMobileDownloadSourceResolutionV1: (...args) => requested.push(args),
      subscribeMobileDownloadCandidatesV1: (fn) => { fn([]); return () => {}; },
    },
  });
  hook.useDownloadSourceAutoReturnV1(target.itemKey, 'vixsrc', target.media);
  hook.useDownloadSourceAutoReturnV1(target.itemKey, 'vidlink', { ...target.media, episode: 4 });
  assert.deepEqual(requested, []);
  hook.useDownloadSourceAutoReturnV1(target.itemKey, 'vidlink', target.media);
  assert.deepEqual(requested, [[target.itemKey, 'fragments', 'vidlink']]);
  job = { ...job, state: 'cancelled' };
  hook.useDownloadSourceAutoReturnV1(target.itemKey, 'vidlink', target.media);
  assert.equal(requested.length, 1);
});

test('native admission preserves same-job ownership, completion fence and authority-bound cache safety', () => {
  const module = read('plugins/orion-cinema-webview-native/OrionDownloadEngineModule.kt');
  const store = read('plugins/orion-cinema-webview-native/OrionDownloadJobStore.kt');
  const runtime = read('plugins/orion-cinema-webview-native/OrionDownloadTransferRuntime.kt');
  const broker = read('plugins/orion-cinema-webview-native/OrionDownloadRequestContextBroker.kt');
  const ytdlp = read('plugins/orion-cinema-webview-native/OrionDownloadYtDlpRuntime.kt');
  const gateway = read('plugins/orion-cinema-webview-native/OrionDownloadYtDlpGateway.kt');
  const activity = read('src/features/downloads/DownloadActivityList.tsx');
  const rebind = module.split('fun retryJobWithFreshCandidate(')[1].split('fun retryAllJobs(')[0];
  assert.match(rebind, /hasCompleteLocalFinalization/);
  assert.match(rebind, /hasCompleteLocalYtDlpFinalization/);
  assert.match(rebind, /OrionDownloadJobStore\.rebindFreshCandidate\(clean, oldCandidateId, media, prepared\)/);
  assert.match(rebind, /OrionDownloadForegroundService\.start\(reactContext, clean, recovery = true\)/);
  assert.doesNotMatch(rebind, /createJob\(|startJobInternal\(|nextSourceId|vixsrc/);
  assert.match(store, /job\.optString\("_itemKey"\) != mediaItemKey\(media\)/);
  assert.match(store, /job\.optString\("_sourceId"\) != transfer\.sourceId/);
  assert.match(store, /job\.optString\("_transferKind"\) != transfer\.transferKind/);
  assert.match(store, /job\.optString\("state"\) !in setOf\("action-required", "expired"\)/);
  assert.match(store, /transfer\.transferKind !in setOf\("hls", "dash"\)/);
  assert.match(store, /job\.optJSONObject\("_finalizationPlan"\) != null/);
  assert.match(store, /job\.optJSONObject\("_ytDlpTransferCompletion"\) != null/);
  assert.match(store, /job\.put\("progress", emptyProgress\(\)\)/);
  const admission = store.split('fun rebindFreshCandidate(')[1].split('fun setState(')[0];
  assert.ok(admission.indexOf('sameNullableMediaNumber(previous, media, "episode")') < admission.indexOf('retireOldCache()'));
  assert.ok(admission.indexOf('retireOldCache()') < admission.indexOf('job.put("candidateId"'));
  assert.match(broker, /contexts\[candidateId\]\?\.sessionId != sessionId/);
  assert.match(runtime, /contexts\[jobId\]\?\.takeIf \{ it\.candidateId == candidateId \}/);
  assert.match(ytdlp, /File\(stagingDir\(context, clean\), "\$transferKind-resume-v1"\)/);
  assert.match(ytdlp, /cache\.deleteRecursively\(\)/);
  assert.match(gateway, /append\(bound\.requestContextId\)/);
  assert.match(gateway, /append\(bound\.candidateId\)/);
  assert.match(module, /fun cancelJob\(jobId: String\)/);
  assert.match(store, /fun markCompleted\(jobId: String, expectedGeneration: Long/);
  assert.match(activity, /job\.transferKind === 'direct' && \(recoveryCode === 'request-context-refresh-required'/);
});
