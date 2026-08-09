// Orion Smart Connect v3 - encrypted, device-bound local remote-control transport.
const https = require("https");
const os = require("os");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app, ipcMain, safeStorage } = require("electron");
const { WebSocketServer } = require("ws");
const QRCode = require("qrcode");
const { Bonjour } = require("bonjour-service");
const { SMART_CONNECT_PROTOCOL_VERSION, normalizeSmartConnectCommand, normalizePlaybackTelemetry } = require("../../../../../packages/shared/src/smartConnectProtocol.cjs");
const { loadOrCreateSecureIdentity, signChallenge, verifyDeviceSignature } = require("../smartConnect/secureIdentity");
const { createTrustState, eligibleLanAddresses, privateAddress } = require("../smartConnect/secureTrust");

const PORT = 8924;
const PROTOCOL_VERSION = SMART_CONNECT_PROTOCOL_VERSION;
const PIN_TTL_MS = 5 * 60 * 1000;
const TOKEN_IDLE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 1800;
const MAX_PAIR_ATTEMPTS = 5;
// Failed attempts live for the displayed code's lifetime. Reopening either
// Connect surface must not silently restore all five attempts.
const ATTEMPT_WINDOW_MS = PIN_TTL_MS;
const LOCKOUT_MS = 2 * 60 * 1000;
const ALLOWED_REMOTE_ORIGIN = "orion://mobile";
const COMMAND_RATE_WINDOW_MS = 1000;

let server = null;
let socketServer = null;
let currentPin = "";
let pinExpiresAt = 0;
let getMainWindowRef = null;
let currentPlayback = null;
let currentContext = null;
let telemetrySequence = 0;
let pairAttempts = [];
let lockedUntil = 0;
let bonjour = null;
let advertisedService = null;
const pairedSessions = new Map();
const pendingCommands = new Map();
const connectedSockets = new Map();
const secureTrust = createTrustState();
const authChallenges = new Map();
let secureIdentity = null;
let activePairingId = null;
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
  activePairingId = null;
  createPin();
  notifyConnectionStatus();
  return session;
}
function socketIsOpen(socket) {
  return Boolean(socket && socket.readyState === 1);
}

function originAllowed(req) {
  return !req.headers.origin || req.headers.origin === ALLOWED_REMOTE_ORIGIN;
}
function acceptCommandRate(socket, droppable) {
  const now = Date.now();
  if (!socket.commandRateWindowAt || now - socket.commandRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
    socket.commandRateWindowAt = now; socket.commandRateCount = 0;
  }
  socket.commandRateCount += 1;
  return socket.commandRateCount <= secureTrust.networkPolicy().commandRatePerSecond
    ? { ok: true }
    : { ok: false, droppable, reason: "COMMAND_RATE_LIMITED" };
}

function publicDevices() {
  return [...pairedSessions.values()].map(({ deviceId, deviceName, device, createdAt, lastSeenAt, rePairRequired }) => ({
    deviceId,
    deviceName: sanitizeDeviceName(deviceName || device),
    createdAt: Number(createdAt || lastSeenAt || Date.now()),
    lastSeenAt,
    rePairRequired: Boolean(rePairRequired),
    connected: socketIsOpen(connectedSockets.get(deviceId)),
  }));
}

function sanitizeDeviceName(value) {
  return String(value || "Orion Mobile").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) || "Orion Mobile";
}

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

let desktopInstanceId = "";

function ensureDesktopInstanceId() {
  if (!desktopInstanceId) desktopInstanceId = getDesktopInstanceId();
  return desktopInstanceId;
}

function pairingError(res, status, code, message, retryAfterMs, attemptsRemaining) {
  return json(res, status, {
    ok: false,
    error: {
      code,
      message,
      ...(Number.isFinite(retryAfterMs) ? { retryAfterMs } : {}),
      ...(Number.isFinite(attemptsRemaining) ? { attemptsRemaining } : {}),
    },
  });
}

