const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), 'utf8');

const modal = read('src/components/DownloadModal.tsx');
const detail = read('src/features/media-detail/MediaDetailScreen.tsx');
const capture = read('src/features/downloads/downloadCandidateCapture.ts');
const start = read('src/features/downloads/downloadStart.ts');
const manager = read('src/services/downloadManager.ts');

test('P10.3 user entry activates only against the real Android native engine', () => {
  assert.match(manager, /MOBILE_DOWNLOADER_AVAILABLE = isNativeDownloadEngineAvailableV1\(\)/);
  assert.match(manager, /state: 'ready'/);
  assert.match(manager, /reason: \"Downloads require Orion's Android native download engine\.\"/);
  assert.doesNotMatch(manager, /setInterval|fakeProgress|Math\.min\(99.*Date/);
});

test('P10.3 Download sheet preserves Auto and opens Player when no candidate exists', () => {
  assert.match(modal, /useState<MobileDownloadTransferMethodV1>\('auto'\)/);
  assert.match(modal, /selectedCandidate \? handleStart : handleResolveSource/);
  assert.match(modal, /'Open player'/);
  assert.match(modal, /Ready to download/);
  assert.match(modal, /return here automatically/);
});

test('P10.3 user start creates only a safe V1 job and starts by opaque candidate id', () => {
  assert.match(start, /candidateId: candidate\.candidateId/);
  assert.match(start, /startNativeDownloadJobV1/);
  assert.match(start, /selectedSubtitleAssetIds/);
  assert.match(start, /resolveMobileDownloadSubtitleSourcesForNativeV1/);
  assert.doesNotMatch(start, /rawUrl|requestHeaders|cookieHeader|Authorization|signedUrl/);
});

test('P10.3 source resolution retention is explicit, title-scoped and bounded', () => {
  assert.match(capture, /SOURCE_RESOLUTION_RETENTION_MS = 2 \* 60_000/);
  assert.match(capture, /pendingSourceResolution\.itemKey === itemKey/);
  assert.match(capture, /retainedSourceSessions/);
  assert.match(capture, /releaseRetainedSessions/);
  assert.match(capture, /snapshots = snapshots\.filter\(\(entry\) => entry\.itemKey !== input\.itemKey\)/);
});

test('P10.3 Media Detail returns from Player to the same download target', () => {
  assert.match(detail, /pendingDownloadTargetRef/);
  assert.match(detail, /requestMobileDownloadSourceResolutionV1\(target\.itemKey, method\)/);
  assert.match(detail, /pathname: '\/player\/\[id\]'/);
  assert.match(detail, /setDownloadTarget\(pendingDownloadTarget\)/);
});

test('P10.3 media and episode surfaces graduate from Offline info to Download', () => {
  assert.match(detail, /accessibilityLabel={`Download Episode \$\{ep\.episode_number\}`}/);
  assert.match(detail, />Download<\/Text>/);
  assert.match(detail, />Download<\/Text>/);
  assert.doesNotMatch(detail, />Offline info<\/Text>/);
});

test('P10.3 fragment destination boundary stays truthful at user start', () => {
  assert.match(start, /preferences\.defaultDestination !== 'orion-library'/);
  assert.match(start, /Stream downloads currently save to Orion Library only/);
  assert.doesNotMatch(start, /chooseNativeDeviceStorageTargetV1/);
});
