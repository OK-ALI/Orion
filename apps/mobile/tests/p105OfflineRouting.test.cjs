const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.5-C2 exposes Play Offline only for reconciled Verified Orion Library assets', () => {
  const list = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(list, /function verifiedOrionLibraryAssetId\(/);
  assert.match(list, /primary\?\.destination === 'orion-library' && primary\.availability === 'verified'/);
  assert.match(list, /asset\?\.destination === 'orion-library' && asset\.availability === 'verified'/);
  assert.match(list, /onPlayOffline\?: \(entry: OfflineMediaEntryV1, assetId: string\) => void/);
  assert.match(list, /label="Play Offline"/);
  assert.match(list, /onPlayOffline\(episode, episodePlayableAssetId\)/);
});

test('P10.5-C2 routes opaque asset identity instead of durable physical offline URI', () => {
  const downloads = read('app', '(tabs)', 'downloads.tsx');

  assert.match(downloads, /isOffline: 'true'/);
  assert.match(downloads, /offlineAssetId: assetId/);
  assert.match(downloads, /onPlayOffline=\{\(entry, assetId\) => router\.push/);
  assert.doesNotMatch(downloads, /offlineUri:/);
});

test('P10.5-C5 mounts the dedicated native offline surface by opaque asset ID and bypasses online metadata lookup', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const surface = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');

  assert.match(screen, /offlineAssetId\?: string/);
  assert.match(screen, /if \(offlineRequested\) \{\s*setImdbId\(null\);\s*return undefined;/);
  assert.match(screen, /if \(offlineRequested\) return '';/);
  assert.match(screen, /<OrionOfflinePlayerSurface/);
  assert.match(screen, /assetId=\{offlineAssetId\}/);
  assert.match(screen, /\) : \(\s*<EmbedPlayerSurface/);
  assert.match(screen, /PlayerStateOverlay/);
  assert.match(screen, /controller|setLoading/);
  assert.doesNotMatch(screen, /resolveNativeOfflinePlaybackV1|resolvedOfflineUri|streamContentType/);
  assert.doesNotMatch(screen, /offlineUri/);

  assert.match(surface, /requireNativeComponent<NativeOfflinePlayerProps>\('OrionOfflinePlayerView'\)/);
  assert.match(surface, /assetId=\{assetId\}/);
  assert.doesNotMatch(surface, /streamUrl|offlineUri|useVideoPlayer/);
});
