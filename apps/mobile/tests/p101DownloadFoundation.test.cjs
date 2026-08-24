'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ts = require('typescript');

function loadTypeScriptModule(filePath, mocks = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
    throw new Error(`Unexpected runtime import in P10.1 test: ${specifier}`);
  };
  const factory = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  factory(module.exports, localRequire, module, filePath, path.dirname(filePath));
  return module.exports;
}

function createMemoryStorage() {
  const values = new Map();
  return {
    values,
    adapter: {
      get(key) { return values.has(key) ? values.get(key) : null; },
      set(key, value) { values.set(key, value); },
    },
  };
}

function createRuntimeJob(overrides = {}) {
  return {
    schemaVersion: 1,
    jobId: 'job-1',
    candidateId: 'candidate-1',
    media: {
      schemaVersion: 1,
      id: 42,
      mediaType: 'tv',
      title: 'Orion Test',
      year: 2026,
      season: 1,
      episode: 2,
      libraryKind: 'series',
      seriesTitle: 'Orion Test',
      episodeTitle: 'Episode 2',
      posterPath: null,
      backdropPath: null,
    },
    destination: 'orion-library',
    storageTarget: {
      mode: 'orion-library',
      targetId: 'managed:test',
      displayName: 'Orion Library',
      writable: true,
      persistedPermission: true,
    },
    requestedQuality: '720p',
    selectedSubtitleAssetIds: ['sub-1'],
    state: 'downloading',
    progress: {
      bytesDownloaded: 100,
      totalBytes: 100,
      completedFragments: null,
      totalFragments: null,
      percent: 100,
      bytesPerSecond: 50,
      etaSeconds: 0,
    },
    retryCount: 0,
    recoveryCount: 0,
    failure: null,
    createdAt: 1,
    updatedAt: 2,
    startedAt: 1,
    completedAt: null,
    ...overrides,
  };
}

const mobileRoot = path.resolve(__dirname, '..');
const sharedRoot = path.resolve(mobileRoot, '..', '..', 'packages', 'shared');
const readMobile = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');
const readShared = (...parts) => fs.readFileSync(path.join(sharedRoot, ...parts), 'utf8');

test('P10.1 adds explicit versioned Mobile download contracts without mutating legacy download records', () => {
  const contracts = readShared('src', 'types', 'mobileDownloads.ts');
  const exports = readShared('src', 'types', 'index.ts');
  const legacy = readShared('src', 'types', 'media.ts');

  for (const contract of [
    'MobileDownloadCandidateV1',
    'MobileDownloadJobV1',
    'MobileDownloadAssetV1',
    'OfflineMediaEntryV1',
  ]) {
    assert.match(contracts, new RegExp(`interface ${contract}`));
  }
  assert.match(contracts, /schemaVersion: 1/);
  assert.match(exports, /export \* from "\.\/mobileDownloads"/);
  assert.match(legacy, /interface DownloadRecord/);
  assert.doesNotMatch(contracts, /cookies?|authorization|signedUrl|requestHeaders|rawHeaders/i);
});

test('P10.1 durable repository and preferences use restart-safe MMKV-owned schemas', () => {
  const repository = readMobile('src', 'features', 'downloads', 'downloadRepository.ts');
  const preferences = readMobile('src', 'features', 'downloads', 'downloadPreferences.ts');

  assert.match(repository, /orion\.mobile\.downloads\.repository\.v1/);
  assert.match(repository, /normalizeMobileDownloadRepositoryV1/);
  assert.match(repository, /normalizeMobileDownloadJobV1/);
  assert.match(repository, /normalizeMobileDownloadAssetV1/);
  assert.match(repository, /normalizeOfflineMediaEntryV1/);
  assert.doesNotMatch(repository, /filter\(isVersionOneRecord\) as/);
  assert.match(repository, /field-by-field/);
  assert.match(repository, /mmkvStorageAdapter\.get/);
  assert.match(repository, /mmkvStorageAdapter\.set/);
  assert.match(repository, /jobs: \[\]/);
  assert.match(repository, /assets: \[\]/);
  assert.match(repository, /offlineEntries: \[\]/);

  assert.match(preferences, /orion\.mobile\.downloads\.preferences\.v1/);
  assert.match(preferences, /defaultDestination: 'orion-library'/);
  assert.match(preferences, /'device-storage'/);
  assert.match(preferences, /preferredQuality: 'best'/);
  assert.match(preferences, /subtitlePreference: 'preferred'/);
});

