const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function loadTypeScriptModule(...parts) {
  const source = read(...parts);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, require);
  return loaded.exports;
}

test('yt-dlp stdout telemetry populates the complete production progress contract', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
  const parser = read('plugins', 'orion-cinema-webview-native', 'OrionYtDlpProgressParser.kt');
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');

  assert.match(runtime, /\{ percent, eta, line ->/);
  assert.match(runtime, /OrionYtDlpProgressParser\.parse\(line, percent, eta\)/);
  assert.match(runtime, /--progress-template/);
  for (const field of ['bytesDownloaded', 'totalBytes', 'bytesPerSecond', 'etaSeconds', 'percent']) {
    assert.match(parser, new RegExp(`val ${field}`));
    assert.match(transfer, new RegExp(`progress\\.${field}`));
  }
  assert.match(store, /progress\.put\("bytesDownloaded"/);
  assert.match(store, /progress\.put\("totalBytes"/);
  assert.match(store, /progress\.put\("bytesPerSecond"/);
  assert.doesNotMatch(runtime, /authorization|cookie|providerUrl/i);
});

test('yt-dlp completion requires a probed MP4 with video, expected audio, duration and sane samples', () => {
  const verifier = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedMediaVerifier.kt');
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');

  assert.match(verifier, /MediaExtractor/);
  assert.match(verifier, /mime\.startsWith\("video\/"\)/);
  assert.match(verifier, /mime\.startsWith\("audio\/"\)/);
  assert.match(verifier, /sampleCount <= 0L/);
  assert.match(verifier, /durationUs <= 0L/);
  assert.match(verifier, /fileName\.endsWith\("\.mp4"/);
  assert.match(verifier, /hasIsoBmffFileType/);
  assert.match(verifier, /findDecoderForFormat/);
  assert.match(verifier, /readSampleData/);
  assert.doesNotMatch(verifier, /sampleTime < 0L/);
  assert.match(owner, /OrionFinalizedMediaVerifier\.verify\(targetCanonical, requireAudio\)/);
  assert.match(owner, /openAssetFileDescriptor\(uri, "r"\)/);
  assert.match(transfer, /OrionFinalizedArtifactOwner\.settle\(/);
  assert.match(transfer, /mediaVerification\.code/);
});

test('finalized SAF files launch the framework MediaPlayer Activity while legacy bundles keep fragment playback', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const finalized = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');
  const legacy = read('src', 'features', 'playback', 'OrionOfflinePlayerSurface.tsx');

  assert.match(manager, /OrionFinalizedArtifactOwner\.authorize\(context, bundleDir, expectedSize\)/);
  assert.match(manager, /sourceKind", "file"/);
  assert.match(manager, /contentType", "progressive"/);
  assert.match(bridge, /launchNativeFinalizedPlayerV1/);
  assert.match(bridge, /subscribeNativeFinalizedPlayerProgressV1/);
  assert.match(screen, /offlineSource\.sourceKind === 'file' \? \([\s\S]*<OrionFinalizedPlayerActivitySurface/);
  assert.match(screen, /\) : \(\s*<OrionOfflinePlayerSurface/);
  assert.doesNotMatch(screen, /OrionFinalizedPlayerSurface/);
  assert.match(finalized, /evidence: 'native-video-event'/);
  assert.match(legacy, /requireNativeComponent<NativeOfflinePlayerProps>\('OrionOfflinePlayerView'\)/);
});

test('finalized files keep verified sidecar subtitles behind the native Activity asset-id boundary', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');

  assert.match(manager, /artifact\.optString\("availability"\) != "verified"/);
  assert.match(manager, /MAX_FINALIZED_SUBTITLE_BYTES/);
  assert.match(screen, /assetId=\{offlineAssetId\}/);
  assert.match(activity, /resolveFinalizedPlayerAsset\(applicationContext, assetId\)/);
  assert.match(activity, /subtitle\.document/);
  assert.match(activity, /subtitle\.file/);
  assert.match(activity, /OrionPlayerSubtitleParser\.parse/);
  assert.doesNotMatch(activity, /content:\/\/|filePath/);
});

test('bounded finalized sidecar parsing executes for VTT, SRT and ASS cues', () => {
  const { parseOfflineSubtitleCues, activeOfflineSubtitleCue } = loadTypeScriptModule(
    'src', 'features', 'playback', 'offlineSubtitleCues.ts',
  );
  const samples = [
    { format: 'vtt', content: 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello <b>Orion</b>' },
    { format: 'srt', content: '1\n00:00:01,000 --> 00:00:03,000\nHello Orion' },
    { format: 'ass', content: '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello {\\i1}Orion' },
  ];
  for (const sample of samples) {
    const cues = parseOfflineSubtitleCues({ id: sample.format, language: 'en', label: 'English', isDefault: true, ...sample });
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, 'Hello Orion');
    assert.equal(activeOfflineSubtitleCue(cues, 2)?.text, 'Hello Orion');
    assert.equal(activeOfflineSubtitleCue(cues, 4), null);
  }
});

test('completed downloads expose distinct Play in Orion and secure Play Locally actions', () => {
  const list = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const downloads = read('app', '(tabs)', 'downloads.tsx');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const plugin = read('plugins', 'withOrionCinemaWebView.js');

  assert.match(list, /label="Play in Orion"/);
  assert.match(list, /label="Play Locally"/);
  assert.match(downloads, /playNativeDownloadAssetLocallyV1/);
  assert.match(owner, /FileProvider\.getUriForFile/);
  assert.match(manager, /Intent\.createChooser/);
  assert.match(manager, /ClipData\.newRawUri/);
  assert.match(manager, /FLAG_GRANT_READ_URI_PERMISSION/);
  assert.doesNotMatch(manager, /resolveActivity/);
  assert.doesNotMatch(manager, /Uri\.fromFile\(target\)/);
  assert.match(plugin, /orion_download_file_paths/);
  assert.match(plugin, /orion-downloads\/library\//);
});
