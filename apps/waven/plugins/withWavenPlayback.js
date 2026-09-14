"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require("@expo/config-plugins");

const PACKAGE_PATH = ["com", "okali", "waven", "playback"];
const NATIVE_SOURCE = path.join(__dirname, "waven-playback-native");
const PACKAGE_IMPORT = "com.okali.waven.playback.WavenPlaybackPackage";
const PACKAGE_ADD = "add(WavenPlaybackPackage())";

const MEDIA3_VERSION = "1.9.0";
const DEPENDENCY_MARKER = "// WAVEN_P41_MEDIA3_PLAYBACK_DEPENDENCIES";
const DEPENDENCIES = Object.freeze([
  `implementation "androidx.media3:media3-exoplayer:${MEDIA3_VERSION}"`,
  `implementation "androidx.media3:media3-session:${MEDIA3_VERSION}"`,
  `implementation "androidx.media3:media3-datasource:${MEDIA3_VERSION}"`,
]);

const NATIVE_FILES = Object.freeze([
  "WavenPlaybackContract.kt",
  "WavenPlaybackModule.kt",
  "WavenPlaybackPackage.kt",
  "WavenPlaybackRecoveryStore.kt",
  "WavenPlaybackService.kt",
]);

function withPlaybackMainApplication(config) {
  return withMainApplication(config, (nextConfig) => {
    let contents = nextConfig.modResults.contents;

    if (!contents.includes(PACKAGE_IMPORT)) {
      const firstImport = contents.indexOf("import ");
      contents =
        firstImport >= 0
          ? `${contents.slice(0, firstImport)}import ${PACKAGE_IMPORT}\n${contents.slice(firstImport)}`
          : `${contents}\nimport ${PACKAGE_IMPORT}\n`;
    }

    if (!contents.includes(PACKAGE_ADD)) {
      contents = contents.replace(
        /PackageList\(this\)\.packages(?:\.apply\s*\{[\s\S]*?\})?/,
        (match) =>
          match.includes(".apply")
            ? match.replace(/\}\s*$/, `  ${PACKAGE_ADD}\n        }`)
            : `${match}.apply {\n          ${PACKAGE_ADD}\n        }`,
      );
    }

    nextConfig.modResults.contents = contents;
    return nextConfig;
  });
}

function withPlaybackGradle(config) {
  return withAppBuildGradle(config, (nextConfig) => {
    if (!nextConfig.modResults.contents.includes(DEPENDENCY_MARKER)) {
      nextConfig.modResults.contents = nextConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) =>
          `${match}\n${[DEPENDENCY_MARKER, ...DEPENDENCIES]
            .map((line) => `    ${line}`)
            .join("\n")}`,
      );
    }
    return nextConfig;
  });
}

function withPlaybackManifest(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const permissions = manifest["uses-permission"] || [];

    for (const name of [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.WAKE_LOCK",
    ]) {
      if (!permissions.some((item) => item?.$?.["android:name"] === name)) {
        permissions.push({ $: { "android:name": name } });
      }
    }
    manifest["uses-permission"] = permissions;

    const application = manifest.application?.[0];
    if (!application) {
      throw new Error("Unable to locate WAVEN Android application.");
    }

    const services = application.service || [];
    const serviceName = "com.okali.waven.playback.WavenPlaybackService";

    if (!services.some((item) => item?.$?.["android:name"] === serviceName)) {
      services.push({
        $: {
          "android:name": serviceName,
          "android:exported": "true",
          "android:foregroundServiceType": "mediaPlayback",
          "android:stopWithTask": "false",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "androidx.media3.session.MediaSessionService",
                },
              },
            ],
          },
        ],
      });
    }

    application.service = services;
    return nextConfig;
  });
}

function withPlaybackSources(config) {
  return withDangerousMod(config, [
    "android",
    async (nextConfig) => {
      const packageRoot = path.join(
        nextConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...PACKAGE_PATH,
      );

      fs.mkdirSync(packageRoot, { recursive: true });
      for (const name of NATIVE_FILES) {
        fs.copyFileSync(
          path.join(NATIVE_SOURCE, name),
          path.join(packageRoot, name),
        );
      }
      return nextConfig;
    },
  ]);
}

module.exports = function withWavenPlayback(config) {
  config = withPlaybackMainApplication(config);
  config = withPlaybackGradle(config);
  config = withPlaybackManifest(config);
  return withPlaybackSources(config);
};

module.exports.MEDIA3_VERSION = MEDIA3_VERSION;
module.exports.DEPENDENCY_MARKER = DEPENDENCY_MARKER;
module.exports.DEPENDENCIES = DEPENDENCIES;
module.exports.NATIVE_FILES = NATIVE_FILES;
