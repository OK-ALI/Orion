const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.4 A5 portable remux preserves presentation cadence and verifies the full A/V timeline', () => {
  const finalizer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadPortableFinalizer.kt');
  const cadence = read('plugins', 'orion-cinema-webview-native', 'OrionPortableCadence.kt');
  const verification = read('plugins', 'orion-cinema-webview-native', 'OrionPortableVerification.kt');
  const nativeTest = read('plugins', 'orion-cinema-webview-native-tests', 'OrionPortableCadenceTest.kt');
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  assert.match(cadence, /MAX_SAMPLES_PER_FRAGMENT = 20_000/);
  assert.match(cadence, /MAX_REORDER_US = 1_000_000L/);
  assert.match(cadence, /MIN_VIDEO_STEP_US = 4_000L/);
  assert.match(cadence, /MAX_VIDEO_STEP_US = 125_000L/);
  assert.match(cadence, /MAX_AV_DRIFT_US = 5_000_000L/);
  assert.match(cadence, /java\.util\.Arrays\.sort\(ordered\)/);
  assert.match(cadence, /offsetUs = previous\.offsetUs/);
  assert.match(cadence, /offsetUs = safeSubtract\(expectedMinUs, analysis\.minTimeUs\)/);
  assert.doesNotMatch(finalizer, /candidate = safeAdd\(lastOutputTimeUs, 1L\)/);
  assert.match(finalizer, /collectRoleSource\(partialDir, roles, "video"\)/);
  assert.doesNotMatch(finalizer, /materializeSegment/);
  assert.match(finalizer, /CompositeMediaDataSource/);
  assert.match(finalizer, /withExtractor\(segment\)/);
  assert.match(finalizer, /OrionPortableCadence\.analyze\(values, accumulator\.kind, accumulator\.fallbackStepUs\)/);
  assert.match(finalizer, /OrionPortableCadence\.applyOffset\(extractor\.sampleTime, placement\.offsetUs\)/);
  assert.match(finalizer, /Build\.VERSION_CODES\.N_MR1/);
  assert.match(finalizer, /nominalSampleStepUs\(plan\)/);
  assert.match(finalizer, /muxer\.setOrientationHint\(rotation\)/);
  assert.match(finalizer, /verifyOutput\(output, plans, remuxed\.stats\)/);
  assert.match(finalizer, /while \(extractor\.sampleTrackIndex >= 0\)/);
  assert.match(finalizer, /val sampleSize = scanner\.sampleSize/);
  assert.doesNotMatch(finalizer, /scanner\.readSampleData/);
  const outputVerifier = finalizer.match(/private fun verifyOutput\([\s\S]*?\n  private fun differenceWithin/)?.[0] || '';
  assert.equal((outputVerifier.match(/MediaExtractor\(\)/g) || []).length, 1);
  assert.doesNotMatch(outputVerifier, /LongArray|scanner\.readSampleData|OrionPortableCadence\.analyze/);
  assert.match(outputVerifier, /OrionPortableSampleLedger/);
  assert.match(outputVerifier, /actual\.digest != expectedStatsForTrack\.sampleDigest/);
  assert.equal((finalizer.match(/ByteBuffer\.allocateDirect\(MAX_SAMPLE_BYTES\)/g) || []).length, 1);
  assert.doesNotMatch(finalizer, /ByteBuffer\.allocate\(MAX_SAMPLE_BYTES\)/);
  assert.match(finalizer, /OrionBoundedLongCollector\(OrionPortableCadence\.MAX_SAMPLES_PER_FRAGMENT\)/);
  assert.match(verification, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(verification, /class OrionBoundedLongCollector/);
  assert.match(finalizer, /mediaDurationUs\(actual\)/);
  assert.match(finalizer, /expectedStatsForTrack\.sampleCount < 2L/);
  assert.match(finalizer, /plans\.any \{ it\.mime\.startsWith\("audio\/"\) \}/);
  assert.match(finalizer, /OrionPortableCadence\.withinAvDrift\(videoDurationUs, audioDurationUs\)/);
  assert.match(finalizer, /sameIntegerFormatValue\(expectedPlan\.format, actual, MediaFormat\.KEY_WIDTH\)/);
  assert.match(finalizer, /sameIntegerFormatValue\(expectedPlan\.format, actual, MediaFormat\.KEY_HEIGHT\)/);
  assert.match(finalizer, /orientationDegrees\(expectedPlan\.format\) != orientationDegrees\(actual\)/);
  assert.match(finalizer, /sameCodecSpecificData\(expected, actual\)/);
  assert.match(finalizer, /portable-video-cadence-invalid/);
  assert.match(finalizer, /portable-remux-track-write-failed/);
  assert.match(finalizer, /portable-output-verification-failed/);
  assert.match(finalizer, /isCancelled\(jobId\)/);
  assert.match(finalizer, /publishedUris/);
  assert.match(nativeTest, /bFramePresentationOrderSurvivesUniformPlacement/);
  assert.match(nativeTest, /oneMicrosecondClustersFailEvenWhenAverageLooksPlausible/);
  assert.match(nativeTest, /duplicatesSlideshowGapsAndDeepReorderFail/);
  assert.match(plugin, /CINEMA_NATIVE_TEST_FILES/);
  assert.match(plugin, /'OrionPortableVerification\.kt'/);
  assert.match(plugin, /testImplementation "junit:junit:4\.13\.2"/);
});


