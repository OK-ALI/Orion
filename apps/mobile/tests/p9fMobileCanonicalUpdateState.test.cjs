const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobileRoot = path.resolve(__dirname, '..');
const readMobile = (relativePath) => fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');

test('P9-F5 Mobile owns one canonical application-update state across release, Android environment, and native execution', () => {
  const state = readMobile('src/services/mobileApplicationUpdateState.ts');

  assert.match(state, /checkMobileReleaseTruthV1/);
  assert.match(state, /getAndroidUpdateEnvironmentV1/);
  assert.match(state, /Promise\.allSettled/);
  assert.match(state, /result\.integrity\.status !== 'ready'/);
  assert.match(state, /!environment\.productionSignerMatched \|\| !environment\.requestInstallPackagesDeclared/);
  assert.match(state, /!environment\.canRequestPackageInstalls/);
  assert.match(state, /return 'permission-required'/);
  assert.match(state, /return 'available'/);
  assert.match(state, /engineState === 'downloading'/);
  assert.match(state, /engineState === 'verifying'/);
  assert.match(state, /engineState === 'installing'/);
  assert.match(state, /publishMobileApplicationUpdateEngineEventV1/);
  assert.match(state, /isMobileApplicationUpdateInstallReadyV1/);
  assert.match(state, /checkSequence/);
  assert.doesNotMatch(state, /expoRuntimeUpdates|checkExpoRuntimeUpdateV1/);
});

test('P9-F5 Settings summary, App updates badge, announcement, and automatic check consume the canonical owner', () => {
  const settings = readMobile('src/features/settings/UpdatesSettingsContent.tsx');
  const execution = readMobile('src/features/settings/MobileUpdateExecutionSection.tsx');
  const coordinator = readMobile('src/features/notifications/MobileNotificationCoordinator.tsx');
  const announcement = readMobile('src/services/mobileUpdateAnnouncement.ts');

  assert.match(settings, /subscribeMobileApplicationUpdateStateV1\(setAppUpdateState\)/);
  assert.match(settings, /checkMobileApplicationUpdateStateV1\(nextChannel\)/);
  assert.match(settings, /getMobileApplicationUpdatePresentationV1\(appUpdateState\)/);
  assert.match(settings, /<MobileUpdateExecutionSection state=\{appUpdateState\} \/>/);
  assert.doesNotMatch(settings, /checkMobileReleaseTruthV1/);

  assert.match(execution, /getMobileApplicationUpdatePresentationV1\(state\)/);
  assert.match(execution, /refreshMobileApplicationUpdateEnvironmentV1/);
  assert.match(execution, /publishMobileApplicationUpdateEngineEventV1/);
  assert.match(execution, /isMobileApplicationUpdateInstallReadyV1\(state\)/);
  assert.doesNotMatch(execution, /getAndroidUpdateEnvironmentV1/);

  assert.match(coordinator, /checkMobileApplicationUpdateStateV1\(getMobileUpdateChannelV1\(\)\)/);
  assert.doesNotMatch(coordinator, /checkMobileReleaseTruthV1/);
  assert.match(coordinator, /updateState\.status === 'failed'/);
  assert.match(coordinator, /UPDATE_FAILURE_RETRY_MS/);

  assert.match(announcement, /subscribeMobileApplicationUpdateStateV1\(syncFromApplicationUpdateState\)/);
  assert.match(announcement, /state\.status === 'available'/);
  assert.match(announcement, /state\.status === 'permission-required'/);
});

test('P9-F5 exposes one App Updates surface after Expo runtime retirement', () => {
  const settings = readMobile('src/features/settings/UpdatesSettingsContent.tsx');
  const execution = readMobile('src/features/settings/MobileUpdateExecutionSection.tsx');
  const banner = readMobile('src/features/updates/MobileUpdateAnnouncementBanner.tsx');
  const state = readMobile('src/services/mobileApplicationUpdateState.ts');

  assert.match(settings, /appPresentation/);
  assert.match(execution, /presentation\.label/);
  assert.match(state, /label: 'Update ready'/);
  assert.match(state, /label: 'Permission needed'/);
  assert.match(state, /label: 'Unavailable'/);
  assert.match(state, /label: 'Downloading'/);
  assert.match(banner, /announcement\.installState === 'permission-required'/);
  assert.doesNotMatch(settings, /checkExpoRuntimeUpdateV1|RuntimeUpdateExecutionSection|runtimeStatus|Quick update|Recovery/);
});