test('P10.1 preserves exact TV episode identity instead of a boolean-only modal state', () => {
  const identity = readMobile('src', 'features', 'downloads', 'downloadIdentity.ts');
  const detail = readMobile('src', 'features', 'media-detail', 'MediaDetailScreen.tsx');
  const modal = readMobile('src', 'components', 'DownloadModal.tsx');

  assert.match(identity, /groupKey/);
  assert.match(identity, /itemKey/);
  assert.match(identity, /season/);
  assert.match(identity, /episode/);
  assert.match(identity, /episodeTitle/);
  assert.match(detail, /MobileDownloadTargetV1 \| null/);
  assert.match(detail, /season: selectedSeason/);
  assert.match(detail, /episode: ep\.episode_number/);
  assert.match(detail, /episodeTitle: ep\.name/);
  assert.doesNotMatch(detail, /showDownloadModal/);
  assert.match(modal, /target: MobileDownloadTargetV1 \| null/);
});

test('P10.4C activates dual destination selection only through the Android-owned SAF finalizer', () => {
  const architecture = readMobile('src', 'features', 'settings', 'settingsArchitecture.ts');
  const settings = readMobile('app', '(tabs)', 'settings.tsx');
  const downloadSettings = readMobile('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');
  const manager = readMobile('src', 'services', 'downloadManager.ts');
  const modal = readMobile('src', 'components', 'DownloadModal.tsx');

  assert.match(architecture, /id: 'downloads', label: 'Downloads', status: 'active'/);
  assert.match(settings, /<DownloadSettingsContent \/>/);
  assert.match(downloadSettings, />Orion Library</);
  assert.match(downloadSettings, />Device Storage</);
  assert.match(downloadSettings, /chooseNativeDeviceStorageTargetV1/);
  assert.match(downloadSettings, /setMobileDownloadDefaultDestinationV1\('device-storage'\)/);
  assert.match(downloadSettings, />Preferred quality</);
  assert.match(downloadSettings, />Subtitles</);
  assert.doesNotMatch(downloadSettings, /notification/i);

  // Device Storage stays behind the real Android native engine and SAF picker.
  assert.match(manager, /isNativeDownloadEngineAvailableV1/);
  assert.match(manager, /MOBILE_DOWNLOADER_AVAILABLE = isNativeDownloadEngineAvailableV1\(\)/);
  assert.match(manager, /state: 'waiting-for-engine'/);
  assert.match(manager, /state: 'ready'/);
  assert.match(modal, /!capability\.available/);
  assert.match(modal, /const subtitleCheckPending =/);
  assert.match(modal, /disabled=\{needsEpisode \|\| starting \|\| subtitleCheckPending \|\| !capability\.available\}/);
  assert.doesNotMatch(manager, /setInterval|Math\.random/);
});

test('P10.1 extends Phase 9 Notifications with Downloads alerts and no parallel settings toggle', () => {
  const service = readMobile('src', 'services', 'mobileNotifications.ts');
  const notificationSettings = readMobile('src', 'features', 'settings', 'NotificationSettingsContent.tsx');
  const responseRouter = readMobile('src', 'features', 'notifications', 'MobileNotificationResponseRouter.tsx');
  const downloadSettings = readMobile('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');

  assert.match(service, /\| 'downloads'/);
  assert.match(service, /label: 'Downloads'/);
  assert.match(service, /description: 'Completion and problem alerts\.'/);
  assert.match(service, /orion-downloads/);
  assert.match(notificationSettings, /'downloads'/);
  assert.match(responseRouter, /target\.target === 'downloads'/);
  assert.match(responseRouter, /\/(tabs)\/downloads|\(tabs\)\/downloads/);
  assert.doesNotMatch(downloadSettings, /Notifications|notification toggle|completion and problem alerts/i);
});

test('P10.1 replaces engineering-only Downloads copy with Orion product foundation', () => {
  const screen = readMobile('app', '(tabs)', 'downloads.tsx');
  const modal = readMobile('src', 'components', 'DownloadModal.tsx');

  assert.match(screen, /MobilePageHeader/);
  assert.match(screen, /Your offline library starts here/);
  assert.match(screen, /Orion Library/);
  assert.match(screen, /DownloadActivityList/);
  assert.match(screen, /subscribeMobileDownloadRepositoryV1/);
  assert.doesNotMatch(screen, /STABILIZATION BOUNDARY|Protected and segmented streams require|engineering/i);
  assert.doesNotMatch(modal, /LOCKED DURING STABILIZATION|native downloader research/i);
});