function startServiceAdvertisement() {
  if (bonjour || advertisedService) return;
  try {
    bonjour = new Bonjour({}, (error) => {
      console.warn("[SmartConnect] NSD advertisement warning:", error?.message || error);
    });
    advertisedService = bonjour.publish({
      name: `Orion Desktop (${os.hostname()})`,
      type: "orion-connect",
      protocol: "tcp",
      port: PORT,
      txt: {
        app: "orion",
        version: String(PROTOCOL_VERSION),
        instanceId: ensureDesktopInstanceId(),
        fingerprint: secureIdentity?.certificateFingerprint || "",
      },
    });
  } catch (error) {
    console.warn("[SmartConnect] Could not advertise NSD service:", error.message);
  }
}

function stopServiceAdvertisement() {
  try { advertisedService?.stop?.(); } catch {}
  try { bonjour?.destroy?.(); } catch {}
  advertisedService = null;
  bonjour = null;
}

function createPin() {
  currentPin = crypto.randomInt(100000, 1000000).toString();
  pinExpiresAt = Date.now() + PIN_TTL_MS;
  return currentPin;
}

function ensureFreshPin() {
  if (!currentPin || Date.now() >= pinExpiresAt) createPin();
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
    .filter((time) => Number.isFinite(time) && now - time < ATTEMPT_WINDOW_MS);
  if (!Number.isFinite(lockedUntil) || lockedUntil <= now) lockedUntil = 0;
}

function pairingGuardSnapshot(now = Date.now()) {
  normalizePairingGuard(now);
  return {
    attemptsRemaining: now < lockedUntil ? 0 : Math.max(0, MAX_PAIR_ATTEMPTS - pairAttempts.length),
    retryAfterMs: now < lockedUntil ? lockedUntil - now : 0,
    lockedUntil: now < lockedUntil ? lockedUntil : 0,
  };
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
      if (credentialId && session?.deviceId && Date.now() - Number(session.lastSeenAt || 0) < TOKEN_IDLE_TTL_MS) {
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

function getAllLocalIpAddresses() {
  const addresses = [];
  for (const [name, networks] of Object.entries(os.networkInterfaces())) {
    for (const network of networks || []) {
      if (network.family === "IPv4" && !network.internal) {
        addresses.push({ name: name.toLowerCase(), address: network.address });
      }
    }
  }
  const isLan = (address) => /^192\.168\./.test(address) || /^10\./.test(address)
    || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(address);
  return addresses
    .sort((a, b) => Number(isLan(b.address)) - Number(isLan(a.address)))
    .map((entry) => entry.address);
}

function getLocalIpAddress() { return getAllLocalIpAddresses()[0] || "127.0.0.1"; }
function notifyDesktopRenderer(event, data) {
  const win = getMainWindowRef?.(); if (win && !win.isDestroyed()) win.webContents.send(event, data);
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function secureSession(deviceId) {
  const session = pairedSessions.get(`v3:${String(deviceId || "")}`);
  return !session || session.rePairRequired || session.revokedAt ? null : session;
}

function requireSecureRequest(req, body = {}) {
  const deviceId = String(req.headers["x-orion-device"] || body.deviceId || "");
  const signature = String(req.headers["x-orion-signature"] || body.signature || "");
  const timestamp = Number(req.headers["x-orion-timestamp"] || body.timestamp || 0);
  const session = secureSession(deviceId);
  if (!session || !signature || Math.abs(Date.now() - timestamp) > 30_000) return null;
  const message = `${req.method}\n${req.url}\n${timestamp}`;
  return verifyDeviceSignature(session.publicKey, message, signature) ? session : null;
}

function normalizeCommand(input = {}) { return normalizeSmartConnectCommand(input, () => crypto.randomUUID()); }

function dispatchCommand(command) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(command.id);
      resolve({
        id: command.id,
        sequence: command.sequence,
        ok: false,
        appliedAt: Date.now(),
        error: "Desktop did not acknowledge the command in time.",
      });
    }, COMMAND_TIMEOUT_MS);
    pendingCommands.set(command.id, { resolve, timer });
    notifyDesktopRenderer("orion:remote-command", command);
  });
}

