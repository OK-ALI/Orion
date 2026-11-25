const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const readApp = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const canonical = readApp('src/features/discovery/wavenCanonicalPresentation.ts');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

test('P6.5 V3.4.8 treats anonymous New Releases video rows as freshness signals, not Home presentation', () => {
  assert.match(provider, /interface NewReleaseSignal/);
  assert.match(provider, /rankGlobalNewReleaseSignals/);
  assert.match(provider, /if \(!isVideoReleasePresentation\(item\)\) continue/);
  assert.match(provider, /freshness signals only/);
  assert.match(provider, /canonical catalog music/);
});

test('P6.5 V3.4.8 ranks and deduplicates signals across the same fixed global markets before resolution', () => {
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS/);
  assert.match(provider, /marketCount: number/);
  assert.match(provider, /seenInMarket/);
  assert.match(provider, /left\.bestRank !== right\.bestRank/);
  assert.match(provider, /right\.marketCount - left\.marketCount/);
  assert.match(provider, /NEW_RELEASE_SIGNAL_LIMIT = 48/);
});

test('P6.5 V3.4.8 resolves each strong signal through dynamic YouTube Music catalog search', () => {
  assert.match(provider, /async function resolveNewReleaseSignal/);
  assert.match(provider, /ytmRequest\(\s*'search'/s);
  assert.match(provider, /\{ query \}/);
  assert.match(provider, /signal\.market/);
  assert.match(provider, /curateSearchTracks\(parsed\.tracks\)/);
  assert.match(provider, /curateSearchAlbums\(parsed\.albums\)/);
});

test('P6.5 V3.4.8 requires strong title and Artist equivalence before accepting a canonical replacement', () => {
  assert.match(provider, /function releaseSignalCandidateScore/);
  assert.match(provider, /artistIdentityEquivalent\(signal, candidate\)/);
  assert.match(provider, /titleSimilarity < 0\.84/);
  assert.match(provider, /readYouTubeMusicCatalogArtistHint\(signal\)/);
  assert.match(provider, /signalHint\.source\.id === candidateHint\.source\.id/);
});

test('P6.5 V3.4.8 never resolves freshness signals back into secondary or low-confidence media', () => {
  assert.match(provider, /isWavenSecondaryEntityPresentation\(candidate\)/);
  assert.match(provider, /isWavenLowConfidenceEntityPresentation\(candidate\)/);
  assert.match(provider, /canonicalizeWavenTracks\(tracks, \{ songsOnly: true \}\)/);
  assert.match(provider, /MUSIC_VIDEO_TYPE_ATV/);
});

test('P6.5 V3.4.8 bounds resolver concurrency and propagates cancellation without turning it into filler', () => {
  assert.match(provider, /NEW_RELEASE_RESOLVER_CONCURRENCY = 3/);
  assert.match(provider, /Math\.min\(NEW_RELEASE_RESOLVER_CONCURRENCY, signals\.length\)/);
  assert.match(provider, /requestSignal\?\.aborted/);
  assert.match(provider, /abortError\.name = 'AbortError'/);
  assert.doesNotMatch(provider, /newReleaseFiller|padNewReleases|fallbackRelease/i);
});

test('P6.5 V3.4.8 preserves direct canonical release rows if YouTube restores them later', () => {
  assert.match(provider, /const directSections = mergeGlobalNewReleaseSections\(marketResults\)/);
  assert.match(provider, /market: 'direct-canonical'/);
  assert.match(provider, /market: 'canonical-resolution'/);
  assert.match(provider, /sections: mergeGlobalNewReleaseSections\(/);
});

test('P6.5 V3.4.8 publishes only canonical Track or Album release sections after resolution', () => {
  assert.match(provider, /function sectionsFromResolvedNewReleases/);
  assert.match(provider, /type: 'albums'/);
  assert.match(provider, /type: 'tracks'/);
  assert.doesNotMatch(provider, /ytmusic-new-release-resolved-videos|type: 'videos'/);
});

test('P6.5 V3.4.8 remains dynamic with no artist or validation-song exceptions', () => {
  assert.doesNotMatch(provider, /\bJISOO\b|\bROS[EÉ]\b|\bLISA\b|new trick|SaWaDiKa|\bClick\b/);
  assert.match(provider, /releaseSignalTitle\(signal\.item\)/);
  assert.match(provider, /tokenDiceSimilarity/);
});

test('P6.5 V3.4.8 documents signal-to-canonical ownership without advancing WAVEN completion', () => {
  assert.match(master, /V3\.4\.8 New Release signal -> canonical resolution/);
  assert.match(master, /OMV feed is retained only as a fast-changing freshness signal/);
  assert.match(master, /WAVEN remains \*\*45%\*\*/);
  assert.match(design, /V3\.4\.8 New Release signal-to-canonical contract/);
  assert.match(design, /never becomes visible Home presentation/);
});