test('P10.1 canonical state model and progress snapshot enforce truthful completion', () => {
  const contracts = readMobile('src', 'features', 'downloads', 'contracts.ts');

  assert.match(contracts, /MOBILE_DOWNLOAD_ALLOWED_TRANSITIONS_V1/);
  assert.match(contracts, /canTransitionMobileDownloadJobStateV1/);
  assert.match(contracts, /completed: transitions\(\)/);
  assert.match(contracts, /createMobileDownloadProgressSnapshotV1/);
  assert.match(contracts, /job\.state === 'completed'/);
  assert.match(contracts, /Math\.min\(99, progress\.percent\)/);
  assert.doesNotMatch(contracts, /return \{\s*\.\.\.job/);
  assert.doesNotMatch(contracts, /requestContextId|cookie|authorization|signedUrl|requestHeaders|rawHeaders/i);
});

test('P10.1 persistence boundary strips unknown hitchhiker fields before durable state', () => {
  const repository = readMobile('src', 'features', 'downloads', 'downloadRepository.ts');
  const preferences = readMobile('src', 'features', 'downloads', 'downloadPreferences.ts');

  assert.match(repository, /Every accepted V1 record is rebuilt field-by-field/);
  assert.match(repository, /jobs: Array\.isArray\(input\.jobs\)[\s\S]*map\(normalizeMobileDownloadJobV1\)/);
  assert.match(repository, /assets: Array\.isArray\(input\.assets\)[\s\S]*map\(normalizeMobileDownloadAssetV1\)/);
  assert.match(repository, /offlineEntries: Array\.isArray\(input\.offlineEntries\)[\s\S]*map\(normalizeOfflineMediaEntryV1\)/);
  assert.match(preferences, /normalizeMobileDownloadStorageTargetV1/);
  assert.doesNotMatch(repository, /\\.\\.\\.input|\\.\\.\\.value/);
});

test('P10.1 Downloads surfaces consume established theme and responsive owners', () => {
  const screen = readMobile('app', '(tabs)', 'downloads.tsx');
  const modal = readMobile('src', 'components', 'DownloadModal.tsx');
  const settings = readMobile('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');
  const themeContext = readMobile('src', 'context', 'ThemeContext.tsx');

  assert.match(screen, /useOrionTheme/);
  assert.match(screen, /useResponsiveLayout/);
  assert.match(modal, /useOrionTheme/);
  assert.match(modal, /useResponsiveLayout/);
  assert.match(settings, /useOrionTheme/);

  for (const themeId of ['midnight-premiere', 'amoled', 'mocha', 'slate', 'projector-silver', 'custom']) {
    assert.match(themeContext, new RegExp(themeId));
  }
});


test('P10.1 runtime state model and progress presentation stay truthful', () => {
  const contractsPath = path.join(mobileRoot, 'src', 'features', 'downloads', 'contracts.ts');
  const contracts = loadTypeScriptModule(contractsPath);

  assert.equal(contracts.canTransitionMobileDownloadJobStateV1('downloading', 'verifying'), true);
  assert.equal(contracts.canTransitionMobileDownloadJobStateV1('completed', 'queued'), false);

  const active = contracts.createMobileDownloadProgressSnapshotV1(createRuntimeJob());
  assert.equal(active.percent, 99);
  assert.equal(active.isComplete, false);
  assert.equal(active.statusLabel, 'Downloading');

  const completed = contracts.createMobileDownloadProgressSnapshotV1(createRuntimeJob({
    state: 'completed',
    completedAt: 3,
  }));
  assert.equal(completed.percent, 100);
  assert.equal(completed.isComplete, true);
});

test('P10.1 repository survives module restart and strips unknown sensitive hitchhiker fields', () => {
  const contractsPath = path.join(mobileRoot, 'src', 'features', 'downloads', 'contracts.ts');
  const repositoryPath = path.join(mobileRoot, 'src', 'features', 'downloads', 'downloadRepository.ts');
  const contracts = loadTypeScriptModule(contractsPath);
  const storage = createMemoryStorage();
  const mocks = {
    '../../services/storageAdapter': { mmkvStorageAdapter: storage.adapter },
    './contracts': contracts,
  };
  const loadRepository = () => loadTypeScriptModule(repositoryPath, mocks);

  const firstProcess = loadRepository();
  const job = createRuntimeJob({ authorization: 'Bearer secret', signedUrl: 'https://secret.invalid' });
  firstProcess.writeMobileDownloadRepositoryV1({
    schemaVersion: 1,
    jobs: [job],
    assets: [],
    offlineEntries: [],
    updatedAt: 0,
  });

  const persisted = storage.values.get(firstProcess.MOBILE_DOWNLOAD_REPOSITORY_KEY_V1);
  assert.equal(typeof persisted, 'string');
  assert.doesNotMatch(persisted, /Bearer secret|secret\.invalid|authorization|signedUrl/i);

  const secondProcess = loadRepository();
  const restored = secondProcess.readMobileDownloadRepositoryV1();
  assert.equal(restored.jobs.length, 1);
  assert.equal(restored.jobs[0].jobId, 'job-1');
  assert.equal(restored.jobs[0].progress.percent, 100);
  assert.equal(Object.prototype.hasOwnProperty.call(restored.jobs[0], 'authorization'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(restored.jobs[0], 'signedUrl'), false);

  storage.values.set(secondProcess.MOBILE_DOWNLOAD_REPOSITORY_KEY_V1, JSON.stringify({
    schemaVersion: 2,
    jobs: [job],
    assets: [],
    offlineEntries: [],
    updatedAt: 4,
  }));
  const futureSchemaProcess = loadRepository();
  assert.deepEqual(futureSchemaProcess.readMobileDownloadRepositoryV1().jobs, []);
});

test('P10.1 download preferences survive module restart and future schemas fail closed to defaults', () => {
  const contractsPath = path.join(mobileRoot, 'src', 'features', 'downloads', 'contracts.ts');
  const preferencesPath = path.join(mobileRoot, 'src', 'features', 'downloads', 'downloadPreferences.ts');
  const contracts = loadTypeScriptModule(contractsPath);
  const storage = createMemoryStorage();
  const mocks = {
    '../../services/storageAdapter': { mmkvStorageAdapter: storage.adapter },
    './contracts': contracts,
  };
  const loadPreferences = () => loadTypeScriptModule(preferencesPath, mocks);

  const firstProcess = loadPreferences();
  firstProcess.setMobileDownloadDeviceStorageTargetV1({
    mode: 'device-storage',
    targetId: 'saf:downloads',
    displayName: 'Downloads',
    writable: true,
    persistedPermission: true,
  });
  firstProcess.setMobileDownloadDefaultDestinationV1('device-storage');
  firstProcess.setMobileDownloadPreferredQualityV1('1080p');
  firstProcess.setMobileDownloadSubtitlePreferenceV1('none');

  const secondProcess = loadPreferences();
  const restored = secondProcess.getMobileDownloadPreferencesV1();
  assert.equal(restored.defaultDestination, 'device-storage');
  assert.equal(restored.deviceStorageTarget.targetId, 'saf:downloads');
  assert.equal(restored.preferredQuality, '1080p');
  assert.equal(restored.subtitlePreference, 'none');

  storage.values.set(secondProcess.MOBILE_DOWNLOAD_PREFERENCES_KEY_V1, JSON.stringify({
    schemaVersion: 2,
    defaultDestination: 'device-storage',
  }));
  const futureSchemaProcess = loadPreferences();
  assert.deepEqual(futureSchemaProcess.getMobileDownloadPreferencesV1(), {
    schemaVersion: 1,
    defaultDestination: 'orion-library',
    deviceStorageTarget: null,
    preferredQuality: 'best',
    subtitlePreference: 'preferred',
  });
});

test('P10.4 Downloads surface projects media-first identity, native transfer truth and dual-storage readiness', () => {
  const screen = readMobile('app', '(tabs)', 'downloads.tsx');
  const activity = readMobile('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const preferences = readMobile('src', 'features', 'downloads', 'downloadPreferences.ts');

  assert.match(screen, /listMobileDownloadAssetsV1/);
  assert.match(screen, />Stored</);
  assert.match(screen, /Device Storage creates a verified portable MP4/);
  assert.match(activity, /createMobileDownloadProgressSnapshotV1/);
  assert.match(activity, /imgUrl/);
  assert.match(activity, /posterPath/);
  assert.match(activity, /episodeTitle/);
  assert.match(activity, /groupKey/);
  assert.match(activity, /Search downloads/);
  for (const label of ['All', 'Active', 'Completed', 'Failed', 'Movies', 'Series', 'Newest', 'Oldest', 'Name', 'Progress', 'Size']) {
    assert.match(activity, new RegExp(label));
  }
  assert.match(activity, /bytesPerSecond/);
  assert.match(activity, /etaSeconds/);
  assert.match(activity, /completedFragments/);
  assert.match(activity, /elapsed/);
  assert.match(preferences, /input\.defaultDestination === 'device-storage' && deviceStorageTarget/);
});
