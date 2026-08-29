const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('yt-dlp exposes only the deterministic media.mp4 staging artifact', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');

  assert.match(runtime, /OrionFinalizedArtifactOwner\.stagingOutput\(workDir\)/);
  assert.match(runtime, /yt-dlp-output-contract-invalid/);
  assert.match(owner, /it\.equals\("media\.mp4", ignoreCase = false\)/);
  assert.match(owner, /if \(entries\.size != 1\) return null/);
  assert.doesNotMatch(runtime, /private fun finalizedOutputs/);
});

test('new Orion Library completion settles and verifies the SAF document before persistence', () => {
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');

  const settle = transfer.indexOf('OrionFinalizedArtifactOwner.settleToUserFolder(');
  const artifacts = transfer.indexOf('directUserFolderArtifacts(', settle);
  const complete = transfer.indexOf('OrionDownloadJobStore.markCompleted(', artifacts);
  assert.ok(settle >= 0 && artifacts > settle && complete > artifacts,
    'durable settlement must precede artifact construction and the completion transaction');
  assert.match(owner, /OrionDownloadStorageRegistry\.createDocument/);
  assert.match(owner, /OrionFinalizedMediaVerifier\.verify\(context, uri, displayName/);
  assert.match(owner, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(owner, /openFileDescriptor\(document, "rwt"\)/);
  assert.match(owner, /openAssetFileDescriptor\(uri, "r"\)/);
  assert.match(transfer, /_verificationVersion/);
  assert.match(transfer, /_verifiedByteCount/);
  assert.match(transfer, /_contentSha256/);
  assert.match(store, /artifact\.remove\("_verificationVersion"\)/);
});

test('reconciliation validates old unstamped MP4s and playback requires durable authority', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');

  assert.match(manager, /OrionFinalizedArtifactOwner\.validate\(/);
  assert.match(manager, /OrionFinalizedArtifactPolicy\.VERIFICATION_VERSION/);
  assert.match(manager, /clearVerification = true/);
  assert.ok((manager.match(/OrionFinalizedArtifactOwner\.authorize\(/g) || []).length >= 3);
  assert.match(manager, /offline-primary-missing/);
  assert.match(manager, /offline-primary-unavailable/);
  assert.match(manager, /artifact-missing/);
  assert.match(manager, /artifact-unavailable/);
  assert.match(owner, /FileProvider\.getUriForFile/);
  assert.match(owner, /authorizeDocument/);
  assert.match(bridge, /uri\.startsWith\('content:\/\/'\)/);
  assert.doesNotMatch(bridge, /filePath|absolutePath/);
});

test('framework finalized player reports native launch/playback failure with retry and back', () => {
  const screen = read('src', 'features', 'playback', 'PlayerScreen.tsx');
  const player = read('src', 'features', 'playback', 'OrionFinalizedPlayerActivitySurface.tsx');

  assert.match(screen, /<OrionFinalizedPlayerActivitySurface/);
  assert.match(screen, /<OrionOfflinePlayerSurface/);
  assert.match(player, /setError\(message\)/);
  assert.match(player, /onRetry=\{error \? \(\) => setLaunchAttempt/);
  assert.match(player, /onBack=\{error \? \(\) => router\.back\(\) : undefined\}/);
  assert.match(player, /result\.message/);
  assert.match(player, /result\.code/);
});

test('yt-dlp telemetry contract remains intact', () => {
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt');
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');

  assert.match(runtime, /OrionYtDlpProgressParser\.parse/);
  for (const field of ['bytesDownloaded', 'totalBytes', 'bytesPerSecond', 'etaSeconds', 'percent']) {
    assert.match(transfer, new RegExp(`progress\\.${field}`));
  }
});
