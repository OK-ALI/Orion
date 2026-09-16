const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const readApp = (relativePath) =>
  fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readRepo = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const search = readApp('app/search.tsx');
const metadataAdapter = readApp(
  'src/infrastructure/music/providers/youtubeMusicMetadata.ts',
);
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo(
  'docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md',
);

test('P6.2 wires the product Search surface to the P6.1 discovery runtime with cancellation', () => {
  assert.match(search, /wavenDiscoveryRuntime/);
  assert.match(search, /\.search\(safeQuery, \{ signal: controller\.signal \}\)/);
  assert.match(search, /new AbortController\(\)/);
  assert.match(search, /controller\.abort\(\)/);
  assert.match(search, /SEARCH_DEBOUNCE_MS = 360/);
  assert.match(search, /safeQuery\.length < 2/);
});

test('P6.2 renders truthful loading, result, empty, partial and retry states without raw provider errors', () => {
  assert.match(search, /status === 'loading'/);
  assert.match(search, /status === 'error'/);
  assert.match(search, /status === 'ready' && scopedItems\.length === 0/);
  assert.match(search, /status === 'ready' && scopedItems\.length > 0/);
  assert.match(search, /Some results may be unavailable\./);
  assert.match(search, /accessibilityLabel="Retry search"/);
  assert.doesNotMatch(search, /\{providerErrors\.join/);
  assert.doesNotMatch(search, /\{providerErrors\[0\]/);
});

test('P6.2 keeps Search scope, artwork, provider identity, and classification bounded', () => {
  assert.match(search, /const SEARCH_SCOPES = \['Songs', 'Artists', 'Albums', 'Playlists'\]/);
  assert.match(search, /itemsForScope/);
  assert.match(search, /WavenSearchArtwork/);
  assert.match(search, /WavenArtworkFallback/);
  assert.doesNotMatch(
    search,
    /providerName|providerAttribution|YouTube Music|YOUTUBE MUSIC/,
  );
  assert.match(
    metadataAdapter,
    /browsePageType === 'MUSIC_PAGE_TYPE_PLAYLIST'/,
  );
  assert.match(metadataAdapter, /String\(browseId\)\.startsWith\('VL'\)/);
  assert.match(
    metadataAdapter,
    /browsePageType === 'MUSIC_PAGE_TYPE_ALBUM'/,
  );
  assert.match(metadataAdapter, /id\.startsWith\('MPRE'\)/);
  assert.match(
    metadataAdapter,
    /if \(!isAlbumBrowse\(type, browseId\)\) return null;/,
  );
  assert.match(
    metadataAdapter,
    /if \(browseId && isAlbumBrowse\(browsePageType, browseId\)\)/,
  );
  assert.doesNotMatch(
    metadataAdapter,
    /if \(browseId\) \{\s*return \{\s*id: `ytmusic-album:/,
  );
  assert.doesNotMatch(
    search,
    /WavenPlaybackNative|MediaSession|resolveCandidate|resolveTrack|playbackUrl|streamUrl|NativeModules/,
  );
});

test('P6.2 records the published P6.1 foundation and leaves completion and later phases unchanged', () => {
  assert.match(master, /P6\.2 Provider-backed Search presentation/);
  assert.match(
    master,
    /P6\.1 is checkpointed and published at `fa2ec829a989b7e0edb93aa61821da49b63d03c0`/,
  );
  assert.match(master, /first physical product check is Expo Go suitable/);
  assert.match(master, /Authoritative WAVEN v1 completion remains \*\*45%\*\*/);
  assert.match(master, /Phase 7 and every later phase remain \*\*NOT AUTHORIZED\*\*/);
  assert.match(
    master,
    /underlying metadata-provider brand stays internal and is not shown on WAVEN product surfaces/,
  );
  assert.match(
    design,
    /WAVEN product surfaces do not display upstream metadata-provider brand names/,
  );
});
