const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobileRoot = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(mobileRoot, file), 'utf8');

test('connected Smart Connect uses one unified adaptive surface', () => {
  const screen = read('src/features/connect/ConnectScreen.tsx');
  const surface = read('src/features/connect/UnifiedRemoteSurface.tsx');

  assert.match(screen, /<UnifiedRemoteSurface/);
  assert.doesNotMatch(screen, /modeTabs|setRemoteMode/);
  assert.match(surface, /Desktop touchpad/);
  assert.match(surface, /context\?\.canType/);
  assert.match(surface, /ACCESSIBILITY D-PAD/);
  assert.match(surface, /MeasuredScrubber/);
  assert.match(surface, /isLandscape \? styles\.rightPane/);
});

test('pointer input coalesces movement and supports two-finger scrolling', () => {
  const pointer = read('src/features/connect/useRemotePointer.ts');

  assert.match(pointer, /33/);
  assert.match(pointer, /touches\.length >= 2/);
  assert.match(pointer, /scroll/);
  assert.match(pointer, /cursor_move/);
});

test('Desktop receives unified remote scroll commands', () => {
  const hook = read('../desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js');
  assert.match(hook, /action === ['"]scroll['"]/);
  assert.match(hook, /scrollBy/);
});
