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

const provider = readApp(
  'src/infrastructure/music/providers/youtubeMusicMetadata.ts',
);
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const detailNavigation = readApp(
  'src/features/discovery/detailNavigation.ts',
);
const search = readApp('app/search.tsx');
const home = readApp('app/index.tsx');
const layout = readApp('app/_layout.tsx');
const artistRoute = readApp('app/artist/[provider]/[id].tsx');
const albumRoute = readApp('app/album/[provider]/[id].tsx');
const detailFoundation = readApp(
  'src/components/detail/WavenMusicDetailFoundation.tsx',
);
const heroVisual = readApp('src/components/detail/WavenDetailHeroVisual.tsx');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo(
  'docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md',
);

test('P6.4A adapts provider-backed artist and album browse detail without weakening strict entity classification', () => {
  assert.match(provider, /async getArtist\(artist, requestContext = \{\}\): Promise<MusicArtistDetail>/);
  assert.match(provider, /async getAlbum\(album, requestContext = \{\}\): Promise<MusicAlbumDetail>/);
  assert.match(provider, /detailBrowseId\(artist\)/);
  assert.match(provider, /detailBrowseId\(album\)/);
  assert.match(provider, /ytmRequest\(\s*'browse'/s);
  assert.match(provider, /collectContinuationTokens\(payload, 1\)/);
  assert.match(provider, /biography: ''/);
  assert.match(provider, /browsePageType === 'MUSIC_PAGE_TYPE_ARTIST'/);
  assert.match(
    provider,
    /explicitBrowseId && isAlbumBrowse\(type, explicitBrowseId\)/,
  );
  assert.match(
    provider,
    /if \(!isAlbumBrowse\(type, fallbackBrowseId\)\) return null;/,
  );
  assert.doesNotMatch(
    provider,
    /String\([^)]*\)\.startsWith\('UC'\)[\s\S]{0,400}satisfies MusicArtist/,
  );
});

test('P6.4A runtime resolves detail through the owning metadata provider with broker timeout cancellation and health', () => {
  assert.match(runtime, /async getArtist\(/);
  assert.match(runtime, /async getAlbum\(/);
  assert.match(runtime, /metadataProviderFor\(artist\.source\.provider\)/);
  assert.match(runtime, /metadataProviderFor\(album\.source\.provider\)/);
  assert.match(runtime, /queryMusicProviders\(/);
  assert.match(runtime, /timeoutMs: options\.timeoutMs \?\? 12_000/);
  assert.match(runtime, /canonicalizeWavenArtistDetail\(response\.results\[0\]\.value\)/);
  assert.match(runtime, /canonicalizeWavenAlbumDetail\(response\.results\[0\]\.value\)/);
});

test('P6.4A routes only Artist and Album entities from Search and Home into provider-neutral detail paths', () => {
  assert.match(detailNavigation, /pathname: '\/artist\/\[provider\]\/\[id\]'/);
  assert.match(detailNavigation, /pathname: '\/album\/\[provider\]\/\[id\]'/);
  assert.match(search, /scope === 'Artists'/);
  assert.match(search, /scope === 'Albums'/);
  assert.match(search, /router\.push\(detailRoute\)/);
  assert.match(home, /type === 'artists'/);
  assert.match(home, /type === 'albums'/);
  assert.match(home, /router\.push\(detailRoute\)/);
  assert.doesNotMatch(detailNavigation, /track|playlist/i);
});

test('P6.4A detail routes keep cancellation retry and truthful provider-backed content without playback or persistence creep', () => {
  assert.match(artistRoute, /new AbortController\(\)/);
  assert.match(artistRoute, /\.getArtist\(presentedSeedArtist, \{ signal: controller\.signal \}\)/);
  assert.match(albumRoute, /new AbortController\(\)/);
  assert.match(albumRoute, /\.getAlbum\(presentedSeedAlbum, \{ signal: controller\.signal \}\)/);
  assert.match(artistRoute, /Albums & Releases/);
  assert.match(albumRoute, /title="Tracks"/);
  assert.doesNotMatch(
    `${artistRoute}\n${albumRoute}\n${detailFoundation}`,
    /favorite|follow|download|add to playlist|MediaSession|resolveCandidate|playbackUrl|streamUrl|writePortableProfile|Orion Cloud/i,
  );
});

test('P6.4A detail family inherits WAVEN atmosphere and hides primary navigation on detail routes', () => {
  assert.match(layout, /pathname\.startsWith\('\/artist\/'\)/);
  assert.match(layout, /pathname\.startsWith\('\/album\/'\)/);
  assert.match(layout, /showAtmosphericCanvas \? <WavenAtmosphericCanvas cacheStatic \/> : null/);
  assert.match(layout, /showPrimaryNavigation \? <WavenBottomNav \/> : null/);
  assert.match(detailFoundation, /type DetailKind = 'Artist' \| 'Album' \| 'Single' \| 'EP';/);
  assert.match(detailFoundation, /kindLabel: DetailKind;/);
  assert.match(detailFoundation, /accessibilityLabel="Go back"/);
  assert.match(detailFoundation, /minimumTouchTarget/);
});

test('P6.4A docs preserve the locked P6.3 visual system and Phase 6 boundaries without advancing completion', () => {
  assert.match(design, /P6\.4A Artist \+ Album detail foundation contract/);
  assert.match(design, /P6\.3 Home \/ Discovery remains locked/);
  assert.match(master, /P6\.4A Artist \+ Album detail foundation/);
  assert.match(master, /Authoritative WAVEN v1 completion remains \*\*45%\*\*/);
  assert.match(master, /Phase 7 and every later phase remain \*\*NOT AUTHORIZED\*\*/);
  assert.match(design, /Follow, Favorite, Save, Add to Playlist, Download/);
});

test('P6.4B/C keeps artwork-led atmosphere without adding a blur dependency', () => {
  assert.match(heroVisual, /import \{ LinearGradient \} from 'expo-linear-gradient'/);
  assert.match(detailFoundation, /blurRadius=/);
  assert.match(detailFoundation, /WavenFullBleedArtwork/);
  assert.doesNotMatch(`${detailFoundation}\n${heroVisual}`, /BlurView|expo-blur|backdropFilter/);
});

test('P6.4B/C keeps editorial detail rows and suppresses generic unknown metadata', () => {
  assert.match(detailFoundation, /function cleanMetadata/);
  assert.match(detailFoundation, /\^unknown\(\?: artist\| album\)\?\$/i);
  assert.match(detailFoundation, /showArtwork = false/);
  assert.match(detailFoundation, /formatDuration\(track\.durationMs\)/);
  assert.match(artistRoute, /showArtwork/);
  assert.match(artistRoute, /fallbackArtistName=\{artist\.name\}/);
  assert.match(albumRoute, /fallbackArtistName=\{album\.artistName\}/);
  assert.doesNotMatch(detailFoundation, /'Unknown artist'/);
});

test('P6.4B/C records the physical visual rejection and keeps future blur/player ideas deferred', () => {
  assert.match(design, /rejected the initial detail presentation visually/i);
  assert.match(design, /The entity becomes the hero environment/);
  assert.match(design, /Artwork-derived blur is allowed inside the detail hero/);
  assert.match(design, /future Phase 10 Full Player, Lyrics, Queue/);
  assert.match(master, /P6\.4B\/C Immersive Artist \+ Album detail visual repair/);
  assert.match(master, /visually rejected/);
  assert.match(master, /completion remains \*\*45%\*\*/);
  assert.match(master, /Phase 7 and every later phase remain \*\*NOT AUTHORIZED\*\*/);
});
