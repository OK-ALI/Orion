const fs = require('node:fs');
const path = require('node:path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const PACKAGE_PATH = ['com', 'okali', 'orion', 'smartconnect'];
const NATIVE_SOURCE = path.join(__dirname, 'orion-nsd-native');

function ensurePermission(manifest, permission) {
  const permissions = manifest.manifest['uses-permission'] || [];
  if (!permissions.some((entry) => entry?.$?.['android:name'] === permission)) {
    permissions.push({ $: { 'android:name': permission } });
  }
  manifest.manifest['uses-permission'] = permissions;
}

function withNsdManifest(config) {
  return withAndroidManifest(config, (nextConfig) => {
    ensurePermission(nextConfig.modResults, 'android.permission.ACCESS_WIFI_STATE');
    ensurePermission(nextConfig.modResults, 'android.permission.CHANGE_WIFI_MULTICAST_STATE');
    return nextConfig;
  });
}

function withNsdMainApplication(config) {
  return withMainApplication(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;
    if (!contents.includes('com.okali.orion.smartconnect.OrionNsdPackage')) {
      const firstImport = contents.indexOf('import ');
      contents = `${contents.slice(0, firstImport)}import com.okali.orion.smartconnect.OrionNsdPackage\n${contents.slice(firstImport)}`;
    }
    if (!contents.includes('add(OrionNsdPackage())')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages(?:\.apply\s*\{[\s\S]*?\})?/,
        (match) => match.includes('.apply')
          ? match.replace(/\}\s*$/, '  add(OrionNsdPackage())\n        }')
          : `${match}.apply {\n          add(OrionNsdPackage())\n        }`,
      );
    }
    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withNsdSources(config) {
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
    for (const name of ['OrionNsdModule.kt', 'OrionNsdPackage.kt', 'OrionSecureConnectModule.kt']) {
      fs.copyFileSync(path.join(NATIVE_SOURCE, name), path.join(packageRoot, name));
    }
    return nextConfig;
  }]);
}

module.exports = function withOrionNsd(config) {
  config = withNsdManifest(config);
  config = withNsdMainApplication(config);
  config = withNsdSources(config);
  return config;
};
