const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');
const appConfig = JSON.parse(readApp('app.json'));
const rootLayout = readApp('app/_layout.tsx');

const discoveryAssets = {
  'assets/discovery/chill.png': ['c70805bda84485e64905d42e203832b8a46dacb1157e12465e199cb5f438edbc', 768, 768],
  'assets/discovery/classical.png': ['24620feb0fb83c0920b5fca5f166686e47ed5c4e2920e2fd27b71ddc85dfeaf7', 1024, 683],
  'assets/discovery/electronic.png': ['cce6fbdb7541c922497995cfc82f919dceeb546b47039d26a9a369c08e93df40', 1024, 683],
  'assets/discovery/feel-good.png': ['4ba1601dfbce61573185297c1badeff391558b0c4103ba06ecdc71daabf2e60f', 768, 768],
  'assets/discovery/focus.png': ['7d3db2184aab732b60dfce458fbeaf58e0d2e2a1f99fcfa56d228d76fbc5a445', 768, 768],
  'assets/discovery/global-charts.png': ['47e00baad07e2fbe5220f89193929c11d3edc6680f5271bae18a035eecc48b13', 768, 768],
  'assets/discovery/hip-hop.png': ['24d1aff651094817eecb8fc35d6b3c1b11b778d67fae910771219fbc893a03a1', 1024, 683],
  'assets/discovery/indie-alternative.png': ['b0267570bfafed0eaf029230ac9c94a99c066ea7ac8c87dfcbb5ceb7461edf71', 1024, 683],
  'assets/discovery/jazz.png': ['df71909f8aaa2686b99d3cb360a2c0a7f0ff8b9a29b1fc96fbf7e1953228b9e4', 1024, 683],
  'assets/discovery/new-releases.png': ['dbbfc04a9468c50f010c0572245dc13f0764b5d593bf848e5c3c9e6c8aaf5b40', 768, 768],
  'assets/discovery/party.png': ['1a4b0a775795d25b19653713b63e93e159ce0064c981c1ea87887372371f1dcf', 768, 768],
  'assets/discovery/pop.png': ['c01f23d9143c00dd3a1b5802d262c88df0e16cd29bda4416e1af900c616f703c', 1024, 683],
  'assets/discovery/rnb-soul.png': ['89fb1443af5029f24a4d2b58ff69ba26cfb59cc6fe30956b01ce8cc780fa8448', 1024, 683],
  'assets/discovery/rock.png': ['4b3c164b1060411e155c35298988f66248c9aae014acb42e0e105d394241994b', 1024, 683],
  'assets/discovery/sleep.png': ['7b45ac873fbbc356202b005b3f6f81312f5d0b765be01ddca8bf9177cda88c56', 768, 768],
  'assets/discovery/workout.png': ['0cd5d5856bc315d1a5cc461ceb2ea28e23b90692530533d237b121b358b70c5f', 768, 768],
};