function sendSocket(socket, type, deviceId, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.outgoingSequence = Number(socket.outgoingSequence || 0) + 1;
    socket.send(JSON.stringify({
      version: PROTOCOL_VERSION,
      type,
      deviceId,
      connectionId: socket.smartConnectConnectionId,
      sequence: socket.outgoingSequence,
      payload,
    }));
  }
}

function configureSockets() {
  socketServer = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    let parsed;
    try { parsed = new URL(req.url, `https://${req.headers.host || "localhost"}`); } catch { socket.destroy(); return; }
    if (parsed.pathname !== "/api/socket") { socket.destroy(); return; }
    const policy = secureTrust.networkPolicy();
    if (!policy.allowed || !originAllowed(req) || !privateAddress(req.socket.remoteAddress)) { socket.destroy(); return; }
    const ticket = secureTrust.consumeTicket(req.headers["x-orion-ticket"]);
    const session = ticket ? secureSession(ticket.deviceId) : null;
    const replacingExistingDevice = Boolean(session && connectedSockets.has(session.deviceId));
    if (!session || (!replacingExistingDevice && connectedSockets.size >= policy.maxConnections)) { socket.destroy(); return; }
    socketServer.handleUpgrade(req, socket, head, (ws) => {
      ws.smartConnectSession = session;
      ws.smartConnectConnectionId = ticket.connectionId;
      socketServer.emit("connection", ws);
    });
  });

  socketServer.on("connection", (socket) => {
    const session = socket.smartConnectSession;
    socket.lastSmartConnectHeartbeat = Date.now();
    const previousSocket = connectedSockets.get(session.deviceId);
    if (previousSocket && previousSocket !== socket) previousSocket.close();
    connectedSockets.set(session.deviceId, socket);
    session.lastSeenAt = Date.now();
    sendSocket(socket, "status", session.deviceId, { connected: true });
    if (currentContext) sendSocket(socket, "context", session.deviceId, currentContext);
    if (currentPlayback) sendSocket(socket, "telemetry", session.deviceId, currentPlayback);
    notifyConnectionStatus();
    socket.on("message", async (raw) => {
      try {
        socket.lastSmartConnectHeartbeat = Date.now();
        const envelope = JSON.parse(String(raw));
        if (envelope.version !== PROTOCOL_VERSION || envelope.deviceId !== session.deviceId) throw new Error("Unsupported Smart Connect envelope.");
        if (envelope.connectionId !== socket.smartConnectConnectionId) throw new Error("Connection identity mismatch.");
        if (envelope.type === "heartbeat") {
          session.lastSeenAt = Date.now();
          socket.lastSmartConnectHeartbeat = Date.now();
          sendSocket(socket, "heartbeat", session.deviceId, { at: Date.now() });
          return;
        }
        if (envelope.type !== "command") return;
        const droppable = envelope.payload?.action === "cursor_move";
        const rate = acceptCommandRate(socket, droppable);
        if (!rate.ok) {
          if (!rate.droppable) sendSocket(socket, "error", session.deviceId, { error: rate.reason });
          return;
        }
        const replay = secureTrust.acceptEnvelope(
          session.deviceId,
          socket.smartConnectConnectionId,
          Number(envelope.sequence),
          String(envelope.commandId || envelope.payload?.id || ""),
          droppable,
        );
        if (!replay.ok) {
          if (!replay.droppable) sendSocket(socket, "error", session.deviceId, { error: "Replay or duplicate command rejected." });
          return;
        }
        if (envelope.payload?.action === "smart_connect_rename") {
          session.deviceName = sanitizeDeviceName(envelope.payload?.value);
          saveSessions();
          notifyConnectionStatus();
          sendSocket(socket, "ack", session.deviceId, {
            id: envelope.payload?.id, sequence: envelope.payload?.sequence, ok: true, appliedAt: Date.now(),
          });
          return;
        }
        if (envelope.payload?.action === "smart_connect_unpair") {
          pairedSessions.delete(`v3:${session.deviceId}`);
          saveSessions();
          sendSocket(socket, "ack", session.deviceId, {
            id: envelope.payload?.id, sequence: envelope.payload?.sequence, ok: true, appliedAt: Date.now(),
          });
          setTimeout(() => socket.close(), 30);
          notifyConnectionStatus();
          return;
        }
        const command = normalizeCommand(envelope.payload);
        const ack = await dispatchCommand(command);
        sendSocket(socket, "ack", session.deviceId, ack);
      } catch (error) {
        sendSocket(socket, "error", session.deviceId, { error: error.message });
      }
    });
    const watchdog = setInterval(() => {
      if (Date.now() - socket.lastSmartConnectHeartbeat > 45_000) socket.close();
    }, 15_000);
    socket.on("close", () => {
      clearInterval(watchdog);
      if (connectedSockets.get(session.deviceId) === socket) {
        connectedSockets.delete(session.deviceId);
        notifyConnectionStatus();
      }
    });
    socket.on("error", () => {
      clearInterval(watchdog);
      if (connectedSockets.get(session.deviceId) === socket) {
        connectedSockets.delete(session.deviceId);
        notifyConnectionStatus();
      }
    });
  });
}

