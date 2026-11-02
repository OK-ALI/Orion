'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PACKAGE = 'com.okali.orion';
const SIGNER = '4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd';

function validateMobileReleaseMap({ map, mobilePackage, app, lock, releaseSigner, metadataSigner, metadataApkName }) {
  const failures = [];
  const equal = (name, actual, expected) => {
    if (actual !== expected) failures.push(`${name}: expected ${expected}, received ${actual}`);
  };
  equal('schema', map.schemaVersion, 1);
  equal('platform', map.platform, 'android');
  if (!/^\d+\.\d+\.\d+$/.test(map.mobileVersion || '')) failures.push('Invalid Mobile version');
  if (!Number.isSafeInteger(map.androidVersionCode) || map.androidVersionCode <= 0) failures.push('Invalid Android versionCode');
  if (!/^[a-f0-9]{40}$/.test(map.preservationBaseline?.commit || '')) failures.push('Invalid preservation baseline commit');
  if (!/^v\d+\.\d+\.\d+$/.test(map.preservationBaseline?.tag || '')) failures.push('Invalid preservation baseline tag');
  equal('mapped package', map.androidPackage, PACKAGE);
  equal('application package', app.android?.package, PACKAGE);
  equal('mapped signer', map.expectedSignerSha256, SIGNER);
  equal('release builder signer', String(releaseSigner || '').toLowerCase(), SIGNER);
  equal('metadata builder signer', String(metadataSigner || '').toLowerCase(), SIGNER);
  equal('Mobile package version', mobilePackage.version, map.mobileVersion);
  equal('Mobile display version', app.version, map.mobileVersion);
  equal('lockfile Mobile version', lock.packages?.['apps/mobile']?.version, map.mobileVersion);
  equal('Android versionCode', app.android?.versionCode, map.androidVersionCode);
  equal('Mobile runtime', app.runtimeVersion, map.mobileRuntimeVersion);
  equal('target tag name', map.gitTag, `v${map.mobileVersion}`);
  equal('mapped APK name', map.artifactName, `orion-mobile-v${map.mobileVersion}.apk`);
  equal('metadata APK name', metadataApkName, map.artifactName);
  return failures;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  const map = read('config/orion-mobile-release-map-v1.json');
  const release = require(path.join(root, 'apps/mobile/scripts/build-android-release.cjs'));
  const metadata = require(path.join(root, 'apps/mobile/scripts/create-mobile-release-manifests.cjs'));
  const failures = validateMobileReleaseMap({
    map,
    mobilePackage: read('apps/mobile/package.json'),
    app: read('apps/mobile/app.json').expo,
    lock: read('package-lock.json'),
    releaseSigner: release.expectedCertificateSha256,
    metadataSigner: metadata.SIGNER,
    metadataApkName: metadata.APK_NAME,
  });
  if (map.preservationBaseline?.tag && map.preservationBaseline?.commit) {
    const actual = execFileSync('git', ['rev-parse', `${map.preservationBaseline.tag}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
    if (actual !== map.preservationBaseline.commit) failures.push('Preservation tag/commit mismatch');
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Mobile ${map.mobileVersion} identity map is consistent. Release qualification was not performed.`);
}

module.exports = { validateMobileReleaseMap };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
