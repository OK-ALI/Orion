const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const native = (...parts) => read('plugins', 'orion-cinema-webview-native', ...parts);

test('completed-download subtitle controls use explicit selected tracks and existing discovery', () => {
  const sheet = read('src', 'features', 'downloads', 'DownloadManagementSheet.tsx');
  const ui = read('src', 'features', 'downloads', 'CompletedSubtitleManager.tsx');
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  assert.match(sheet, /asset\.availability === 'verified' \? <IconAction label="Manage Subtitles"/);
  assert.match(ui, /discoverMobileDownloadSubtitlesV1\(/);
  assert.match(ui, /saved\.length === 0 \? <Text[^>]*>None<\/Text>/);
  assert.match(ui, /discovery\.state === 'none' \? 'No match'/);
  assert.match(ui, /change\('add', track\.id\)/);
  assert.match(ui, /change\('remove', track\.id\)/);
  assert.match(bridge, /resolveMobileDownloadSubtitleSourcesForNativeV1\(\[trackId\]\)/);
  assert.match(bridge, /managementToken, JSON\.stringify\(/);
});

test('native mutation fences deletion and persists an exact journal before sidecar publication', () => {
  const store = native('OrionDownloadJobStore.kt');
  const manager = native('OrionCompletedSubtitleManager.kt');
  const artifacts = native('OrionDownloadArtifactManager.kt');
  const module = native('OrionDownloadEngineModule.kt');
  const plugin = read('plugins', 'withOrionCinemaWebView.js');
  assert.match(store, /fun beginSubtitleMutation\(/);
  assert.match(store, /persistSubtitleMutationLocked\(state\)/);
  assert.match(store, /\.putString\(KEY_STATE, state\.toString\(\)\)\.commit\(\)/);
  assert.match(store, /asset\.has\("_subtitleMutation"\) \|\| ownershipFingerprint/);
  assert.match(store, /val currentById =/);
  assert.match(store, /JSONObject\(existing\.toString\(\)\)/);
  assert.match(artifacts, /if \(asset\.has\("_subtitleMutation"\)\)/);
  assert.ok(manager.indexOf('beginSubtitleMutation(assetId, token, journal)') < manager.indexOf('publish(context, local, target, journal)'));
  assert.ok(manager.indexOf('publish(context, local, target, journal)') < manager.indexOf('completeSubtitleMutation(assetId, mutationId, token, replacement)'));
  assert.match(module, /OrionCompletedSubtitleManager\.recover\(reactContext\)/);
  assert.match(plugin, /'OrionCompletedSubtitleManager\.kt'/);
});

test('published sidecars are bounded, verified, and never treated as new download candidates', () => {
  const manager = native('OrionCompletedSubtitleManager.kt');
  const registry = native('OrionDownloadStorageRegistry.kt');
  assert.match(manager, /subtitles\.size >= 2/);
  assert.match(manager, /local\.length\(\) !in 1\.\.MAX_BYTES/);
  assert.match(manager, /sha256\(destination\) != digest/);
  assert.match(manager, /sha256\(context, uri\) != digest/);
  assert.match(manager, /findDocumentsByName\(context, targetId, name\)/);
  assert.match(registry, /fun findDocumentsByName\(/);
  assert.match(manager, /"managed-relative"/);
  assert.match(manager, /"content-uri"/);
  assert.doesNotMatch(manager, /prepareDownload|startJob\(/);
});

test('fragment index and exact removal are recoverable without touching primary media', () => {
  const manager = native('OrionCompletedSubtitleManager.kt');
  assert.match(manager, /AtomicFile\(indexFile\)/);
  assert.match(manager, /atomic\.openRead\(\)/);
  assert.match(manager, /atomic\.finishWrite\(stream\)/);
  assert.match(manager, /private fun rollbackAdd\(/);
  assert.match(manager, /private fun finishRemove\(/);
  assert.match(manager, /if \(!deleteExact\(context, asset, journal\)\) return false/);
  assert.match(manager, /value\.matches\(expected\)/);
  assert.match(manager, /if \(matches\.size > 1\) return false/);
  assert.doesNotMatch(manager, /primaryFile\.delete\(|primaryUri.*deleteDocument/);
});

test('subtitle fetch checks every HTTPS redirect against the existing public-network boundary', () => {
  const runtime = native('OrionDownloadSubtitleRuntime.kt');
  const broker = native('OrionDownloadRequestContextBroker.kt');
  const fetch = runtime.slice(runtime.indexOf('private fun downloadBounded('), runtime.indexOf('private fun extractFirstSubtitle('));
  assert.match(fetch, /for \(hop in 0\.\.4\)/);
  assert.match(fetch, /URL\(current\)\.protocol != "https"/);
  assert.match(fetch, /trustedManifestReferencedDestination\(current\)/);
  assert.ok(fetch.indexOf('trustedManifestReferencedDestination(current)') < fetch.indexOf('URL(current).openConnection()'));
  assert.match(fetch, /active\.instanceFollowRedirects = false/);
  assert.match(fetch, /current = URL\(URL\(current\), location\)\.toExternalForm\(\)/);
  assert.match(broker, /internal fun trustedManifestReferencedDestination\(rawUrl: String\): Boolean =\s*isSafePublicHttpUrl\(rawUrl\)/);
});
