'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const SIGNER = '4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd';
const PUBLIC_KEY = 'SuLjyzOgmmaEQcLLZ4BezrAJ8TVODzad/KRDbpGaflI=';
const KEY_ID = 'orion-release-2026-01';
const APK_NAME = 'orion-mobile-v4.0.0.apk';
function mobileReleasePayload(verified, sequence, publishedAt) {
  if (verified.package !== 'com.okali.orion' || verified.versionName !== '4.0.0'
    || verified.versionCode !== 60 || verified.signerSha256 !== SIGNER
    || verified.dirtySource !== false || verified.physicalUpgradePassed !== true
    || verified.name !== APK_NAME || !/^[a-f0-9]{64}$/.test(verified.apkSha256 || '')
    || !/^[a-f0-9]{40}$/.test(verified.sourceHead || '')
    || !Number.isSafeInteger(verified.size) || verified.size <= 0
    || !Number.isSafeInteger(sequence) || sequence <= 0
    || !Number.isFinite(Date.parse(publishedAt))) throw Error('Mobile release verification is incomplete');
  return { schemaVersion: 2, sequence, tag: 'v4.0.0', version: '4.0.0', channel: 'stable', publishedAt,
    minimumUpdaterVersion: '3.2.0', rolloutPercentage: 100,
    artifacts: [{ platform: 'android', name: APK_NAME, productId: verified.package,
      buildNumber: verified.versionCode, size: verified.size, sha256: verified.apkSha256, signerSha256: SIGNER }] };
}
function signedEnvelope(payload, privateKey) {
  const bytes = Buffer.from(JSON.stringify(payload));
  const signature = crypto.sign(null, bytes, privateKey);
  const publicKey = crypto.createPublicKey({ key: Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(PUBLIC_KEY, 'base64')]), format: 'der', type: 'spki' });
  if (!crypto.verify(null, bytes, publicKey, signature)) throw Error('Release metadata authority mismatch');
  return { schemaVersion: 2, algorithm: 'Ed25519', keyId: KEY_ID,
    payload: bytes.toString('base64url'), signature: signature.toString('base64url') };
}
function main() {
  const root = path.resolve(__dirname, '../../..');
  const verificationPath = path.resolve(process.argv[2] || '');
  const output = path.resolve(process.argv[3] || '');
  if (!process.argv[2] || !process.argv[3]) throw Error('Verified physical record and output directory are required');
  const verified = JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
  if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw Error('Source must be clean');
  if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !== verified.sourceHead) throw Error('Sealed source does not match the physical APK');
  const apk = fs.readFileSync(verified.apkPath);
  if (apk.length !== verified.size || crypto.createHash('sha256').update(apk).digest('hex') !== verified.apkSha256) throw Error('Physical APK hash changed');
  require('./check-glimpse-preservation.cjs').checkPreservation();
  require('./build-android-release.cjs').verifySigning(verified.apkPath);
  const payload = mobileReleasePayload(verified, Date.now(), new Date().toISOString());
  // The protected existing key is read only into memory, never emitted or copied.
  const key = crypto.createPrivateKey(fs.readFileSync(path.join(os.homedir(), '.orion/signing/orion-release-ed25519-private.pem')));
  const envelope = signedEnvelope(payload, key);
  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(verified.apkPath, path.join(output, APK_NAME));
  const artifacts = payload.artifacts.map(({ name, size, sha256, signerSha256 }) => ({ name, size, sha256, signerSha256 }));
  fs.writeFileSync(path.join(output, 'orion-release-integrity-v1.json'), JSON.stringify({ schemaVersion: 1, tag: payload.tag, version: payload.version, artifacts }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'orion-release-integrity-v2.json'), JSON.stringify(envelope, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'orion-artifact-verification.json'), JSON.stringify({ ...verified, artifacts: payload.artifacts }, null, 2) + '\n');
  console.log(JSON.stringify({ output, name: APK_NAME, apkSha256: verified.apkSha256, signerSha256: SIGNER, sequence: payload.sequence }));
}
module.exports = { mobileReleasePayload, signedEnvelope, APK_NAME, SIGNER };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
