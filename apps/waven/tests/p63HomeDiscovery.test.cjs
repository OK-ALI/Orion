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
const exploreIcon = readApp('src/components/icons/WavenExploreIcon.tsx');
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

test('P6.3 wires Home to the existing dashboard runtime with bounded cancellation and retry', () => {
  assert.match(home, /wavenDiscoveryRuntime/);
  assert.match(home, /\.getDashboard\(\{ signal: controller\.signal, refresh: shouldRefresh \}\)/);
  assert.match(home, /new AbortController\(\)/);
  assert.match(home, /return \(\) => controller\.abort\(\)/);
  assert.match(home, /discoveryRequestSequence/);
  assert.match(home, /setDiscoveryRetryNonce\(\(value\) => value \+ 1\)/);
  assert.match(runtime, /async getDashboard\(/);
});

test('P6.3 keeps the accepted Home hierarchy and adds truthful discovery states', () => {
  assert.match(home, /<WavenAppShell brandTagline>/);
  assert.match(home, /home-reference-02-feature/);
  assert.match(home, /leading="Recently" accent="Played"/);
  assert.match(home, /EXPLORE_CARDS/);
  assert.match(home, /Open Your Library/);
  assert.match(home, /discoveryStatus === 'loading'/);
  assert.match(home, /discoveryStatus === 'ready'/);
  assert.match(home, /discoveryStatus === 'empty'/);
  assert.match(home, /discoveryStatus === 'error'/);
  assert.match(home, /Some discovery shelves are temporarily unavailable\./);
  assert.match(home, /accessibilityLabel="Retry Home discovery"/);
  assert.match(home, /minHeight: 48/);
});

test('P6.3 Explore destinations use WAVEN semantic identity icons instead of fallback media artwork', () => {
  assert.match(home, /WavenExploreIcon/);
  assert.match(home, /icon: 'songs'/);
  assert.match(home, /icon: 'artists'/);
  assert.match(home, /icon: 'albums'/);
  assert.match(home, /kind=\{card\.icon\}/);
  assert.doesNotMatch(home, /home-explore-songs|home-explore-artists|home-explore-albums/);
  assert.match(exploreIcon, /WavenExploreIconKind = 'songs' \| 'artists' \| 'albums'/);
  assert.match(exploreIcon, /songStem/);
  assert.match(exploreIcon, /songFlag/);
  assert.match(exploreIcon, /songHead/);
  assert.doesNotMatch(exploreIcon, /songBeam|songStemAccent|songHeadAccent/);
  assert.match(exploreIcon, /artistHead/);
  assert.match(exploreIcon, /artistBust/);
  assert.match(exploreIcon, /artistSignalBar/);
  assert.doesNotMatch(
    exploreIcon,
    /songGlyph|identityDot|artistBustMask|micCapsule|micCradle|micStand|micBase/,
  );
  assert.match(exploreIcon, /albumDisc/);
});

test('P6.3 translates Reference 02 into one WAVEN editorial card family across Home', () => {
  assert.match(home, /WavenSectionTitle/);
  assert.match(home, /leading="Recently" accent="Played"/);
  assert.match(home, /leading="Explore" single/);
  assert.match(home, /leading="Your" accent="Music"/);
  assert.match(home, /sectionTitleAccent/);
  assert.match(home, /sectionTitleSignalBar/);
  assert.match(home, /leading=\{group\.label\.split\(' '\)\[0\]\}/);
  assert.match(home, /accent=\{group\.label\.split\(' '\)\.slice\(1\)\.join\(' '\)\}/);
  assert.match(home, /const discoveryArtworkSize = layout\.isCompact/);
  assert.match(home, /const discoveryCardMinHeight = discoveryArtworkSize \+ 70/);
  assert.match(home, /snapToInterval=\{discoveryCardWidth \+ 10\}/);
  assert.match(home, /styles\.discoveryMeta/);
  assert.match(home, /styles\.cardTopHighlight/);
  assert.match(home, /paddingRight: Math\.round\(discoveryCardWidth \* 0\.5\)/);
  assert.match(home, /backgroundColor: 'rgba\(10, 17, 24, 0\.43\)'/);
  assert.match(home, /minHeight: 30/);
  assert.doesNotMatch(home, /discoveryGroupTitle/);
});

test('P6.3 uses a real chart signal for Popular Now and truthful editorial labels elsewhere', () => {
  assert.match(home, /GLOBAL_CHART_SECTION_ID = 'waven-global-top-50'/);
  assert.match(home, /chartTracks\.length > 0 \? 'Popular Now' : 'Discover Now'/);
  assert.match(home, /\{ type: 'artists', label: 'Featured Artists' \}/);
  assert.match(home, /\{ type: 'albums', label: 'Featured Albums' \}/);
  assert.match(home, /\{ type: 'playlists', label: 'Featured Playlists' \}/);
  assert.match(chartProvider, /SPOTIFY_CHARTS_URL/);
  assert.match(chartProvider, /id: 'waven-global-top-50'/);
  assert.match(chartProvider, /type: 'tracks'/);
  assert.match(runtime, /createSpotifyChartsDashboardProvider/);
  assert.match(runtime, /createSpotifyChartsDashboardProvider\(\),\s*createYouTubeMusicDashboardProvider\(\)/);
  assert.match(home, /WavenHomeDiscoveryArtwork/);
  assert.doesNotMatch(home, /providerName|providerAttribution|YouTube Music|Spotify|YOUTUBE MUSIC/);
});

test('P6.3 rejects generic UC channel identities unless the provider explicitly marks an artist page', () => {
  assert.match(provider, /type === 'MUSIC_PAGE_TYPE_ARTIST'/);
  assert.match(
    provider,
    /browseId && browsePageType === 'MUSIC_PAGE_TYPE_ARTIST'/,
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

test('P6.3 replaces the broad Top songs fallback with strict category-directed Home fillers', () => {
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
  assert.match(provider, /variable provider response must not make a core/);
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

test('P6.3 treats real dashboard playlist shelves as usable discovery instead of falsely falling back', () => {
  assert.match(
    provider,
    /\{ type: 'playlists' as const, items: groups\.playlists \}/,
  );
  assert.match(provider, /\.\.\.collectCatalogSections\(payload\)/);
  assert.match(provider, /sections\.some\(\(section\) => section\.type === target\.type\)/);
  assert.match(home, /type: 'playlists'/);
  assert.match(home, /label: 'Featured Playlists'/);
});

test('P6.3 keeps core Home discovery lanes structurally stable across dashboard variation', () => {
  assert.match(provider, /missingTargets = HOME_DISCOVERY_FILLERS\.filter/);
  assert.match(provider, /Promise\.all\(/);
  assert.match(provider, /ytmusic-home-directed-\$\{target\.type\}/);
  assert.match(provider, /Songs\/Artists\/Albums\/Playlists lane appear or disappear/);
  assert.doesNotMatch(provider, /region-aware starter shelves/);
});

test('P6.3 preserves one Home discovery snapshot for the app session until explicit retry', () => {
  assert.match(runtime, /dashboardSessionCache/);
  assert.match(runtime, /if \(!refresh && this\.dashboardSessionCache\)/);
  assert.match(runtime, /this\.dashboardSessionCache = result/);
  assert.match(runtime, /refresh\?: boolean/);
  assert.match(home, /refresh: shouldRefresh/);
});

test('P6.3 physical polish keeps explicit refresh one-shot and aligns media/icon geometry', () => {
  assert.match(home, /const discoveryCardWidth = discoveryArtworkSize \+ 32/);
  assert.match(home, /const discoveryCardMinHeight = discoveryArtworkSize \+ 70/);
  assert.match(home, /const lastExplicitRefreshNonce = useRef\(0\)/);
  assert.match(home, /const shouldRefresh =\s*discoveryRetryNonce > lastExplicitRefreshNonce\.current/);
  assert.match(home, /lastExplicitRefreshNonce\.current = discoveryRetryNonce/);
  assert.match(home, /refresh: shouldRefresh/);
  assert.match(home, /accessibilityLabel="Refresh Home discovery"/);
  assert.match(home, /styles\.discoveryCardContent/);
  assert.match(home, /\{ width: discoveryArtworkSize \}/);
  assert.match(home, /discoveryCardContent: \{[\s\S]*alignSelf: 'center'[\s\S]*gap: 7/);
  assert.match(home, /discoveryCard: \{[\s\S]*alignItems: 'center'[\s\S]*paddingHorizontal: 0/);
  assert.doesNotMatch(home, /discoveryMeta: \{[\s\S]{0,180}paddingHorizontal:/);
  assert.match(exploreIcon, /songStem/);
  assert.match(exploreIcon, /songFlag/);
  assert.match(exploreIcon, /artistSignalBar/);
  assert.doesNotMatch(exploreIcon, /identityDot|artistBustMask|songGlyph/);
});

test('P6.3 selective WAVEN Glass keeps artwork crisp and adds depth without a blur dependency', () => {
  assert.match(home, /styles\.shortcutGlassTint/);
  assert.match(home, /styles\.shortcutGlassInnerEdge/);
  assert.match(home, /styles\.mediaGlassTint/);
  assert.match(home, /styles\.mediaGlassInnerEdge/);
  assert.match(home, /shortcutGlassTint: \{[\s\S]*rgba\(38, 153, 223, 0\.018\)/);
  assert.match(home, /mediaGlassTint: \{[\s\S]*rgba\(38, 153, 223, 0\.012\)/);
  assert.match(home, /mediaGlassInnerEdge: \{[\s\S]*rgba\(93, 187, 237, 0\.045\)/);
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
  assert.match(home, /const discoveryCardWidth = discoveryArtworkSize \+ 32/);
  assert.match(home, /const discoveryCardMinHeight = discoveryArtworkSize \+ 70/);
  assert.match(home, /discoveryCardContent: \{[\s\S]*gap: 7/);
  assert.match(home, /discoveryMeta: \{[\s\S]*gap: 2/);
  assert.match(exploreIcon, /songStem/);
  assert.match(exploreIcon, /songFlag/);
  assert.match(exploreIcon, /songHead/);
  assert.doesNotMatch(exploreIcon, /songBeam|songStemAccent|songHeadAccent/);
  assert.match(exploreIcon, /artistSignalBar/);
  assert.doesNotMatch(atmosphericCanvas, /#FF|orange|coral|pink/i);
});

test('P6.3 keeps discovery cards informational and does not enter detail playback persistence or Cloud scope', () => {
  assert.match(home, /group\.items\.map/);
  assert.doesNotMatch(
    home,
    /WavenPlaybackNative|MediaSession|resolveCandidate|resolveTrack|playbackUrl|streamUrl|NativeModules/,
  );
  assert.doesNotMatch(home, /AsyncStorage|SecureStore|MMKV|sqlite|Orion Cloud|writePortableProfile/);
  assert.doesNotMatch(home, /router\.(?:push|navigate)\([^\n]*(?:artist|album)/i);
});

test('P6.3 docs record the bounded Home discovery slice without advancing completion or later phases', () => {
  assert.match(master, /P6\.3 Provider-backed Home \/ Discovery presentation/);
  assert.match(master, /wavenDiscoveryRuntime\.getDashboard\(\)/);
  assert.match(master, /Songs.*, \*\*Artists\*\*, \*\*Albums\*\*, and \*\*Playlists\*\*/s);
  assert.match(master, /Authoritative WAVEN v1 completion remains \*\*45%\*\*/);
  assert.match(master, /Phase 7 and every later phase remain \*\*NOT AUTHORIZED\*\*/);
  assert.match(design, /P6\.3 Home \/ Discovery implementation contract/);
  assert.match(design, /Do not render upstream dashboard titles, attribution, provider names, or provider diagnostics/);
  assert.match(design, /Expo Go is a valid first physical evidence tier/);
  assert.match(design, /Icons represent destinations and actions; artwork represents music entities/);
  assert.match(master, /WAVEN-owned stable core Home composition/);
  assert.match(design, /Popular Now/);
  assert.match(design, /Featured Artists/);
  assert.match(design, /Featured Albums/);
  assert.match(design, /Featured Playlists/);
  assert.match(design, /internal discovery foundation/i);
  assert.match(master, /editorial Home labels/i);
});
