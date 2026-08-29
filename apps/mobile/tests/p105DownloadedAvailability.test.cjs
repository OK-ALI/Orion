const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.5-B owns one recoverable reconciled Verified Orion Library availability projection', () => {
  const source = read('src', 'features', 'downloads', 'MobileDownloadAvailabilityContext.tsx');
  const engine = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');

  assert.match(source, /subscribeMobileDownloadRepositoryV1\(publish\)/);
  assert.match(source, /subscribeMobileDownloadReconciliationV1/);
  assert.match(source, /reconciliationState !== 'ready'/);
  assert.match(source, /state !== 'ready'/);
  assert.match(source, /publish\(readMobileDownloadRepositoryV1\(\)\)/);
  assert.match(source, /reconcileNativeDownloadsV1\(\)\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(source, /let reconciled = false/);

  assert.match(engine, /export type MobileDownloadReconciliationStateV1 = 'checking' \| 'ready' \| 'unavailable'/);
  assert.match(engine, /subscribeMobileDownloadReconciliationV1/);
  assert.match(engine, /listener\(mobileDownloadReconciliationStateV1\)/);
  assert.match(engine, /publishMobileDownloadReconciliationStateV1\('checking'\)/);
  assert.match(engine, /publishMobileDownloadReconciliationStateV1\('ready'\)/);
  assert.match(engine, /publishMobileDownloadReconciliationStateV1\('unavailable'\)/);
  assert.match(engine, /const generation = \+\+mobileDownloadReconciliationGenerationV1/);
  assert.match(engine, /generation !== mobileDownloadReconciliationGenerationV1/);

  assert.match(source, /asset\.destination !== 'orion-library'/);
  assert.match(source, /!\['orion-library', 'user-folder'\]\.includes\(asset\.storageTarget\.mode\)/);
  assert.match(source, /asset\.availability !== 'verified'/);
  assert.match(source, /artifact\.role === 'primary' && artifact\.availability === 'verified'/);
  assert.match(source, /mobileDownloadItemKeyFromMediaV1\(asset\.media\) === itemKey/);
  assert.match(source, /const mediaId = String\(entry\.media\.id\)/);
  assert.match(source, /const logicalEpisodeKey = `s\$\{entry\.media\.season\}:e\$\{entry\.media\.episode\}`/);
  assert.match(source, /verifiedEpisodeCountsByMediaId\.get\(normalizedId\)/);
  assert.match(source, /sameAvailabilityIndexV1/);
  assert.match(source, /setIndex\(\(current\) => sameAvailabilityIndexV1\(current, next\) \? current : next\)/);
  assert.doesNotMatch(source, /device-storage.*downloaded:\s*true/);
});

test('P10.5-B mounts availability once above global media cards', () => {
  const layout = read('app', '_layout.tsx');
  const card = read('src', 'components', 'MediaCard.tsx');

  assert.match(layout, /<LibraryProvider[\s\S]*<MobileDownloadAvailabilityProvider>[\s\S]*<MyListSteadyStateSyncProvider>/);
  assert.match(layout, /<MobileDownloadEngineCoordinator \/>/);
  assert.match(layout, /<\/MobileDownloadAvailabilityProvider>[\s\S]*<\/LibraryProvider>/);

  assert.match(card, /useMobileDownloadAvailability\(item\.id, isMovie \? 'movie' : 'tv'\)/);
  assert.doesNotMatch(card, /subscribeMobileDownloadRepositoryV1/);
});

test('P10.5-B renders a quiet right-side Downloaded indicator with truthful accessibility', () => {
  const card = read('src', 'components', 'MediaCard.tsx');

  assert.match(card, /styles\.downloadedBadgeWrapper/);
  assert.match(card, /top:\s*36/);
  assert.match(card, /right:\s*8/);
  assert.match(card, /name="download-outline"/);
  assert.match(card, /Available offline/);
  assert.match(card, /episodeCount === 1 \? 'episode' : 'episodes'/);
  assert.match(card, /\{offlineAvailability\.episodeCount\}/);
});
