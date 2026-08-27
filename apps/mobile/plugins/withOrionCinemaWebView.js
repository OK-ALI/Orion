const fs = require('node:fs');
const path = require('node:path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const PACKAGE_PATH = ['com', 'okali', 'orion', 'playback'];
const NATIVE_SOURCE = path.join(__dirname, 'orion-cinema-webview-native');
const NATIVE_TEST_SOURCE = path.join(__dirname, 'orion-cinema-webview-native-tests');
const PACKAGE_IMPORT = 'com.okali.orion.playback.OrionCinemaWebViewPackage';
const CINEMA_ANDROID_DEPENDENCY_MARKER = '// ORION_P105_OFFLINE_PLAYER_DEPENDENCIES';
const CINEMA_ANDROID_DEPENDENCIES = Object.freeze([
  'implementation "androidx.media3:media3-exoplayer:1.9.0"',
  'implementation "androidx.media3:media3-ui:1.9.0"',
]);
const YTDLP_ANDROID_DEPENDENCY_MARKER = '// ORION_P105_DESKTOP_PARITY_DOWNLOAD_ENGINE_DEPENDENCIES';
const YTDLP_ANDROID_DEPENDENCIES = Object.freeze([
  'implementation "com.github.Lizzergas.youtubedl-android:library:83f41ae27710b4a1d47f4a0095209f4325e4564f"',
  'implementation "com.github.Lizzergas.youtubedl-android:ffmpeg:83f41ae27710b4a1d47f4a0095209f4325e4564f"',
]);
const CINEMA_NATIVE_FILES = Object.freeze([
  'OrionCinemaWebViewClient.kt',
  'OrionCinemaWebChromeClient.kt',
  'OrionCinemaWebViewManager.kt',
  'OrionCinemaWebViewManagerDelegate.java',
  'OrionCinemaWebViewPackage.kt',
  'OrionPlayerSystemUiModule.kt',
  'OrionDownloadCaptureModule.kt',
  'OrionDownloadRequestContextBroker.kt',
  'OrionDownloadAuthorizedHttp.kt',
  'OrionDownloadEngineModule.kt',
  'OrionDownloadForegroundService.kt',
  'OrionDownloadFragmentPlanner.kt',
  'OrionDownloadArtifactManager.kt',
  'OrionDownloadExecutionFence.kt',
  'OrionDownloadFinalizationManifest.kt',
  'OrionDownloadJobStore.kt',
  'OrionDownloadNotificationContract.kt',
  'OrionDownloadNotifications.kt',
  'OrionDownloadOwnershipPolicy.kt',
  'OrionDownloadRecoveryWorker.kt',
  'OrionDownloadStorageRegistry.kt',
  'OrionDownloadSubtitleRuntime.kt',
  'OrionOfflineMediaSourcePolicy.kt',
  'OrionOfflineMediaSourceFactory.kt',
  'OrionOfflinePlayerView.kt',
  'OrionOfflinePlayerViewManager.kt',
  'OrionOfflinePlaybackTimeline.kt',
  'OrionPortableCadence.kt',
  'OrionPortableVerification.kt',
  'OrionDownloadPortableFinalizer.kt',
  'OrionDownloadYtDlpAuthority.kt',
  'OrionDownloadYtDlpRuntime.kt',
  'OrionDownloadTransferRuntime.kt',
]);
const CINEMA_NATIVE_TEST_FILES = Object.freeze([
  'OrionOfflineMediaSourcePolicyTest.kt',
  'OrionOfflinePlaybackTimelineTest.kt',
  'OrionPortableCadenceTest.kt',
  'OrionDownloadManagementPolicyTest.kt',
  'OrionDownloadRetryPolicyTest.kt',
  'OrionDownloadCancellationFenceTest.kt',
  'OrionDownloadNotificationContractTest.kt',
]);

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
    for (const name of CINEMA_NATIVE_FILES) {
      fs.copyFileSync(path.join(NATIVE_SOURCE, name), path.join(packageRoot, name));
    }
    const testPackageRoot = path.join(
      nextConfig.modRequest.platformProjectRoot,
      'app', 'src', 'test', 'java', ...PACKAGE_PATH,
    );
    fs.mkdirSync(testPackageRoot, { recursive: true });
    for (const name of CINEMA_NATIVE_TEST_FILES) {
      fs.copyFileSync(path.join(NATIVE_TEST_SOURCE, name), path.join(testPackageRoot, name));
    }
    return nextConfig;
  }]);
}

