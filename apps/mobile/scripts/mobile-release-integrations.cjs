'use strict';
// Only the deliberately authorized Mobile 4.0.0 identity transition.
function mobileReleaseIntegration(file, original) {
  if (file === 'apps/mobile/app.json') return original.replace('"version": "3.2.1"', '"version": "4.0.0"').replace('"versionCode": 59', '"versionCode": 60');
  if (file === 'apps/mobile/package.json') return original.replace('"version": "3.2.1"', '"version": "4.0.0"');
  if (file === 'apps/mobile/android/app/build.gradle') return original.replace('versionCode 59', 'versionCode 60').replace('versionName "3.2.1"', 'versionName "4.0.0"');
  if (file === 'package-lock.json') return original.replace(/("apps\/mobile": \{\n[^}]*?"version": ")3\.2\.1(")/, (_, before, after) => before + '4.0.0' + after);
  if (file === 'apps/mobile/tests/p107DistributionVersioning.test.cjs') return original.replaceAll("'3.2.1'", "'4.0.0'").replace('versionCode, 59', 'versionCode, 60');
  return original;
}
function assertMobileGeneratedIntegration(file, actual) {
  if (file !== 'apps/mobile/android/app/build.gradle') throw Error('Unreviewed generated file: ' + file);
  const digest = require('node:crypto').createHash('sha256').update(actual.replace(/\r\n/g, '\n')).digest('hex');
  if (digest !== '0df69eef3e0aee7ff94596f7a37c25943fb978037b845ec855aa541c38d2b8ba') throw Error('Generated Mobile Gradle differs from the exact reviewed release configuration');
}
module.exports = { mobileReleaseIntegration, assertMobileGeneratedIntegration };
