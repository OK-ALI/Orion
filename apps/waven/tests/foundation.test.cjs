const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

test('pins the proven Orion Mobile Expo and React Native baseline', () => {
  assert.equal(packageJson.dependencies.expo, '57.0.19');
  assert.equal(packageJson.dependencies['react-native'], '0.86.3');
  assert.equal(packageJson.dependencies.react, '19.2.3');
  assert.equal(packageJson.dependencies['expo-router'], '57.0.18');
  assert.equal(packageJson.devDependencies.typescript, '6.0.3');
});

test('uses an independent WAVEN application identity', () => {
  assert.equal(packageJson.name, '@orion/waven');
  assert.equal(appJson.expo.name, 'WAVEN');
  assert.equal(appJson.expo.slug, 'waven');
  assert.equal(appJson.expo.scheme, 'waven');
  assert.equal(appJson.expo.android.package, 'com.okali.waven');
});

test('pins the observed Orion Android SDK and Kotlin baseline', () => {
  const buildProperties = appJson.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  assert.ok(buildProperties);
  const android = buildProperties[1].android;
  assert.equal(android.compileSdkVersion, 36);
  assert.equal(android.targetSdkVersion, 36);
  assert.equal(android.minSdkVersion, 24);
  assert.equal(android.buildToolsVersion, '36.0.0');
  assert.equal(android.kotlinVersion, '2.1.20');
});

test('does not inherit Cinema-only or hard-coded Orion native plugins', () => {
  const serializedPlugins = JSON.stringify(appJson.expo.plugins);
  assert.doesNotMatch(serializedPlugins, /withOrionCinemaWebView|withOrionNsd|withOrionUpdates/);
  assert.doesNotMatch(serializedPlugins, /withOrionGoogleIdentity|withOrionGoogleDriveAuthorization/);
});
