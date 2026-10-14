'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { mobileReleasePayload, signedEnvelope, APK_NAME, SIGNER } = require('../scripts/create-mobile-release-manifests.cjs');
const prefix = 'apps/mobile/src/features/glimpse/';
test('public Glimpse admits the qualified release while the internal switch remains closed', () => {
  const saved = global.__DEV__;
  try {
    global.__DEV__ = false;
    const build = loader()(prefix + 'glimpseBuild.ts');
    assert.equal(build.GLIMPSE_INTERNAL_PREVIEW, false);
    assert.equal(build.GLIMPSE_PRODUCTION_ENABLED, true);
    assert.equal(loader()(prefix + 'glimpsePreview.ts').isGlimpsePreviewEnabled(), true);
    assert.equal(loader({ './glimpseBuild': { GLIMPSE_PRODUCTION_ENABLED: false, GLIMPSE_INTERNAL_PREVIEW: false } })(prefix + 'glimpsePreview.ts').isGlimpsePreviewEnabled(), false);
  } finally { if (saved === undefined) delete global.__DEV__; else global.__DEV__ = saved; }
});
test('the public build cannot reset Welcome or arm feedback acknowledgement loss', () => {
  const fail = () => { throw Error('Internal qualification must not touch storage'); };
  const load = loader({ '../../services/storageAdapter': { mmkvStorageAdapter: { get: fail, set: fail } } });
  const welcome = load('apps/mobile/src/features/releaseWelcome/welcomeQualification.ts');
  assert.equal(welcome.qualificationEnabled(), false);
  assert.equal(welcome.resetWelcomeQualification('public-probe'), false);
  const feedback = load('apps/mobile/src/features/feedback/feedbackQualification.ts');
  assert.equal(feedback.armFeedbackAckLoss('public-probe'), false);
  assert.equal(feedback.consumeFeedbackAckLoss(), false);
});
test('public ambient capture retains playing, profile and teardown guards without the internal flag', async () => {
  const h = hookHarness(), calls = [], stops = [];
  const native = { sample: (id, session) => { calls.push({ id, session }); return new Promise(() => {}); }, stop: async session => stops.push(session) };
  const hook = loader({ react: h.react, 'react-native': { Platform: { OS: 'android' } },
    'expo-modules-core': { requireOptionalNativeModule: () => native } })(prefix + 'useGlimpseAmbientSampler.ts').useGlimpseAmbientSampler;
  let playing = true, profile = 'balanced';
  h.start(() => hook('orion-glimpse:public', 'public', playing, profile, false, () => {}));
  assert.equal(calls.length, 1);
  playing = false; h.update(); assert.deepEqual(stops, ['public']);
  playing = true; profile = 'efficiency'; h.update(); assert.equal(calls.length, 1);
  profile = 'quality'; h.update(); assert.equal(calls.length, 2); h.dispose(); assert.equal(stops.length, 2);
});
test('Mobile release identity leaves root, Desktop and dependency versions intact', () => {
  const app = JSON.parse(read('apps/mobile/app.json')).expo;
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(app.version, '4.0.0'); assert.equal(app.android.versionCode, 60); assert.equal(app.android.package, 'com.okali.orion');
  assert.equal(JSON.parse(read('apps/mobile/package.json')).version, app.version);
  assert.equal(lock.packages['apps/mobile'].version, app.version);
  assert.equal(lock.version, '3.2.1'); assert.equal(lock.packages[''].version, '3.2.1');
  assert.equal(JSON.parse(read('apps/desktop/package.json')).version, '3.2.1');
  assert.match(read('apps/mobile/android/app/build.gradle'), /versionCode 60/);
  assert.match(read('apps/mobile/android/app/build.gradle'), /versionName "4.0.0"/);
});
const verified = () => ({ name: APK_NAME, package: 'com.okali.orion', versionName: '4.0.0', versionCode: 60,
  signerSha256: SIGNER, apkSha256: 'a'.repeat(64), sourceHead: 'b'.repeat(40), size: 100,
  dirtySource: false, physicalUpgradePassed: true });
test('Mobile-only metadata requires exact qualified identity and rejects incomplete or substituted artifacts', () => {
  const payload = mobileReleasePayload(verified(), 1, '2026-10-14T12:00:00Z');
  assert.equal(payload.artifacts.length, 1); assert.equal(payload.artifacts[0].platform, 'android');
  assert.equal(payload.minimumUpdaterVersion, '3.2.0');
  for (const patch of [{ package: 'other' }, { versionCode: 59 }, { signerSha256: 'a'.repeat(64) },
    { dirtySource: true }, { physicalUpgradePassed: false }, { name: 'test.apk' }, { size: 0 }, { apkSha256: 'bad' }]) {
    assert.throws(() => mobileReleasePayload({ ...verified(), ...patch }, 1, '2026-10-14T12:00:00Z'));
  }
  assert.throws(() => mobileReleasePayload(verified(), 0, 'invalid'));
});
test('release metadata signing rejects a different Ed25519 authority', () => {
  const { privateKey } = require('node:crypto').generateKeyPairSync('ed25519');
  assert.throws(() => signedEnvelope(mobileReleasePayload(verified(), 1, '2026-10-14T12:00:00Z'), privateKey), /authority mismatch/);
});

test('the generated native release configuration remains exact, including identity and signing', () => {
  const { assertMobileGeneratedIntegration } = require('../scripts/mobile-release-integrations.cjs');
  const gradle = read('apps/mobile/android/app/build.gradle');
  assert.doesNotThrow(() => assertMobileGeneratedIntegration('apps/mobile/android/app/build.gradle', gradle));
  assert.throws(() => assertMobileGeneratedIntegration('apps/mobile/android/app/build.gradle', gradle.replace('versionCode 60', 'versionCode 59')));
  assert.throws(() => assertMobileGeneratedIntegration('apps/mobile/android/app/build.gradle', gradle.replace('signingConfig signingConfigs.release', 'signingConfig signingConfigs.debug')));
  assert.throws(() => assertMobileGeneratedIntegration('unreviewed', gradle));
});
