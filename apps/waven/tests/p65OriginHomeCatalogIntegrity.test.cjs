const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const readApp = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

const home = readApp('app/index.tsx');
const search = readApp('app/search.tsx');
const searchSession = readApp('src/features/navigation/wavenSearchNavigationSession.ts');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const canonical = readApp('src/features/discovery/wavenCanonicalPresentation.ts');
const lifecycle = readApp('src/features/artwork/wavenArtworkLifecycle.ts');
const leaseHook = readApp('src/hooks/useWavenArtworkLease.ts');

test('P6.5 V3.4.7 preserves the accepted Home order including New Releases', () => {
  assert.match(home, /label: 'Trending Now'/);
  assert.match(home, /label: 'New Releases'/);
  const trending = home.indexOf("label: 'Trending Now'");
  const releases = home.indexOf("label: 'New Releases'");
  assert.ok(trending >= 0 && releases > trending);
  assert.match(home, /discoveryGroups\.map\(\(group\) =>/);
});

test('P6.5 V3.4.7 New Releases extraction consumes the whole semantic browse payload', () => {
  assert.match(provider, /function newReleaseSectionsFromPayload\(/);
  assert.match(provider, /const flat = splitResults\(dedupeMusicEntities\(collectMusicItems\(payload\)\)\)/);
  assert.match(provider, /shelfSections[\s\S]*flat\.albums/);
  assert.match(provider, /shelfSections[\s\S]*flat\.tracks/);
  assert.match(provider, /sections: newReleaseSectionsFromPayload\(/);
  assert.match(provider, /browseId: 'FEmusic_new_releases'/);
});

test('P6.5 V3.4.7 keeps New Releases dynamic and fixed-market rather than artist-specific', () => {
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS/);
  assert.match(provider, /mergeGlobalNewReleaseSections\(marketResults\)/);
  assert.doesNotMatch(provider, /\bJISOO\b|\bROS[EÉ]\b|\bLISA\b|new trick|SaWaDiKa|\bClick\b/);
});

test('P6.5 V3.4.7 Home reuses any visible authoritative snapshot while a missing lane hydrates', () => {
  assert.match(home, /const cachedGroups = buildDiscoveryGroups\(/);
  assert.match(home, /if \(!shouldRefresh && cachedGroups\.length > 0\)/);
  assert.match(home, /setDiscoveryStatus\('ready'\)/);
  assert.match(home, /if \(cachedTrending && cachedNewReleases\)/);
});

test('P6.5 V3.4.7 persists Artists to Explore horizontal origin state across detail Back', () => {
  assert.match(searchSession, /artistsToExploreX: number/);
  assert.match(searchSession, /updateWavenSearchArtistsToExploreScroll/);
  assert.match(search, /artistsToExploreXRef/);
  assert.match(search, /initialScrollX=\{artistsToExploreXRef\.current\}/);
  assert.match(search, /updateWavenSearchArtistsToExploreScroll\(scrollX\)/);
  assert.match(search, /railRef\.current\?\.scrollTo\(\{ x: initialScrollX, animated: false \}\)/);
});

test('P6.5 V3.4.7 same-name Artists never expose opaque provider/profile ID fragments', () => {
  assert.match(search, /function artistDisambiguationLabel/);
  assert.doesNotMatch(search, /Profile \$\{identityTail\}/);
  assert.doesNotMatch(search, /slice\(-6\)/);
  assert.match(search, /show less rather than leaking an internal-looking ID fragment/);
});

test('P6.5 V3.4.7 canonical track evidence uses provider metadata kind in addition to title semantics', () => {
  assert.match(provider, /const providerTypeSecondary = metadata\.some/);
  assert.match(provider, /video\|music video\|performance\|live performance/);
  assert.match(provider, /youtube-music-provider-type/);
  assert.match(provider, /secondary:[\s\S]*providerTypeSecondary/);
  assert.match(canonical, /readWavenMediaPresentationEvidence\(item\)\?\.secondary/);
});

test('P6.5 V3.4.7 focused discovery keeps explicit fallback ownership when provider artwork is absent', () => {
  assert.match(search, /artworkLease\.showFallback/);
  assert.match(search, /WavenArtworkFallback/);
  assert.match(search, /sourceKey: artworkUrl/);
});

test('P6.5 V3.4.7 does not regress the physically proven V3.4.6 artwork lease', () => {
  assert.match(lifecycle, /lastRenderedSourceKey/);
  assert.match(lifecycle, /readWavenArtworkBackupSource/);
  assert.match(leaseHook, /if \(result\.hadRendered\) setHasRendered\(true\)/);
  assert.doesNotMatch(leaseHook, /setHasRendered\(false\)/);
});

test('P6.5 V3.4.7 keeps canonical New Releases accuracy before quota', () => {
  assert.match(provider, /!candidate\.videoPresentation/);
  assert.match(provider, /!isLowConfidenceSearchTrack/);
  assert.match(provider, /isWavenSecondaryEntityPresentation\(item\)/);
  assert.doesNotMatch(provider, /releaseEntries\.push\([^)]*fallback|padNewReleases|newReleaseFiller/i);
});
