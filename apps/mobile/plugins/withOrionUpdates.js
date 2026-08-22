const fs = require('node:fs');
const path = require('node:path');
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const PACKAGE_PATH = ['com', 'okali', 'orion', 'updates'];
const NATIVE_SOURCE = path.join(__dirname, 'orion-updates-native');

function withUpdateProvider(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) {
      throw new Error('Unable to locate Android application manifest for Orion Updates.');
    }

    const providers = application.provider || [];
    const authority = '${applicationId}.orion-updates';
    if (!providers.some((provider) => provider?.$?.['android:authorities'] === authority)) {
      providers.push({
        $: {
          'android:name': 'androidx.core.content.FileProvider',
          'android:authorities': authority,
          'android:exported': 'false',
          'android:grantUriPermissions': 'true',
        },
        'meta-data': [
          {
            $: {
              'android:name': 'android.support.FILE_PROVIDER_PATHS',
              'android:resource': '@xml/orion_update_file_paths',
            },
          },
        ],
      });
    }
    application.provider = providers;
    return nextConfig;
  });
}

function withUpdateMainApplication(config) {
  return withMainApplication(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;
    const importLine = 'import com.okali.orion.updates.OrionUpdatePackage';
    const registration = 'add(OrionUpdatePackage())';

    if (!contents.includes(importLine)) {
      const firstImport = contents.indexOf('import ');
      if (firstImport < 0) {
        throw new Error('Unable to locate MainApplication imports for Orion Updates.');
      }
      contents = `${contents.slice(0, firstImport)}${importLine}\n${contents.slice(firstImport)}`;
    }

    if (!contents.includes(registration)) {
      const applyPattern = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!applyPattern.test(contents)) {
        throw new Error('Unable to locate React Native package list for Orion Updates.');
      }
      contents = contents.replace(applyPattern, (match) => `${match}\n          ${registration}`);
    }

    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withUpdateSources(config) {
  return withDangerousMod(config, ['android', async (nextConfig) => {
    const androidRoot = nextConfig.modRequest.platformProjectRoot;
    const packageRoot = path.join(androidRoot, 'app', 'src', 'main', 'java', ...PACKAGE_PATH);
    const xmlRoot = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(xmlRoot, { recursive: true });

    for (const name of ['OrionUpdateModule.kt', 'OrionUpdatePackage.kt']) {
      const source = path.join(NATIVE_SOURCE, name);
      const target = path.join(packageRoot, name);
      if (!fs.existsSync(source)) {
        throw new Error(`Missing Orion Updates native source: ${source}`);
      }
      fs.copyFileSync(source, target);
    }

    fs.writeFileSync(
      path.join(xmlRoot, 'orion_update_file_paths.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n  <cache-path name="orion_updates" path="orion-updates/"/>\n</paths>\n',
      'utf8',
    );
    return nextConfig;
  }]);
}

module.exports = function withOrionUpdates(config) {
  config = withUpdateProvider(config);
  config = withUpdateMainApplication(config);
  config = withUpdateSources(config);
  return config;
};
