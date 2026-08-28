const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const readRepo = (...parts) => fs.readFileSync(path.join(repo, ...parts), 'utf8');

test('new downloads are logical Orion Library assets with a required user-folder owner', () => {
  const types = readRepo('packages', 'shared', 'src', 'types', 'mobileDownloads.ts');
  const preferences = read('src', 'features', 'downloads', 'downloadPreferences.ts');
  const start = read('src', 'features', 'downloads', 'downloadStart.ts');
  const modal = read('src', 'components', 'DownloadModal.tsx');
  const settings = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');

  assert.match(types, /MobileDownloadStorageTargetModeV1[^\n]+user-folder/);
  assert.match(types, /libraryStorageTarget: MobileDownloadStorageTargetV1 \| null/);
  assert.match(preferences, /mode: 'user-folder' as const/);
  assert.match(start, /destination[^=]+=[^;]+'orion-library'/);
  assert.match(start, /storageTarget\.mode !== 'user-folder'/);
  assert.doesNotMatch(start, /preferences\.defaultDestination/);
  assert.match(modal, /const destination[^=]+=[^;]+'orion-library'/);
  assert.match(modal, /Choose storage folder/);
  assert.match(modal, /disabled=\{!storageReady/);
  assert.match(modal, /validateNativeLibraryStorageTargetV1/);
  assert.match(modal, /storageTarget\.targetId === validatedStorageTargetId/);
  assert.doesNotMatch(settings, /Device Storage download destination/);
  assert.match(settings, /Storage folder:/);
  assert.match(settings, /chooseNativeLibraryStorageTargetV1/);
});

test('native folder authority is opaque, persisted, and create-capability checked', () => {
  const bridge = read('src', 'features', 'downloads', 'nativeDownloadEngine.ts');
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const registry = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');

  assert.match(bridge, /chooseLibraryStorageTarget/);
  assert.match(bridge, /validateLibraryStorageTarget/);
  assert.match(bridge, /mode: 'user-folder'/);
  assert.doesNotMatch(bridge, /treeUri|documentUri|absolutePath/);
  assert.match(module, /Intent\.ACTION_OPEN_DOCUMENT_TREE/);
  assert.match(module, /destination == "orion-library" && storageMode == "user-folder"/);
  assert.match(registry, /takePersistableUriPermission/);
  assert.match(registry, /isReadPermission && it\.isWritePermission/);
  assert.match(registry, /FLAG_DIR_SUPPORTS_CREATE/);
  assert.match(registry, /saf-\$\{sha256\(uri\.toString\(\)\)\.take\(20\)\}/);
});

test('SAF final settlement verifies the exact document before completion', () => {
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const transfer = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const verifier = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedMediaVerifier.kt');

  const settle = transfer.indexOf('settleToUserFolder(');
  const artifacts = transfer.indexOf('directUserFolderArtifacts(', settle);
  const complete = transfer.indexOf('OrionDownloadJobStore.markCompleted(', artifacts);
  assert.ok(settle >= 0 && artifacts > settle && complete > artifacts);
  assert.match(owner, /openFileDescriptor\(document, "rwt"\)/);
  assert.match(owner, /output\.fd\.sync\(\)/);
  assert.match(owner, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(owner, /OrionFinalizedMediaVerifier\.verify\(context, uri, displayName/);
  assert.match(owner, /setPendingPublication/);
  assert.match(owner, /renameDocument/);
  const renamed = owner.indexOf('document = renamed');
  const adoptedJournal = owner.indexOf('journal(context, jobId, generation, targetId, document, finalName, finalName, "renamed")', renamed);
  const renamedInspection = owner.indexOf('documentInfo(context, document)', renamed);
  assert.ok(renamed >= 0 && adoptedJournal > renamed && renamedInspection > adoptedJournal);
  assert.match(store, /job\.remove\("_pendingPublication"\)/);
  assert.match(verifier, /extractor\.setDataSource\(it\.fileDescriptor, 0L, sizeBytes\)/);
  assert.match(transfer, /locatorKind = if \(userOwnedLibrary\) "content-uri" else "managed"/);
});

test('one persisted content URI drives Orion and external playback while legacy FileProvider remains isolated', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');

  assert.match(manager, /locatorKind == "content-uri" && storageMode == "user-folder"/);
  assert.match(manager, /OrionFinalizedArtifactOwner\.authorizeDocument/);
  assert.match(manager, /\.put\("uri", playbackUri\.toString\(\)\)/);
  assert.match(manager, /Intent\.ACTION_VIEW/);
  assert.match(manager, /ClipData\.newRawUri/);
  assert.match(owner, /FileProvider\.getUriForFile/);
  assert.match(owner, /openFileDescriptor\(uri, "r"\)/);
  assert.match(owner, /openAssetFileDescriptor\(uri, "r"\)/);
});

test('production naming is human-readable, bounded, and provider collision-safe', () => {
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const registry = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');

  assert.match(owner, /append\(" - S"\)/);
  assert.match(owner, /year\?\.takeIf/);
  assert.match(owner, /OrionSafDocumentNamePolicy\.sanitize\("\$raw\.mp4"/);
  assert.match(registry, /codePointCount\(0, stem\.length\)/);
  assert.match(registry, /offsetByCodePoints\(0, maximumStemCodePoints\)/);
  assert.ok((registry.match(/OrionSafDocumentNamePolicy\.sanitize\(/g) || []).length >= 2);
  assert.doesNotMatch(registry, /cleaned\.take\(120\)/);
  assert.match(registry, /COLUMN_DISPLAY_NAME/);
  assert.match(registry, /DocumentsContract\.createDocument/);
  assert.doesNotMatch(owner, /buildChildDocumentsUri|queryChildDocuments/);
});

test('routine SAF reconciliation requires descriptor access and agrees on known sizes', () => {
  const registry = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');

  const probe = registry.indexOf('fun probeDocument(');
  const query = registry.indexOf('resolver.query(', probe);
  const descriptor = registry.indexOf('resolver.openFileDescriptor(uri, "r")', probe);
  assert.ok(probe >= 0 && query > probe && descriptor > query);
  assert.match(registry, /metadataSize != null && descriptorSize != null && metadataSize != descriptorSize/);
  assert.match(registry, /descriptorOutcome != DescriptorOutcome\.OPENED/);
  assert.ok((registry.match(/DescriptorOutcome\.MISSING/g) || []).length >= 2);
  assert.ok((registry.match(/DescriptorOutcome\.UNAVAILABLE/g) || []).length >= 3);
  assert.match(registry, /private fun documentProbe\(result: OrionDocumentProbePolicy\.Result\)/);
});
