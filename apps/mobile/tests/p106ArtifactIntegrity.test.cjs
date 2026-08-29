const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-D3 deep-verifies targeted finalized primary media even when length is unchanged', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');

  assert.match(manager, /FULL_DIGEST_RECHECK_INTERVAL_MS = 24L \* 60L \* 60L \* 1000L/);
  assert.match(manager, /targeted = assetIds != null/);
  assert.match(manager, /if \(!stampValid \|\| targeted\) return true/);

  const managedValidation = manager.indexOf('OrionFinalizedArtifactOwner.validate(');
  const managedDigest = manager.indexOf('expectedSha256 = contentSha256.takeIf { stampValid }', managedValidation);
  assert.ok(managedValidation >= 0 && managedDigest > managedValidation);

  const documentValidation = manager.indexOf('OrionFinalizedArtifactOwner.validateDocumentIntegrity(');
  const documentDigest = manager.indexOf('expectedSha256 = artifact.optString("_contentSha256").takeIf { stampValid }', documentValidation);
  assert.ok(documentValidation >= 0 && documentDigest > documentValidation);
});

test('P10.6-D3 detects same-size SAF digest mutation and clears durable verification', () => {
  const owner = read('plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt');
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');

  assert.match(owner, /if \(!expectedSha256\.isNullOrBlank\(\) && !hashed\.first\.equals\(expectedSha256, true\)\)/);
  assert.match(owner, /"finalized-artifact-digest-mismatch"/);
  assert.match(manager, /is OrionFinalizedDocumentSettlement\.Failed -> ArtifactProbe\([\s\S]{0,300}clearVerification = true/);
  assert.match(store, /artifact\.remove\("_contentSha256"\)/);
  assert.match(store, /artifact\.remove\("_integrityCheckedAt"\)/);
});

test('P10.6-D3 bounds global hashing with a private daily cadence', () => {
  const manager = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadArtifactManager.kt');
  const store = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadJobStore.kt');
  const repository = read('src', 'features', 'downloads', 'downloadRepository.ts');

  assert.match(manager, /previousIntegrityCheckedAt\(integrityCheckedAt: Long, legacyLastCheckedAt: Long\)/);
  assert.match(manager, /now - baseline >= FULL_DIGEST_RECHECK_INTERVAL_MS/);
  assert.match(manager, /update\.put\("_integrityCheckedAt", it\)/);
  assert.match(store, /artifact\.put\("_integrityCheckedAt", integrityCheckedAt\)/);
  assert.match(store, /privateKeys\.forEach\(copy::remove\)/);
  assert.doesNotMatch(repository, /integrityCheckedAt|_integrityCheckedAt/);
});

test('P10.6-D3 removes corrupt primary media from Downloaded truth without a public schema expansion', () => {
  const availability = read('src', 'features', 'downloads', 'MobileDownloadAvailabilityContext.tsx');
  const ownership = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadOwnershipPolicy.kt');

  assert.match(availability, /asset\.availability !== 'verified'/);
  assert.match(availability, /artifact\.role === 'primary' && artifact\.availability === 'verified'/);
  assert.match(ownership, /MISSING\("missing"\)/);
  assert.match(ownership, /UNAVAILABLE\("unavailable"\)/);
  assert.doesNotMatch(ownership, /CORRUPT|corrupt/);
});

test('P10.6-D3 preserves D1 storage and D2 recovery contracts', () => {
  const storage = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadStorageRegistry.kt');
  const recovery = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');

  assert.match(storage, /OrionSafPhysicalStoragePolicy/);
  assert.match(storage, /physicalVolumeProbePath/);
  assert.match(recovery, /OrionDownloadRecoveryPolicy\.shouldRemainIdle/);
  assert.match(recovery, /request-context-refresh-required/);
});

test('P10.6-D3 durable and generated integrity owners remain synchronized', () => {
  const pairs = [
    ['plugins/orion-cinema-webview-native/OrionDownloadArtifactManager.kt', 'android/app/src/main/java/com/okali/orion/playback/OrionDownloadArtifactManager.kt'],
    ['plugins/orion-cinema-webview-native/OrionFinalizedArtifactOwner.kt', 'android/app/src/main/java/com/okali/orion/playback/OrionFinalizedArtifactOwner.kt'],
    ['plugins/orion-cinema-webview-native/OrionDownloadJobStore.kt', 'android/app/src/main/java/com/okali/orion/playback/OrionDownloadJobStore.kt'],
    ['plugins/orion-cinema-webview-native-tests/OrionFinalizedArtifactPolicyTest.kt', 'android/app/src/test/java/com/okali/orion/playback/OrionFinalizedArtifactPolicyTest.kt'],
  ];

  for (const [durable, generated] of pairs) {
    assert.equal(read(...durable.split('/')), read(...generated.split('/')), `${generated} must match durable owner`);
  }
});
