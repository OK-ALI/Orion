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
  assert.ok(surface.indexOf('const RemoteTouchpad = memo') < surface.indexOf('export function UnifiedRemoteSurface'));
  assert.match(surface, /scrollEnabled=\{!controller\.isPointerGestureActive\}/);
  assert.doesNotMatch(surface, /const Touchpad = \(\) =>/);
});

test('pointer input coalesces movement and supports two-finger scrolling', () => {
  const pointer = read('src/features/connect/useRemotePointer.ts');

  assert.match(pointer, /TARGET_FRAME_MS = 33/);
  assert.match(pointer, /touches\.length >= 2/);
  assert.match(pointer, /pendingScrollRef/);
  assert.match(pointer, /cursor_move/);
  assert.match(pointer, /clearPendingPointer/);
  assert.match(pointer, /isPointerGestureActive/);
  assert.doesNotMatch(pointer, /console\.log/);
});

test('reliable command acknowledgement waiter is installed before socket send', () => {
  const controller = read('src/features/connect/useConnectController.ts');
  const waiter = controller.indexOf('pendingAcks.current.set(command.id');
  const send = controller.indexOf('const sent = await sendSecureEnvelope', waiter);

  assert.ok(waiter > 0, 'acknowledgement waiter is registered');
  assert.ok(send > waiter, 'socket send happens only after waiter registration');
  assert.match(controller, /pending\.sequence === Number\(envelope\.payload\?\.sequence\)/);
  assert.match(controller, /pending\.connectionId === String\(envelope\.connectionId/);
});

test('Desktop receives unified remote scroll commands', () => {
  const hook = read('../desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js');
  assert.match(hook, /action === ['"]scroll['"]/);
  assert.match(hook, /scrollBy/);
});