function readPngInfo(relativePath) {
  const file = fs.readFileSync(path.join(appRoot, relativePath));
  assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    file,
    hash: crypto.createHash('sha256').update(file).digest('hex'),
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

test('P6.5 V3.4 makes zero-query Search taxonomy-first while preserving real focused discovery', () => {
  assert.doesNotMatch(search, /getDashboard\(\{ signal: controller\.signal, refresh \}\)/);
  assert.doesNotMatch(search, /collectSearchDiscoveryItems|before="Browse "|accent="Music"/);
  assert.doesNotMatch(search, /before="Explore Your Next "/);
  assert.doesNotMatch(search, /title="New Releases"|title="Global Charts"|SEARCH_DISCOVERY_ARTWORK/);
  assert.match(search, /before="Find Your " accent="Sound"/);
  assert.match(search, /leading="Browse By" accent="Genre"/);
  assert.match(search, /title="Artists to Explore"/);
  assert.match(search, /scope="Artists"/);
  assert.match(search, /primaryHeading/);
  assert.match(search, /leading="Moods &" accent="Moments"/);
  assert.match(search, /SEARCH_DISCOVERY_GENRE_DEFINITIONS/);
  assert.match(search, /SEARCH_DISCOVERY_MOOD_DEFINITIONS/);
  assert.match(search, /aliases\.includes\(normalizedTitle\)/);
  assert.match(search, /contentContainerStyle=\{styles\.moodDiscoveryRail\}/);
  assert.match(search, /snapToInterval=\{moodDiscoveryCardWidth \+ 10\}/);
  assert.match(search, /width=\{moodDiscoveryCardWidth\}/);
  assert.match(search, /moodDiscoveryCardWidth = useMemo/);
  assert.doesNotMatch(search, /discoveryFeatureGrid/);
  assert.doesNotMatch(search, /normalizedTitle\.includes|SEARCH_DISCOVERY_PREVIEW_CONCURRENCY|discoveryPreviewArtwork/);
  assert.match(search, /require\('\.\.\/assets\/discovery\/pop\.png'\)/);
  assert.match(search, /require\('\.\.\/assets\/discovery\/chill\.png'\)/);
  assert.doesNotMatch(search, /require\('\.\.\/assets\/discovery\/(?:new-releases|global-charts)\.png'\)/);
  assert.match(search, /Math\.round\(\(width \* 2\) \/ 3\)/);
  assert.match(search, /style=\{\[styles\.discoveryDestinationArtwork, \{ height, width \}\]\}/);
  assert.match(search, /discoveryDestinationArtwork:\s*\{\s*left: 0,\s*position: 'absolute',\s*top: 0,/);
  assert.doesNotMatch(search, /discoveryDestinationArtwork:\s*\{\s*\.\.\.StyleSheet\.absoluteFill/);
  assert.match(runtime, /getSearchDiscoveryCategories/);
  assert.match(runtime, /getSearchDiscoveryCategory/);
  assert.match(runtime, /getSearchNewReleases/);
  assert.match(runtime, /getSearchGlobalCharts/);
  assert.match(runtime, /getArtistsToExplore/);
  assert.match(runtime, /getArtistsToExploreSessionSnapshot/);
  assert.match(provider, /FEmusic_moods_and_genres/);
  assert.match(provider, /FEmusic_moods_and_genres_category/);
  assert.match(provider, /FEmusic_new_releases/);
  assert.match(runtime, /searchCategorySessionCache/);
  assert.match(runtime, /getSearchDiscoveryCategoriesSessionSnapshot/);
  assert.match(runtime, /getSearchDiscoveryCategorySessionSnapshot/);
  assert.match(search, /getSearchDiscoveryCategoriesSessionSnapshot/);
  assert.match(search, /getSearchDiscoveryCategorySessionSnapshot/);
  assert.doesNotMatch(search, /Start typing to bring the music into focus\./);
  assert.doesNotMatch(search, /discoveryChipRow|styles\.discoveryChip/);

  for (const [relativePath, [expectedHash, expectedWidth, expectedHeight]] of Object.entries(discoveryAssets)) {
    const { file, hash, width, height } = readPngInfo(relativePath);
    assert.ok(file.length > 500_000, `${relativePath} should preserve a high-fidelity optimized PNG presentation master`);
    assert.equal(hash, expectedHash, `${relativePath} must preserve the accepted optimized artwork bytes`);
    assert.equal(width, expectedWidth, `${relativePath} width`);
    assert.equal(height, expectedHeight, `${relativePath} height`);
  }
});

test('P6.5 keeps discovery and focused Search as distinct modes', () => {
  assert.match(search, /const isDiscoveryMode = trimmedQuery\.length === 0/);
  assert.match(search, /\{isDiscoveryMode \? \(/);
  assert.match(search, /SEARCH ACROSS/);
  assert.match(search, /YOUR SEARCH · \{scope\.toUpperCase\(\)\}/);
  assert.match(search, /status === 'ready' && scopedItems\.length > 0/);
});

test('P6.5 uses provider-backed cancellable suggestions without adding history persistence', () => {
  assert.match(runtime, /async getSuggestions\(/);
  assert.match(search, /SEARCH_SUGGESTION_DEBOUNCE_MS = 170/);
  assert.match(search, /wavenDiscoveryRuntime\s*\.getSuggestions\(safeQuery, \{ signal: controller\.signal \}\)/);
  assert.match(search, /sequence !== suggestionSequence\.current/);
  assert.match(search, /controller\.abort\(\)/);
  assert.match(search, /Search suggestions/);
  assert.doesNotMatch(search, /backgroundColor: 'rgba\(8, 15, 21, 0\.38\)'/);
  assert.doesNotMatch(search, /recentSearch|searchHistory|AsyncStorage|SecureStore/);
});

test('P6.5 preserves circular Artist identity and the locked Artist Album detail reveal owner', () => {
  assert.match(search, /const circular = scope === 'Artists'/);
  assert.match(search, /borderRadius=\{circular \? artworkSize \/ 2 : wavenRadii\.sm\}/);
  assert.match(search, /borderRadius=\{circular \? 29 : 10\}/);
  assert.match(search, /title="Artists to Explore"/);
  assert.match(search, /beginWavenEntityReveal/);
  assert.match(search, /primeWavenArtistDetail/);
  assert.match(search, /primeWavenAlbumDetail/);
});

test('P6.5 records reference translation and keeps Home Library playback Cloud and later phases out of scope', () => {
  assert.match(master, /P6\.5 Search Discovery \+ Suggestions — candidate 2026-09-19/);
  assert.match(master, /Zero-query Search becomes a real discovery surface/);
  assert.match(master, /Home Trending\/New Releases redesign/);
  assert.match(master, /Authoritative WAVEN v1 completion remains \*\*45%\*\*/);
  assert.match(master, /Phase 7\+ remain \*\*NOT AUTHORIZED\*\*/);
  assert.match(design, /P6\.5 Search discovery \+ suggestions visual contract — 2026-09-19/);
  assert.match(design, /Reference-image borrowing is structural only/);
  assert.match(design, /No fabricated categories/);
  assert.match(design, /provider-supplied mood and genre/);
  assert.match(design, /opaque browse params/);
  assert.match(master, /Global Charts uses the existing region-neutral global chart source/);
  assert.match(master, /New Releases uses the provider browse surface/);
  assert.match(design, /Home Explore shortcut row is removed/);
  assert.match(design, /Library remains Phase 7-owned/);
  assert.match(master, /P6\.5 physical visual repair V3/);
  assert.match(master, /two-column artwork-led discovery destination cards/);
  assert.match(design, /Orion-shaped discovery, WAVEN artwork identity/);
  assert.match(design, /open rows with quiet separators/);
  assert.match(master, /P6\.5 curated discovery artwork V3\.2/);
  assert.match(master, /signed APK physical acceptance/);
  assert.match(design, /16 lossless PNG presentation masters/);
  assert.match(design, /exact provider-category matches/);
  assert.match(design, /3:2 clipped destination viewport/);
  assert.match(design, /signed APK/);
  assert.doesNotMatch(search, /WavenPlaybackNative|MediaSession|resolveCandidate|resolveTrack|playbackUrl|streamUrl|NativeModules/);
  assert.equal(appConfig.expo.orientation, 'portrait');
  assert.doesNotMatch(`${search}\n${runtime}\n${rootLayout}`, /accelerometer_rotation|user_rotation|settings\s+put\s+system|wm\s+(?:set-)?rotation/i);
});
