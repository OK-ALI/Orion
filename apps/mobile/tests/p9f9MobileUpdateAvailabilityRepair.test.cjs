const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobileRoot = path.resolve(__dirname, '..');
const readMobile = (relativePath) => fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');

test('P9-F9 installed-package inspection requests signing and declared-permission metadata', () => {
  const native = readMobile('plugins/orion-updates-native/OrionUpdateModule.kt');

  assert.match(
    native,
    /getPackageInfo\(\s*reactContext\.packageName,\s*signingFlags\(\) or PackageManager\.GET_PERMISSIONS,\s*\)/,
  );
  assert.match(
    native,
    /info\.requestedPermissions\?\.contains\(Manifest\.permission\.REQUEST_INSTALL_PACKAGES\) == true/,
  );
  assert.match(native, /requestInstallPackagesDeclared\(info\)/);
  assert.match(native, /if \(!requestInstallPackagesDeclared\(\)\)/);
});

test('P9-F9 canonical availability preserves declared-permission, grant, signer, and integrity gates', () => {
  const state = readMobile('src/services/mobileApplicationUpdateState.ts');

  assert.match(state, /result\.integrity\.status !== 'ready'/);
  assert.match(
    state,
    /!environment\.productionSignerMatched \|\| !environment\.requestInstallPackagesDeclared/,
  );
  assert.match(state, /!environment\.canRequestPackageInstalls/);
  assert.match(state, /return 'permission-required'/);
  assert.match(state, /return 'available'/);
  assert.match(state, /label: 'Unavailable'/);
  assert.match(state, /label: 'Permission needed'/);
  assert.match(state, /label: 'Update ready'/);
});

test('P9-F9 actionable canonical states reveal the correct updater action and announcement', () => {
  const execution = readMobile('src/features/settings/MobileUpdateExecutionSection.tsx');
  const announcement = readMobile('src/services/mobileUpdateAnnouncement.ts');
  const banner = readMobile('src/features/updates/MobileUpdateAnnouncementBanner.tsx');

  assert.match(execution, /state\.status === 'permission-required'/);
  assert.match(execution, /Allow installs/);
  assert.match(execution, /isMobileApplicationUpdateInstallReadyV1\(state\)/);
  assert.match(execution, /Download & install/);
  assert.match(announcement, /state\.status === 'available'/);
  assert.match(announcement, /state\.status === 'permission-required'/);
  assert.match(banner, /announcement\.installState === 'permission-required'/);
  assert.match(banner, /section: 'updates'/);
});

test('P9-F9 remains the sole production updater after Expo runtime retirement', () => {
  const settings = readMobile('src/features/settings/UpdatesSettingsContent.tsx');
  const execution = readMobile('src/features/settings/MobileUpdateExecutionSection.tsx');

  assert.match(settings, /<MobileUpdateExecutionSection state=\{appUpdateState\} \/>/);
  assert.doesNotMatch(settings, /checkExpoRuntimeUpdateV1|RuntimeUpdateExecutionSection|Quick updates|Recovery/);
  assert.match(execution, /installDirectApkV1/);
  assert.match(execution, /Download & install/);
  assert.doesNotMatch(execution, /checkExpoRuntimeUpdateV1|downloadExpoRuntimeUpdateV1|reloadExpoRuntimeUpdateV1/);
});
