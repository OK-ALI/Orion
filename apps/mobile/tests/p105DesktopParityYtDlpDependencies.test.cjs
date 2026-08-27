const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pluginPath = path.join(ROOT, 'plugins', 'withOrionCinemaWebView.js');
const appConfigPath = path.join(ROOT, 'app.json');
const plugin = fs.readFileSync(pluginPath, 'utf8');
const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));

test('P10.5 Candidate 1 wires the desktop-parity yt-dlp and FFmpeg Android substrate only', () => {
  assert.match(plugin, /com\.github\.Lizzergas\.youtubedl-android:library:83f41ae27710b4a1d47f4a0095209f4325e4564f/);
  assert.match(plugin, /com\.github\.Lizzergas\.youtubedl-android:ffmpeg:83f41ae27710b4a1d47f4a0095209f4325e4564f/);
  assert.doesNotMatch(plugin, /io\.github\.junkfood02\.youtubedl-android:library:0\.18\.1/);
  assert.doesNotMatch(plugin, /io\.github\.junkfood02\.youtubedl-android:ffmpeg:0\.18\.1/);
  assert.match(plugin, /ORION_P105_DESKTOP_PARITY_DOWNLOAD_ENGINE_DEPENDENCIES/);
  assert.equal(
    appConfig.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-build-properties')?.[1]?.android?.useLegacyPackaging,
    true,
  );
  assert.doesNotMatch(plugin, /android:extractNativeLibs/);
  assert.doesNotMatch(plugin, /youtubedl-android:aria2c/);
});
