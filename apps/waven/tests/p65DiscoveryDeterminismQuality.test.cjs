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
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const provider = readApp(
  'src/infrastructure/music/providers/youtubeMusicMetadata.ts',
);
const canonical = readApp('src/features/discovery/wavenCanonicalPresentation.ts');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

test('P6.5 V3.4.2 keeps published fast-changing discovery snapshots authoritative for the app session', () => {
  const newReleaseGetter = runtime.match(
    /getSearchNewReleasesSessionSnapshot\(\)[\s\S]*?\n  }/,
  )?.[0] || '';
  const chartsGetter = runtime.match(
    /getSearchGlobalChartsSessionSnapshot\(\)[\s\S]*?\n  }/,
  )?.[0] || '';

  assert.match(newReleaseGetter, /return this\.searchNewReleasesSessionCache/);
  assert.match(chartsGetter, /return this\.searchGlobalChartsSessionCache/);
  assert.doesNotMatch(newReleaseGetter, /refreshIsRecommended|Date\.now/);
  assert.doesNotMatch(chartsGetter, /refreshIsRecommended|Date\.now/);
  assert.match(runtime, /DISCOVERY_REFRESH_HINT_MS = 15 \* 60 \* 1_000/);
  assert.match(runtime, /getDiscoveryFreshnessHints/);
});

test('P6.5 V3.4.2 prevents older request generations from overwriting newer discovery', () => {
  assert.match(runtime, /private searchNewReleasesGeneration = 0/);
  assert.match(runtime, /private searchGlobalChartsGeneration = 0/);
  assert.match(runtime, /private artistsToExploreGeneration = 0/);
  assert.match(
    runtime,
    /requestGeneration !== this\.searchNewReleasesGeneration/,
  );
  assert.match(
    runtime,
    /requestGeneration !== this\.searchGlobalChartsGeneration/,
  );
  assert.match(runtime, /requestGeneration !== this\.artistsToExploreGeneration/);
  assert.match(
    runtime,
    /!refresh &&\s*this\.searchNewReleasesSessionCache[\s\S]*return this\.searchNewReleasesSessionCache/,
  );
});

test('P6.5 V3.4.2 aggregates all fixed markets before publishing one New Releases result', () => {
  assert.match(provider, /WAVEN_GLOBAL_DISCOVERY_MARKETS\.map/);
  assert.match(provider, /Promise\.allSettled/);
  assert.match(provider, /const marketResults = settled\.flatMap/);
  assert.match(provider, /mergeGlobalNewReleaseSections\(marketResults\)/);

  const awaitAll = provider.indexOf('const settled = await Promise.allSettled');
  const merge = provider.indexOf('mergeGlobalNewReleaseSections(marketResults)');
  assert.ok(awaitAll >= 0 && merge > awaitAll);
});

test('P6.5 V3.4.2 prefers canonical release identities over equivalent video presentations', () => {
  assert.match(provider, /function isVideoReleasePresentation/);
  assert.match(provider, /existing\.videoPresentation && !nextVideoPresentation/);
  assert.match(provider, /existing\.type === 'tracks'[\s\S]*type === 'albums'/);
  assert.match(provider, /existing\.videoPresentation = false/);
  assert.match(
    provider,
    /existing\.videoPresentation && !nextVideoPresentation/,
  );
  assert.match(
    provider,
    /left\.videoPresentation !== right\.videoPresentation/,
  );
  assert.match(provider, /return left\.videoPresentation \? 1 : -1/);
});

test('P6.5 V3.4.2 normalizes common video wrappers for release deduplication through the shared canonical layer', () => {
  assert.ok(canonical.includes(String.raw`music\s+video`));
  assert.match(canonical, /visuali\[sz\]er/);
  assert.match(canonical, /\bmv\b/);
  assert.match(provider, /normalizeWavenCanonicalMediaText/);
  assert.match(home, /normalizeWavenCanonicalMediaText/);
});

test('P6.5 V3.4.2 expands rail depth without changing card geometry', () => {
  assert.match(home, /NEW_RELEASE_ALBUM_TARGET = 10/);
  assert.match(home, /HOME_DISCOVERY_LIMIT = 16/);
  assert.match(
    home,
    /function collectDiscoveryItems\([\s\S]*limit = HOME_DISCOVERY_LIMIT/,
  );
  assert.match(home, /if \(items\.length >= limit\) return items/);
  assert.match(runtime, /ARTISTS_TO_EXPLORE_LIMIT = 12/);
  assert.match(runtime, /ARTIST_CANDIDATE_LIMIT = 18/);
  assert.match(home, /const discoveryCardWidth = discoveryArtworkSize \+ 32/);
});

test('P6.5 V3.4.2 ranks Artist candidates deterministically from chart and release evidence', () => {
  assert.match(runtime, /const scores = new Map/);
  assert.match(runtime, /addEvidence\(item, Math\.max\(8, 48 - index\), index\)/);
  assert.match(runtime, /addEvidence\(item, Math\.max\(6, 32 - index\), index\)/);
  assert.match(runtime, /if \(left\.score !== right\.score\) return right\.score - left\.score/);
  assert.match(runtime, /leftKey\.localeCompare\(rightKey\)/);
  assert.doesNotMatch(runtime, /ARTIST_DISCOVERY_SEEDS|featuredArtists\s*=\s*\[/);
});

test('P6.5 V3.4.2 records Explore More as a future live pagination contract without implementing it now', () => {
  assert.match(master, /Future Explore More contract is preserved, not implemented here/);
  assert.match(master, /12–20 distinct high-confidence entities/);
  assert.match(master, /continuation\/pagination and explicit Refresh/);
  assert.match(design, /Explore More is a later Phase-6 destination contract only/);
  assert.match(design, /No Explore More page is implemented by V3\.4\.2/);
  assert.doesNotMatch(home, /Explore More|See All/);
});
