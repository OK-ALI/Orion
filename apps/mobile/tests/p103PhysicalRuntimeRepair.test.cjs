const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.3 physical repair removes Direct and keeps Auto fragment-only', () => {
  const capture = read('src', 'features', 'downloads', 'downloadCandidateCapture.ts');
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  assert.match(capture, /MobileDownloadTransferMethodV1 = 'auto' \| 'fragments'/);
  assert.doesNotMatch(modal, /title: 'Direct file'/);
  assert.doesNotMatch(modal, /Direct is available as the selected fallback/);
  assert.match(start, /Mobile downloads require a ready HLS or DASH stream/);
  assert.match(start, /selection\.resolvedMethod !== 'fragments'/);
});

test('P10.3 source intent retains the selected method and auto-returns only on ready fragments', () => {
  const capture = read('src', 'features', 'downloads', 'downloadCandidateCapture.ts');
  const hook = read('src', 'features', 'downloads', 'useDownloadSourceAutoReturn.ts');
  const detail = read('src', 'features', 'media-detail', 'MediaDetailScreen.tsx');
  assert.match(capture, /method: MobileDownloadTransferMethodV1/);
  assert.match(capture, /autoReturnIssued: boolean/);
  assert.match(capture, /markMobileDownloadSourceAutoReturnIssuedV1/);
  assert.match(hook, /getMobileDownloadPreferencesV1\(\)\.defaultDestination/);
  assert.match(hook, /selectMobileDownloadCandidateForItemV1\(itemKey, intent\.method, snapshots, destination\)/);
  assert.match(hook, /router\.back\(\)/);
  assert.doesNotMatch(hook, /setTimeout|setInterval|sleep/);
  assert.match(detail, /requestMobileDownloadSourceResolutionV1\(target\.itemKey, method\)/);
});

test('P10.3 Download modal gives theme-aware readiness acknowledgement without raw transport material', () => {
  const modal = read('src', 'components', 'DownloadModal.tsx');
  assert.match(modal, /Ready to download/);
  assert.match(modal, /Resolving stream…/);
  assert.match(modal, /Source needs refresh/);
  assert.match(modal, /This source is not download-ready/);
  assert.match(modal, /theme\.success/);
  assert.match(modal, /theme\.warning/);
  assert.match(modal, /theme\.danger/);
  assert.match(modal, /return here automatically/);
  assert.doesNotMatch(modal, /rawUrl|requestHeaders|cookieHeader|Authorization|signedUrl/);
});

