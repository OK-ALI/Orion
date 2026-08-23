const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P9.4 staged APK rollout uses a persistent device cohort and hidden release-note directive', () => {
  const lifecycle = read('src', 'services', 'mobileUpdateLifecycle.ts');

  assert.match(lifecycle, /orion\.mobile\.updateRolloutBucket\.v1/);
  assert.match(lifecycle, /orion-mobile-rollout/);
  assert.match(lifecycle, /percentage >= 100 \|\| bucket < percentage/);
  assert.match(lifecycle, /assets\.filter\(\(asset\) => !isAndroidApkAsset\(asset\)\)/);
  assert.match(lifecycle, /formatMobileReleaseNotesV1/);
  assert.match(lifecycle, /MOBILE_ROLLOUT_DIRECTIVE_GLOBAL/);
});

test('P9.4 release truth distinguishes latest published release from the update offered to this device', () => {
  const releaseTruth = read('src', 'services', 'mobileReleaseTruth.ts');

  assert.match(releaseTruth, /publishedTruth = resolveOrionReleaseTruthV1\(releases, channel\)/);
  assert.match(releaseTruth, /applyMobileStagedRolloutV1\(releases, rolloutBucket\)/);
  assert.match(releaseTruth, /releaseTruth = resolveOrionReleaseTruthV1\(rolloutReleases, channel\)/);
  assert.match(releaseTruth, /publishedRelease: OrionReleaseEntryV1 \| null/);
  assert.match(releaseTruth, /rollout: MobileRolloutStatusV1/);
  assert.match(releaseTruth, /hasNewerOfferedMobile/);
  assert.match(releaseTruth, /rolloutDeferred/);
});

test('P9.4 direct APK update preserves staged-rollout truth and retry without downgrade logic', () => {
  const execution = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');
  const bridge = read('src', 'services', 'nativeUpdateEngine.ts');

  assert.match(execution, /state\.result\?\.rollout\.deferred/);
  assert.match(execution, /state\.status === 'failed' \? 'Retry update' : 'Download & install'/);
  assert.match(execution, /isMobileApplicationUpdateInstallReadyV1\(state\)/);
  assert.match(bridge, /installDirectApkV1/);
  assert.doesNotMatch(bridge, /downgrade|rollbackApk|installOlder/i);
});

test('P9.4 production lifecycle retires Expo runtime actions and keeps bundled startup plus signed APK updates', () => {
  const settings = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const config = JSON.parse(read('app.json')).expo;

  assert.equal(config.updates.enabled, false);
  assert.equal(config.updates.checkAutomatically, 'NEVER');
  assert.equal(config.updates.url, undefined);
  assert.doesNotMatch(settings, /RuntimeUpdateExecutionSection|checkExpoRuntimeUpdateV1|Use recovery version|Get quick update|Restart Orion/);
});

test('P9.4 Updates surface keeps release notes visible, rollout-aware and retryable', () => {
  const settings = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const execution = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');
  const state = read('src', 'services', 'mobileApplicationUpdateState.ts');

  assert.match(settings, /formatMobileReleaseNotesV1\(published\?\.notes\)/);
  assert.match(settings, /What's new/);
  assert.match(state, /result\.rollout\.deferred/);
  assert.match(execution, /state\.result\?\.rollout\.deferred/);
  assert.match(execution, /A newer Orion version is still rolling out/);
  assert.match(settings, /appUpdateState\.status === 'failed' \? 'Try again' : 'Check for updates'/);
});
