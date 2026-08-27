'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTypeScriptModule(filePath, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
    throw new Error(`Unexpected import in P10.4 management test: ${specifier}`);
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, localRequire, module, filePath, path.dirname(filePath));
  return module.exports;
}

const repository = loadTypeScriptModule(path.join(root, 'src/features/downloads/downloadRepository.ts'), {
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null, set: () => {} } },
  './contracts': {
    isMobileDownloadJobStateV1: () => true,
    normalizeMobileDownloadProgressV1: (value) => value,
    normalizeMobileDownloadStorageTargetV1: (value) => value,
  },
});

let deleteSelectionsPayload = null;
const nativeEngine = loadTypeScriptModule(path.join(root, 'src/features/downloads/nativeDownloadEngine.ts'), {
  'react-native': {
    DeviceEventEmitter: { addListener: () => ({ remove: () => {} }) },
    NativeModules: { OrionDownloadEngine: {
      deleteAssets: async (payload) => {
        deleteSelectionsPayload = JSON.parse(payload);
        return { requestedAssetIds: [], deletedAssetIds: [], retainedAssetIds: [], reclaimedBytes: 0, failures: [], outcomes: [] };
      },
    } },
    Platform: { OS: 'android' },
  },
  './downloadRepository': {
    normalizeMobileDownloadAssetV1: (value) => value,
    normalizeMobileDownloadJobV1: (value) => value,
    normalizeMobileDownloadRepositoryV1: (value) => value,
    normalizeOfflineMediaEntryV1: (value) => value,
    writeMobileDownloadRepositoryV1: () => {},
  },
});

const media = {
  schemaVersion: 1, id: 7, mediaType: 'movie', title: 'Fixture', year: 2026,
  season: null, episode: null, libraryKind: 'movie', seriesTitle: null,
  episodeTitle: null, posterPath: null, backdropPath: null,
};
const storageTarget = { mode: 'device-storage', targetId: 'saf-test', displayName: 'Test folder', writable: true, persistedPermission: true };

function artifact(assetId, availability, bytes, subtitleBytes = 0) {
  const artifacts = [{ schemaVersion: 1, artifactId: `${assetId}:primary`, role: 'primary', displayName: `${assetId}.mp4`, mimeType: 'video/mp4', expectedSizeBytes: bytes, observedSizeBytes: bytes, availability, lastCheckedAt: 1, actions: { open: true, locate: true, delete: true } }];
  if (subtitleBytes) artifacts.push({ schemaVersion: 1, artifactId: `${assetId}:subtitle:0`, role: 'subtitle', displayName: `${assetId}.en.srt`, mimeType: 'application/x-subrip', expectedSizeBytes: subtitleBytes, observedSizeBytes: subtitleBytes, availability: 'verified', lastCheckedAt: 1, actions: { open: false, locate: false, delete: true } });
  return { schemaVersion: 1, assetId, managementToken: 'a'.repeat(64), jobId: `job-${assetId}`, media, destination: 'device-storage', storageTarget, locator: { kind: 'native-owned', value: assetId }, container: 'mp4', mimeType: 'video/mp4', verifiedSizeBytes: availability === 'verified' ? bytes + subtitleBytes : subtitleBytes, sha256: null, tracks: [], sourceId: 'fixture', playInOrion: true, externallyVisible: true, verifiedAt: 1, availability, artifacts, actions: { open: availability === 'verified', locate: availability === 'verified', delete: true } };
}

test('Completed and Stored derive only from verified owned artifacts', () => {
  const assets = [artifact('verified', 'verified', 1_000, 25), artifact('missing', 'missing', 9_000), artifact('unavailable', 'unavailable', 8_000)];
  const entries = [
    { groupKey: 'movie:verified', assetIds: ['verified'], primaryAssetId: 'verified' },
    { groupKey: 'movie:missing', assetIds: ['missing'], primaryAssetId: 'missing' },
    { groupKey: 'movie:unavailable', assetIds: ['unavailable'], primaryAssetId: 'unavailable' },
  ];
  assert.deepEqual(repository.deriveMobileDownloadLibrarySummaryV1(assets, entries), {
    completedTitleCount: 1,
    storedBytes: 1_025,
    needsAttentionCount: 2,
  });
});

test('one verified copy keeps an item completed while a missing copy needs attention', () => {
  const assets = [artifact('library', 'verified', 500), artifact('portable', 'missing', 500)];
  const entries = [{ groupKey: 'movie:fixture', assetIds: ['library', 'portable'], primaryAssetId: 'library' }];
  assert.deepEqual(repository.deriveMobileDownloadLibrarySummaryV1(assets, entries), {
    completedTitleCount: 1,
    storedBytes: 500,
    needsAttentionCount: 1,
  });
});

test('legacy assets synthesize only a checking primary and hide their locator', () => {
  const normalized = repository.normalizeMobileDownloadAssetV1({
    schemaVersion: 1, assetId: 'legacy', jobId: 'job-legacy', media,
    destination: 'device-storage', storageTarget,
    locator: { kind: 'content-uri', value: 'content://private/document' },
    container: 'mp4', mimeType: 'video/mp4', verifiedSizeBytes: 700,
    sha256: null, tracks: [], sourceId: 'fixture', playInOrion: true,
    externallyVisible: true, verifiedAt: 1,
  });
  assert.equal(normalized.locator.kind, 'native-owned');
  assert.equal(normalized.locator.value, 'legacy');
  assert.equal(normalized.availability, 'checking');
  assert.equal(normalized.verifiedSizeBytes, 0);
  assert.equal(normalized.artifacts.length, 1);
  assert.equal(normalized.artifacts[0].role, 'primary');
  assert.equal(normalized.managementToken, '');
});