test('P10.3 subtitle discovery uses user-owned SubDL and Wyzie keys and keeps provider URLs outside presentation', () => {
  const subtitles = read('src', 'features', 'downloads', 'downloadSubtitles.ts');
  const provider = read('src', 'services', 'subtitles.ts');
  const modal = read('src', 'components', 'DownloadModal.tsx');
  assert.match(subtitles, /searchSubtitlesWithOutcome/);
  assert.match(subtitles, /providerLabel: 'SubDL' \| 'Wyzie'/);
  assert.match(subtitles, /resolveMobileDownloadSubtitleSourcesForNativeV1/);
  assert.match(subtitles, /SUBTITLE_DISCOVERY_TIMEOUT_MS = 8_000/);
  assert.match(subtitles, /sourceRegistry\.clear\(\)/);
  assert.match(provider, /expo-secure-store/);
  assert.match(provider, /api\.subdl\.com\/api\/v1\/subtitles/);
  assert.match(provider, /sub\.wyzie\.io\/search/);
  assert.match(provider, /api-key-required/);
  assert.match(provider, /invalid-key/);
  assert.doesNotMatch(provider, /EXPO_PUBLIC_SUBDL_API_KEY|EXPO_PUBLIC_WYZIE_API_KEY|EXPO_PUBLIC_ORION_SUBTITLE_BROKER_URL\s*=/);
  assert.match(modal, /Searching SubDL and Wyzie/);
  assert.match(modal, /Subtitles ready/);
  assert.match(modal, /subtitleCheckPending/);
  assert.match(modal, /Checking subtitles…/);
  assert.doesNotMatch(modal, /\.url\b|https:\/\//);
});

test('P10.3 native subtitle packaging is private, bounded and optional during fragment finalization', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const subtitleRuntime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadSubtitleRuntime.kt');
  assert.match(module, /DOWNLOAD_FRAGMENT_SOURCE_REQUIRED/);
  assert.match(module, /OrionDownloadSubtitleRuntime\.register/);
  assert.doesNotMatch(store, /_subtitleSources/);
  assert.match(store, /if \(key\.startsWith\("_"\)\) remove\.add\(key\)/);
  assert.match(subtitleRuntime, /MAX_SOURCE_BYTES = 5L \* 1024L \* 1024L/);
  assert.match(subtitleRuntime, /MAX_EXTRACTED_BYTES = 10L \* 1024L \* 1024L/);
  assert.match(subtitleRuntime, /ZipInputStream/);
  assert.match(subtitleRuntime, /selection\.json/);
  assert.match(runtime, /finalizeSelectedSubtitles/);
  assert.match(runtime, /\.put\("subtitles", subtitleResult\.bundleEntries\)/);
  assert.match(runtime, /\.put\("tracks", finalizedTracks\(roles, subtitleResult\.tracks\)\)/);
  assert.doesNotMatch(store, /\.put\("url"/);
});

test('P10.3 retires experimental Direct residue and renders real operational download controls', () => {
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const screen = read('app', '(tabs)', 'downloads.tsx');
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  assert.match(store, /retireDirectExperimentalArtifactsLocked/);
  assert.match(store, /deleteRetiredDirectFilesLocked/);
  assert.match(store, /job\.optString\("_transferKind"\) == "direct"/);
  assert.match(screen, /DownloadActivityList/);
  assert.doesNotMatch(screen, /Queue and Offline Library presentation will use/);
  assert.match(activity, /Pause/);
  assert.match(activity, /Resume/);
  assert.match(activity, /Retry/);
  assert.match(activity, /Cancel/);
  assert.match(activity, /Verified/);
  assert.match(activity, /Orion Library/);
  assert.match(activity, /theme\.success/);
  assert.match(activity, /flexWrap: 'wrap'/);
  assert.match(screen, /useOrionTheme/);
});

test('P10.3 runtime repair stays under the Mobile source-size ceiling on touched large surfaces', () => {
  const detail = read('src', 'features', 'media-detail', 'MediaDetailScreen.tsx').split(/\r?\n/).length - 1;
  const player = read('src', 'features', 'playback', 'EmbedPlayerSurface.tsx').split(/\r?\n/).length - 1;
  assert.ok(detail <= 800, `MediaDetailScreen is ${detail} lines`);
  assert.ok(player <= 800, `EmbedPlayerSurface is ${player} lines`);
});


test('P10.3 capture parity ranks viable fragment candidates instead of taking the newest one blindly', () => {
  const capture = read('src', 'features', 'downloads', 'downloadCandidateCapture.ts');
  assert.match(capture, /scoreMobileDownloadCandidateV1/);
  assert.match(capture, /kind === 'hls' \? 200 : kind === 'dash' \? 150/);
  assert.match(capture, /\.sort\(\(left, right\) => scoreMobileDownloadCandidateV1\(right\) - scoreMobileDownloadCandidateV1\(left\)/);
  assert.doesNotMatch(capture, /resolvedManifestKind === 'direct'.*scoreMobileDownloadCandidateV1/s);
});

test('P10.3 foreground notification uses real media title and native progress truth', () => {
  const notifications = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotifications.kt');
  const screen = read('app', '(tabs)', 'downloads.tsx');
  assert.match(notifications, /json\.isNull\(key\)/);
  assert.match(notifications, /!it\.equals\("null", ignoreCase = true\)/);
  assert.match(notifications, /completedFragments/);
  assert.match(notifications, /totalFragments/);
  assert.match(notifications, /bytesPerSecond/);
  assert.match(notifications, /etaSeconds/);
  assert.match(notifications, /BigTextStyle/);
  assert.match(notifications, /"paused"/);
  assert.match(screen, /'paused'/);
});


test('P10.4C Device Storage activation remains fragment-only, SAF-scoped and portable-finalizer backed', () => {
  const capture = read('src', 'features', 'downloads', 'downloadCandidateCapture.ts');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const broker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  assert.match(capture, /candidate\.capabilities\.deviceStorage === true/);
  assert.doesNotMatch(capture, /destination !== 'orion-library'\) return null/);
  assert.match(start, /preferences\.deviceStorageTarget/);
  assert.match(start, /candidate\.capabilities\.deviceStorage/);
  assert.match(modal, />Device Storage</);
  assert.match(modal, /chooseNativeDeviceStorageTargetV1/);
  assert.match(module, /destination !in setOf\("orion-library", "device-storage"\)/);
  assert.match(module, /OrionDownloadStorageRegistry\.describe/);
  assert.match(broker, /ready && resolvedKind in setOf\("hls", "dash"\)/);
  assert.match(runtime, /finalizeFragmentedToDeviceStorage/);
  assert.match(runtime, /OrionDownloadPortableFinalizer\.finalizeToDeviceStorage/);
  assert.match(runtime, /\.put\("locator", org\.json\.JSONObject\(\)\.put\("kind", "content-uri"\)/);
  assert.doesNotMatch(runtime, /fragment-device-storage-not-finalizable/);
});
