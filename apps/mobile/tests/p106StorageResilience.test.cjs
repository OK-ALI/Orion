const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-D1 resolves free space only for physical SAF external-storage volumes', () => {
  const registry = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');

  assert.match(registry, /EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY = "com\.android\.externalstorage\.documents"/);
  assert.match(registry, /OrionSafPhysicalStoragePolicy\.volumeId\(tree\.authority, docId\)/);
  assert.match(registry, /context\.getExternalFilesDirs\(null\)\.filterNotNull\(\)/);
  assert.match(registry, /storageManager\.getStorageVolume\(directory\)/);
  assert.match(registry, /OrionSafPhysicalStoragePolicy\.matchesVolume\(volumeId, volume\.isPrimary, volume\.uuid\)/);
  assert.match(registry, /StatFs\(probe\.absolutePath\)\.availableBytes/);
  assert.match(registry, /if \(!authority\.equals\(EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY, ignoreCase = true\)\) return null/);
  assert.doesNotMatch(registry, /getStorageVolume\(tree\)|getStorageVolume\(uri\)/);
});

test('P10.6-D1 preflights exact final media bytes before creating a SAF publication document', () => {
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');

  const settle = owner.indexOf('fun settleToUserFolder(');
  const sourceProof = owner.indexOf('if (!source.isFile || source.length() <= 0L)', settle);
  const expectedBytes = owner.indexOf('val expectedBytes = source.length()', sourceProof);
  const freeBytes = owner.indexOf('OrionDownloadStorageRegistry.freeBytes(context, targetId)', expectedBytes);
  const capacityFence = owner.indexOf('OrionSafPhysicalStoragePolicy.isConclusiveInsufficient(expectedBytes, destinationFreeBytes)', freeBytes);
  const create = owner.indexOf('OrionDownloadStorageRegistry.createDocument(', capacityFence);

  assert.ok(settle >= 0 && sourceProof > settle && expectedBytes > sourceProof);
  assert.ok(freeBytes > expectedBytes && capacityFence > freeBytes && create > capacityFence);
  assert.match(owner, /"storage-destination-insufficient"/);
  assert.match(owner, /does not have enough free space for this completed download/);
});

test('P10.6-D1 keeps the established start-time selected-folder capacity guard', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const registry = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');

  assert.match(module, /OrionDownloadStorageRegistry\.freeBytes\(reactContext, targetId\)/);
  assert.match(module, /freeBytes != null && freeBytes < MIN_FREE_RESERVE_BYTES/);
  assert.match(registry, /expectedBytes > 0L && freeBytes != null && freeBytes >= 0L && freeBytes < expectedBytes/);
});

test('P10.6-D1 keeps durable and generated storage owners synchronized', () => {
  const pairs = [
    [
      'plugins/orion-cinema-webview-native/OrionDownloadStorageRegistry.kt',
      'android/app/src/main/java/com/okali/orion/playback/OrionDownloadStorageRegistry.kt',
    ],
    [
      'plugins/orion-cinema-webview-native/OrionFinalizedArtifactOwner.kt',
      'android/app/src/main/java/com/okali/orion/playback/OrionFinalizedArtifactOwner.kt',
    ],
    [
      'plugins/orion-cinema-webview-native-tests/OrionDownloadManagementPolicyTest.kt',
      'android/app/src/test/java/com/okali/orion/playback/OrionDownloadManagementPolicyTest.kt',
    ],
  ];

  for (const [durable, generated] of pairs) {
    assert.equal(read(...durable.split('/')), read(...generated.split('/')), `${generated} must match its durable owner`);
  }
});
