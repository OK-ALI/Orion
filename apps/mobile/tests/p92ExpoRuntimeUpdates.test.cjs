const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '../..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const readRepo = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('P9 retirement disables Expo runtime updates and removes remote runtime routing', () => {
  const config = JSON.parse(read('app.json')).expo;

  assert.equal(config.updates.enabled, false);
  assert.equal(config.updates.checkAutomatically, 'NEVER');
  assert.equal(config.updates.fallbackToCacheTimeout, 0);
  assert.equal(config.updates.useEmbeddedUpdate, true);
  assert.equal(config.runtimeVersion, 'orion-mobile-native-r1');
  assert.equal(config.updates.url, undefined);
  assert.equal(config.updates.requestHeaders, undefined);
});

test('P9 retirement removes Quick Updates and Recovery from the production Settings surface', () => {
  const settings = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');

  assert.match(settings, /<MobileUpdateExecutionSection state=\{appUpdateState\} \/>/);
  assert.doesNotMatch(settings, /RuntimeUpdateExecutionSection/);
  assert.doesNotMatch(settings, /checkExpoRuntimeUpdateV1|setExpoRuntimeUpdateChannelV1|getExpoRuntimeUpdateStatusV1/);
  assert.doesNotMatch(settings, /Quick update|Quick Updates|recovery version|runtimeStatus/);
  assert.equal(fs.existsSync(path.join(root, 'src', 'services', 'expoRuntimeUpdates.ts')), false);
  assert.equal(fs.existsSync(path.join(root, 'src', 'features', 'settings', 'RuntimeUpdateExecutionSection.tsx')), false);
});

test('P9 retirement makes the local Android builder fail closed on Expo runtime enablement', () => {
  const standalone = read('scripts', 'build-android-standalone.cjs');
  const manifest = read('android', 'app', 'src', 'main', 'AndroidManifest.xml');

  assert.match(standalone, /ensureExpoRuntimeUpdatesRetired/);
  assert.match(standalone, /Expo runtime updates retired; production will boot only the bundled app runtime/);
  assert.match(standalone, /updates\.enabled !== false/);
  assert.match(standalone, /updates\.checkAutomatically !== "NEVER"/);
  assert.match(standalone, /removeAndroidMetaData\(manifest, "expo\.modules\.updates\.EXPO_UPDATE_URL"\)/);
  assert.match(manifest, /expo\.modules\.updates\.ENABLED" android:value="false"/);
  assert.match(manifest, /expo\.modules\.updates\.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="NEVER"/);
  assert.doesNotMatch(manifest, /expo\.modules\.updates\.EXPO_UPDATE_URL/);
  assert.doesNotMatch(manifest, /UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY/);
});

test('P9 retirement removes the Expo patch lifecycle while retaining the dependency for the first bridge', () => {
  const rootPackage = JSON.parse(readRepo('package.json'));
  const mobilePackage = JSON.parse(read('package.json'));

  assert.equal(rootPackage.scripts?.['patch:expo-updates'], undefined);
  assert.equal(rootPackage.scripts?.postinstall, undefined);
  assert.equal(fs.existsSync(path.join(repoRoot, 'scripts', 'patch-expo-updates-embedded-registration.cjs')), false);
  assert.equal(fs.existsSync(path.join(root, 'tests', 'p9fExpoEmbeddedRegistration.test.cjs')), false);
  assert.equal(mobilePackage.dependencies['expo-updates'], '~57.0.19');
});

test('P9 retirement removes EAS Update channel bindings from build profiles', () => {
  const eas = JSON.parse(read('eas.json'));
  assert.equal(eas.build.preview.channel, undefined);
  assert.equal(eas.build.production.channel, undefined);
});

test('P9 retirement keeps transitional bundled-manifest generation only as packaging compatibility', () => {
  const standalone = read('scripts', 'build-android-standalone.cjs');
  const release = read('scripts', 'build-android-release.cjs');

  assert.match(standalone, /prepareExpoEmbeddedUpdateManifest/);
  assert.match(standalone, /createUpdatesResources\.js/);
  assert.match(release, /assets\/app\.manifest/);
  assert.match(release, /Bundled app manifest verified/);
});
