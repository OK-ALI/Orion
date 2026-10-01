const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MOBILE = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(MOBILE, ...parts), 'utf8');

test('v3.2 Original uses the existing Cinema owner for a bounded post-layout compositor recovery', () => {
  const surface = read('src', 'features', 'playback', 'EmbedPlayerSurface.tsx');

  assert.match(surface, /androidLayerType="none"/);
  assert.match(surface, /presentationMode=\{presentation\}/);
  assert.match(surface, /key=\{`\$\{sourceId\}:\$\{playbackSessionId\}:\$\{surfaceRetryKey\}`\}/);
  assert.doesNotMatch(surface, /key=\{[^\n]*presentation/);

  const presentationChange = surface.slice(
    surface.indexOf('onChange={(mode: MobilePlayerPresentation) => {'),
    surface.indexOf('onClose={controller.closeOverlay}', surface.indexOf('onChange={(mode: MobilePlayerPresentation) => {')),
  );
  assert.match(presentationChange, /savePresentationPreference\('embed', sourceId, mode\)/);
  assert.match(presentationChange, /controller\.setPresentation\(mode\)/);
  assert.doesNotMatch(presentationChange, /reload\(|setSurfaceRetryKey|injectJavaScript|document\.|querySelector|style\.objectFit/);

  const wrapper = read('src', 'features', 'playback', 'OrionCinemaWebView.tsx');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewManager.kt');
  const client = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewClient.kt');
  assert.match(wrapper, /presentationMode,/);
  assert.match(wrapper, /presentationMode,\r?\n\s*\}\), \[downloadAllowed, downloadCaptureEnabled, downloadProviderClass, presentationMode,/);
  assert.match(manager, /armOriginalSurfaceRecovery\(viewWrapper, "mode-transition"\)/);
  assert.match(manager, /OnLayoutChangeListener/);
  assert.match(manager, /setLayerType\(View\.LAYER_TYPE_HARDWARE, null\)/);
  assert.match(manager, /buildLayer\(\)/);
  assert.match(manager, /setLayerType\(View\.LAYER_TYPE_NONE, null\)/);
  assert.match(manager, /postInvalidateOnAnimation\(\)/);
  assert.match(manager, /ORIGINAL_LAYOUT_SETTLE_MS = 72L/);
  assert.match(client, /onPageSettled\?\.invoke\(view\)/);
  assert.doesNotMatch(manager, /reload\(\)|loadUrl\(|evaluateJavascript/);
});

test('v3.2 Original repair freezes accepted Original geometry and healthy Fit Fill geometry', () => {
  const surface = read('src', 'features', 'playback', 'EmbedPlayerSurface.tsx');

  assert.match(surface, /presentation === 'provider'\s*\? \{ width: '100%' as const, height: '100%' as const, flex: 0, alignSelf: 'stretch' as const \}/);
  assert.match(surface, /containerStyle=\{presentation === 'provider' \? presentationStyle : undefined\}/);
  assert.doesNotMatch(surface, /presentation === 'provider'\s*\? \{[^}]*flex: 1/);
  assert.match(surface, /presentation === 'fit'\s*\? \(screenWiderThanVideo \? \{ height: '100%' as const, aspectRatio: 16 \/ 9, alignSelf: 'center' as const, flex: 0 \}/);
  assert.match(surface, /presentation === 'fill'\s*\? \(screenWiderThanVideo \? \{ width: '100%' as const, aspectRatio: 16 \/ 9, alignSelf: 'center' as const, flex: 0 \}/);
  assert.match(surface, /style=\{\[styles\.webVideo, presentationStyle\]\}/);
});

test('v3.2 Original recovery stays on the existing Orion Cinema WebView owner and freezes provider playback', () => {
  const wrapper = read('src', 'features', 'playback', 'OrionCinemaWebView.tsx');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewManager.kt');
  const delegate = read('plugins', 'orion-cinema-webview-native', 'OrionCinemaWebViewManagerDelegate.java');

  assert.match(wrapper, /nativeConfig=\{nativeConfig\}/);
  assert.match(manager, /class OrionCinemaWebViewManager : RNCWebViewManager\(\)/);
  assert.match(manager, /override fun getDelegate\(\): ViewManagerDelegate<RNCWebViewWrapper> = fabricDelegate/);
  assert.match(delegate, /super\.setProperty\(view, propName, value\)/);
  assert.match(wrapper, /props: \{ orionShieldSession: serializedManifest \}/);
  assert.match(manager, /parsePresentationMode\(serializedManifest\)/);
  assert.doesNotMatch(manager, /reload\(\)|loadUrl\(.*Original|evaluateJavascript.*Original/);
  assert.doesNotMatch(manager, /WebView\(/);
});
