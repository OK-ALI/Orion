const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const wavenRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(wavenRoot, relativePath), 'utf8');

const harness = read('src/features/playback/debug/PlaybackDebugHarness.tsx');

test('P4.3b keeps the playback validation surface guarded by dev mode or the explicit physical-validation flag', () => {
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
  assert.doesNotMatch(harness, /OrionCloud|GoogleDrive|OAuth/i);
});