test('P10.4 A2-N portable publication naming treats JSON null as absent and falls back to media title', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  assert.match(runtime, /private fun safeMediaNamePart/);
  assert.match(runtime, /!media\.has\(key\) \|\| media\.isNull\(key\)/);
  assert.match(runtime, /value !is String/);
  assert.match(runtime, /value\.trim\(\)\.takeIf \{ it\.isNotBlank\(\) \}/);
  assert.match(runtime, /safeMediaNamePart\(media, "seriesTitle"\)[\s\S]*?\?: safeMediaNamePart\(media, "title"\)[\s\S]*?\?: "Orion download"/);
  assert.doesNotMatch(runtime, /media\.optString\("seriesTitle"\)\.ifBlank/);
});

test('P10.4 final pre-lock retry can finalize complete local fragments before ephemeral source recovery', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  assert.match(runtime, /if \(runVerifiedLocalFinalization\(context, jobId\)\) return/);
  assert.match(runtime, /fun hasCompleteLocalFinalization/);
  assert.match(store, /setFinalizationPlan/);
  assert.match(store, /_finalizationPlan/);
  assert.doesNotMatch(store, /_subtitleSources/);
  assert.match(module, /hasCompleteLocalFinalization\(reactContext, clean\)/);
  assert.match(worker, /hasCompleteLocalFinalization/);
});

test('P10.4 final pre-lock duplicate exclusion stays native-atomic and destination-aware', () => {
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const modal = read('src', 'components', 'DownloadModal.tsx');
  assert.match(store, /current\.optString\("_itemKey"\) != itemKey \|\| current\.optString\("destination"\) != destination/);
  assert.match(store, /DUPLICATE_BLOCKING_STATES/);
  assert.match(module, /DOWNLOAD_DUPLICATE/);
  assert.match(modal, /preferences\.deviceStorageTarget/);
  assert.match(modal, /mobileDownloadItemKeyFromMediaV1\(job\.media\) === target\.itemKey/);
  assert.match(modal, /job\.destination === destination/);
  assert.match(modal, /Already downloaded here/);
  assert.match(modal, /verified \$\{destinationTitle\} copy/);
  assert.doesNotMatch(modal, /other storage location for a second intentional copy/);
});

