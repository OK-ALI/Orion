const fs = require('node:fs');
const path = require('node:path');
const {
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const PACKAGE_PATH = ['com', 'okali', 'orion', 'playback'];
const NATIVE_SOURCE = path.join(__dirname, 'orion-cinema-webview-native');
const PACKAGE_IMPORT = 'com.okali.orion.playback.OrionCinemaWebViewPackage';

function withCinemaMainApplication(config) {
  return withMainApplication(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;
    if (!contents.includes(PACKAGE_IMPORT)) {
      const firstImport = contents.indexOf('import ');
      contents = `${contents.slice(0, firstImport)}import ${PACKAGE_IMPORT}\n${contents.slice(firstImport)}`;
    }
    if (!contents.includes('add(OrionCinemaWebViewPackage())')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages(?:\.apply\s*\{[\s\S]*?\})?/,
        (match) => match.includes('.apply')
          ? match.replace(/\}\s*$/, '  add(OrionCinemaWebViewPackage())\n        }')
          : `${match}.apply {\n          add(OrionCinemaWebViewPackage())\n        }`,
      );
    }
    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withCinemaSources(config) {
  return withDangerousMod(config, ['android', async (nextConfig) => {
    const packageRoot = path.join(
      nextConfig.modRequest.platformProjectRoot,
      'app', 'src', 'main', 'java', ...PACKAGE_PATH,
    );
    fs.mkdirSync(packageRoot, { recursive: true });
    for (const name of [
      'OrionCinemaWebViewClient.kt',
      'OrionCinemaWebViewManager.kt',
      'OrionCinemaWebViewPackage.kt',
    ]) {
      fs.copyFileSync(path.join(NATIVE_SOURCE, name), path.join(packageRoot, name));
    }
    return nextConfig;
  }]);
}

module.exports = function withOrionCinemaWebView(config) {
  config = withCinemaMainApplication(config);
  return withCinemaSources(config);
};
