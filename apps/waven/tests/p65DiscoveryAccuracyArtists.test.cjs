const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const readApp = (relativePath) =>
  fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

const home = readApp('app/index.tsx');
const search = readApp('app/search.tsx');
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp(
  'src/infrastructure/music/providers/youtubeMusicMetadata.ts',
);

test('P6.5 V3.4.1 makes explicit music browse identity authoritative over incidental video playback identity', () => {
  const endpointArtist = provider.indexOf(
    "explicitBrowseId && type === 'MUSIC_PAGE_TYPE_ARTIST'",
  );
  const endpointAlbum = provider.indexOf(
    'explicitBrowseId && isAlbumBrowse(type, explicitBrowseId)',
  );
  const endpointVideo = provider.indexOf('if (videoId) {', endpointArtist);

  assert.ok(endpointArtist >= 0, 'endpoint Artist canonical identity');
  assert.ok(endpointAlbum >= 0, 'endpoint Album canonical identity');
  assert.ok(endpointVideo >= 0, 'endpoint Track fallback');
  assert.ok(endpointArtist < endpointVideo);
  assert.ok(endpointAlbum < endpointVideo);

  const listStart = provider.indexOf(
    'function normalizeListItem(item: any): MusicEntity | null',
  );
  const listArtist = provider.indexOf(
    "browsePageType === 'MUSIC_PAGE_TYPE_ARTIST'",
    listStart,
  );
  const listAlbum = provider.indexOf(
    'isAlbumBrowse(browsePageType, explicitBrowseId)',
    listStart,
  );
  const listVideo = provider.indexOf('if (videoId) {', listAlbum);

  assert.ok(listArtist >= listStart);
  assert.ok(listAlbum >= listStart);
  assert.ok(listVideo >= listStart);
  assert.ok(listArtist < listVideo);
  assert.ok(listAlbum < listVideo);

  assert.match(provider, /isExplicitNonMusicTrack/);
  assert.match(provider, /MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE/);
  assert.doesNotMatch(
    provider,
    /MUSIC_PAGE_TYPE_ARTIST'\s*\|\|\s*String\([^)]*\)\.startsWith\('UC'\)/,
  );
});

test('P6.5 V3.4.1 aggregates deterministic fixed-market New Releases instead of following device or VPN geography', () => {
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS/);
  assert.match(provider, /'US'/);
  assert.match(provider, /'GB'/);
  assert.match(provider, /'KR'/);
  assert.match(provider, /'JP'/);
  assert.match(provider, /'IN'/);
  assert.match(provider, /'BR'/);
  assert.match(provider, /'MX'/);
  assert.match(provider, /'DE'/);
  assert.match(provider, /Promise\.allSettled\(/);
  assert.match(provider, /mergeGlobalNewReleaseSections\(marketResults\)/);
  assert.match(provider, /FEmusic_new_releases/);
  assert.doesNotMatch(
    provider,
    /expo-location|navigator\.geolocation|react-native-geolocation|ipify|Localization\.region|getLocales\s*\(|TelephonyManager|SubscriptionManager/,
  );
});

test('P6.5 V3.4.1 keeps New Releases canonical and distinct from Trending presentation', () => {
  assert.match(provider, /type ReleaseSectionType = 'albums' \| 'tracks'/);
  assert.match(provider, /existing\.videoPresentation && !nextVideoPresentation/);
  assert.match(provider, /existing\.type === 'tracks'[\s\S]*type === 'albums'/);
  assert.doesNotMatch(
    provider,
    /ytmusic-new-releases-global-playlists/,
  );

  assert.match(home, /NEW_RELEASE_ALBUM_TARGET = 10/);
  assert.match(home, /HOME_DISCOVERY_LIMIT = 16/);
  assert.match(home, /const trendingKeys = new Set\(chartTracks\.map\(releaseFingerprint\)\)/);
  assert.match(home, /trendingKeys\.has\(key\) \|\| releaseKeys\.has\(key\)/);
  assert.match(home, /appendRelease\('albums', album\)/);
  assert.match(home, /appendRelease\('tracks', track\)/);
  assert.doesNotMatch(home, /collectDiscoveryItems\(newReleaseSections, 'playlists'\)/);
});

test('P6.5 V3.4.1 derives Artists to Explore from current release and chart signals while V3.4.3 makes provider identity authoritative', () => {
  assert.match(runtime, /collectArtistCandidates\(/);
  assert.match(runtime, /const releaseItems = releases\.sections\.flatMap/);
  assert.match(runtime, /const trendingItems = trending\.sections\.flatMap/);
  assert.match(runtime, /const scores = new Map/);
  assert.match(runtime, /getSearchGlobalCharts\(/);
  assert.match(runtime, /getSearchNewReleases\(/);
  assert.match(runtime, /readYouTubeMusicCatalogArtistHint/);
  assert.match(runtime, /function resolveArtistCandidate\(/);
  assert.match(runtime, /artist\.source\.provider === candidate\.sourceHint\?\.source\.provider/);
  assert.match(runtime, /const evidenceScores = new Map/);
  assert.match(runtime, /evidenceIsDecisive/);
  assert.doesNotMatch(runtime, /return sameName\[0\]/);
  assert.match(runtime, /seenArtistKeys/);
  assert.doesNotMatch(runtime, /seenArtistNames/);
  assert.match(runtime, /ARTISTS_TO_EXPLORE_LIMIT = 12/);
  assert.doesNotMatch(runtime, /ARTIST_DISCOVERY_SEEDS|featuredArtists\s*=\s*\[/);
});

test('P6.5 V3.4.1 inserts one compact Artist rail between Genre and Moods without changing focused or typed Search ownership', () => {
  const genre = search.indexOf('leading="Browse By" accent="Genre"');
  const artists = search.indexOf('title="Artists to Explore"');
  const moods = search.indexOf('leading="Moods &" accent="Moments"');

  assert.ok(genre >= 0);
  assert.ok(artists > genre);
  assert.ok(moods > artists);

  assert.match(search, /artistDiscoveryArtworkSize = layout\.isCompact \? 88 : 100/);
  assert.match(search, /scope="Artists"/);
  assert.match(search, /primaryHeading/);
  assert.match(search, /getArtistsToExploreSessionSnapshot/);
  assert.match(search, /\.getArtistsToExplore\(\{ signal: controller\.signal, refresh \}\)/);
  assert.match(search, /const isDiscoveryMode = trimmedQuery\.length === 0/);
  assert.match(search, /wavenDiscoveryRuntime\s*\.search\(safeQuery/);
  assert.match(search, /getSearchDiscoveryCategory/);
});

test('P6.5 V3.4.2 keeps visible discovery session-stable while retaining explicit refresh hints and cancellation', () => {
  assert.match(runtime, /DISCOVERY_REFRESH_HINT_MS = 15 \* 60 \* 1_000/);
  assert.match(runtime, /function refreshIsRecommended/);
  assert.match(runtime, /searchNewReleasesSessionCapturedAt = Date\.now\(\)/);
  assert.match(runtime, /searchGlobalChartsSessionCapturedAt = Date\.now\(\)/);
  assert.match(runtime, /artistsToExploreSessionCapturedAt = Date\.now\(\)/);
  assert.match(runtime, /searchNewReleasesGeneration/);
  assert.match(runtime, /searchGlobalChartsGeneration/);
  assert.match(runtime, /artistsToExploreGeneration/);
  assert.match(runtime, /refresh\?: boolean/);
  assert.match(search, /controller\.abort\(\)/);
  assert.match(home, /refresh: shouldRefresh/);
});
