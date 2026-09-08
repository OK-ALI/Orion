const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { app, safeStorage } = require("electron");

function sanitizeDeviceName(value) {
  return String(value || "Orion Mobile").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) || "Orion Mobile";
}

function createPairingStore(options = {}) {
  const pinTtlMs = Number(options.pinTtlMs || 5 * 60 * 1000);
  const attemptWindowMs = Number(options.attemptWindowMs || pinTtlMs);
  const lockoutMs = Number(options.lockoutMs || 2 * 60 * 1000);
  const maxPairAttempts = Number(options.maxPairAttempts || 5);
  const tokenIdleTtlMs = Number(options.tokenIdleTtlMs || 90 * 24 * 60 * 60 * 1000);

  const pairedSessions = new Map();
  let pairAttempts = [];
  let lockedUntil = 0;
  let currentPin = "";
  let pinExpiresAt = 0;
  let desktopInstanceId = "";

  function instanceIdFile() {
    return path.join(app.getPath("userData"), "smart-connect-instance-id");
  }

  function getDesktopInstanceId() {
    try {
      const file = instanceIdFile();
      if (fs.existsSync(file)) {
        const value = fs.readFileSync(file, "utf8").trim();
        if (/^[a-f0-9-]{16,64}$/i.test(value)) return value;
      }
      const value = crypto.randomUUID();
      fs.writeFileSync(file, value, { encoding: "utf8", mode: 0o600 });
      return value;
    } catch {
      return crypto.createHash("sha256").update(`${app.getPath("userData")}:${os.hostname()}`).digest("hex").slice(0, 32);
    }
  }

  function ensureDesktopInstanceId() {
    if (!desktopInstanceId) desktopInstanceId = getDesktopInstanceId();
    return desktopInstanceId;
  }

  function createPin() {
    currentPin = crypto.randomInt(100000, 1000000).toString();
    pinExpiresAt = Date.now() + pinTtlMs;
    return currentPin;
  }

  function ensureFreshPin() {
    if (!currentPin || Date.now() >= pinExpiresAt) createPin();
    return currentPin;
  }

  function setPin(pin) {
    const value = String(pin || "");
    currentPin = /^\d{6}$/.test(value) ? value : createPin();
    pinExpiresAt = Date.now() + pinTtlMs;
    clearPairingGuard();
    return { currentPin, pinExpiresAt };
  }

  function getPinState() {
    return { currentPin, pinExpiresAt };
  }

  function tokenFile() {
    return path.join(app.getPath("userData"), "smart-connect-sessions.bin");
  }

  function pairingGuardFile() {
    return path.join(app.getPath("userData"), "smart-connect-pairing-guard.json");
  }

  function normalizePairingGuard(now = Date.now()) {
    pairAttempts = pairAttempts
      .map(Number)
      .filter((time) => Number.isFinite(time) && now - time < attemptWindowMs);
    if (!Number.isFinite(lockedUntil) || lockedUntil <= now) lockedUntil = 0;
  }

  function pairingGuardSnapshot(now = Date.now()) {
    normalizePairingGuard(now);
    return {
      attemptsRemaining: now < lockedUntil ? 0 : Math.max(0, maxPairAttempts - pairAttempts.length),
      retryAfterMs: now < lockedUntil ? lockedUntil - now : 0,
      lockedUntil: now < lockedUntil ? lockedUntil : 0,
    };
  }

  function recordFailure(now = Date.now()) {
    normalizePairingGuard(now);
    pairAttempts.push(now);
    if (pairAttempts.length >= maxPairAttempts) {
      lockedUntil = now + lockoutMs;
    }
    savePairingGuard();
    return pairingGuardSnapshot(now);
  }

  function clearPairingGuard() {
    pairAttempts = [];
    lockedUntil = 0;
    savePairingGuard();
  }

  function savePairingGuard() {
    try {
      normalizePairingGuard();
      fs.writeFileSync(pairingGuardFile(), JSON.stringify({ pairAttempts, lockedUntil }), {
        encoding: "utf8",
        mode: 0o600,
      });
    } catch (error) {
      console.warn("[SmartConnect] Could not persist pairing guard:", error.message);
    }
  }

  function loadPairingGuard() {
    try {
      const file = pairingGuardFile();
      if (!fs.existsSync(file)) return;
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      pairAttempts = Array.isArray(saved.pairAttempts) ? saved.pairAttempts : [];
      lockedUntil = Number(saved.lockedUntil || 0);
      normalizePairingGuard();
    } catch (error) {
      pairAttempts = [];
      lockedUntil = 0;
      console.warn("[SmartConnect] Ignoring unreadable pairing guard:", error.message);
    }
  }

  function saveSessions() {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn("[SmartConnect] Secure storage is unavailable; paired devices will remain session-only.");
        return;
      }
      const data = JSON.stringify([...pairedSessions.entries()]);
      const payload = safeStorage.encryptString(data);
      fs.writeFileSync(tokenFile(), payload);
    } catch (error) {
      console.warn("[SmartConnect] Could not persist paired devices:", error.message);
    }
  }

  function loadSessions() {
    try {
      if (!safeStorage.isEncryptionAvailable()) return;
      const file = tokenFile();
      if (!fs.existsSync(file)) return;
      const payload = fs.readFileSync(file);
      const decoded = safeStorage.decryptString(payload);
      const entries = JSON.parse(decoded);
      for (const [credentialId, session] of Array.isArray(entries) ? entries : []) {
        if (credentialId && session?.deviceId && Date.now() - Number(session.lastSeenAt || 0) < tokenIdleTtlMs) {
          pairedSessions.set(credentialId, {
            ...session,
            deviceName: sanitizeDeviceName(session.deviceName || session.device),
            createdAt: Number(session.createdAt || session.lastSeenAt || Date.now()),
            rePairRequired: session.protocolVersion !== 3 || !session.publicKey,
          });
        }
      }
    } catch (error) {
      console.warn("[SmartConnect] Ignoring unreadable pairing store:", error.message);
    }
  }

  function secureSession(deviceId) {
    const session = pairedSessions.get(`v3:${String(deviceId || "")}`);
    return !session || session.rePairRequired || session.revokedAt ? null : session;
  }

  function completeSecurePairing(transcript) {
    if (!transcript?.desktopConfirmed || !transcript?.mobileConfirmed) return null;
    const session = {
      deviceId: transcript.deviceId,
      deviceName: sanitizeDeviceName(transcript.deviceName),
      publicKey: transcript.publicKey,
      protocolVersion: 3,
      certificateFingerprint: transcript.certificateFingerprint,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      rePairRequired: false,
    };
    for (const [key, saved] of pairedSessions) {
      if (saved.deviceId === session.deviceId) pairedSessions.delete(key);
    }
    pairedSessions.set(`v3:${session.deviceId}`, session);
    pairAttempts = [];
    lockedUntil = 0;
    savePairingGuard();
    saveSessions();
    createPin();
    return session;
  }

  function controllerDeviceName(deviceId) {
    const session = [...pairedSessions.values()].find((item) => item.deviceId === String(deviceId || ""));
    return sanitizeDeviceName(session?.deviceName || session?.device);
  }

  function publicDevices(connectedSockets, controllerOwnership) {
    return [...pairedSessions.values()].map(({ deviceId, deviceName, device, createdAt, lastSeenAt, rePairRequired }) => {
      const socket = connectedSockets?.get?.(deviceId);
      const isConnected = Boolean(socket && socket.readyState === 1);
      return {
        deviceId,
        deviceName: sanitizeDeviceName(deviceName || device),
        createdAt: Number(createdAt || lastSeenAt || Date.now()),
        lastSeenAt,
        rePairRequired: Boolean(rePairRequired),
        connected: isConnected,
        activeController: Boolean(controllerOwnership?.isActive?.(deviceId)),
      };
    });
  }

  return {
    pairedSessions,
    ensureDesktopInstanceId,
    createPin,
    ensureFreshPin,
    setPin,
    getPinState,
    pairingGuardSnapshot,
    recordFailure,
    clearPairingGuard,
    loadPairingGuard,
    savePairingGuard,
    loadSessions,
    saveSessions,
    secureSession,
    completeSecurePairing,
    controllerDeviceName,
    publicDevices,
    sanitizeDeviceName,
  };
}

module.exports = {
  createPairingStore,
  sanitizeDeviceName,
};
