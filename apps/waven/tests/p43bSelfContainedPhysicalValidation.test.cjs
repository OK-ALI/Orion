const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const wavenRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(wavenRoot, relativePath), 'utf8');

const index = read('app/index.tsx');
const harness = read('src/features/playback/debug/PlaybackDebugHarness.tsx');

test('P4.3b keeps the harness hidden unless dev mode or the explicit physical-validation flag is enabled', () => {
  assert.match(index, /EXPO_PUBLIC_WAVEN_P4_PHYSICAL_VALIDATION/);
  assert.match(index, /__DEV__\s*\|\|\s*P4_PHYSICAL_VALIDATION/);
  assert.match(harness, /EXPO_PUBLIC_WAVEN_P4_PHYSICAL_VALIDATION/);
  assert.match(harness, /__DEV__\s*\|\|\s*P4_PHYSICAL_VALIDATION/);
  assert.match(harness, /if \(!__DEV__\)/);
  assert.match(harness, /if \(!P4_PHYSICAL_VALIDATION\)/);
});

test('P4.3b does not change playback ownership or introduce a second audio engine', () => {
  assert.match(harness, /nativePlayback/);
  assert.match(harness, /subscribeNativePlayback/);
  assert.doesNotMatch(harness, /expo-audio|AudioPlayer|ExoPlayer|MediaPlayer|new Audio\(/);
});

test('P4.3b physical-validation flag is build-time only and unrelated to Orion Cloud', () => {
  assert.doesNotMatch(index, /OrionCloud.*P4_PHYSICAL_VALIDATION|P4_PHYSICAL_VALIDATION.*OrionCloud/);
  assert.doesNotMatch(harness, /OrionCloud|GoogleDrive|OAuth/i);
});
