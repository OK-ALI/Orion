const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobileRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(mobileRoot, '..', '..');

const readJson = (filePath) =>
  JSON.parse(fs.readFileSync(filePath, 'utf8'));

const app = readJson(path.join(mobileRoot, 'app.json'));
const mobilePackage = readJson(path.join(mobileRoot, 'package.json'));
const rootLock = readJson(path.join(repoRoot, 'package-lock.json'));

const standalone = fs.readFileSync(
  path.join(mobileRoot, 'scripts', 'build-android-standalone.cjs'),
  'utf8',
);

const release = fs.readFileSync(
  path.join(mobileRoot, 'scripts', 'build-android-release.cjs'),
  'utf8',
);

test('P10.7-A production candidate owns one aligned Mobile version identity', () => {
  assert.equal(app.expo.version, '2.2.5');
  assert.equal(app.expo.android.versionCode, 39);
  assert.equal(app.expo.android.package, 'com.okali.orion');
  assert.equal(mobilePackage.version, '2.2.5');
  assert.equal(rootLock.packages['apps/mobile'].version, '2.2.5');
});

test('P10.7-A Android builder materializes app.json versionName and versionCode into generated Gradle', () => {
  assert.match(standalone, /function ensureAndroidAppVersion\(\)/);
  assert.match(standalone, /appConfig\.version/);
  assert.match(standalone, /appConfig\.android\?\.versionCode/);
  assert.match(standalone, /versionCode \$\{versionCode\}/);
  assert.match(standalone, /versionName "\$\{versionName\}"/);
  assert.match(standalone, /App version materialized:/);
});

test('P10.7-A release distribution artifact name follows the Mobile package version', () => {
  assert.match(release, /const packageJson = JSON\.parse/);
  assert.match(release, /`orion-mobile-v\$\{packageJson\.version\}\.apk`/);
  assert.match(release, /verifyEmbeddedBundle\(releaseApk\)/);
  assert.match(release, /verifySigning\(releaseApk\)/);
  assert.match(release, /Release APK SHA-256:/);
});
