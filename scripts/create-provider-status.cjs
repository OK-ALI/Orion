const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const outputDirectory = path.resolve(process.argv[2] || path.join(repoRoot, 'release'));
const payload = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config', 'provider-status-3.2.0.json'), 'utf8'));
const privateKeyPath = process.env.ORION_RELEASE_ED25519_PRIVATE_KEY
  || path.join(os.homedir(), '.orion', 'signing', 'orion-release-ed25519-private.pem');
if (!fs.existsSync(privateKeyPath)) throw new Error('Protected Orion release signing key is unavailable.');
const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = crypto.sign(null, payloadBytes, fs.readFileSync(privateKeyPath));
const base64url = (value) => Buffer.from(value).toString('base64url');
const envelope = {
  schemaVersion: 1,
  algorithm: 'Ed25519',
  keyId: 'orion-release-2026-01',
  payload: base64url(payloadBytes),
  signature: base64url(signature),
};
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'orion-provider-status-v1.json'), JSON.stringify(envelope, null, 2) + '\n');
console.log('Created signed Orion provider status.');
