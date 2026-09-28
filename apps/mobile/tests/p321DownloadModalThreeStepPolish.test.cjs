'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), 'utf8');

const modal = read('src/components/DownloadModal.tsx');
const capture = read('src/features/downloads/downloadCandidateCapture.ts');
const autoReturn = read('src/features/downloads/useDownloadSourceAutoReturn.ts');
const detail = read('src/features/media-detail/MediaDetailScreen.tsx');
const start = read('src/features/downloads/downloadStart.ts');

test('Download Modal exposes only the locked Options Prepare Ready product flow', () => {
  assert.match(modal, /type DownloadStep = 'options' \| 'prepare' \| 'ready'/);
  assert.match(modal, /STEP_ORDER: readonly DownloadStep\[\] = \['options', 'prepare', 'ready'\]/);
  assert.match(modal, />Provider<\/Text>/);
  assert.match(modal, />Subtitles<\/Text>/);
  assert.match(modal, /Best available/);
  assert.match(modal, /value="Orion Library"/);
  assert.match(modal, /'Start Download'/);
  assert.doesNotMatch(modal, /Download method|gateway|broker|manifest ready|HLS stream|DASH stream/);
});

test('provider preparation remains explicit and never silently cycles providers', () => {
  assert.match(modal, /onResolveSource\(target, transferMethod, selectedSourceId \|\| undefined\)/);
  assert.match(detail, /requestMobileDownloadSourceResolutionV1\(target\.itemKey, method, sourceId\)/);
  assert.doesNotMatch(modal, /getNextMobileDownloadSource|automatic failover|next provider/i);
});

test('prepared providers are retained source-by-source and source-specific auto return cannot select another provider', () => {
  assert.match(capture, /sourceId: string \| null/);
  assert.match(capture, /entry\.itemKey === input\.itemKey && entry\.candidate\.sourceId === input\.sourceId/);
  assert.match(capture, /\.filter\(\(entry\) => !sourceId \|\| entry\.candidate\.sourceId === sourceId\)/);
  assert.match(autoReturn, /selectMobileDownloadCandidateForItemV1\(itemKey, intent\.method, snapshots, 'orion-library', intent\.sourceId\)/);
});

test('Back preserves local provider and subtitle choices because it only changes step state', () => {
  assert.match(modal, /const secondaryAction = step === 'options' \? onClose : \(\) => \{/);
  assert.match(modal, /setStep\('options'\)/);
  const secondary = modal.slice(modal.indexOf("const secondaryAction"));
  assert.doesNotMatch(secondary.slice(0, 260), /setSelectedSourceId|setSubtitleChoice/);
});

test('subtitle provider choice filters presentation without blocking the proven video candidate', () => {
  assert.match(modal, /type SubtitleChoice = 'auto' \| 'subdl' \| 'wyzie' \| 'none'/);
  assert.match(modal, /track\.provider === choice/);
  assert.match(modal, /The video is still ready/);
  assert.match(modal, /selectedSubtitleAssetIds: selectedSubtitleIds/);
});

test('Start Download still crosses the exact existing safe native handoff only from Ready', () => {
  assert.match(modal, /await startMobileDownloadFromSelectionV1\(/);
  assert.match(start, /candidateId: candidate\.candidateId/);
  assert.match(start, /startNativeDownloadJobV1/);
  assert.match(start, /selectedSubtitleAssetIds/);
  assert.doesNotMatch(start, /rawUrl|requestHeaders|cookieHeader|Authorization|signedUrl/);
});

test('storage setup remains a prerequisite but configured Orion Library storage is no longer permanent modal clutter', () => {
  assert.match(modal, /!storageReady \? \(/);
  assert.match(modal, /Orion Library storage/);
  assert.match(modal, /value="Orion Library"/);
  assert.match(modal, /chooseNativeLibraryStorageTargetV1/);
});

test('the repair does not reach into the transfer runtime', () => {
  assert.doesNotMatch(modal, /OrionDownloadYtDlpGateway|OrionDownloadYtDlpHlsGateway|OrionDownloadYtDlpRuntime/);
  assert.doesNotMatch(capture, /OrionDownloadYtDlpGateway|OrionDownloadYtDlpHlsGateway|OrionDownloadYtDlpRuntime/);
});
