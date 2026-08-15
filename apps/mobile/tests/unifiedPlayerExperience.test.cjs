"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(mobileRoot, "../..");
const readMobile = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readWorkspace = (relative) => fs.readFileSync(path.join(workspaceRoot, relative), "utf8");

test("one controller owns user-intent chrome independently from playback telemetry", () => {
  const controller = readMobile("src/features/playback/MobilePlayerController.tsx");
  const screen = readMobile("src/features/playback/PlayerScreen.tsx");
  assert.match(screen, /MobilePlayerControllerProvider/);
  assert.match(controller, /state\.hudState === 'initial' \? 3000 : 4000/);
  assert.match(controller, /state: 'visible-explicit'/);
  assert.match(controller, /hudState: 'pinned-by-sheet'/);
  assert.match(controller, /hudState: state\.hudBeforeSheet/);
  assert.match(controller, /state\.activeSessionId !== action\.sessionId/);
  assert.match(controller, /overlay: action\.overlay/);
  assert.match(controller, /current\.overlay !== 'none'/);
  assert.doesNotMatch(controller, /action\.snapshot\.state === 'buffering'[\s\S]{0,160}hudState/);
});

test("native and embedded surfaces register adapters without creating a second player", () => {
  const nativeSurface = readMobile("src/features/playback/NativePlayerSurface.tsx");
  const nativeHud = readMobile("src/components/player/PlayerHUD.tsx");
  const embeddedSurface = readMobile("src/features/playback/EmbedPlayerSurface.tsx");
  const embeddedHud = readMobile("src/features/playback/EmbeddedPlayerHud.tsx");
  assert.equal((nativeSurface.match(/useVideoPlayer\(/g) || []).length, 1);
  assert.equal((embeddedSurface.match(/<OrionCinemaWebView/g) || []).length, 1);
  assert.match(nativeSurface, /controller\.registerSurface/);
  assert.match(embeddedSurface, /controller\.registerSurface/);
  assert.match(embeddedHud, /pointerEvents="box-none"/);
  assert.doesNotMatch(embeddedSurface, /GestureDetector/);
  assert.match(embeddedSurface, /EmbeddedPlayerHud/);
  assert.match(nativeHud, /if \(controlledVisible === undefined\) resetHideTimer\(\)/);
  assert.match(nativeHud, /PlayerChromeHandle controlsVisible=\{controlsVisible\}/);
});

test("presentation modes use safe defaults and versioned provider preferences", () => {
  const preferences = readMobile("src/features/playback/presentationPreferences.ts");
  const sheet = readMobile("src/components/player/PresentationSheet.tsx");
  const nativeSurface = readMobile("src/features/playback/NativePlayerSurface.tsx");
  assert.match(preferences, /orion\.player\.presentation\.v1/);
  assert.match(preferences, /surface === 'native' \? preferences\.native : preferences\.embedded\[sourceId\] \|\| 'provider'/);
  for (const mode of ["fit", "fill", "stretch", "provider"]) assert.match(sheet, new RegExp(`id: '${mode}'`));
  assert.match(nativeSurface, /presentation === 'fill' \? 'cover'/);
  assert.match(nativeSurface, /presentation === 'stretch' \? 'fill' : 'contain'/);
});

test("immersive system UI owns and restores Android bars and cutout policy", () => {
  const nativeModule = readMobile("plugins/orion-cinema-webview-native/OrionPlayerSystemUiModule.kt");
  const hook = readMobile("src/features/playback/immersiveSystemUi.ts");
  assert.match(nativeModule, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
  assert.match(nativeModule, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES/);
  assert.match(nativeModule, /previousCutoutMode/);
  assert.match(nativeModule, /WindowInsetsCompat\.Type\.systemBars\(\)/);
  assert.match(hook, /module\.exit\(\)/);
  assert.match(hook, /AppState\.addEventListener/);
});

test("embedded HUD leaves provider touch ownership uncovered and keeps a safe reveal handle", () => {
  const hud = readMobile("src/features/playback/EmbeddedPlayerHud.tsx");
  const handle = readMobile("src/components/player/PlayerChromeHandle.tsx");
  const surface = readMobile("src/features/playback/EmbedPlayerSurface.tsx");
  const wrapper = readMobile("src/features/playback/OrionCinemaWebView.tsx");
  const manager = readMobile("plugins/orion-cinema-webview-native/OrionCinemaWebViewManager.kt");
  const blocker = readMobile("src/features/playback/mobileAdBlocker.ts");
  assert.match(hud, /useSafeAreaInsets/);
  assert.match(hud, /Math\.max\(insets\.top, 8\)/);
  assert.doesNotMatch(hud, /Math\.max\(insets\.top, 8\) \+ 44/);
  assert.match(hud, /pointerEvents="box-none"/);
  assert.match(hud, /PlayerChromeHandle/);
  assert.match(handle, /insets\.left \+ \(safeWidth \/ 2\) - 38/);
  assert.match(handle, /accessibilityLabel=\{controlsVisible \? 'Hide player controls' : 'Show player controls'\}/);
  assert.match(handle, /height: 44/);
  assert.match(surface, /PlayerStateOverlay/);
  assert.match(surface, /controller\.state\.overlay === 'subtitles'/);
  assert.match(surface, /onNativeSingleTap=\{controller\.toggleChromeFromUserTap\}/);
  assert.match(wrapper, /DeviceEventEmitter\.addListener\(["']OrionPlayerSingleTap["']/);
  assert.match(manager, /onSingleTapConfirmed/);
  assert.match(manager, /View\.OnTouchListener/);
  assert.match(manager, /webView\.setOnTouchListener\(tapObserver\)/);
  assert.match(manager, /override fun onTouch\(view: View\?, event: MotionEvent\)/);
  assert.match(manager, /return false/);
  assert.doesNotMatch(surface, /handleScreenTap|envelope\.type === ['"]TAP['"]/);
  assert.doesNotMatch(blocker, /type:\s*['"]TAP['"]/);
});

test("VidKing subtitle presentation repair is bounded, scrollable, and provider scoped", () => {
  const blocker = readMobile("src/features/playback/mobileAdBlocker.ts");
  const surface = readMobile("src/features/playback/EmbedPlayerSurface.tsx");
  assert.match(blocker, /createProviderPresentationScript/);
  assert.match(blocker, /sourceId !== 'vidking'/);
  assert.match(blocker, /data-orion-scroll-fixed/);
  assert.match(blocker, /overflow-y/);
  assert.match(blocker, /touch-action/);
  assert.match(blocker, /stopTimer = setTimeout\(stopObservation, 1600\)/);
  assert.match(surface, /createProviderPresentationScript\(sourceId\)/);
  assert.match(surface, /providerPresentationScript/);
});

test("native and embedded taps share one controller toggle without disturbing double tap seek", () => {
  const controller = readMobile("src/features/playback/MobilePlayerController.tsx");
  const nativeHud = readMobile("src/components/player/PlayerHUD.tsx");
  const nativeSurface = readMobile("src/features/playback/NativePlayerSurface.tsx");
  assert.match(controller, /toggleChromeFromUserTap/);
  assert.match(controller, /current\.overlay !== 'none'/);
  assert.match(controller, /current\.hudState === 'pinned-by-sheet'/);
  assert.match(controller, /current\.hudState === 'recovery'/);
  assert.match(nativeSurface, /onToggle=\{controller\.toggleChromeFromUserTap\}/);
  assert.match(nativeHud, /const singleTap = Gesture\.Tap\(\)\.onEnd\(\(\) => \{\s*runOnJS\(toggleControls\)\(\)/);
  assert.match(nativeHud, /const doubleTapLeft[\s\S]*player\.seekBy\(-10\)/);
  assert.match(nativeHud, /const doubleTapRight[\s\S]*player\.seekBy\(10\)/);
});

test("shield evidence enters React through a typed native callback with identity and sequence validation", () => {
  const wrapper = readMobile("src/features/playback/OrionCinemaWebView.tsx");
  const surface = readMobile("src/features/playback/EmbedPlayerSurface.tsx");
  const client = readMobile("plugins/orion-cinema-webview-native/OrionCinemaWebViewClient.kt");
  const contracts = readWorkspace("packages/shared/src/types/media.ts");
  assert.match(wrapper, /onNativeShieldEvidence/);
  assert.match(wrapper, /DeviceEventEmitter\.addListener\(["']OrionShieldEvidence["']/);
  assert.match(surface, /sequence <= nativeShieldSequence\.current/);
  assert.match(surface, /envelope\.sessionId !== telemetry\.getSession\(\)\.id/);
  assert.match(client, /RCTDeviceEventEmitter/);
  assert.match(client, /\.emit\("OrionShieldEvidence"/);
  assert.match(contracts, /OrionSubtitleGrantV1/);
});

test("loading truth distinguishes source preparation, provider wait, buffering, switching, offline and failure", () => {
  const overlay = readMobile("src/components/player/PlayerStateOverlay.tsx");
  const surface = readMobile("src/features/playback/EmbedPlayerSurface.tsx");
  for (const state of ["preparing", "waiting", "buffering", "switching", "offline", "failed"]) {
    assert.match(overlay, new RegExp(`${state}:`));
  }
  assert.match(surface, /controller\.setLoading\('preparing'\)/);
  assert.match(surface, /controller\.setLoading\('waiting'\)/);
  assert.match(surface, /controller\.setLoading\('switching'\)/);
});
