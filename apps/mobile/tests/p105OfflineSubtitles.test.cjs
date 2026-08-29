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

test('P10.5-C3 keeps subtitle controls local across legacy fragment and framework finalized playback owners', () => {
  const legacy = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const hud = read('src', 'components', 'player', 'PlayerHUD.tsx');

  assert.match(hud, /onOpenSubtitles\?: \(\) => void/);
  assert.match(hud, />Subtitles</);

  assert.match(legacy, /canSubtitles: subtitleTracks\.length > 0/);
  assert.match(legacy, /onOpenSubtitles=\{subtitleTracks\.length > 0/);
  assert.match(legacy, /controller\.openOverlay\('subtitles'\)/);
  assert.match(legacy, /<OfflineSubtitleSheet/);
  assert.match(legacy, /facade\.selectSubtitle\(track\?\.id \|\| null\)/);

  assert.match(activity, /subtitleButton = button\("Subtitles Off"\)/);
  assert.match(activity, /OrionPlayerSubtitleParser\.parse/);
  assert.match(activity, /OrionPlayerSubtitleParser\.activeCue/);
  assert.match(activity, /prepareSubtitle\(subtitle: OrionOfflinePlayerSubtitle\)/);
  assert.match(activity, /contentResolver\.openInputStream\(subtitle\.document\.uri\)/);
});

test('P10.5-C3 subtitle selection remains local and does not add playback-time provider discovery', () => {
  const legacy = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const sheet = read('src', 'features', 'playback', 'OfflineSubtitleSheet.tsx');

  assert.match(sheet, /Downloaded and available offline/);
  assert.match(sheet, /onSelect: \(track: SubtitleTrack \| null\) => void/);
  assert.match(sheet, /accessibilityRole="radio"/);
  assert.doesNotMatch(legacy, /downloadSubtitles|discoverSubtitles|subtitleSources|fetch\(/);
  assert.doesNotMatch(sheet, /fetch\(|https?:\/\//);
  assert.doesNotMatch(activity, /https?:\/\/|SubDL|Wyzie|downloadSubtitles|discoverSubtitles/i);
});
