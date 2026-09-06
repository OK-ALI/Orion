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

  assert.match(pointer, /activeRateHz: 30 as 24 \| 30 \| 40/);
  assert.match(pointer, /constrained \? 24 : healthy \? 40 : 30/);
  assert.match(pointer, /frameIntervalRef\.current = Math\.round\(1000 \/ rate\)/);
  assert.match(pointer, /touches\.length >= 2/);
  assert.match(pointer, /pendingScrollRef/);
  assert.match(pointer, /cursor_move/);
  assert.match(pointer, /clearPendingPointer/);
  assert.match(pointer, /isPointerGestureActive/);
  assert.doesNotMatch(pointer, /console\.log/);
});

test('remote playback remains source-aware and does not fabricate unavailable timing', () => {
  const surface = read('src/features/connect/UnifiedRemoteSurface.tsx');
  const telemetry = read('src/features/connect/useLiveTelemetry.ts');

  assert.match(surface, /playback\.sourceLabel/);
  assert.match(surface, /Playback timing unavailable/);
  assert.match(surface, /primaryAction = playback\.paused \? 'play' : 'pause'/);
  assert.doesNotMatch(surface, /accessibilityLabel=["']Disconnect remote["']/);
  assert.match(surface, /Disconnect remote/);
  assert.match(telemetry, /remoteContextRef\.current\?\.capabilities\?\.canPlay/);
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

test('pointer keeps movement realtime but sends discrete click through the reliable acknowledgement lane', () => {
  const pointer = read('src/features/connect/useRemotePointer.ts');
  const controller = read('src/features/connect/useConnectController.ts');
  assert.match(pointer, /void reliableRef\.current\('cursor_click'\)/);
  assert.doesNotMatch(pointer, /sendRef\.current\('cursor_click'\)/);
  assert.match(controller, /useRemotePointer\(fireAndForgetRef, sendCommandRef\)/);
  assert.match(controller, /FIRE_AND_FORGET_ACTIONS = new Set\(\['cursor_move', 'scroll'\]\)/);
});

test('pointer health consumes native socket pressure and lowers the adaptive realtime rate', () => {
  const pointer = read('src/features/connect/useRemotePointer.ts');
  const controller = read('src/features/connect/useConnectController.ts');
  const nativeBridge = read('src/services/nativeSecureConnect.ts');
  assert.match(controller, /backpressured: socketBackpressured/);
  assert.match(controller, /onPressure: \(pressure\) => setSocketBackpressured/);
  assert.match(pointer, /health\.backpressured/);
  assert.match(pointer, /constrained \? 24 : healthy \? 40 : 30/);
  assert.match(nativeBridge, /orionSmartConnectPressure/);
});


test('passive trusted phones keep telemetry but require explicit Take Control before remote input', () => {
  const controller = read('src/features/connect/useConnectController.ts');
  const surface = read('src/features/connect/UnifiedRemoteSurface.tsx');
  assert.match(controller, /CONTROLLER_MANAGEMENT_ACTIONS/);
  assert.match(controller, /smart_connect_take_control/);
  assert.match(controller, /controllerAccess\.isActiveController/);
  assert.match(controller, /applyControllerAccess\(envelope\.payload\?\.controller\)/);
  assert.match(controller, /!controllerAccess\.isActiveController && !CONTROLLER_MANAGEMENT_ACTIONS\.has\(action\)/);
  assert.match(surface, /CONTROLLER ACCESS/);
  assert.match(surface, /Take Control/);
  assert.match(surface, /disabled=\{!controllerActive \|\| !canSeek\}/);
  assert.match(surface, /disabled=\{!isActiveController\}/);
});
