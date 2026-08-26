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

test('P10.5-C2 resolves native offline playback before mounting the native surface and bypasses online metadata lookup', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const surface = read('src', 'features', 'playback', 'NativePlayerSurface.tsx');

  assert.match(screen, /offlineAssetId\?: string/);
  assert.match(screen, /resolveNativeOfflinePlaybackV1\(offlineAssetId\)/);
  assert.match(screen, /if \(offlineRequested\) \{\s*setImdbId\(null\);\s*return undefined;/);
  assert.match(screen, /if \(offlineRequested\) return resolvedOfflineUri \|\| '';/);
  assert.match(screen, /streamContentType=\{offlineSource\?\.contentType\}/);
  assert.match(screen, /Preparing offline playback/);
  assert.match(screen, /PlayerStateOverlay/);
  assert.match(screen, /controller|setLoading/);
  assert.match(screen, /onRetry=\{\(\) => setOfflineResolveAttempt/);
  assert.doesNotMatch(screen, /offlineUri/);

  assert.match(surface, /streamContentType\?: 'hls'/);
  assert.match(surface, /useMemo<VideoSource>/);
  assert.match(surface, /\{ uri: streamUrl, contentType: streamContentType \}/);
  assert.match(surface, /useVideoPlayer\(videoSource,/);
});
