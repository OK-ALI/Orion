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
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp(
  'src/infrastructure/music/providers/youtubeMusicMetadata.ts',
);
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo(
  'docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md',
);

test('P6.3 wires Home to the existing dashboard runtime with bounded cancellation and retry', () => {
  assert.match(home, /wavenDiscoveryRuntime/);
  assert.match(home, /\.getDashboard\(\{ signal: controller\.signal \}\)/);
  assert.match(home, /new AbortController\(\)/);
  assert.match(home, /return \(\) => controller\.abort\(\)/);
  assert.match(home, /discoveryRequestSequence/);
  assert.match(home, /setDiscoveryRetryNonce\(\(value\) => value \+ 1\)/);
  assert.match(runtime, /async getDashboard\(/);
});

test('P6.3 keeps the accepted Home hierarchy and adds truthful discovery states', () => {
  assert.match(home, /<WavenAppShell brandTagline>/);
  assert.match(home, /home-reference-02-feature/);
  assert.match(home, /Recently Played/);
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

test('P6.3 Explore destinations use semantic icons instead of fallback media artwork', () => {
  assert.match(home, /WavenExploreIcon/);
  assert.match(home, /icon: 'songs'/);
  assert.match(home, /icon: 'artists'/);
  assert.match(home, /icon: 'albums'/);
  assert.match(home, /kind=\{card\.icon\}/);
  assert.doesNotMatch(home, /home-explore-songs|home-explore-artists|home-explore-albums/);
  assert.match(exploreIcon, /WavenExploreIconKind = 'songs' \| 'artists' \| 'albums'/);
  assert.match(exploreIcon, /micCapsule/);
  assert.match(exploreIcon, /albumDisc/);
  assert.match(exploreIcon, /noteAccent/);
  assert.doesNotMatch(exploreIcon, /noteHeadAccent/);
});

test('P6.3 projects provider dashboard content into neutral Songs Artists Albums and Playlists groups', () => {
  assert.match(home, /HOME_DISCOVERY_GROUPS/);
  assert.match(home, /\{ type: 'tracks', label: 'Songs' \}/);
  assert.match(home, /\{ type: 'artists', label: 'Artists' \}/);
  assert.match(home, /\{ type: 'albums', label: 'Albums' \}/);
  assert.match(home, /\{ type: 'playlists', label: 'Playlists' \}/);
  assert.match(home, /buildDiscoveryGroups/);
  assert.match(home, /item\.source\.provider/);
  assert.match(home, /WavenHomeDiscoveryArtwork/);
  assert.match(home, /home-discovery-/);
  assert.doesNotMatch(home, /providerName|providerAttribution|YouTube Music|YOUTUBE MUSIC/);
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
  assert.match(home, /label: 'Playlists'/);
});

test('P6.3 keeps core Home discovery lanes structurally stable across dashboard variation', () => {
  assert.match(provider, /missingTargets = HOME_DISCOVERY_FILLERS\.filter/);
  assert.match(provider, /Promise\.all\(/);
  assert.match(provider, /ytmusic-home-directed-\$\{target\.type\}/);
  assert.match(provider, /Songs\/Artists\/Albums\/Playlists lane appear or disappear/);
  assert.doesNotMatch(provider, /region-aware starter shelves/);
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
});