test('P10.4 normal download entry defaults to Orion Library while a persisted Device Storage target remains usable', () => {
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const preferences = read('src', 'features', 'downloads', 'downloadPreferences.ts');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  assert.match(preferences, /defaultDestination: 'orion-library'/);
  assert.match(preferences, /input\.defaultDestination === 'device-storage' && deviceStorageTarget/);
  assert.match(preferences, /deviceStorageTarget,/);
  assert.match(preferences, /setMobileDownloadDefaultDestinationV1/);
  assert.match(start, /preferences\.deviceStorageTarget/);
  assert.match(start, /destination === 'device-storage'/);
  assert.match(start, /candidate\.capabilities\.deviceStorage/);
  assert.match(start, /storageTarget\.persistedPermission/);
  assert.match(modal, /preferences\.deviceStorageTarget/);
  assert.match(modal, /destinationTitle/);
  assert.match(modal, /selectMobileDownloadCandidateForItemV1\(target\.itemKey, transferMethod, candidateSnapshots, destination\)/);
  assert.doesNotMatch(modal, /chooseNativeDeviceStorageTargetV1/);
});

test('P10.4 final pre-lock Cancel cleans non-completed native state without routing through Resume', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const contracts = read('src', 'features', 'downloads', 'contracts.ts');
  const moduleCancel = module.match(/fun cancelJob\(jobId: String\)[\s\S]*?\n  }/)?.[0] || '';
  const serviceCancel = service.match(/ACTION_CANCEL -> \{[\s\S]*?\n      }/)?.[0] || '';
  assert.match(moduleCancel, /OrionDownloadTransferEngine\.cancelJob/);
  assert.doesNotMatch(moduleCancel, /ForegroundService\.start|resumeJob/);
  assert.match(serviceCancel, /OrionDownloadTransferEngine\.cancelJob/);
  assert.doesNotMatch(serviceCancel, /ACTION_RESUME|recovery = true/);
  assert.match(runtime, /OrionDownloadRecoveryScheduler\.cancel\(context, jobId\)/);
  assert.match(runtime, /partial\/\$jobId-fragments/);
  assert.match(runtime, /OrionDownloadSubtitleRuntime\.cleanup/);
  assert.match(runtime, /markCancelled\(jobId\)/);
  assert.match(runtime, /isCancellationRequested\(jobId\)/);
  assert.match(contracts, /finalizing: transitions\('completed', 'failed', 'action-required', 'cancelled'\)/);
});

