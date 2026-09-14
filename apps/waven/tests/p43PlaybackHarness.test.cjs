const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const wavenRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(wavenRoot, relativePath), 'utf8');

const route = read('app/playback-debug.tsx');
const harness = read('src/features/playback/debug/PlaybackDebugHarness.tsx');

test('P4.3 keeps the playback harness on its bounded development route while Phase 5 removes validation links from product Home', () => {
  assert.match(route, /PlaybackDebugHarness/);
  assert.match(harness, /if \(!__DEV__\)/);
});

test('P4.3 harness controls the existing native playback owner instead of introducing another player', () => {
  assert.match(harness, /replaceNativeQueue/);
  assert.match(harness, /resolveNativeQueueItem/);
  assert.match(harness, /nativePlayback\.play/);
  assert.match(harness, /nativePlayback\.pause/);
  assert.match(harness, /nativePlayback\.next/);
  assert.match(harness, /nativePlayback\.previous/);
  assert.match(harness, /nativePlayback\.seekTo/);
  assert.match(harness, /subscribeNativePlayback/);
  assert.doesNotMatch(harness, /expo-audio|AudioPlayer|ExoPlayer|MediaPlayer|new Audio\(/);
});

test('P4.3 queue fixtures are stable intent only and source leases are injected separately', () => {
  assert.match(harness, /p43-harness-track-a/);
  assert.match(harness, /p43-harness-track-b/);
  assert.match(harness, /streamingProvider/);
  assert.doesNotMatch(harness, /resolvedSource\s*:/);
  assert.match(harness, /buildSource/);
  assert.match(harness, /Resolve current/);
  assert.match(harness, /Resolve all/);
});

test('P4.3 makes playback policy, snapshots, errors and persisted recovery intent observable', () => {
  assert.match(harness, /setRepeatMode/);
  assert.match(harness, /setShuffleEnabled/);
  assert.match(harness, /getPersistedPlaybackRecoveryState/);
  assert.match(harness, /Live native snapshot \/ errors/);
  assert.match(harness, /Read persisted recovery intent/);
});

test('P4.3 stays a bounded development harness without Cloud, downloads or final-player ownership', () => {
  assert.doesNotMatch(harness, /OrionCloud|GoogleDrive|download|offline library|lyrics|visualizer/i);
  assert.match(harness, /validation tooling, not the final WAVEN player/i);
});
