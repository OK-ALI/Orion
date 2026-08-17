const fs = require('node:fs');
const path = require('node:path');
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const PACKAGE_PATH = ['com', 'okali', 'orion', 'identity'];
const NATIVE_SOURCE = path.join(__dirname, 'orion-google-identity-native');
const DEPENDENCY_MARKER = '// ORION_GOOGLE_IDENTITY_DEPENDENCIES';

function withIdentityDependencies(config) {
  return withAppBuildGradle(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;
    if (contents.includes(DEPENDENCY_MARKER)) return nextConfig;

    const dependencyBlock = [
      `    ${DEPENDENCY_MARKER}`,
      '    implementation "androidx.credentials:credentials:1.6.0"',
      '    implementation "androidx.credentials:credentials-play-services-auth:1.6.0"',
      '    implementation "com.google.android.libraries.identity.googleid:googleid:1.2.0"',
    ].join('\n');

    if (!/dependencies\s*\{/.test(contents)) {
      throw new Error('Unable to locate Android app dependencies block for Orion Google Identity.');
    }
    contents = contents.replace(/dependencies\s*\{/, (match) => `${match}\n${dependencyBlock}`);
    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withIdentityMainApplication(config) {
  return withMainApplication(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;
    const importLine = 'import com.okali.orion.identity.OrionGoogleIdentityPackage';

    if (!contents.includes(importLine)) {
      const firstImport = contents.indexOf('import ');
      if (firstImport < 0) throw new Error('Unable to locate MainApplication imports for Orion Google Identity.');
      contents = `${contents.slice(0, firstImport)}${importLine}\n${contents.slice(firstImport)}`;
    }

    if (!contents.includes('add(OrionGoogleIdentityPackage())')) {
      const applyPattern = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (applyPattern.test(contents)) {
        contents = contents.replace(
          applyPattern,
          (match) => `${match}\n          add(OrionGoogleIdentityPackage())`,
        );
      } else if (contents.includes('PackageList(this).packages')) {
        contents = contents.replace(
          'PackageList(this).packages',
          'PackageList(this).packages.apply {\n          add(OrionGoogleIdentityPackage())\n        }',
        );
      } else {
        throw new Error('Unable to locate React Native package list for Orion Google Identity.');
      }
    }

    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withIdentitySources(config) {
  return withDangerousMod(config, ['android', async (nextConfig) => {
    const packageRoot = path.join(
      nextConfig.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'java',
      ...PACKAGE_PATH,
    );
    fs.mkdirSync(packageRoot, { recursive: true });
    for (const name of ['OrionGoogleIdentityModule.kt', 'OrionGoogleIdentityPackage.kt']) {
      const source = path.join(NATIVE_SOURCE, name);
      const target = path.join(packageRoot, name);
      if (!fs.existsSync(source)) throw new Error(`Missing Orion Google Identity native source: ${source}`);
      fs.copyFileSync(source, target);
    }
    return nextConfig;
  }]);
}

module.exports = function withOrionGoogleIdentity(config) {
  config = withIdentityDependencies(config);
  config = withIdentityMainApplication(config);
  config = withIdentitySources(config);
  return config;
};