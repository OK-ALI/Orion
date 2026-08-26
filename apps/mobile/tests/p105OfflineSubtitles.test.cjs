const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.5-C3 prepares downloaded subtitle sidecars as local HLS WebVTT renditions', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const finalizer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadPortableFinalizer.kt');

  assert.match(manager, /tracks = asset\.optJSONArray\("tracks"\) \?: JSONArray\(\)/);
  assert.match(finalizer, /prepareOfflineSubtitlePresentations\(/);
  assert.match(finalizer, /writeOfflineWebVtt\(/);
  assert.match(finalizer, /offlineSrtToWebVtt\(/);
  assert.match(finalizer, /offlineAssToWebVtt\(/);
  assert.match(finalizer, /#EXT-X-MEDIA:TYPE=SUBTITLES/);
  assert.match(finalizer, /SUBTITLES=\\"orion-subtitles\\"/);
  assert.match(finalizer, /#EXT-X-PLAYLIST-TYPE:VOD/);
  assert.match(finalizer, /localPlaybackUri\(subtitle\)/);

  const resolverStart = finalizer.indexOf('fun prepareOfflinePlaybackPresentation(');
  const resolverEnd = finalizer.indexOf('fun finalizeToDeviceStorage(', resolverStart);
  assert.ok(resolverStart >= 0 && resolverEnd > resolverStart);
  const resolver = finalizer.slice(resolverStart, resolverEnd);
  assert.doesNotMatch(resolver, /https?:\/\//);
  assert.doesNotMatch(resolver, /SubDL|Wyzie|subdl|wyzie/);
});

test('P10.5-C3 activates the existing Orion subtitle HUD only when Expo exposes local tracks', () => {
  const surface = read('src', 'features', 'playback', 'NativePlayerSurface.tsx');
  const hud = read('src', 'components', 'player', 'PlayerHUD.tsx');

  assert.match(hud, /onOpenSubtitles\?: \(\) => void/);
  assert.match(hud, />Subtitles</);
  assert.match(surface, /player\.availableSubtitleTracks/);
  assert.match(surface, /canSubtitles: subtitleTracks\.length > 0/);
  assert.match(surface, /onOpenSubtitles=\{subtitleTracks\.length > 0/);
  assert.match(surface, /controller\.openOverlay\('subtitles'\)/);
  assert.match(surface, /<OfflineSubtitleSheet/);
  assert.match(surface, /player\.subtitleTrack = track/);
});

test('P10.5-C3 subtitle selection remains local and does not add playback-time provider discovery', () => {
  const surface = read('src', 'features', 'playback', 'NativePlayerSurface.tsx');
  const sheet = read('src', 'features', 'playback', 'OfflineSubtitleSheet.tsx');

  assert.match(sheet, /Downloaded and available offline/);
  assert.match(sheet, /onSelect: \(track: SubtitleTrack \| null\) => void/);
  assert.match(sheet, /accessibilityRole="radio"/);
  assert.doesNotMatch(surface, /downloadSubtitles|discoverSubtitles|subtitleSources|fetch\(/);
  assert.doesNotMatch(sheet, /fetch\(|https?:\/\//);
});