function withDownloadEngineGradle(config) {
  return withAppBuildGradle(config, (nextConfig) => {
    if (!nextConfig.modResults.contents.includes(CINEMA_ANDROID_DEPENDENCY_MARKER)) {
      nextConfig.modResults.contents = nextConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n${[
          CINEMA_ANDROID_DEPENDENCY_MARKER,
          ...CINEMA_ANDROID_DEPENDENCIES,
        ].map((line) => `    ${line}`).join('\n')}`,
      );
    }
    if (!nextConfig.modResults.contents.includes(YTDLP_ANDROID_DEPENDENCY_MARKER)) {
      nextConfig.modResults.contents = nextConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n${[
          YTDLP_ANDROID_DEPENDENCY_MARKER,
          ...YTDLP_ANDROID_DEPENDENCIES,
        ].map((line) => `    ${line}`).join('\n')}`,
      );
    }
    const marker = 'implementation "androidx.work:work-runtime-ktx:2.10.1"';
    if (!nextConfig.modResults.contents.includes(marker)) {
      nextConfig.modResults.contents = nextConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n    // ORION_P10_DOWNLOAD_ENGINE_DEPENDENCIES\n    ${marker}`,
      );
    }
    const testMarker = 'testImplementation "junit:junit:4.13.2"';
    if (!nextConfig.modResults.contents.includes(testMarker)) {
      nextConfig.modResults.contents = nextConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n    // ORION_P10_PORTABLE_CADENCE_TEST_DEPENDENCY\n    ${testMarker}`,
      );
    }
    return nextConfig;
  });
}

function withDownloadEngineManifest(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const permissions = manifest['uses-permission'] || [];
    for (const name of [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    ]) {
      if (!permissions.some((item) => item?.$?.['android:name'] === name)) {
        permissions.push({ $: { 'android:name': name } });
      }
    }
    manifest['uses-permission'] = permissions;
    const application = manifest.application?.[0];
    if (!application) throw new Error('Unable to locate Android application for Orion downloads.');
    const services = application.service || [];
    const serviceName = 'com.okali.orion.playback.OrionDownloadForegroundService';
    if (!services.some((item) => item?.$?.['android:name'] === serviceName)) {
      services.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
          'android:stopWithTask': 'false',
        },
      });
    }
    application.service = services;
    return nextConfig;
  });
}

module.exports = function withOrionCinemaWebView(config) {
  config = withCinemaMainApplication(config);
  config = withDownloadEngineGradle(config);
  config = withDownloadEngineManifest(config);
  return withCinemaSources(config);
};

module.exports.CINEMA_NATIVE_FILES = CINEMA_NATIVE_FILES;
module.exports.CINEMA_NATIVE_TEST_FILES = CINEMA_NATIVE_TEST_FILES;
module.exports.CINEMA_ANDROID_DEPENDENCY_MARKER = CINEMA_ANDROID_DEPENDENCY_MARKER;
module.exports.CINEMA_ANDROID_DEPENDENCIES = CINEMA_ANDROID_DEPENDENCIES;
module.exports.YTDLP_ANDROID_DEPENDENCY_MARKER = YTDLP_ANDROID_DEPENDENCY_MARKER;
module.exports.YTDLP_ANDROID_DEPENDENCIES = YTDLP_ANDROID_DEPENDENCIES;
