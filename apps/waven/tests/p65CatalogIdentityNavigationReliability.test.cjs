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
const artistRoute = readApp('app/artist/[provider]/[id].tsx');
const albumRoute = readApp('app/album/[provider]/[id].tsx');
const shell = readApp('src/components/shell/WavenAppShell.tsx');
const bottomNav = readApp('src/components/shell/WavenBottomNav.tsx');
const detail = readApp('src/components/detail/WavenMusicDetailFoundation.tsx');
const revealRuntime = readApp('src/features/navigation/wavenEntityReveal.ts');
const revealOverlay = readApp('src/components/navigation/WavenEntityRevealOverlay.tsx');
const detailNavigation = readApp('src/features/discovery/detailNavigation.ts');
const searchSession = readApp('src/features/navigation/wavenSearchNavigationSession.ts');
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const canonical = readApp('src/features/discovery/wavenCanonicalPresentation.ts');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

test('P6.5 V3.4.3 preserves strict provider Artist browse identity from catalog evidence', () => {
  assert.match(provider, /function linkedArtistFromRuns\(/);
  assert.match(provider, /pageType\(run\.navigationEndpoint\) === 'MUSIC_PAGE_TYPE_ARTIST'/);
  assert.match(provider, /source: \{ provider: 'ytmusic-metadata', id: browseId \}/);
  assert.match(provider, /rememberCatalogArtistHint\(item, metadataRuns\(renderer\)\)/);
  assert.match(provider, /export function readYouTubeMusicCatalogArtistHint/);
});

test('P6.5 V3.4.3 resolves discovery Artists by canonical evidence instead of first homonym', () => {
  assert.match(runtime, /function resolveArtistCandidate\(/);
  assert.match(runtime, /candidate\.sourceHint/);
  assert.match(runtime, /const evidenceScores = new Map/);
  assert.match(runtime, /evidenceIsDecisive/);
  assert.match(runtime, /artist\.source\.provider/);
  assert.match(runtime, /artist\.source\.id/);
  assert.doesNotMatch(runtime, /return sameName\[0\]/);
  assert.match(runtime, /return null;\s*\n\}/);
});

test('P6.5 V3.4.3 ranks typed Search with linked canonical Artist evidence without hardcoded celebrities', () => {
  assert.match(runtime, /function rankSearchResultForQuery\(/);
  assert.match(runtime, /const artistEvidence = new Map</);
  assert.match(runtime, /readYouTubeMusicCatalogArtistHint\(item\)/);
  assert.match(runtime, /artistEvidence\.get\(key\)/);
  assert.match(runtime, /normalizedName === normalizedQuery/);
  assert.doesNotMatch(`${runtime}\n${provider}`, /\b(?:BTS|BLACKPINK|ROSÉ|LISA)\b/);
});

test('P6.5 V3.4.3 removes strong fan/unofficial Search noise and canonicalizes duplicate video forms', () => {
  assert.match(provider, /function isLowConfidenceSearchTrack\(/);
  assert.match(canonical, /ai\\s\+fan\\s\+song/);
  assert.match(canonical, /fan\[- \]\?made/);
  assert.match(canonical, /unofficial/);
  assert.match(provider, /function curateSearchTracks\(/);
  assert.match(provider, /canonicalizeWavenTracks\(tracks, \{ songsOnly: true \}\)/);
  assert.match(provider, /tracks: curateSearchTracks\(result\.tracks\)/);
});

test('P6.5 V3.4.3 refuses video-only New Releases filler while preserving deterministic global aggregation', () => {
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS\.map/);
  assert.match(provider, /Promise\.allSettled/);
  assert.match(provider, /mergeGlobalNewReleaseSections\(marketResults\)/);
  assert.match(provider, /candidate\.type === 'tracks'/);
  assert.match(provider, /!candidate\.videoPresentation/);
  assert.match(provider, /!isLowConfidenceSearchTrack\(candidate\.item as MusicTrack\)/);
});

test('P6.5 V3.4.3 bounds reveal anchor capture and provides an exact-once exit escape hatch', () => {
  assert.match(revealRuntime, /ANCHOR_CAPTURE_TIMEOUT_MS = 180/);
  assert.match(revealRuntime, /Promise\.race<WavenEntityRevealRect \| null>/);
  assert.match(revealRuntime, /setTimeout\(\(\) => resolve\(null\), ANCHOR_CAPTURE_TIMEOUT_MS\)/);
  assert.match(revealRuntime, /export function forceCompleteWavenEntityRevealExit/);
  assert.match(revealRuntime, /pending\.committed = true/);
  assert.match(revealRuntime, /pending\?\.commit\(\)/);
  assert.match(revealRuntime, /histories\.delete\(finished\.entityKey\)/);
});

test('P6.5 V3.4.3 keeps healthy reverse reveal choreography but adds a bounded watchdog fallback', () => {
  assert.match(revealOverlay, /EXIT_OWNERSHIP_MS = 72/);
  assert.match(revealOverlay, /EXIT_DEPARTURE_MS = 140/);
  assert.match(revealOverlay, /EXIT_TRAVEL_MS = 500/);
  assert.match(revealOverlay, /EXIT_LANDING_HANDOFF_MS = 96/);
  assert.match(revealOverlay, /EXIT_FAILSAFE_MS = 1800/);
  assert.match(revealOverlay, /forceCompleteWavenEntityRevealExit/);
  assert.match(revealOverlay, /transition\.phase === 'enter' \? ENTER_FAILSAFE_MS : EXIT_FAILSAFE_MS/);
  assert.match(revealOverlay, /forceExitTransition\(token\)/);
});

test('P6.5 V3.4.3 keeps UI Back and Android Back on one recoverable detail exit owner', () => {
  assert.match(detail, /const requestEntityBack = useCallback\(async \(\) =>/);
  assert.match(detail, /beginWavenEntityRevealExit\(/);
  assert.match(detail, /catch \{/);
  assert.match(detail, /onBackRef\.current\(\)/);
  assert.match(detail, /BackHandler\.addEventListener\('hardwareBackPress',[\s\S]*requestEntityBack/);
  assert.match(detail, /onPress=\{\(\) => void requestEntityBack\(\)\}/);
});

test('P6.5 V3.4.3 keeps Search query scope focus results suggestions and scroll in session navigation state', () => {
  for (const field of [
    'query:',
    'scope:',
    'status:',
    'result:',
    'suggestions:',
    'selectedDiscovery:',
    'focusedDiscoveryStatus:',
    'focusedDiscoverySections:',
    'scrollY:',
  ]) {
    assert.match(searchSession, new RegExp(field));
  }
  assert.match(searchSession, /SEARCH_NAVIGATION_HISTORY_LIMIT = 16/);
  assert.match(searchSession, /pushWavenSearchNavigationCheckpoint/);
  assert.match(searchSession, /popWavenSearchNavigationCheckpoint/);
  assert.match(search, /readWavenSearchNavigationSession\(\)/);
  assert.match(search, /writeWavenSearchNavigationSession/);
  assert.match(shell, /scrollRestoreRequest/);
  assert.match(shell, /scrollTo\?\.\(\{/);
});

test('P6.5 V3.4.3 returns Search-origin details to Search and unwinds Search internal history before leaving', () => {
  assert.match(detailNavigation, /export type WavenDetailReturnTarget = 'search'/);
  assert.match(search, /returnToSearch \? \{ returnTo: 'search' as const \} : undefined/);
  assert.match(search, /detailRouteForSearchItem\(item, itemScope, true\)/);
  assert.match(artistRoute, /if \(returnTo === 'search'\)[\s\S]*router\.navigate\('\/search'\)/);
  assert.match(albumRoute, /if \(returnTo === 'search'\)[\s\S]*router\.navigate\('\/search'\)/);
  assert.match(search, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(search, /if \(restorePreviousSearchState\(\)\) return true/);
  assert.match(search, /selectedDiscovery: null/);
});

test('P6.5 V3.4.3 adds contained bottom-nav drag navigation while preserving tap and cancellation semantics', () => {
  assert.match(bottomNav, /PanResponder\.create/);
  assert.match(bottomNav, /horizontal > vertical \* 1\.25/);
  assert.match(bottomNav, /NAV_SWIPE_COMMIT_RATIO = 0\.28/);
  assert.match(bottomNav, /NAV_SWIPE_VELOCITY = 0\.35/);
  assert.match(bottomNav, /selectionIndex\.setValue\(nextIndex\)/);
  assert.match(bottomNav, /router\.navigate\(ITEMS\[targetIndex\]\.href\)/);
  assert.match(bottomNav, /onPanResponderTerminate: \(\) =>/);
  assert.match(bottomNav, /settle\(0, 0\)/);
  assert.match(bottomNav, /if \(!active\) router\.navigate\(item\.href\)/);
  assert.match(bottomNav, /\.\.\.panResponder\.panHandlers/);
});

test('P6.5 V3.4.3 documents the bounded reliability slice and keeps Explore More deferred', () => {
  assert.match(master, /P6\.5 V3\.4\.3 catalog identity \+ navigation reliability/);
  assert.match(master, /display name is a query signal, not canonical Artist identity/i);
  assert.match(master, /Search navigation state is session-only/i);
  assert.match(master, /bottom navigation supports both tap and contained horizontal drag/i);
  assert.match(master, /Explore More remains deferred/i);
  assert.match(design, /V3\.4\.3 catalog identity \+ navigation reliability contract/);
  assert.match(design, /reverse reveal has a bounded escape path/i);
  assert.match(design, /No Explore More page is implemented by V3\.4\.3/i);
  assert.match(master, /WAVEN remains \*\*45%\*\*/);
});
