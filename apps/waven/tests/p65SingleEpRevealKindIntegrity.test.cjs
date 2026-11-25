const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const readApp = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

const reveal = readApp('src/features/navigation/wavenEntityReveal.ts');
const overlay = readApp('src/components/navigation/WavenEntityRevealOverlay.tsx');
const detail = readApp('src/components/detail/WavenMusicDetailFoundation.tsx');
const home = readApp('app/index.tsx');
const search = readApp('app/search.tsx');
const artistRoute = readApp('app/artist/[provider]/[id].tsx');
const albumRoute = readApp('app/album/[provider]/[id].tsx');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const newReleaseVerification = readApp('src/infrastructure/music/providers/newReleaseVerification.ts');

test('V3.4.11 reveal transactions carry Artist Album Single and EP semantic kinds', () => {
  assert.match(
    reveal,
    /WavenEntityRevealKind = 'artist' \| 'album' \| 'single' \| 'ep'/,
  );
  assert.match(reveal, /kind: WavenEntityRevealKind/);
  assert.match(reveal, /histories\.set\(input\.entityKey,[\s\S]*kind: input\.kind/);
  assert.match(reveal, /kind: history\.kind/);
});

test('V3.4.11 release kind mapping is generic and fail-safe to Album', () => {
  assert.match(reveal, /export function wavenReleaseRevealKind\(primaryType: unknown\)/);
  assert.match(reveal, /normalized === 'single'\) return 'single'/);
  assert.match(reveal, /normalized === 'ep' \|\| normalized === 'e\.p\.'\) return 'ep'/);
  assert.match(reveal, /return 'album'/);
  assert.doesNotMatch(reveal, /the cure|Olivia|Granted|Rose Song/i);
});

test('V3.4.11 keeps release anchor identity on the accepted Album route family', () => {
  assert.match(reveal, /WavenEntityRevealKeyKind = 'artist' \| 'album'/);
  assert.match(reveal, /wavenEntityRevealKey\([\s\S]*kind: WavenEntityRevealKeyKind/);
  assert.match(detail, /entityKey=\{`album:\$\{album\.source\.provider\}:\$\{album\.source\.id\}`\}/);
  assert.match(albumRoute, /wavenEntityRevealKey\('album', provider, id\)/);
  assert.doesNotMatch(albumRoute, /wavenEntityRevealKey\('single'|wavenEntityRevealKey\('ep'/);
});

test('V3.4.11 nested Artist releases seed reveal kind from authoritative primaryType', () => {
  assert.match(artistRoute, /seedWavenPresentation\(album, 'album'\)/);
  assert.match(artistRoute, /kind: wavenReleaseRevealKind\(presented\.primaryType\)/);
  assert.match(artistRoute, /entityKey: albumKey/);
  assert.match(artistRoute, /wavenEntityRevealKey\(\s*'album'/);
});

test('V3.4.11 Home and Search use the same release-kind mapper instead of Album collapse', () => {
  assert.match(home, /wavenReleaseRevealKind\(\(presented as MusicAlbum\)\.primaryType\)/);
  assert.match(search, /wavenReleaseRevealKind\(\(presented as MusicAlbum\)\.primaryType\)/);
  assert.doesNotMatch(home, /kind: type === 'artists' \? 'artist' : 'album'/);
  assert.doesNotMatch(search, /kind: itemScope === 'Artists' \? 'artist' : 'album'/);
});

test('V3.4.11 overlay renders semantic reveal label while Single and EP keep release geometry', () => {
  assert.match(overlay, /\{transition\.kind\.toUpperCase\(\)\}/);
  assert.match(overlay, /transition\?\.kind === 'artist'[\s\S]*:[\s\S]*Math\.max\(layout\.isCompact \? 420 : 456/);
  assert.match(overlay, /blurRadius=\{transition\.kind === 'artist' \? 36 : 30\}/);
  assert.match(overlay, /numberOfLines=\{transition\.kind === 'artist' \? 2 : 3\}/);
});

test('V3.4.11 does not introduce another navigation owner and reverse reveal reuses forward semantic history', () => {
  assert.match(reveal, /pendingEnterCommit/);
  assert.match(reveal, /pendingExitCommit/);
  assert.match(reveal, /kind: history\.kind/);
  assert.doesNotMatch(`${home}\n${search}\n${artistRoute}`, /navigation\.navigate|navigation\.push/);
});

test('V3.4.11 leaves V3.4.10 Single hydration and V3.4.9 New Releases provider ownership untouched', () => {
  assert.match(provider, /function isSingleRelease\(album: MusicAlbum\)/);
  assert.match(provider, /resolveSingleTrackFromCatalog/);
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS/);
  assert.match(newReleaseVerification, /Released on:/);
  assert.doesNotMatch(`${reveal}\n${home}\n${search}\n${artistRoute}`, /resolveSingleTrackFromCatalog|WAVEN_GLOBAL_DISCOVERY_MARKETS|Released on:/);
});
