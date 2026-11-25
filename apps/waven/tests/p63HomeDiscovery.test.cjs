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

const home = readApp('app/index.tsx');
const sectionTitle = readApp('src/components/typography/WavenSectionTitle.tsx');
const atmosphericCanvas = readApp('src/components/surfaces/WavenAtmosphericCanvas.tsx');
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp(
  'src/infrastructure/music/providers/youtubeMusicMetadata.ts',
);
const chartProvider = readApp(
  'src/infrastructure/music/providers/spotifyChartsDashboard.ts',
);
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo(
  'docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md',
);

test('P6.5 V3.4 Home uses dedicated chart and new-release discovery with bounded cancellation and retry', () => {
  assert.match(home, /wavenDiscoveryRuntime/);
  assert.match(home, /getSearchGlobalCharts\(\{/);
  assert.match(home, /getSearchNewReleases\(\{/);
  assert.match(home, /new AbortController\(\)/);
  assert.match(home, /return \(\) => controller\.abort\(\)/);
  assert.match(home, /discoveryRequestSequence/);
  assert.match(home, /setDiscoveryRetryNonce\(\(value\) => value \+ 1\)/);
  assert.match(runtime, /async getSearchGlobalCharts\(/);
  assert.match(runtime, /async getSearchNewReleases\(/);
});

test('P6.5 V3.4 gives Home one deliberate hierarchy after the hero and truthful recent state', () => {
  assert.match(home, /<WavenAppShell brandTagline>/);
  assert.match(home, /home-reference-02-feature/);
  assert.match(home, /leading="Recently" accent="Played"/);
  assert.match(home, /label: 'Trending Now'/);
  assert.match(home, /label: 'New Releases'/);
  assert.doesNotMatch(home, /Featured Artists|Featured Albums|Featured Playlists/);
  assert.doesNotMatch(home, /Open Your Library|leading="Your" accent="Music"/);
  assert.doesNotMatch(home, /EXPLORE_CARDS|WavenExploreIcon|Choose a direction/);
  assert.match(home, /discoveryStatus === 'loading'/);
  assert.match(home, /discoveryStatus === 'ready'/);
  assert.match(home, /discoveryStatus === 'empty'/);
  assert.match(home, /discoveryStatus === 'error'/);
});

test('Home keeps the first-run Search affordance and transforms its hero from real P7 history without duplicate navigation', () => {
  assert.match(home, /router\.navigate\('\/search'\)/);
  assert.match(home, /latestPlay \? `Replay \$\{latestPlay\.title\}` : 'Explore music'/);
  assert.match(home, /const latestPlay = library\.state\.history\[0\]\?\.track/);
  assert.match(home, /discoveryGroups\.map/);
  assert.doesNotMatch(home, /WavenExploreIcon|EXPLORE_CARDS|Open Your Library|Your Music/);
  assert.match(sectionTitle, /wavenColors\.interactionBlue/);
});

test('P6.5 V3.4 Home media identity stays artwork-first with the accepted Sora split-heading grammar', () => {
  assert.match(home, /WavenSectionTitle/);
  assert.match(home, /leading="Recently" accent="Played"/);
  assert.match(sectionTitle, /accent/);
  assert.match(sectionTitle, /wavenColors\.interactionBlue/);
  assert.match(home, /leading=\{group\.label\.split\(' '\)\[0\]\}/);
  assert.match(home, /accent=\{group\.label\.split\(' '\)\.slice\(1\)\.join\(' '\)\}/);
  assert.match(home, /const discoveryArtworkSize = layout\.isCompact/);
  assert.match(home, /const discoveryMediaArtworkSize = discoveryCardWidth/);
  assert.match(home, /const discoveryCardMinHeight = discoveryMediaArtworkSize \+ 56/);
  assert.match(home, /snapToInterval=\{discoveryCardWidth \+ 10\}/);
  assert.match(home, /styles\.discoveryMeta/);
  assert.match(home, /paddingRight: Math\.round\(discoveryCardWidth \* 0\.5\)/);
  assert.match(home, /discoveryCard: \{[\s\S]*backgroundColor: 'transparent'/);
  assert.doesNotMatch(home, /styles\.mediaGlassTint|styles\.mediaGlassInnerEdge/);
});

test('P6.5 V3.4.1 keeps Trending chart-backed while New Releases becomes globally aggregated canonical release discovery', () => {
  assert.match(home, /GLOBAL_CHART_SECTION_ID = 'waven-global-top-50'/);
  assert.match(home, /section\.id === GLOBAL_CHART_SECTION_ID/);
  assert.match(home, /label: 'Trending Now'/);
  assert.doesNotMatch(home, /label: 'Discover Now'|label: 'Popular Now'/);
  assert.match(home, /NEW_RELEASE_ALBUM_TARGET = 10/);
  assert.match(home, /HOME_DISCOVERY_LIMIT = 16/);
  assert.match(home, /releaseFingerprint/);
  assert.match(runtime, /getSearchGlobalChartsSessionSnapshot/);
  assert.match(runtime, /getSearchNewReleasesSessionSnapshot/);
  assert.match(chartProvider, /SPOTIFY_CHARTS_URL/);
  assert.match(chartProvider, /id: 'waven-global-top-50'/);
  assert.match(chartProvider, /type: 'tracks'/);
  assert.match(provider, /FEmusic_new_releases/);
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS/);
  assert.match(provider, /mergeGlobalNewReleaseSections/);
  assert.doesNotMatch(home, /providerName|providerAttribution|YouTube Music|Spotify|YOUTUBE MUSIC/);
});

test('P6.3 rejects generic UC channel identities unless the provider explicitly marks an artist page', () => {
  assert.match(provider, /type === 'MUSIC_PAGE_TYPE_ARTIST'/);
  assert.match(
    provider,
    /explicitBrowseId &&[\s\S]*browsePageType === 'MUSIC_PAGE_TYPE_ARTIST'/,
  );
  assert.doesNotMatch(
    provider,
    /type === 'MUSIC_PAGE_TYPE_ARTIST' \|\|\s*String\(browseId\)\.startsWith\('UC'\)/,
  );
  assert.doesNotMatch(
    provider,
    /browsePageType === 'MUSIC_PAGE_TYPE_ARTIST' \|\|\s*\(titleEndpoint\.id && String\(browseId\)\.startsWith\('UC'\)\)/,
  );
});

test('P6.3 keeps strict category-directed dashboard fillers as a provider safeguard even though V3.4 no longer renders those generic Home shelves', () => {
  assert.doesNotMatch(provider, /\{ query: 'Top songs' \}/);
  assert.match(provider, /HOME_DISCOVERY_FILLERS/);
  assert.match(provider, /queries: \['popular songs'\]/);
  assert.match(provider, /queries: \['top music artists', 'top artists'\]/);
  assert.doesNotMatch(provider, /query: 'popular artists'/);
  assert.match(provider, /queries: \['popular albums'\]/);
  assert.match(provider, /queries: \['popular playlists'\]/);
  assert.match(provider, /flatDashboard\[target\.type\]/);
  assert.match(
    provider,
    /splitResults\(collectMusicItems\(directedPayload\)\)\[target\.type\]/,
  );
});

test('P6.3 rejects explicit non-music episode and podcast rows before videoId can promote them to Songs', () => {
  assert.match(provider, /function isExplicitNonMusicTrack/);
  assert.match(provider, /MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE/);
  assert.match(provider, /primaryType === 'episode'/);
  assert.match(provider, /primaryType === 'podcast'/);
  assert.match(provider, /videoId && isExplicitNonMusicTrack\(metadata, type\)/);
  assert.match(
    provider,
    /videoId && isExplicitNonMusicTrack\(metadata, browsePageType\)/,
  );
});

test('P6.5 V3.4.1 builds one release lane from canonical albums/singles plus track-only releases and removes cross-shelf duplicates', () => {
  assert.match(home, /const releaseAlbums = collectDiscoveryItems\(newReleaseSections, 'albums'\)/);
  assert.match(home, /const releaseTracks = collectDiscoveryItems\(newReleaseSections, 'tracks'\)/);
  assert.match(home, /NEW_RELEASE_ALBUM_TARGET/);
  assert.match(home, /trendingKeys\.has\(key\) \|\| releaseKeys\.has\(key\)/);
  assert.match(home, /appendRelease\('albums', album\)/);
  assert.match(home, /appendRelease\('tracks', track\)/);
  assert.match(home, /label: 'New Releases'/);
  assert.doesNotMatch(home, /collectDiscoveryItems\(newReleaseSections, 'playlists'\)/);
  assert.doesNotMatch(home, /Featured Artists|Featured Albums|Featured Playlists/);
});

test('P6.5 V3.4.2 keeps one authoritative session snapshot and treats age as an explicit refresh hint', () => {
  assert.match(runtime, /DISCOVERY_REFRESH_HINT_MS = 15 \* 60 \* 1_000/);
  assert.match(runtime, /function refreshIsRecommended/);
  assert.match(runtime, /return this\.searchNewReleasesSessionCache;/);
  assert.match(runtime, /return this\.searchGlobalChartsSessionCache;/);
  assert.match(runtime, /searchNewReleasesGeneration/);
  assert.match(runtime, /searchGlobalChartsGeneration/);
  assert.match(runtime, /requestGeneration !== this\.searchNewReleasesGeneration/);
  assert.match(runtime, /requestGeneration !== this\.searchGlobalChartsGeneration/);
  assert.match(runtime, /getDiscoveryFreshnessHints/);
  assert.match(home, /initialTrendingSnapshot/);
  assert.match(home, /initialNewReleasesSnapshot/);
  assert.match(runtime, /refresh\?: boolean/);
});

test('P6.5 V3.4 keeps explicit refresh one-shot and preserves accepted Home media geometry', () => {
  assert.match(home, /const discoveryCardWidth = discoveryArtworkSize \+ 32/);
  assert.match(home, /const discoveryMediaArtworkSize = discoveryCardWidth/);
  assert.match(home, /const discoveryCardMinHeight = discoveryMediaArtworkSize \+ 56/);
  assert.match(home, /const lastExplicitRefreshNonce = useRef\(0\)/);
  assert.match(home, /const shouldRefresh =\s*discoveryRetryNonce > lastExplicitRefreshNonce\.current/);
  assert.match(home, /lastExplicitRefreshNonce\.current = discoveryRetryNonce/);
  assert.match(home, /refresh: shouldRefresh/);
  assert.match(home, /accessibilityLabel="Refresh Home discovery"/);
  assert.match(home, /styles\.discoveryCardContent/);
  assert.match(home, /size=\{discoveryMediaArtworkSize\}/);
  assert.doesNotMatch(home, /WavenExploreIcon|EXPLORE_CARDS/);
});

test('P6.3 selective WAVEN Glass stays on utility surfaces while real media artwork remains shell-free', () => {
  assert.match(home, /styles\.shortcutGlassTint/);
  assert.match(home, /styles\.shortcutGlassInnerEdge/);
  assert.match(home, /shortcutGlassTint: \{[\s\S]*rgba\(38, 153, 223, 0\.018\)/);
  assert.doesNotMatch(home, /mediaGlassTint|mediaGlassInnerEdge/);
  assert.doesNotMatch(home, /BlurView|expo-blur|backdropFilter/);
  assert.match(design, /P6\.3 selective WAVEN Glass refinement/);
  assert.match(master, /P6\.3 selective WAVEN Glass refinement/);
});

test('P6.3 final Home micro-polish inherits the reference atmosphere without changing WAVEN identity', () => {
  assert.match(atmosphericCanvas, /PRIMARY_TOP_GLOW/);
  assert.match(atmosphericCanvas, /PRIMARY_MID_GLOW/);
  assert.match(atmosphericCanvas, /PRIMARY_LOWER_GLOW/);
  assert.match(atmosphericCanvas, /rgba\(69,191,239,0\.22\)/);
  assert.match(atmosphericCanvas, /rgba\(102,178,221,0\.085\)/);
  assert.match(atmosphericCanvas, /const isEntry = variant === 'entry'/);
  assert.match(atmosphericCanvas, /colors=\{isEntry \? ENTRY_BASE : PRIMARY_BASE\}/);
  assert.match(home, /discoveryCardContent: \{[\s\S]*gap: 8/);
  assert.match(home, /discoveryMeta: \{[\s\S]*gap: 2/);
  assert.doesNotMatch(home, /WavenExploreIcon|EXPLORE_CARDS/);
  assert.match(sectionTitle, /accessibilityRole="header"/);
  assert.match(sectionTitle, /wavenColors\.interactionBlue/);
  assert.doesNotMatch(atmosphericCanvas, /#FF|orange|coral|pink/i);
});

test('P6.5 V3.4 keeps Home discovery free of playback persistence and Cloud ownership', () => {
  assert.match(home, /data=\{group\.items\}/);
  assert.match(home, /renderItem=\{\(\{ item: \{ item, type \} \}\) =>/);
  assert.doesNotMatch(
    home,
    /WavenPlaybackNative|MediaSession|resolveCandidate|resolveTrack|playbackUrl|streamUrl|NativeModules/,
  );
  assert.doesNotMatch(home, /AsyncStorage|SecureStore|MMKV|sqlite|Orion Cloud|writePortableProfile/);
  assert.match(master, /No playback or persistence expansion/i);
});

test('P6.5 V3.4 records the bounded Home IA change without advancing completion or later phases', () => {
  assert.match(master, /P6\.5 V3\.4\.0 discovery hierarchy/);
  assert.match(master, /Hero → Recently Played → Trending Now → New Releases/);
  assert.match(master, /Authoritative WAVEN v1 completion remains \*\*45%\*\*/);
  assert.match(master, /Phase 7\+ remain \*\*NOT AUTHORIZED\*\*/);
  assert.match(design, /P6\.5 V3\.4\.0 discovery hierarchy contract/);
  assert.match(design, /Trending Now.*chart-backed/s);
  assert.match(design, /New Releases.*provider-backed/s);
  assert.match(design, /Featured Artists.*removed from Home/s);
  assert.match(design, /Your Music.*removed from Home/s);
});

test('P6.5 V3.4 preserves the locked Artist Album reveal owner for any navigable New Releases album cards', () => {
  assert.match(home, /detailRouteForHomeItem/);
  assert.match(home, /primeWavenAlbumDetail/);
  assert.match(home, /beginWavenEntityReveal/);
  assert.match(home, /wavenEntityRevealKey/);
  assert.match(home, /role="origin"/);
});
