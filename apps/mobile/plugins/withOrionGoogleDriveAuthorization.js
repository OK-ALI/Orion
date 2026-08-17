const fs = require('node:fs');
const path = require('node:path');
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const PACKAGE_PATH = ['com', 'okali', 'orion', 'cloud'];
const NATIVE_SOURCE = path.join(__dirname, 'orion-google-drive-authorization-native');
const DEPENDENCY_MARKER = '// ORION_GOOGLE_DRIVE_AUTHORIZATION_DEPENDENCIES';
const PLAY_SERVICES_AUTH = 'implementation "com.google.android.gms:play-services-auth:21.6.0"';

function withDriveAuthorizationDependencies(config) {
  return withAppBuildGradle(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;
    if (contents.includes(DEPENDENCY_MARKER)) return nextConfig;

    const dependencyBlock = [
      `    ${DEPENDENCY_MARKER}`,
      `    ${PLAY_SERVICES_AUTH}`,
    ].join('\n');

    if (!/dependencies\s*\{/.test(contents)) {
      throw new Error('Unable to locate Android app dependencies block for Orion Google Drive authorization.');
    }
    contents = contents.replace(/dependencies\s*\{/, (match) => `${match}\n${dependencyBlock}`);
    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withDriveAuthorizationMainApplication(config) {
  return withMainApplication(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;
    const importLine = 'import com.okali.orion.cloud.OrionGoogleDriveAuthorizationPackage';

    if (!contents.includes(importLine)) {
      const firstImport = contents.indexOf('import ');
      if (firstImport < 0) throw new Error('Unable to locate MainApplication imports for Orion Google Drive authorization.');
      contents = `${contents.slice(0, firstImport)}${importLine}\n${contents.slice(firstImport)}`;
    }

    if (!contents.includes('add(OrionGoogleDriveAuthorizationPackage())')) {
      const applyPattern = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!applyPattern.test(contents)) {
        throw new Error('Unable to locate React Native package list for Orion Google Drive authorization.');
      }
      contents = contents.replace(
        applyPattern,
        (match) => `${match}\n          add(OrionGoogleDriveAuthorizationPackage())`,
      );
    }

    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withDriveAuthorizationSources(config) {
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
    for (const name of [
      'OrionGoogleDriveAuthorizationModule.kt',
      'OrionGoogleDriveProfileStoreModule.kt',
      'OrionGoogleDriveAuthorizationPackage.kt',
    ]) {
      const source = path.join(NATIVE_SOURCE, name);
      const target = path.join(packageRoot, name);
      if (!fs.existsSync(source)) throw new Error(`Missing Orion Google Drive authorization native source: ${source}`);
      fs.copyFileSync(source, target);
    }
    return nextConfig;
  }]);
}

module.exports = function withOrionGoogleDriveAuthorization(config) {
  config = withDriveAuthorizationDependencies(config);
  config = withDriveAuthorizationMainApplication(config);
  config = withDriveAuthorizationSources(config);
  return config;
};
