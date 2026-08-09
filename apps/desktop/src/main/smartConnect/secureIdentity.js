"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { safeStorage } = require("electron");

const CERT_LIFETIME_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function identityPath(userDataPath) {
  return path.join(userDataPath, "smart-connect-identity-v3.bin");
}

function fingerprintCertificate(pem) {
  const body = String(pem).replace(/-----[^-]+-----|\s/g, "");
  return crypto.createHash("sha256").update(Buffer.from(body, "base64")).digest("hex");
}

function protectIdentity(file, value) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("SECURE_STORAGE_UNAVAILABLE");
  }
  fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
}

function readIdentity(file) {
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    const value = JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
    if (!value?.certificatePem || !value?.privateKeyPem || !value?.instanceId) return null;
    if (Number(value.notAfter || 0) <= Date.now() + 24 * 60 * 60 * 1000) return null;
    return value;
  } catch {
    return null;
  }
}

async function createIdentity(instanceId) {
  require("reflect-metadata");
  const x509 = await import("@peculiar/x509");
  x509.cryptoProvider.set(crypto.webcrypto);
  const signingAlgorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const keys = await crypto.webcrypto.subtle.generateKey(signingAlgorithm, true, ["sign", "verify"]);
  const now = Date.now();
  const certificate = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: crypto.randomBytes(16).toString("hex"),
    name: `CN=Orion Smart Connect ${instanceId}`,
    notBefore: new Date(now - 60_000),
    notAfter: new Date(now + CERT_LIFETIME_MS),
    signingAlgorithm,
    keys,
    extensions: [
      new x509.BasicConstraintsExtension(false, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  });
  const privateKey = Buffer.from(await crypto.webcrypto.subtle.exportKey("pkcs8", keys.privateKey));
  const publicKey = Buffer.from(await crypto.webcrypto.subtle.exportKey("spki", keys.publicKey));
  const certificatePem = certificate.toString("pem");
  return {
    version: 3,
    instanceId,
    certificatePem,
    privateKeyPem: `-----BEGIN PRIVATE KEY-----\n${privateKey.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`,
    publicKey: publicKey.toString("base64"),
    certificateFingerprint: fingerprintCertificate(certificatePem),
    createdAt: now,
    notAfter: now + CERT_LIFETIME_MS,
  };
}

async function loadOrCreateSecureIdentity(userDataPath, instanceId) {
  const file = identityPath(userDataPath);
  const current = readIdentity(file);
  if (current) return current;
  const identity = await createIdentity(instanceId);
  protectIdentity(file, identity);
  return identity;
}

function signChallenge(identity, value) {
  return crypto.sign("sha256", Buffer.from(String(value)), identity.privateKeyPem).toString("base64");
}

function verifyDeviceSignature(publicKeyBase64, value, signatureBase64) {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(String(publicKeyBase64), "base64"),
      format: "der",
      type: "spki",
    });
    return crypto.verify("sha256", Buffer.from(String(value)), publicKey, Buffer.from(String(signatureBase64), "base64"));
  } catch {
    return false;
  }
}

module.exports = {
  fingerprintCertificate,
  loadOrCreateSecureIdentity,
  signChallenge,
  verifyDeviceSignature,
};