test('management UI routes all destructive and artifact actions through ID-only native methods', () => {
  const sheet = fs.readFileSync(path.join(root, 'src/features/downloads/DownloadManagementSheet.tsx'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'src/features/downloads/nativeDownloadEngine.ts'), 'utf8');
  const module = fs.readFileSync(path.join(root, 'plugins/orion-cinema-webview-native/OrionDownloadEngineModule.kt'), 'utf8');
  const manager = fs.readFileSync(path.join(root, 'plugins/orion-cinema-webview-native/OrionDownloadArtifactManager.kt'), 'utf8');
  assert.match(sheet, /deleteNativeDownloadAssetsV1/);
  assert.match(sheet, /deleteAllNativeDownloadsV1/);
  assert.match(sheet, /removeUnavailableNativeDownloadRecordsV1/);
  assert.match(sheet, /Remove from Orion/);
  assert.match(sheet, /Conclusions?ly missing|Conclusively missing/);
  assert.doesNotMatch(sheet, /Remove stale record/);
  assert.match(sheet, /Play Locally/);
  assert.match(sheet, /playNativeDownloadAssetLocallyV1/);
  assert.match(sheet, /Locate/);
  assert.match(sheet, /legacy copies have no exact subtitle ownership record/);
  assert.match(sheet, /interface ConfirmationSnapshot/);
  assert.match(sheet, /source\.map\(snapshotAsset\)/);
  assert.match(sheet, /managementToken: asset\.managementToken/);
  assert.match(bridge, /removeUnavailableRecords\(JSON\.stringify/);
  assert.match(bridge, /schemaVersion: 1,[\s\S]*selections: \[\.\.\.unique\.values\(\)\]/);
  assert.match(module, /OrionDownloadArtifactManager\.deleteSelected/);
  assert.match(manager, /expectedSelections/);
  assert.match(manager, /asset-selection-stale/);
  assert.match(manager, /fun deleteAll/);
  const offlinePlaybackBoundary = bridge.indexOf('export interface NativeOfflinePlaybackSourceV1');
  assert.ok(offlinePlaybackBoundary > 0, 'offline playback boundary should remain explicit');
  const managementBridge = bridge.slice(0, offlinePlaybackBoundary);
  assert.doesNotMatch(managementBridge, /file:\/\/|content:\/\//);
});

test('Delete Selected sends only the exact deduplicated confirmation snapshot', async () => {
  const tokenA = 'a'.repeat(64);
  const tokenB = 'b'.repeat(64);
  await nativeEngine.deleteNativeDownloadAssetsV1([
    { assetId: 'B', managementToken: tokenB },
    { assetId: 'B', managementToken: tokenB },
    { assetId: 'A', managementToken: tokenA },
  ]);
  assert.deepEqual(deleteSelectionsPayload, {
    schemaVersion: 1,
    selections: [
      { assetId: 'B', managementToken: tokenB },
      { assetId: 'A', managementToken: tokenA },
    ],
  });
});

test('management results normalize only known truthful dispositions', () => {
  const result = nativeEngine.normalizeManagementResult({
    requestedAssetIds: ['deleted', 'missing', 'unavailable'],
    deletedAssetIds: ['deleted', 'missing'],
    retainedAssetIds: ['unavailable'],
    reclaimedBytes: 500,
    failures: [{ assetId: 'unavailable', artifactId: 'primary', code: 'artifact-delete-unavailable', message: 'Access unavailable.' }],
    outcomes: [
      { assetId: 'deleted', disposition: 'physically-deleted' },
      { assetId: 'missing', disposition: 'already-missing' },
      { assetId: 'unavailable', disposition: 'retained-unavailable' },
      { assetId: 'invalid', disposition: 'invented' },
    ],
  });
  assert.deepEqual(result.outcomes, [
    { assetId: 'deleted', disposition: 'physically-deleted' },
    { assetId: 'missing', disposition: 'already-missing' },
    { assetId: 'unavailable', disposition: 'retained-unavailable' },
  ]);
  assert.equal(
    nativeEngine.formatNativeDownloadManagementResultV1(result, (bytes) => `${bytes} B`),
    '1 deleted, 1 already absent, 1 kept · 500 B reclaimed. Access unavailable.',
  );
});

test('metadata-only unavailable cleanup never implies physical deletion', () => {
  const result = nativeEngine.normalizeManagementResult({
    requestedAssetIds: ['unavailable'],
    deletedAssetIds: ['unavailable'],
    retainedAssetIds: [],
    reclaimedBytes: 0,
    failures: [],
    outcomes: [{ assetId: 'unavailable', disposition: 'removed-from-orion' }],
  });
  assert.equal(
    nativeEngine.formatNativeDownloadManagementResultV1(result, (bytes) => `${bytes} B`),
    '1 removed from Orion · 0 B reclaimed. Physical deletion was not confirmed for records removed from Orion.',
  );
});
