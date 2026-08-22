const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P9.2 C3 config pins a manual native runtime and keeps the embedded recovery floor', () => {
  const config = JSON.parse(read('app.json')).expo;

  assert.equal(config.runtimeVersion, 'orion-mobile-native-r1');
  assert.equal(config.updates.url, 'https://u.expo.dev/db8d113f-2d08-4a1c-b58a-19dceeeca94f');
  assert.equal(config.updates.requestHeaders['expo-channel-name'], 'stable');
  assert.equal(config.updates.checkAutomatically, 'ON_ERROR_RECOVERY');
  assert.equal(config.updates.fallbackToCacheTimeout, 0);
  assert.equal(config.updates.useEmbeddedUpdate, true);
  assert.notEqual(config.updates.disableAntiBrickingMeasures, true);
});

test('P9.2 C3 EAS profiles map preview and production to Orion release channels', () => {
  const eas = JSON.parse(read('eas.json'));

  assert.equal(eas.build.preview.channel, 'preview');
  assert.equal(eas.build.production.channel, 'stable');
});

test('P9.2 C3 runtime bridge uses header-only channel surfing and never overrides the update URL', () => {
  const service = read('src', 'services', 'expoRuntimeUpdates.ts');

  assert.match(service, /setUpdateRequestHeadersOverride/);
  assert.match(service, /'expo-channel-name': normalized/);
  assert.match(service, /checkForUpdateAsync/);
  assert.match(service, /fetchUpdateAsync/);
  assert.match(service, /reloadAsync/);
  assert.match(service, /isEmergencyLaunch/);
  assert.match(service, /emergencyLaunchReason/);
  assert.doesNotMatch(service, /setUpdateURLAndRequestHeadersOverride/);
});

test('P9.2 C3 Settings separates runtime download and restart from signed APK installation', () => {
  const settings = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const runtime = read('src', 'features', 'settings', 'RuntimeUpdateExecutionSection.tsx');

  assert.match(settings, /RuntimeUpdateExecutionSection/);
  assert.match(settings, /checkExpoRuntimeUpdateV1/);
  assert.match(runtime, /downloadExpoRuntimeUpdateV1/);
  assert.match(runtime, /reloadExpoRuntimeUpdateV1/);
  assert.match(runtime, /Get quick update/);
  assert.match(runtime, /Restart Orion/);
  assert.match(runtime, /Use recovery version/);
  assert.doesNotMatch(runtime, /installDirectApkV1|openDirectInstallPermissionSettingsV1/);
});

test('P9.2 C3 local Android build materializes Expo update URL, runtime and recovery policy', () => {
  const standalone = read('scripts', 'build-android-standalone.cjs');

  assert.match(standalone, /ensureExpoRuntimeUpdateConfiguration/);
  assert.match(standalone, /expo\.modules\.updates\.EXPO_UPDATE_URL/);
  assert.match(standalone, /expo\.modules\.updates\.EXPO_RUNTIME_VERSION/);
  assert.match(standalone, /ERROR_RECOVERY_ONLY/);
  assert.match(standalone, /UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY/);
  assert.match(standalone, /anti-bricking measures enabled/);
});

test('P9.2 C3 package uses the Expo SDK 57 runtime update line', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['expo-updates'], '~57.0.12');
});

test('P9.2 C3 manual Android bundle pipeline embeds Expo app.manifest before packaging', () => {
  const standalone = read('scripts', 'build-android-standalone.cjs');
  const release = read('scripts', 'build-android-release.cjs');

  assert.match(standalone, /createUpdatesResources\.js/);
  assert.match(standalone, /"all"/);
  assert.match(standalone, /app\.manifest/);
  assert.match(standalone, /Expo embedded update manifest prepared/);
  assert.match(release, /assets\/app\.manifest/);
  assert.match(release, /Expo embedded manifest verified/);
});
