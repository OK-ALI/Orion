const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const readApp = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const canonical = readApp('src/features/discovery/wavenCanonicalPresentation.ts');
const reveal = readApp('src/features/navigation/wavenEntityReveal.ts');
const detail = readApp('src/components/detail/WavenMusicDetailFoundation.tsx');
const detailNavigation = readApp('src/features/discovery/detailNavigation.ts');
const prefetch = readApp('src/features/discovery/wavenDetailPrefetch.ts');
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const home = readApp('app/index.tsx');
const search = readApp('app/search.tsx');
const artistRoute = readApp('app/artist/[provider]/[id].tsx');
const albumRoute = readApp('app/album/[provider]/[id].tsx');
const shell = readApp('src/components/shell/WavenAppShell.tsx');
const bottomNav = readApp('src/components/shell/WavenBottomNav.tsx');
const searchSession = readApp('src/features/navigation/wavenSearchNavigationSession.ts');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

test('P6.5 V3.4.5 claims OPEN intent before any asynchronous source capture', () => {
  const claim = reveal.indexOf('pendingEnterCommit = {');
  const capture = reveal.indexOf('await captureRegistered(origins, input.entityKey)');
  assert.ok(claim >= 0 && capture > claim);
});

test('P6.5 V3.4.5 coalesces rapid duplicate taps into the owned transaction', () => {
  assert.match(reveal, /if \(activeTransition \|\| pendingEnterCommit\) return true/);
  assert.match(reveal, /pendingEnterCommit:[\s\S]*PendingCommit \| null/);
});

test('P6.5 V3.4.5 routes no-artwork and failed-measurement opens through exact-once intent fulfillment', () => {
  assert.match(reveal, /function fulfillEnterIntentWithoutReveal\(token: number\)/);
  assert.match(reveal, /if \(pending\.committed\) return true/);
  assert.match(reveal, /pending\.committed = true;[\s\S]*pending\.commit\(\)/);
  assert.match(reveal, /if \(!origin \|\| origin\.width <= 1 \|\| origin\.height <= 1\)[\s\S]*fulfillEnterIntentWithoutReveal\(token\)/);
});

test('P6.5 V3.4.5 Reduced Motion uses the same navigation owner rather than bypassing it', () => {
  assert.match(reveal, /options: \{ animate\?: boolean \} = \{\}/);
  assert.match(reveal, /options\.animate === false \|\| !artworkUrl/);
  assert.match(home, /\{ animate: !reducedMotion \}/);
  assert.match(search, /\{ animate: !reducedMotion \}/);
  assert.match(artistRoute, /\{ animate: !reducedMotion \}/);
});

test('P6.5 V3.4.5 forward watchdog recovery keeps a bounded landing lock around the committed OPEN intent', () => {
  assert.match(reveal, /DIRECT_LANDING_LOCK_MS = 2200/);
  assert.match(reveal, /releaseDirectEnterLock\(token\)/);
  assert.match(reveal, /pending\?\.commit\(\);[\s\S]*releaseDirectEnterLock\(token\)/);
});

test('P6.5 V3.4.5 destination landing acknowledges and releases the direct OPEN lock', () => {
  assert.match(reveal, /export function acknowledgeWavenEntityRevealLanding\(entityKey: string\)/);
  assert.match(detail, /acknowledgeWavenEntityRevealLanding\(entityKey\)/);
});

test('P6.5 V3.4.5 Back during enter cancels reveal ownership and performs the actual Back intent', () => {
  assert.match(reveal, /export function cancelWavenEntityRevealEnterForBack\(entityKey: string\)/);
  assert.match(detail, /activeReveal\?\.entityKey === entityKey && activeReveal\.phase === 'enter'/);
  assert.match(detail, /cancelWavenEntityRevealEnterForBack\(entityKey\);[\s\S]*onBackRef\.current\(\)/);
});

test('P6.5 V3.4.5 reverse watchdog still fulfills BACK exactly once', () => {
  assert.match(reveal, /export function forceCompleteWavenEntityRevealExit/);
  assert.match(reveal, /if \(pending\) pending\.committed = true/);
  assert.match(reveal, /histories\.delete\(finished\.entityKey\)/);
  assert.match(reveal, /pending\?\.commit\(\)/);
});