function notifyConnectionStatus() {
  const devices = publicDevices();
  notifyDesktopRenderer("orion:smart-connect-status", {
    paired: devices.length > 0,
    connected: devices.some((device) => device.connected),
    devices,
    pin: currentPin,
    pinExpiresAt,
    pendingPairing: activePairingId ? secureTrust.transcript(activePairingId) : null,
    networkPolicy: secureTrust.networkPolicy(),
  });
}

async function startSmartConnectServer(getMainWindow) {
  getMainWindowRef = getMainWindow;
  if (server) return;
  ensureDesktopInstanceId();
  ensureFreshPin();
  loadSessions();
  loadPairingGuard();
  secureIdentity = await loadOrCreateSecureIdentity(app.getPath("userData"), desktopInstanceId);

  server = https.createServer({ cert: secureIdentity.certificatePem, key: secureIdentity.privateKeyPem }, async (req, res) => {
    if (!originAllowed(req)) return json(res, 403, { ok: false, error: "ORIGIN_REJECTED" });
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_REMOTE_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Orion-Device, X-Orion-Signature, X-Orion-Timestamp");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    if (!privateAddress(req.socket.remoteAddress)) return json(res, 403, { ok: false, error: "PRIVATE_LAN_REQUIRED" });
    const policy = secureTrust.networkPolicy();
    if (!policy.allowed) return json(res, 403, { ok: false, error: "PUBLIC_NETWORK_BLOCKED", networkPolicy: policy });

    if (req.method === "GET" && url.pathname === "/api/status") {
      const session = requireSecureRequest(req);
      return json(res, 200, session
        ? {
            ok: true,
            version: PROTOCOL_VERSION,
            instanceId: desktopInstanceId,
            displayName: `Orion Desktop (${os.hostname()})`,
            ip: getLocalIpAddress(),
            availableIps: getAllLocalIpAddresses(),
            port: PORT,
            paired: true,
            connected: socketIsOpen(connectedSockets.get(session.deviceId)),
            device: session.deviceName,
            playback: currentPlayback,
            pairingGuard: pairingGuardSnapshot(),
            certificateFingerprint: secureIdentity.certificateFingerprint,
            secureTransport: true,
          }
        : {
            ok: true,
            version: PROTOCOL_VERSION,
            instanceId: desktopInstanceId,
            displayName: `Orion Desktop (${os.hostname()})`,
            ip: getLocalIpAddress(),
            availableIps: getAllLocalIpAddresses(),
            port: PORT,
            paired: false,
            connected: false,
            pairingGuard: pairingGuardSnapshot(),
            certificateFingerprint: secureIdentity.certificateFingerprint,
            secureTransport: true,
            rePairRequired: publicDevices().some((device) => device.rePairRequired),
          });
    }

    if (req.method === "POST" && url.pathname === "/api/pair/start") {
      try {
        const data = await readJson(req);
        const now = Date.now();
        normalizePairingGuard(now);
        if (now < lockedUntil) return pairingError(res, 429, "LOCKED_OUT", "Pairing is temporarily locked.", lockedUntil - now, 0);
        if (!currentPin || now >= pinExpiresAt) {
          ensureFreshPin();
          return pairingError(res, 401, "CODE_EXPIRED", "The pairing code expired.", undefined, pairingGuardSnapshot(now).attemptsRemaining);
        }
        if (String(data.pin || "") !== currentPin) {
          pairAttempts.push(now);
          if (pairAttempts.length >= MAX_PAIR_ATTEMPTS) lockedUntil = now + LOCKOUT_MS;
          savePairingGuard();
          const guard = pairingGuardSnapshot(now);
          return pairingError(res, lockedUntil ? 429 : 401, lockedUntil ? "LOCKED_OUT" : "INVALID_CODE",
            lockedUntil ? "Pairing is temporarily locked." : "The pairing code is invalid.",
            guard.retryAfterMs || undefined, guard.attemptsRemaining);
        }
        if (!data.deviceId || !data.publicKey) return pairingError(res, 400, "INVALID_REQUEST", "A device-bound public identity is required.");
        const transcript = secureTrust.beginTranscript({
          desktopInstanceId,
          deviceId: String(data.deviceId),
          deviceName: sanitizeDeviceName(data.deviceName),
          publicKey: String(data.publicKey),
          fingerprint: secureIdentity.certificateFingerprint,
        });
        activePairingId = transcript.pairingId;
        notifyConnectionStatus();
        return json(res, 200, { ok: true, transcript });
      } catch (error) {
        return pairingError(res, 400, "INVALID_REQUEST", error.message);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/pair/confirm") {
      try {
        const data = await readJson(req);
        const transcript = secureTrust.confirmTranscript(data.pairingId, "mobile");
        if (!transcript || transcript.deviceId !== String(data.deviceId || "")) {
          return pairingError(res, 410, "PAIRING_EXPIRED", "The verification phrase expired.");
        }
        const session = completeSecurePairing(transcript);
        return json(res, 200, {
          ok: true,
          pendingDesktopConfirmation: !session,
          paired: Boolean(session),
          deviceId: transcript.deviceId,
          instanceId: desktopInstanceId,
          certificateFingerprint: secureIdentity.certificateFingerprint,
        });
      } catch (error) {
        return pairingError(res, 400, "INVALID_REQUEST", error.message);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/pair/result") {
      const data = await readJson(req).catch(() => ({}));
      const session = secureSession(data.deviceId);
      if (session) return json(res, 200, {
        ok: true, paired: true, deviceId: session.deviceId,
        instanceId: desktopInstanceId, certificateFingerprint: secureIdentity.certificateFingerprint,
      });
      const transcript = secureTrust.transcript(data.pairingId);
      if (!transcript || transcript.deviceId !== String(data.deviceId || "")) {
        return pairingError(res, 410, "PAIRING_EXPIRED", "The verification phrase expired.");
      }
      return json(res, 200, { ok: true, paired: false, pendingDesktopConfirmation: true });
    }

    if (req.method === "POST" && url.pathname === "/api/pair/reject") {
      const data = await readJson(req).catch(() => ({}));
      const rejected = secureTrust.rejectTranscript(data.pairingId, data.deviceId);
      if (rejected && activePairingId === String(data.pairingId || "")) activePairingId = null;
      notifyConnectionStatus();
      return json(res, rejected ? 200 : 410, rejected
        ? { ok: true }
        : { ok: false, error: { code: "PAIRING_EXPIRED", message: "The verification phrase expired." } });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/challenge") {
      const data = await readJson(req).catch(() => ({}));
      const session = secureSession(data.deviceId);
      if (!session) return pairingError(res, 401, "REPAIR_REQUIRED", "This device must be paired with protocol v3.");
      const nonce = crypto.randomBytes(32).toString("base64url");
      authChallenges.set(session.deviceId, { nonce, expiresAt: Date.now() + 30_000 });
      return json(res, 200, {
        ok: true,
        nonce,
        desktopPublicKey: secureIdentity.publicKey,
        desktopSignature: signChallenge(secureIdentity, nonce),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/ticket") {
      const data = await readJson(req).catch(() => ({}));
      const session = secureSession(data.deviceId);
      const challenge = authChallenges.get(String(data.deviceId || ""));
      authChallenges.delete(String(data.deviceId || ""));
      if (!session || !challenge || challenge.expiresAt <= Date.now()
        || !verifyDeviceSignature(session.publicKey, challenge.nonce, data.signature)) {
        return pairingError(res, 401, "DEVICE_AUTH_FAILED", "Device-bound authentication failed.");
      }
      const connectionId = crypto.randomUUID();
      const ticket = secureTrust.createTicket(session.deviceId, connectionId);
      return json(res, 200, { ok: true, ticket, connectionId });
    }

    if (["/api/pair", "/api/device", "/api/command", "/api/unpair"].includes(url.pathname)) {
      return json(res, 426, {
        ok: false,
        error: { code: "REPAIR_REQUIRED", message: "Secure Smart Connect v3 is required." },
      });
    }

    return json(res, 404, { ok: false, error: "Not Found" });
  });

  configureSockets();
  const listenAddress = eligibleLanAddresses()[0];
  if (!listenAddress) throw new Error("SMART_CONNECT_PRIVATE_LAN_UNAVAILABLE");
  server.listen(PORT, listenAddress, () => {
    console.log(`[SmartConnect] secure v${PROTOCOL_VERSION} listening at https://${listenAddress}:${PORT}`);
    startServiceAdvertisement();
  });
  server.on("error", (error) => console.error("[SmartConnect] Server error:", error.message));
  app.once("before-quit", stopServiceAdvertisement);
}

ipcMain.handle("smart-connect:get-info", async () => {
  ensureFreshPin();
  const ip = getLocalIpAddress();
  const qrPayload = `orion://connect?ip=${encodeURIComponent(ip)}&port=${PORT}&pin=${encodeURIComponent(currentPin)}&version=3&instanceId=${encodeURIComponent(desktopInstanceId)}&fingerprint=${encodeURIComponent(secureIdentity?.certificateFingerprint || "")}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 248,
    margin: 1,
    errorCorrectionLevel: "M",
  }).catch(() => "");
  return {
    ok: true,
    version: PROTOCOL_VERSION,
    instanceId: desktopInstanceId,
    ip,
    availableIps: getAllLocalIpAddresses(),
    port: PORT,
    pin: currentPin,
    pinExpiresAt,
    qrDataUrl,
    paired: pairedSessions.size > 0,
    connected: publicDevices().some((device) => device.connected),
    devices: publicDevices(),
    pairingGuard: pairingGuardSnapshot(),
    certificateFingerprint: secureIdentity?.certificateFingerprint || "",
    secureTransport: true,
    pendingPairing: activePairingId ? secureTrust.transcript(activePairingId) : null,
    networkPolicy: secureTrust.networkPolicy(),
  };
});

ipcMain.handle("smart-connect:confirm-pairing", () => {
  if (!activePairingId) return { ok: false, error: "No pending secure pairing." };
  const transcript = secureTrust.confirmTranscript(activePairingId, "desktop");
  if (!transcript) return { ok: false, error: "The verification phrase expired." };
  const session = completeSecurePairing(transcript);
  notifyConnectionStatus();
  return { ok: true, paired: Boolean(session), pendingPairing: session ? null : transcript };
});

ipcMain.handle("smart-connect:reject-pairing", () => {
  activePairingId = null;
  createPin();
  notifyConnectionStatus();
  return { ok: true };
});

ipcMain.handle("smart-connect:allow-public-network", () => {
  secureTrust.allowPublicNetworkForSession();
  notifyConnectionStatus();
  return { ok: true, networkPolicy: secureTrust.networkPolicy() };
});

ipcMain.handle("smart-connect:set-pin", (_, pin) => {
  const value = String(pin || "");
  currentPin = /^\d{6}$/.test(value) ? value : createPin();
  pinExpiresAt = Date.now() + PIN_TTL_MS;
  pairAttempts = [];
  lockedUntil = 0;
  savePairingGuard();
  notifyConnectionStatus();
  return { ok: true, pin: currentPin, pinExpiresAt };
});

ipcMain.handle("smart-connect:update-playback", (_, data) => {
  currentPlayback = data ? normalizePlaybackTelemetry(data, telemetrySequence) : null;
  telemetrySequence = currentPlayback?.sequence || telemetrySequence;
  for (const [deviceId, socket] of connectedSockets) {
    sendSocket(socket, "telemetry", deviceId, currentPlayback);
  }
  return { ok: true };
});

ipcMain.handle("smart-connect:update-telemetry", (_, data) => {
  currentContext = data?.context && typeof data.context === "object" ? data.context : currentContext;
  currentPlayback = data?.telemetry ? normalizePlaybackTelemetry(data.telemetry, telemetrySequence) : null;
  telemetrySequence = currentPlayback?.sequence || telemetrySequence;
  for (const [deviceId, socket] of connectedSockets) {
    if (currentContext) sendSocket(socket, "context", deviceId, currentContext);
    sendSocket(socket, "telemetry", deviceId, currentPlayback);
  }
  return { ok: true, connected: connectedSockets.size > 0 };
});

ipcMain.handle("smart-connect:ack-command", (_, ack) => {
  const pending = pendingCommands.get(String(ack?.id || ""));
  if (!pending) return { ok: false, error: "Unknown command acknowledgement." };
  clearTimeout(pending.timer);
  pendingCommands.delete(String(ack.id));
  pending.resolve({
    id: String(ack.id),
    sequence: Number(ack.sequence) || 0,
    ok: ack.ok !== false,
    appliedAt: Date.now(),
    error: ack.error || undefined,
    pointer: ack.pointer || undefined,
    authoritativeTelemetry: currentPlayback || undefined,
  });
  return { ok: true };
});

ipcMain.handle("smart-connect:revoke-device", (_, deviceId) => {
  const target = String(deviceId || "");
  if (!target) return { ok: false, error: "A paired device ID is required." };
  let removed = false;
  for (const [token, session] of pairedSessions) {
    if (session.deviceId === target) {
      pairedSessions.delete(token);
      removed = true;
    }
  }
  connectedSockets.get(target)?.close();
  connectedSockets.delete(target);
  if (removed) saveSessions();
  notifyConnectionStatus();
  return { ok: removed, devices: [...pairedSessions.values()] };
});

ipcMain.handle("smart-connect:rename-device", (_, deviceId, deviceName) => {
  const target = String(deviceId || "");
  if (!target) return { ok: false, error: "A paired device ID is required." };
  const session = [...pairedSessions.values()].find((item) => item.deviceId === target);
  if (!session) return { ok: false, error: "The paired device was not found." };
  session.deviceName = sanitizeDeviceName(deviceName);
  saveSessions();
  notifyConnectionStatus();
  return { ok: true, device: publicDevices().find((item) => item.deviceId === target) };
});

ipcMain.handle("smart-connect:disconnect", () => {
  pairedSessions.clear();
  for (const socket of connectedSockets.values()) socket.close();
  connectedSockets.clear();
  saveSessions();
  createPin();
  notifyConnectionStatus();
  return { ok: true };
});

module.exports = { startSmartConnectServer, getLocalIpAddress };
