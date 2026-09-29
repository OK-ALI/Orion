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

test('manual download source choices exclude retired, disabled, incompatible and cooling-down sources', () => {
  const source = (id, extra = {}) => ({ id, async: false, animeOnly: false, media: { movie: true, tv: true }, supportsDownloads: true, routingMode: 'manual-only', releaseStatus: 'primary', availability: 'ready', ...extra });
  const registry = loadTs('src/features/playback/mobileSources.ts', {
    '@orion/shared/sources': {
      DEFAULT_CINEMA_SOURCE_ID: 'vixsrc',
      PLAYER_SOURCES: [
        source('vixsrc', { routingMode: 'automatic' }), source('videasy'),
        source('disabled', { releaseStatus: 'disabled' }), source('not-downloadable', { supportsDownloads: false }),
        source('movie-only', { media: { movie: true, tv: false } }), source('cooldown'),
        source('vidsrc'), source('111movies'), source('vidlink', { supportsDownloads: false }),
      ],
      getSource: () => null,
    },
    '../../services/sourceHealth': {
      getMobileSourceHealth: () => null,
      getMobileSourceHealthV2: (id) => id === 'cooldown' ? { cooldownUntil: Date.now() + 60_000 } : null,
    },
  });
  assert.deepEqual(registry.MOBILE_PLAYER_SOURCES.map((entry) => entry.id), ['vixsrc', 'not-downloadable', 'movie-only', 'cooldown', 'vidsrc', '111movies', 'vidlink']);
  assert.equal(registry.MOBILE_AUTOMATIC_DOWNLOAD_SOURCE_IDS, undefined);
  assert.equal(registry.getNextMobileDownloadSource, undefined);
  assert.deepEqual(registry.getMobileDownloadSourceChoices('tv').map((entry) => entry.id), ['vixsrc', 'vidsrc', '111movies']);
  const modal = fs.readFileSync(path.join(mobileRoot, 'src', 'components', 'DownloadModal.tsx'), 'utf8');
  assert.match(modal, />Provider<\/Text>/);
  assert.match(modal, /preparedSourceIds\.has\(source\.id\)/);
  assert.match(modal, /selectedSourceId === source\.id/);
  assert.match(modal, /onResolveSource\(target, transferMethod, selectedSourceId \|\| undefined\)/);
  assert.doesNotMatch(modal, /Download method/);
});

test('Dr. House S2E1 download start rejects a stale episode and accepts its exact candidate', async () => {
  const jobs = [];
  const identity = loadTs('src/features/downloads/downloadIdentity.ts');
  const start = loadTs('src/features/downloads/downloadStart.ts', {
    './downloadIdentity': identity,
    './nativeDownloadEngine': { startNativeDownloadJobV1: async (input) => { jobs.push(input); return input.job.jobId; } },
    './downloadSubtitles': { resolveMobileDownloadSubtitleSourcesForNativeV1: () => [] },
  });
  const target = identity.createMobileDownloadTargetV1({ id: 1408, mediaType: 'tv', title: 'Dr. House', season: 2, episode: 1 });
  const candidate = {
    candidateId: 's2e1', sourceId: 'vixsrc', media: { ...target.media },
    preflight: { state: 'ready', requestContextReady: true, resolvedManifestKind: 'hls', requiredBytes: null },
    capabilities: { orionLibrary: true },
  };
  const input = {
    target,
    selection: { candidate, resolvedMethod: 'fragments' },
    preferences: { preferredQuality: 'best', libraryStorageTarget: { mode: 'user-folder', targetId: 'owned', writable: true, persistedPermission: true } },
  };
  await assert.rejects(start.startMobileDownloadFromSelectionV1({
    ...input, selection: { ...input.selection, candidate: { ...candidate, media: { ...candidate.media, episode: 2 } } },
  }), /another title or episode/);
  assert.equal(jobs.length, 0);
  await start.startMobileDownloadFromSelectionV1(input);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].itemKey, 'series:1408:s2:e1');
  assert.equal(jobs[0].job.candidateId, 's2e1');
});

test('111Movies A/V qualification rejects fMP4 video-only HLS before READY and proves same-authority master audio', () => {
  const broker = fs.readFileSync(path.join(mobileRoot, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt'), 'utf8');
  const hls = fs.readFileSync(path.join(mobileRoot, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpHlsGateway.kt'), 'utf8');

  assert.match(broker, /MAX_HLS_INIT_PROBE_BYTES = 64 \* 1024/);
  assert.match(broker, /OrionHlsAvComposition\.inspectIsoBmffInit\(probe\.bytes\)/);
  assert.match(broker, /stage=hls-av-composition/);
  assert.match(broker, /code = "hls-audio-track-missing"/);
  assert.match(broker, /code = "hls-primary-media-audio-only"/);
  assert.match(broker, /composition\.video && !composition\.audio && !separateAudioProven/);

  assert.match(broker, /master\.audioPlaylistUrl\?\.let \{ audioUrl ->/);
  assert.match(broker, /probeHlsAudioRendition\(context, audioUrl\)/);
  assert.match(broker, /urls\.addAll\(audioProbe\.urls\)/);
  assert.match(broker, /separateAudioProven = true/);
  assert.match(broker, /parseHlsMedia\(audioUrl, body, "audio", allowAes128 = true\)/);
  assert.match(broker, /code = "hls-audio-rendition-invalid"/);

  assert.match(hls, /internal object OrionHlsAvComposition/);
  assert.match(hls, /size >= 20L && sizeOffset \+ size <= bytes\.size\.toLong\(\)/);
  assert.match(hls, /String\(bytes, index \+ 12, 4, Charsets\.US_ASCII\)/);
  assert.match(hls, /"vide" -> video = true/);
  assert.match(hls, /"soun" -> audio = true/);
});

test('111Movies HLS audio qualification failure cannot silently fall back to same-source direct fragments', () => {
  const capture = loadTs('src/features/downloads/downloadCandidateCapture.ts', {
    'react-native': {
      DeviceEventEmitter: { addListener: () => ({ remove() {} }) },
      NativeModules: {},
      Platform: { OS: 'android' },
    },
  });
  const itemKey = 'series:teach:s1:e6';
  const candidate = (sourceId, kind, state = 'ready', reasonCode = null) => ({
    candidateId: `${sourceId}-${kind}-${reasonCode || state}`,
    sourceId,
    capturedAt: 1,
    expiry: 'stable',
    capabilities: { orionLibrary: state === 'ready', deviceStorage: false, resumable: true },
    preflight: {
      state,
      requestContextReady: state === 'ready',
      resolvedManifestKind: kind,
      protection: kind === 'hls' ? 'clear' : 'unknown',
      descendantCount: kind === 'hls' ? 100 : 0,
      reasonCode,
    },
  });
  const values = [
    { itemKey, candidate: candidate('111movies', 'hls', 'unsupported', 'hls-audio-track-missing') },
    { itemKey, candidate: candidate('111movies', 'direct') },
    { itemKey, candidate: candidate('vixsrc', 'direct') },
  ];

  assert.equal(
    capture.selectMobileDownloadCandidateForItemV1(itemKey, 'auto', values, 'orion-library', '111movies'),
    null,
  );
  assert.equal(
    capture.getMobileDownloadSourceResolutionStateV1(itemKey, '111movies', values),
    'checking',
  );
  assert.equal(
    capture.selectMobileDownloadCandidateForItemV1(itemKey, 'auto', values, 'orion-library', 'vixsrc')?.candidate?.sourceId,
    'vixsrc',
  );
});
