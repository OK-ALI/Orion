'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { withAppBuildGradle, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
// Reuse the exact Android extractor generation already pinned by Orion Mobile.
// This dependency resolves a transient source; WAVEN adds no downloader or FFmpeg.
const DEPENDENCY = 'implementation "com.github.Lizzergas.youtubedl-android:library:83f41ae27710b4a1d47f4a0095209f4325e4564f"';
const IMPORT = 'import com.okali.waven.streaming.WavenStreamingSourcePackage';
const REGISTER = 'add(WavenStreamingSourcePackage())';
function applyGradle(contents) { return contents.includes(DEPENDENCY) ? contents : contents.replace(/dependencies\s*\{/, `$&\n    // WAVEN_P6_JIT_SOURCE_RESOLUTION\n    ${DEPENDENCY}`); }
function applyApplication(contents) {
  let next = contents.includes(IMPORT) ? contents : contents.replace(/import /, `${IMPORT}\nimport `);
  if (!next.includes(REGISTER)) next = next.replace(/PackageList\(this\)\.packages(?:\.apply\s*\{[\s\S]*?\})?/, match => match.includes('.apply') ? match.replace(/\}\s*$/, `  ${REGISTER}\n        }`) : `${match}.apply {\n          ${REGISTER}\n        }`);
  if (!next.includes(REGISTER)) throw Error('Could not register WAVEN source resolver.');
  return next;
}
function copySources(root) {
  const target = path.join(root, 'app/src/main/java/com/okali/waven/streaming'); fs.mkdirSync(target, { recursive: true });
  for (const name of ['WavenStreamingSourceModule.kt', 'WavenStreamingSourcePackage.kt']) fs.copyFileSync(path.join(__dirname, 'waven-streaming-native', name), path.join(target, name));
  const assets = path.join(root, 'app/src/main/assets/waven-source'); fs.mkdirSync(assets, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'waven-streaming-native/vendor/yt-dlp-2026.08.19'), path.join(assets, 'yt-dlp-2026.08.19'));
}
module.exports = config => {
  config = withAppBuildGradle(config, next => { next.modResults.contents = applyGradle(next.modResults.contents); return next; });
  config = withMainApplication(config, next => { next.modResults.contents = applyApplication(next.modResults.contents); return next; });
  return withDangerousMod(config, ['android', async next => { copySources(next.modRequest.platformProjectRoot); return next; }]);
};
module.exports.applyGradle = applyGradle;
module.exports.applyApplication = applyApplication;
module.exports.copySources = copySources;
module.exports.DEPENDENCY = DEPENDENCY;