test('P10.4 A2-S Mobile exposes safe subtitle candidates and preserves explicit user selection', () => {
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const subtitles = read('src', 'features', 'downloads', 'downloadSubtitles.ts');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  assert.match(modal, /const \[selectedSubtitleIds, setSelectedSubtitleIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(modal, /setSelectedSubtitleIds\(getPreferredMobileDownloadSubtitleIdsV1\(result\)\)/);
  assert.match(modal, /toggleSubtitleSelection/);
  assert.match(modal, /current\.length >= 2/);
  assert.match(modal, /Choose subtitles/);
  assert.match(modal, /Select up to 2/);
  assert.match(modal, /No subtitles for this download/);
  assert.match(modal, /track\.languageLabel/);
  assert.match(modal, /track\.providerLabel/);
  assert.match(modal, /track\.format\.toUpperCase\(\)/);
  assert.match(modal, /track\.label/);
  assert.match(modal, /selectedSubtitleAssetIds: selectedSubtitleIds/);
  assert.doesNotMatch(modal, /\.url\b|https:\/\//);
  assert.match(subtitles, /const \{ url: _url, \.\.\.safe \} = track/);
  assert.match(start, /selectedSubtitleAssetIds = \[\.\.\.new Set\(input\.selectedSubtitleAssetIds \|\| \[\]\)\]\.slice\(0, 2\)/);
});


test('P10.4 A3 finalization uses fast SAF publication verification and truthful stages', () => {
  const finalizer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadPortableFinalizer.kt');
  const storage = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const contracts = read('src', 'features', 'downloads', 'contracts.ts');
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const telemetry = read('src', 'features', 'downloads', 'downloadTelemetry.ts');
  const shared = fs.readFileSync(path.resolve(root, '..', '..', 'packages', 'shared', 'src', 'types', 'mobileDownloads.ts'), 'utf8');
  assert.match(storage, /fun documentSize/);
  assert.match(storage, /OpenableColumns\.SIZE/);
  assert.match(finalizer, /documentSize\(context, uri\)/);
  assert.match(finalizer, /verifyPublishedPrefix/);
  assert.match(finalizer, /verifyPublishedBytesByCounting/);
  assert.match(finalizer, /PUBLISHED_VERIFY_PROBE_BYTES = 64 \* 1024/);
  assert.match(store, /fun setFinalizationStage/);
  assert.match(store, /finalizationStageStartedAt/);
  assert.match(store, /finalizationStage/);
  assert.match(runtime, /transitionFinalizationStage\(context, jobId, "preparing", generation\)/);
  assert.match(finalizer, /transitionFinalizationStage\(context, jobId, "remuxing", generation\)/);
  assert.match(finalizer, /transitionFinalizationStage\(context, jobId, "verifying-output", generation\)/);
  assert.match(finalizer, /transitionFinalizationStage\(context, jobId, "publishing-media", generation\)/);
  assert.match(finalizer, /transitionFinalizationStage\(context, jobId, "confirming-publication", generation\)/);
  assert.match(shared, /MobileDownloadFinalizationStageV1/);
  assert.match(contracts, /finalizationStage: finalizationStage\(input\.finalizationStage\)/);
  assert.match(activity, /const finalizing = job\.state === 'finalizing'/);
  assert.match(activity, /const percent = finalizing \|\| progress\.percent === null \? null/);
  assert.match(activity, /Creating portable MP4/);
  assert.match(activity, /Transfer complete · building portable file/);
  assert.match(activity, /setInterval\(\(\) => setNowMs\(Date\.now\(\)\), 1_000\)/);
  assert.match(activity, /downloadElapsedSecondsV1\(job, nowMs\)/);
  assert.match(telemetry, /job\.progress\.finalizationStageStartedAt/);
  assert.match(telemetry, /finalizing \? nowMs/);
});

test('P10.4 final pre-lock subtitles use protected user keys and bounded path-safe staging', () => {
  const provider = read('src', 'services', 'subtitles.ts');
  const playbackDiscovery = read('src', 'features', 'playback', 'subtitleDiscovery.ts');
  const settings = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');
  const subtitleRuntime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadSubtitleRuntime.kt');
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  assert.match(provider, /expo-secure-store/);
  assert.match(provider, /orion\.mobile\.subtitles\.subdl\.v1/);
  assert.match(provider, /orion\.mobile\.subtitles\.wyzie\.v1/);
  assert.match(provider, /api\.subdl\.com\/api\/v1\/subtitles/);
  assert.match(provider, /sub\.wyzie\.io\/search/);
  assert.doesNotMatch(provider, /EXPO_PUBLIC_SUBDL_API_KEY|EXPO_PUBLIC_WYZIE_API_KEY/);
  assert.match(playbackDiscovery, /outcome\.state === 'invalid-key' \|\| outcome\.state === 'quota-or-rate-limited'/);
  assert.match(settings, /secureTextEntry/);
  assert.match(settings, /Save provider keys/);
  assert.match(subtitleRuntime, /MAX_ZIP_ENTRIES = 64/);
  assert.match(subtitleRuntime, /MAX_EXTRACTED_BYTES = 10L \* 1024L \* 1024L/);
  assert.match(subtitleRuntime, /safeZipEntryName/);
  assert.match(subtitleRuntime, /it == "\.\."/);
  assert.match(subtitleRuntime, /selection\.json/);
  assert.match(plugin, /'OrionDownloadSubtitleRuntime\.kt'/);
});

test('P10.4 final pre-lock Downloads surface is denser and presents truthful dual-destination storage', () => {
  const screen = read('app', '(tabs)', 'downloads.tsx');
  const settings = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  assert.match(screen, /Keep verified movies and episodes ready\./);
  assert.match(screen, /summaryCard: \{[^}\n]*minHeight: 72/);
  assert.match(screen, /destinationCard: \{[^}\n]*minHeight: 68/);
  assert.match(screen, /const destinationLabel = 'Orion Library'/);
  assert.match(settings, />Device Storage<\/Text>/);
  assert.match(settings, /Device Storage creates a verified portable MP4 when the stream can be finalized safely/);
  assert.match(settings, /chooseNativeDeviceStorageTargetV1/);
  assert.match(activity, /horizontal/);
  assert.match(activity, /flexWrap: 'wrap'/);
});