test('P6.5 V3.4.5 stale async enter work cannot complete a newer transaction', () => {
  const tokenChecks = reveal.match(/pendingEnterCommit\?\.token !== token/g) || [];
  assert.ok(tokenChecks.length >= 2);
});

test('P6.5 V3.4.5 session presentation identity is keyed by kind plus canonical provider identity', () => {
  assert.match(canonical, /return `\$\{kind\}:\$\{provider\}\\0\$\{id\}`/);
  assert.match(canonical, /const sessionPresentation = new Map<string, MusicEntity>\(\)/);
});

test('P6.5 V3.4.5 same-ID presentation merge prevents known artwork from downgrading to missing artwork', () => {
  assert.match(canonical, /function bestArtwork\(existing: string \| null, incoming: string \| null\)/);
  assert.match(canonical, /if \(!incoming\) return existing/);
  assert.match(canonical, /artworkUrl: bestArtwork\(/);
});

test('P6.5 V3.4.5 richer trustworthy artwork can upgrade the session presentation', () => {
  assert.match(canonical, /function artworkResolutionScore/);
  assert.match(canonical, /artworkResolutionScore\(incoming\) > artworkResolutionScore\(existing\)/);
});

test('P6.5 V3.4.5 detail route params are built from session-authoritative presentation state', () => {
  assert.match(detailNavigation, /readWavenPresentation\(seedWavenPresentation\(artist, 'artist'\), 'artist'\)/);
  assert.match(detailNavigation, /readWavenPresentation\(seedWavenPresentation\(album, 'album'\), 'album'\)/);
  assert.match(detailNavigation, /wavenEntityArtworkUrl\(presented\)/);
});

test('P6.5 V3.4.5 prefetch seeds presentation immediately without owning navigation', () => {
  assert.match(prefetch, /seedWavenPresentation\(artist, 'artist'\)/);
  assert.match(prefetch, /seedWavenPresentation\(album, 'album'\)/);
  assert.doesNotMatch(prefetch, /router\.|beginWavenEntityReveal/);
});

test('P6.5 V3.4.5 exact source presentation is used by Home Search and nested Album reveal seeds', () => {
  assert.match(home, /const presented = seedWavenPresentation\(item, presentationKindForHomeType\(type\)\)/);
  const homeArtworkTypeBindings = home.match(/<WavenHomeDiscoveryArtwork[\s\S]{0,220}?type=\{type\}/g) || [];
  assert.equal(homeArtworkTypeBindings.length, 2);
  assert.match(search, /const presented = seedWavenPresentation\(item, presentationKindForSearchScope\(itemScope\)\)/);
  assert.match(artistRoute, /seedWavenPresentation\(album, 'album'\)/);
  assert.match(artistRoute, /wavenEntityArtworkUrl\(presented\)/);
});

test('P6.5 V3.4.5 owns one shared secondary and low-confidence media classifier below surfaces', () => {
  assert.match(canonical, /WAVEN_SECONDARY_PRESENTATION_PATTERN/);
  assert.match(canonical, /WAVEN_LOW_CONFIDENCE_PRESENTATION_PATTERN/);
  assert.match(provider, /isWavenSecondaryPresentation/);
  assert.match(provider, /isWavenLowConfidencePresentation/);
  assert.match(home, /normalizeWavenCanonicalMediaText/);
});

test('P6.5 V3.4.5 Songs purity excludes explicit secondary Video and performance presentations', () => {
  assert.match(canonical, /canonicalizeWavenTracks\(/);
  assert.match(canonical, /!options\.songsOnly \|\| !isWavenSecondaryEntityPresentation\(track\)/);
  assert.match(provider, /canonicalizeWavenTracks\(tracks, \{ songsOnly: true \}\)/);
});

test('P6.5 V3.4.5 Artist detail canonicalizes Songs and releases through the shared layer', () => {
  assert.match(canonical, /canonicalizeWavenArtistDetail/);
  assert.match(canonical, /tracks: canonicalizeWavenTracks\(detail\.tracks, \{ songsOnly: true \}\)/);
  assert.match(canonical, /albums: canonicalizeWavenAlbums\(detail\.albums\)/);
  assert.match(runtime, /canonicalizeWavenArtistDetail/);
});

test('P6.5 V3.4.5 Album detail canonicalizes tracks through the same shared layer', () => {
  assert.match(canonical, /canonicalizeWavenAlbumDetail/);
  assert.match(runtime, /canonicalizeWavenAlbumDetail/);
});

test('P6.5 V3.4.5 New Releases keep fixed-market semantics while canonical presentation remains shared', () => {
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS/);
  assert.match(provider, /mergeGlobalNewReleaseSections\(marketResults\)/);
  assert.match(provider, /canonicalizeWavenDashboard/);
  assert.doesNotMatch(provider, /expo-location|navigator\.geolocation|ipify|TelephonyManager/);
});

test('P6.5 V3.4.5 same-name Artists are not collapsed by display name and Search can truthfully disambiguate homonyms', () => {
  assert.match(canonical, /Same display names are intentionally not[\s\S]*merged/);
  assert.match(runtime, /seenArtistKeys/);
  assert.doesNotMatch(runtime, /seenArtistNames/);
  assert.match(search, /artistDisambiguationLabel/);
  assert.doesNotMatch(search, /Profile \$\{identityTail\}/);
  assert.match(search, /show less rather than leaking an internal-looking ID fragment/);
});

test('P6.5 V3.4.5 provider artwork normalization searches nested metadata and chooses the largest trustworthy image', () => {
  assert.match(provider, /function nestedThumbnailList\(value: any, depth = 0\)/);
  assert.match(provider, /return nestedThumbnailList\(renderer\)/);
  assert.match(provider, /chooseWavenLargestArtwork/);
  assert.match(canonical, /const leftArea = Number\(left\?\.width \|\| 0\) \* Number\(left\?\.height \|\| 0\)/);
});

test('P6.5 V3.4.5 presentation store covers Track Artist Album and Playlist without a second identity owner', () => {
  assert.match(canonical, /WavenPresentationKind = 'track' \| 'artist' \| 'album' \| 'playlist'/);
  assert.match(canonical, /mergeSameIdentity<T extends MusicEntity>\([\s\S]*kind: WavenPresentationKind/);
  assert.match(canonical, /mergeSameIdentity\(existing, item, kind\)/);
  assert.match(canonical, /mergeTrack/);
  assert.match(canonical, /mergeArtist/);
  assert.match(canonical, /mergeAlbum/);
  assert.match(canonical, /mergePlaylist/);
});

test('P6.5 V3.4.5 focused discovery uses the same canonical dashboard and provider artwork path', () => {
  assert.match(runtime, /getSearchDiscoveryCategory\([\s\S]*canonicalizeWavenDashboard/);
  assert.match(provider, /getCategory\([\s\S]*canonicalizeWavenDashboard/);
});

test('P6.5 V3.4.5 primary pages are visually opaque while preserving the accepted WAVEN atmospheric surface', () => {
  assert.match(shell, /<WavenAtmosphericCanvas \/>/);
  assert.match(shell, /backgroundColor: wavenColors\.canvas/);
  assert.match(design, /outgoing\/incoming content sandwiches/i);
});

test('P6.5 V3.4.5 preserves bottom-nav pager direction Search restoration and the frozen phase boundary', () => {
  assert.match(bottomNav, /const rawIndex = startIndex - dx \/ step/);
  assert.match(bottomNav, /directionalValue < 0 \? 1 : directionalValue > 0 \? -1 : 0/);
  assert.match(searchSession, /query:/);
  assert.match(searchSession, /scope:/);
  assert.match(master, /P6\.5 V3\.4\.5 canonical presentation \+ atomic navigation/i);
  assert.match(master, /Explore More remains deferred/i);
  assert.match(master, /WAVEN completion remains \*\*45%\*\*|WAVEN remains \*\*45%\*\*/i);
  assert.match(master, /Phase 7\+ remain \*\*NOT AUTHORIZED\*\*/i);
});
