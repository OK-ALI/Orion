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
  assert.match(modal, /!selectedCandidate \? \([\s\S]{0,220}Choose a source/);
  assert.doesNotMatch(modal, /sourceResolutionFailure && !selectedCandidate \? \([\s\S]{0,220}Try a specific source/);
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
