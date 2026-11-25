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

const layout = readApp('app/_layout.tsx');
const home = readApp('app/index.tsx');
const search = readApp('app/search.tsx');
const revealRuntime = readApp('src/features/navigation/wavenEntityReveal.ts');
const revealOverlay = readApp('src/components/navigation/WavenEntityRevealOverlay.tsx');
const bottomNav = readApp('src/components/shell/WavenBottomNav.tsx');
const searchSession = readApp('src/features/navigation/wavenSearchNavigationSession.ts');
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const canonical = readApp('src/features/discovery/wavenCanonicalPresentation.ts');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

function sourcePattern(name) {
  const start = canonical.indexOf(`export const WAVEN_${name} = new RegExp(`);
  assert.ok(start >= 0, `${name} declaration should remain inspectable`);
  const end = canonical.indexOf(`].join('|')`, start);
  assert.ok(end > start, `${name} pattern body should remain inspectable`);
  const body = canonical.slice(start, end);
  const parts = [...body.matchAll(/String\.raw`([^`]*)`/g)].map(
    (match) => match[1],
  );
  assert.ok(parts.length > 0, `${name} should contain pattern parts`);
  return new RegExp(parts.join('|'), 'iu');
}


test('P6.5 V3.4.4 gives forward reveal an exact-once escape path instead of exit-only recovery', () => {
  assert.match(revealRuntime, /export function forceCompleteWavenEntityRevealEnter\(token: number\)/);
  assert.match(revealRuntime, /activeTransition\?\.token !== token[\s\S]*activeTransition\.phase !== 'enter'/);
  assert.match(revealRuntime, /pendingEnterCommit\?\.token === token && !pendingEnterCommit\.committed/);
  assert.match(revealRuntime, /if \(pending\) pending\.committed = true/);
  assert.match(revealRuntime, /activeTransition = null;[\s\S]*pending\?\.commit\(\);[\s\S]*releaseDirectEnterLock\(token\)/);
  assert.match(revealRuntime, /export function forceCompleteWavenEntityRevealTransaction/);
});

test('P6.5 V3.4.4 bounds the whole reveal transaction in both directions', () => {
  assert.match(revealOverlay, /ENTER_FAILSAFE_MS = 2600/);
  assert.match(revealOverlay, /EXIT_FAILSAFE_MS = 1800/);
  assert.match(revealOverlay, /transition\.phase === 'enter'[\s\S]*forceEnterTransition\(token\)[\s\S]*forceExitTransition\(token\)/);
  assert.match(revealOverlay, /transition\.phase === 'enter' \? ENTER_FAILSAFE_MS : EXIT_FAILSAFE_MS/);
  assert.match(revealOverlay, /forceCompleteWavenEntityRevealEnter/);
  assert.match(revealOverlay, /forceCompleteWavenEntityRevealExit/);
});

test('P6.5 V3.4.4 Reduced Motion cannot deadlock behind undecoded transition artwork', () => {
  const reducedMotion = revealOverlay.indexOf('if (reducedMotion) {');
  const visualGate = revealOverlay.indexOf('if (!transition.visualReady) return;');
  assert.ok(reducedMotion >= 0 && visualGate > reducedMotion);
  assert.match(revealOverlay, /commitWavenEntityRevealEnter\(transition\.token\);\s*completeWavenEntityReveal\(transition\.token\)/);
  assert.match(revealOverlay, /commitWavenEntityRevealExit\(transition\.token\);\s*completeWavenEntityReveal\(transition\.token\)/);
});

test('P6.5 V3.4.4 stale reveal watchdogs cannot complete a newer transaction token', () => {
  assert.match(revealRuntime, /activeTransition\?\.token !== token/);
  assert.match(revealRuntime, /pendingEnterCommit\?\.token === token/);
  assert.match(revealRuntime, /pendingExitCommit\?\.token === token/);
  assert.match(revealOverlay, /const token = transition\.token/);
});

test('P6.5 V3.4.4 merges canonical Artist identity with same-ID presentation artwork', () => {
  assert.match(canonical, /const sessionPresentation = new Map<string, MusicEntity>\(\)/);
  assert.match(canonical, /wavenPresentationKey/);
  assert.match(canonical, /existing\.source\.provider !== incoming\.source\.provider/);
  assert.match(canonical, /existing\.source\.id !== incoming\.source\.id/);
  assert.match(canonical, /function bestArtwork/);
  assert.match(canonical, /if \(!incoming\) return existing/);
  assert.doesNotMatch(canonical, /sessionPresentation\.get\([^)]*name/i);
});

test('P6.5 V3.4.4 exposes a lightweight Artist presentation lookup instead of loading full detail just for artwork', () => {
  assert.match(provider, /export interface WavenArtistPresentationProvider/);
  assert.match(provider, /getArtistPresentation\(/);
  assert.match(provider, /async getArtistPresentation\(artist, requestContext = \{\}\)/);
  const presentationMethod = provider.match(
    /async getArtistPresentation\(artist, requestContext = \{\}\)[\s\S]*?\n    },/,
  )?.[0] || '';
  assert.match(presentationMethod, /ytmRequest\([\s\S]*'browse'/);
  assert.match(presentationMethod, /detailHeader\(payload, 'artist', artist\)/);
  assert.doesNotMatch(presentationMethod, /collectContinuationTokens|continueSearch/);
});

test('P6.5 V3.4.4 enriches final Artist presentation without weakening provider ID authority', () => {
  assert.match(runtime, /function mergeArtistPresentation\(/);
  assert.match(runtime, /presentation\.source\.provider === identity\.source\.provider/);
  assert.match(runtime, /presentation\.source\.id === identity\.source\.id/);
  assert.match(runtime, /private async enrichArtistPresentation\(/);
  assert.match(runtime, /activeProvider\.getArtistPresentation\(artist, \{ signal \}\)/);
  assert.match(runtime, /const enrichedArtists = await this\.enrichArtistPresentations\(/);
  assert.match(runtime, /artists: enrichedArtists/);
});

test('P6.5 V3.4.4 promotes exact canonical linked Artist evidence into Artist Search results', () => {
  assert.match(runtime, /const artistEvidence = new Map</);
  assert.match(runtime, /readYouTubeMusicCatalogArtistHint\(item\)/);
  assert.match(runtime, /const artistByKey = new Map<string, MusicArtist>\(\)/);
  assert.match(runtime, /for \(const \[key, evidence\] of artistEvidence\)/);
  assert.match(runtime, /normalizeArtistIdentity\(evidence\.artist\.name\) !== normalizedQuery/);
  assert.match(runtime, /artistByKey\.set\(/);
  assert.match(runtime, /provider Artist browse identity/i);
});

test('P6.5 V3.4.4 distinguishes strong Artist intent from exact-title coincidence in Songs and Albums', () => {
  assert.match(runtime, /const hasStrongArtistIntent = exactArtistEvidence\.size > 0/);
  assert.match(runtime, /if \(hintEvidence > 0\) score \+= 64 \+ Math\.min\(36, hintEvidence\)/);
  assert.match(runtime, /score \+= hasStrongArtistIntent \? 42 : 64/);
  assert.match(runtime, /if \(hintEvidence > 0\) score \+= 72 \+ Math\.min\(32, hintEvidence\)/);
  assert.match(runtime, /score \+= hasStrongArtistIntent \? 36 : 58/);
});

test('P6.5 V3.4.4 classifies secondary video/performance presentation semantics across entity types', () => {
  const secondary = sourcePattern('SECONDARY_PRESENTATION_PATTERN');
  for (const title of [
    'Song (Official Music Video)',
    'Song - Video Oficial',
    'Song (Offizielles Musikvideo)',
    'Song Clip Officiel',
    'Song Dance Performance Video',
    'Song Performance Video',
    'Song Live Performance',
    'Song Lyrics Video',
    'Song Visualizer',
    'Song [MV]',
    'Song MV',
    'Song Fancam',
    'Song ミュージックビデオ',
    'Song 뮤직비디오',
  ]) {
    assert.equal(secondary.test(title), true, title);
  }
  assert.equal(secondary.test('Song - Single'), false);
  assert.match(provider, /function isVideoReleasePresentation\(item: MusicAlbum \| MusicTrack\)/);
  assert.doesNotMatch(provider, /if \(!\('durationMs' in item\)\) return false/);
});

test('P6.5 V3.4.4 rejects strong fan AI unofficial and reupload presentation noise', () => {
  const lowConfidence = sourcePattern('LOW_CONFIDENCE_PRESENTATION_PATTERN');
  for (const title of [
    'new trick AI fan song',
    'Song fan-made',
    'Song fan song',
    'Song unofficial video',
    'Song re-uploaded',
    'Song reaction',
    'Song nightcore',
    'Song 8D audio',
    'Song sped up',
    'Song slowed & reverb',
  ]) {
    assert.equal(lowConfidence.test(title), true, title);
  }
  assert.equal(lowConfidence.test('Song - Official Audio'), false);
  assert.match(canonical, /canonicalizeWavenAlbums/);
  assert.match(canonical, /isWavenLowConfidenceEntityPresentation\(raw\)/);
});

test('P6.5 V3.4.4 makes New Releases canonical presentation quality authoritative over renderer type', () => {
  assert.match(provider, /const nextVideoPresentation = isVideoReleasePresentation\(item\)/);
  assert.match(provider, /existing\.videoPresentation && !nextVideoPresentation/);
  assert.match(provider, /existing\.videoPresentation === nextVideoPresentation[\s\S]*existing\.type === 'tracks'[\s\S]*type === 'albums'/);
  assert.match(provider, /candidate\.type === 'albums'[\s\S]*!candidate\.videoPresentation[\s\S]*!isLowConfidencePresentationTitle\(candidate\.item\.title\)/);
  assert.match(provider, /candidate\.type === 'tracks'[\s\S]*!candidate\.videoPresentation/);
  assert.match(canonical, /dance\\s\+performance/);
});

test('P6.5 V3.4.4 focused discovery artwork extraction skips empty thumbnail branches and can recover nested artwork', () => {
  assert.match(provider, /function validThumbnailList\(/);
  assert.match(provider, /function nestedThumbnailList\(value: any, depth = 0\)/);
  assert.match(provider, /depth > 7/);
  assert.match(provider, /for \(const candidate of candidates\)[\s\S]*if \(valid\.length\) return valid/);
  assert.match(provider, /return nestedThumbnailList\(renderer\)/);
  assert.match(canonical, /const leftArea = Number\(left\?\.width \|\| 0\) \* Number\(left\?\.height \|\| 0\)/);
  const thumbnailFunction = provider.match(/function thumbnailList\(renderer: any\): any\[\] \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(thumbnailFunction, /const candidates = \[/);
  assert.doesNotMatch(thumbnailFunction, /\) \|\|\s*nav\(renderer/);
});

test('P6.5 V3.4.4 coalesces adjacent scope-only Search checkpoints while retaining semantic history', () => {
  assert.match(searchSession, /type SearchCheckpointKind = 'semantic' \| 'scope'/);
  assert.match(searchSession, /function scopeContextKey\(/);
  assert.match(searchSession, /kind === 'scope'[\s\S]*previous\?\.kind === 'scope'[\s\S]*scopeContextKey\(previous\.snapshot\) === scopeContextKey\(next\)/);
  assert.match(searchSession, /!coalescedScopeChange/);
  assert.match(search, /checkpointCurrentSearchState\('scope'\)/);
  assert.match(search, /kind: 'semantic' \| 'scope' = 'semantic'/);
});

test('P6.5 V3.4.4 bottom-nav drag follows pager semantics: left is next and right is previous', () => {
  assert.match(bottomNav, /const rawIndex = startIndex - dx \/ step/);
  assert.match(bottomNav, /directionalValue < 0 \? 1 : directionalValue > 0 \? -1 : 0/);
  assert.match(bottomNav, /startIndexRef\.current - gestureState\.dx \/ step/);
  assert.match(bottomNav, /clampIndex\(startIndex \+ direction\)/);
  assert.match(bottomNav, /function clampIndex|const clampIndex/);
  assert.match(bottomNav, /settle\(0, 0\)/);
});

test('P6.5 V3.4.4 preserves tap navigation and vertical-scroll/system-edge separation while changing swipe direction', () => {
  assert.match(bottomNav, /horizontal > vertical \* 1\.25/);
  assert.match(bottomNav, /if \(!active\) router\.navigate\(item\.href\)/);
  assert.match(bottomNav, /onPanResponderTerminate: \(\) =>/);
  assert.match(bottomNav, /NAV_SWIPE_ACTIVATION_PX/);
  assert.match(bottomNav, /NAV_SWIPE_COMMIT_RATIO/);
  assert.match(bottomNav, /NAV_SWIPE_VELOCITY/);
});

test('P6.5 V3.4.4 primary-tab route commits do not crossfade ghost outgoing and incoming pages', () => {
  assert.match(layout, /PRIMARY_ROUTE_NAMES = new Set\(\['index', 'search', 'library'\]\)/);
  assert.match(layout, /PRIMARY_ROUTE_NAMES\.has\(route\.name\)/);
  assert.match(layout, /\? 'none'\s*:\s*'fade'/);
});

test('P6.5 V3.4.4 documents the no-compromise reliability boundary and keeps Explore More deferred', () => {
  assert.match(master, /P6\.5 V3\.4\.4 reliability \+ catalog integrity/i);
  assert.match(master, /whole-transaction/i);
  assert.match(master, /canonical Artist identity.*artwork/i);
  assert.match(master, /Swipe LEFT.*next/i);
  assert.match(master, /Swipe RIGHT.*previous/i);
  assert.match(master, /Explore More remains deferred/i);
  assert.match(design, /V3\.4\.4 reliability \+ catalog-integrity contract/i);
  assert.match(design, /forward and reverse/i);
  assert.match(design, /Explore More/i);
  assert.match(master, /WAVEN remains \*\*45%\*\*/);
});
