"use strict";

const crypto = require("node:crypto");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const PHRASE_TTL_MS = 2 * 60 * 1000;
const TICKET_TTL_MS = 20 * 1000;
const REPLAY_TTL_MS = 5 * 60 * 1000;
const NETWORK_PROFILE_CACHE_MS = 5 * 1000;
const WORDS = [
  "amber", "atlas", "aurora", "comet", "cosmos", "eclipse", "ember", "lunar",
  "meteor", "nebula", "nova", "orbit", "pearl", "pulsar", "signal", "stellar",
];

function privateAddress(address) {
  const value = String(address || "").replace(/^::ffff:/, "");
  if (/^10\./.test(value) || /^192\.168\./.test(value) || /^127\./.test(value)) return true;
  const match = value.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return value === "::1" || /^f[cd][0-9a-f]{2}:/i.test(value) || /^fe80:/i.test(value);
}

function eligibleLanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((item) =>
    item && item.family === "IPv4" && !item.internal && privateAddress(item.address),
  ).map((item) => item.address);
}

let publicNetworkCache = { value: false, expiresAt: 0 };

function windowsPublicNetwork() {
  if (process.platform !== "win32") return false;
  if (publicNetworkCache.expiresAt > Date.now()) return publicNetworkCache.value;
  try {
    const result = execFileSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      "@(Get-NetConnectionProfile | Where-Object {$_.IPv4Connectivity -ne 'Disconnected'} | Select-Object -ExpandProperty NetworkCategory) -contains 'Public'",
    ], {
      encoding: "utf8",
      timeout: 2500,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    publicNetworkCache = {
      value: String(result).trim().toLowerCase() === "true",
      expiresAt: Date.now() + NETWORK_PROFILE_CACHE_MS,
    };
    return publicNetworkCache.value;
  } catch {
    // An unreadable Windows profile must not silently weaken the LAN policy.
    // Users can still opt in through the explicit, session-only override.
    publicNetworkCache = { value: true, expiresAt: Date.now() + NETWORK_PROFILE_CACHE_MS };
    return publicNetworkCache.value;
  }
}

function phraseForSecret(secret) {
  const bytes = crypto.createHash("sha256").update(secret).digest();
  return [0, 1, 2, 3].map((index) => WORDS[bytes[index] % WORDS.length]);
}

function createTrustState() {
  const transcripts = new Map();
  const tickets = new Map();
  const connectionSequences = new Map();
  const deviceCommandIds = new Map();
  let publicNetworkAllowedUntil = 0;

  function beginTranscript({ desktopInstanceId, deviceId, deviceName, publicKey, fingerprint }) {
    const pairingId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("base64url");
    const transcript = {
      pairingId, desktopInstanceId, deviceId, deviceName, publicKey,
      certificateFingerprint: fingerprint,
      phrase: { words: phraseForSecret(secret), expiresAt: Date.now() + PHRASE_TTL_MS },
      desktopConfirmed: false, mobileConfirmed: false, createdAt: Date.now(),
    };
    transcripts.set(pairingId, transcript);
    return { ...transcript, secret: undefined };
  }

  function transcript(pairingId) {
    const value = transcripts.get(String(pairingId));
    if (!value || value.phrase.expiresAt <= Date.now()) {
      if (value) transcripts.delete(value.pairingId);
      return null;
    }
    return value;
  }

  function confirmTranscript(pairingId, side) {
    const value = transcript(pairingId);
    if (!value) return null;
    if (side === "desktop") value.desktopConfirmed = true;
    if (side === "mobile") value.mobileConfirmed = true;
    return value;
  }

  function rejectTranscript(pairingId, deviceId) {
    const value = transcript(pairingId);
    if (!value || value.deviceId !== String(deviceId || "")) return false;
    transcripts.delete(value.pairingId);
    return true;
  }

  function createTicket(deviceId, connectionId) {
    const ticketId = crypto.randomBytes(32).toString("base64url");
    const value = { ticketId, deviceId, connectionId, expiresAt: Date.now() + TICKET_TTL_MS };
    tickets.set(ticketId, value);
    return value;
  }

  function consumeTicket(ticketId) {
    const value = tickets.get(String(ticketId));
    tickets.delete(String(ticketId));
    return value && value.expiresAt > Date.now() ? value : null;
  }

  function acceptEnvelope(deviceId, connectionId, sequence, commandId, droppable = false) {
    const normalizedDeviceId = String(deviceId || "");
    const normalizedConnectionId = String(connectionId || "");
    const normalizedCommandId = String(commandId || "");
    if (!normalizedDeviceId || !normalizedConnectionId || !normalizedCommandId) {
      return { ok: false, duplicate: false, droppable, reason: "INVALID_IDENTITY" };
    }
    const connectionKey = `${normalizedDeviceId}:${normalizedConnectionId}`;
    const lastSequence = connectionSequences.get(connectionKey) || 0;
    const ids = deviceCommandIds.get(normalizedDeviceId) || new Map();
    const now = Date.now();
    for (const [id, at] of ids) if (now - at > REPLAY_TTL_MS) ids.delete(id);
    if (!Number.isSafeInteger(sequence) || sequence <= lastSequence || ids.has(normalizedCommandId)) {
      return {
        ok: false,
        duplicate: ids.has(normalizedCommandId),
        droppable,
        reason: ids.has(normalizedCommandId) ? "DUPLICATE_COMMAND" : "STALE_SEQUENCE",
      };
    }
    connectionSequences.set(connectionKey, sequence);
    ids.set(normalizedCommandId, now);
    deviceCommandIds.set(normalizedDeviceId, ids);
    return { ok: true };
  }

  return {
    beginTranscript, confirmTranscript, rejectTranscript, transcript, createTicket, consumeTicket, acceptEnvelope,
    networkPolicy() {
      const publicNetwork = windowsPublicNetwork();
      return {
        privateLanOnly: true,
        publicNetwork,
        allowed: !publicNetwork || publicNetworkAllowedUntil > Date.now(),
        publicNetworkAllowedUntil: publicNetworkAllowedUntil || null,
        maxConnections: 4,
        commandRatePerSecond: 60,
      };
    },
    allowPublicNetworkForSession(durationMs = 4 * 60 * 60 * 1000) {
      publicNetworkAllowedUntil = Date.now() + Math.max(60_000, durationMs);
      return publicNetworkAllowedUntil;
    },
  };
}

module.exports = { createTrustState, eligibleLanAddresses, privateAddress };
