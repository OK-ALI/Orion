const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P9.2 Android update plugin owns direct APK native registration without Play Core', () => {
  const plugin = read('plugins', 'withOrionUpdates.js');
  const appConfig = read('app.json');

  assert.match(appConfig, /\.\/plugins\/withOrionUpdates/);
  assert.match(plugin, /OrionUpdatePackage/);
  assert.match(plugin, /androidx\.core\.content\.FileProvider/);
  assert.match(plugin, /orion_update_file_paths/);
  assert.doesNotMatch(plugin, /com\.google\.android\.play:app-update/);
  assert.doesNotMatch(plugin, /AppUpdateType|Play Core|Google Play/);
  assert.doesNotMatch(plugin, /REQUEST_INSTALL_PACKAGES/);
});

test('P9.2 direct-distribution builder injects install-source permission and native source ownership', () => {
  const standalone = read('scripts', 'build-android-standalone.cjs');

  assert.match(standalone, /OrionUpdateModule\.kt/);
  assert.match(standalone, /add\(OrionUpdatePackage\(\)\)/);
  assert.match(standalone, /REQUEST_INSTALL_PACKAGES/);
  assert.match(standalone, /orion_update_file_paths/);
  assert.doesNotMatch(standalone, /com\.google\.android\.play:app-update/);
  assert.doesNotMatch(standalone, /ORION_UPDATE_ENGINE_DEPENDENCIES/);
});

test('P9.2 native updater verifies GitHub origin, hash, package, version and permanent signer before install', () => {
  const native = read('plugins', 'orion-updates-native', 'OrionUpdateModule.kt');

  assert.match(native, /4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd/);
  assert.match(native, /\/ok-ali\/orion\/releases\/download\//);
  assert.match(native, /Downloaded APK SHA-256 verification failed/);
  assert.match(native, /candidate\.packageName != reactContext\.packageName/);
  assert.match(native, /versionCode\(candidate\) <= versionCode\(installedPackageInfo\(\)\)/);
  assert.match(native, /candidateSigner != expectedSigner \|\| candidateSigner != currentSigner/);
  assert.match(native, /FileProvider\.getUriForFile/);
  assert.doesNotMatch(native, /AppUpdateManager|AppUpdateType|InstallStatus|com\.google\.android\.play/);
});

test('P9.2 direct updater fails closed until Android install-source permission is granted', () => {
  const native = read('plugins', 'orion-updates-native', 'OrionUpdateModule.kt');

  assert.match(native, /canRequestPackageInstalls/);
  assert.match(native, /permission-required/);
  assert.match(native, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  assert.match(native, /direct-build-required/);
});

test('P9.2 native JS bridge exposes direct APK execution only', () => {
  const bridge = read('src', 'services', 'nativeUpdateEngine.ts');

  assert.match(bridge, /installDirectApkV1/);
  assert.match(bridge, /openDirectInstallPermissionSettingsV1/);
  assert.match(bridge, /OrionAndroidUpdateSourceV1 = 'direct'/);
  assert.doesNotMatch(bridge, /checkPlayUpdate|startFlexiblePlayUpdate|completeFlexiblePlayUpdate/);
  assert.doesNotMatch(bridge, /OrionPlayUpdateStatus/);
});

test('P9.2 Updates Settings keeps verified direct APK execution separate from runtime updates', () => {
  const updates = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const execution = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');

  assert.match(updates, /MobileUpdateExecutionSection/);
  assert.match(updates, /RuntimeUpdateExecutionSection/);
  assert.match(execution, /installDirectApkV1/);
  assert.match(execution, /expectedSha256: integrity\.sha256/);
  assert.match(execution, /expectedSignerSha256: integrity\.signerSha256/);
  assert.match(execution, /Download & install/);
  assert.match(execution, /Allow installs/);
  assert.doesNotMatch(execution, /checkExpoRuntimeUpdateV1|downloadExpoRuntimeUpdateV1|reloadExpoRuntimeUpdateV1/);
  assert.doesNotMatch(execution, /Google Play|Play Core|logo-google-playstore|startFlexiblePlayUpdate/);
});
