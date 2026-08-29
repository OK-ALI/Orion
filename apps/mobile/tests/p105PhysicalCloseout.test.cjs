const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function loadDownloadIdentity() {
  const source = read('src', 'features', 'downloads', 'downloadIdentity.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  Function('module', 'exports', 'require', output)(module, module.exports, require);
  return module.exports;
}

test('GTA-like movie title survives the JS and native nullable metadata boundaries', () => {
  const { createMobileDownloadTargetV1 } = loadDownloadIdentity();
  const gta = createMobileDownloadTargetV1({
    id: 123,
    mediaType: 'movie',
    title: 'Grand Theft Auto VI: An Extended Look',
    year: 2026,
  });
  assert.equal(gta.media.title, 'Grand Theft Auto VI: An Extended Look');
  assert.equal(gta.media.seriesTitle, null);
  for (const invalid of [null, undefined, '', 'null', 'undefined']) {
    const target = createMobileDownloadTargetV1({ id: 123, mediaType: 'movie', title: invalid, year: 2026 });
    assert.equal(target.media.title, 'Orion Download');
  }

  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  assert.match(owner, /metadataText\(media\.opt\("seriesTitle"\)\)/);
  assert.doesNotMatch(owner, /media\.optString\("seriesTitle"\)\.takeIf/);
  assert.match(owner, /!it\.equals\("null", true\)/);
});

test('verified SAF playback stays asset-id-only and resolves descriptor I/O inside OrionPlayerActivity', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const activity = read('plugins', 'orion-cinema-webview-native', 'OrionPlayerActivity.kt');
  const finalized = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');

  assert.match(screen, /classifyNativeOfflinePlaybackV1\(offlineAssetId\)/);
  assert.match(screen, /offlineSource\.sourceKind === 'file' \? \([\s\S]*<OrionFinalizedPlayerActivitySurface/);
  assert.doesNotMatch(screen, /resolveNativeOfflinePlaybackV1\(offlineAssetId\)|OrionFinalizedPlayerSurface|<NativePlayerSurface|offlineUri/);

  assert.match(manager, /fun resolveFinalizedPlayerAsset\(/);
  assert.match(manager, /mediaDocument = OrionOfflinePlayerDocument\(documentUri, expectedSize\)/);
  assert.match(activity, /resolveFinalizedPlayerAsset\(applicationContext, assetId\)/);
  assert.match(activity, /contentResolver\.openAssetFileDescriptor\(document\.uri, "r"\)/);
  assert.match(activity, /player\.setDataSource\(it\.fileDescriptor, it\.startOffset\.coerceAtLeast\(0L\), length\)/);
  assert.doesNotMatch(activity, /ExoPlayer|androidx\.media3|OrionFinalizedMediaSourceFactory/);

  assert.match(finalized, /launchNativeFinalizedPlayerV1\(\{/);
  assert.match(finalized, /assetId,/);
  assert.doesNotMatch(finalized, /content:\/\/|file:\/\/|offlineUri/);
});

test('new selected subtitles publish as exact same-tree SAF documents and remain independently owned', () => {
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');

  assert.match(owner, /fun publishSubtitlesToUserFolder\(/);
  assert.match(owner, /mediaDisplayName/);
  assert.match(owner, /"\$stem\.\$languageTag\$identity\$suffix"/);
  assert.match(owner, /OrionDownloadStorageRegistry\.createDocument\(context, targetId, mimeType, intendedName\)/);
  assert.match(owner, /openFileDescriptor\(document, "rwt"\)/);
  assert.match(owner, /probeDocument\(context, document\)/);
  assert.match(owner, /setPendingSubtitlePublications/);
  assert.match(transfer, /publishSubtitlesToUserFolder/);
  const userArtifacts = transfer.slice(
    transfer.indexOf('private fun directUserFolderArtifacts('),
    transfer.indexOf('private fun directManagedArtifacts('),
  );
  assert.match(userArtifacts, /locatorKind = "content-uri"/);
  assert.match(userArtifacts, /subtitle\.contentUri\.toString\(\)/);
  assert.doesNotMatch(userArtifacts, /managed-relative|sidecars/);
  assert.match(store, /_pendingSubtitlePublications/);
  assert.match(manager, /if \(artifact\.optString\("availability"\) != "verified"\) continue/);
});

test('Play Locally keeps the exact SAF MP4 grant path', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  assert.match(manager, /Intent\(Intent\.ACTION_VIEW\)/);
  assert.match(manager, /ClipData\.newRawUri\("Orion download", uri\)/);
  assert.match(manager, /Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.doesNotMatch(manager, /Uri\.fromFile\(target\)/);
});
