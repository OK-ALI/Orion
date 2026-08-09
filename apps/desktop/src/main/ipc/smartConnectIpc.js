// Orion Smart Connect v2 — authenticated local remote-control transport.
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app, ipcMain, safeStorage } = require("electron");
const { WebSocketServer } = require("ws");
const QRCode = require("qrcode");
const { Bonjour } = require("bonjour-service");
const { SMART_CONNECT_PROTOCOL_VERSION, normalizeSmartConnectCommand, normalizePlaybackTelemetry } = require("../../../../../packages/shared/src/smartConnectProtocol.cjs");

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

function socketIsOpen(socket) {
  return Boolean(socket && socket.readyState === 1);
}

function publicDevices() {
  return [...pairedSessions.values()].map(({ deviceId, deviceName, device, createdAt, lastSeenAt }) => ({
    deviceId,
    deviceName: sanitizeDeviceName(deviceName || device),
    createdAt: Number(createdAt || lastSeenAt || Date.now()),
    lastSeenAt,
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
    for (const [token, session] of Array.isArray(entries) ? entries : []) {
      if (token && session?.deviceId && Date.now() - Number(session.lastSeenAt || 0) < TOKEN_IDLE_TTL_MS) {
        pairedSessions.set(token, {
          ...session,
          deviceName: sanitizeDeviceName(session.deviceName || session.device),
          createdAt: Number(session.createdAt || session.lastSeenAt || Date.now()),
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

function getLocalIpAddress() {
  return getAllLocalIpAddresses()[0] || "127.0.0.1";
}

function notifyDesktopRenderer(event, data) {
  const win = getMainWindowRef?.();
  if (win && !win.isDestroyed()) win.webContents.send(event, data);
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
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

function getBearer(req, body = {}) {
  const header = String(req.headers.authorization || "");
  return header.replace(/^Bearer\s+/i, "").trim() || String(body.token || "");
}

function authenticate(token) {
  const session = pairedSessions.get(token);
  if (!session) return null;
  if (Date.now() - Number(session.lastSeenAt || 0) > TOKEN_IDLE_TTL_MS) {
    pairedSessions.delete(token);
    saveSessions();
    return null;
  }
  session.lastSeenAt = Date.now();
  return session;
}

function normalizeCommand(input = {}) {
  return normalizeSmartConnectCommand(input, () => crypto.randomUUID());
}

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
    socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type, deviceId, payload }));
  }
}

function configureSockets() {
  socketServer = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    let parsed;
    try { parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`); } catch { socket.destroy(); return; }
    if (parsed.pathname !== "/api/socket") { socket.destroy(); return; }
    const token = parsed.searchParams.get("token") || "";
    const session = authenticate(token);
    if (!session) { socket.destroy(); return; }
    socketServer.handleUpgrade(req, socket, head, (ws) => {
      ws.smartConnectSession = session;
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
        if (envelope.version !== PROTOCOL_VERSION) throw new Error("Unsupported Smart Connect protocol.");
        if (envelope.type === "heartbeat") {
          session.lastSeenAt = Date.now();
          socket.lastSmartConnectHeartbeat = Date.now();
          sendSocket(socket, "heartbeat", session.deviceId, { at: Date.now() });
          return;
        }
        if (envelope.type !== "command") return;
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
  });
}

function startSmartConnectServer(getMainWindow) {
  getMainWindowRef = getMainWindow;
  if (server) return;
  ensureDesktopInstanceId();
  ensureFreshPin();
  loadSessions();
  loadPairingGuard();

  server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/status") {
      const session = authenticate(getBearer(req));
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
          });
    }

    if (req.method === "POST" && url.pathname === "/api/pair") {
      try {
        const data = await readJson(req);
        const now = Date.now();
        normalizePairingGuard(now);
        const existingToken = String(data.token || "");
        const existing = authenticate(existingToken);
        if (!existing && now < lockedUntil) {
          return pairingError(res, 429, "LOCKED_OUT", "Pairing is temporarily locked. Try again shortly.", lockedUntil - now, 0);
        }
        const codeExpired = !currentPin || now >= pinExpiresAt;
        ensureFreshPin();
        if (!existing && codeExpired) {
          // Expiry is not a failed authentication attempt. A fresh code was
          // generated above; retain the user's remaining attempts.
          const guard = pairingGuardSnapshot(now);
          return pairingError(res, 401, "CODE_EXPIRED", "The six-digit pairing code expired. Generate a new code on Orion Desktop.", undefined, guard.attemptsRemaining);
        }
        if (!existing && String(data.pin || "") !== currentPin) {
          pairAttempts.push(now);
          if (pairAttempts.length >= MAX_PAIR_ATTEMPTS) {
            lockedUntil = now + LOCKOUT_MS;
            savePairingGuard();
            return pairingError(res, 429, "LOCKED_OUT", "Pairing is temporarily locked. Try again shortly.", LOCKOUT_MS, 0);
          }
          savePairingGuard();
          return pairingError(
            res,
            401,
            "INVALID_CODE",
            "The six-digit pairing code is invalid.",
            undefined,
            Math.max(0, MAX_PAIR_ATTEMPTS - pairAttempts.length),
          );
        }
        const token = existingToken && existing ? existingToken : crypto.randomBytes(32).toString("hex");
        const session = existing || {
          deviceId: String(data.deviceId || crypto.randomUUID()),
          deviceName: sanitizeDeviceName(data.deviceName || data.device),
          createdAt: now,
          lastSeenAt: now,
        };
        session.lastSeenAt = now;
        if (!existing) {
          for (const [savedToken, savedSession] of pairedSessions) {
            if (savedSession.deviceId === session.deviceId) pairedSessions.delete(savedToken);
          }
        }
        pairedSessions.set(token, session);
        pairAttempts = [];
        lockedUntil = 0;
        savePairingGuard();
        createPin();
        saveSessions();
        notifyConnectionStatus();
        return json(res, 200, {
          ok: true,
          version: PROTOCOL_VERSION,
          instanceId: desktopInstanceId,
          paired: true,
          token,
          deviceId: session.deviceId,
          deviceName: session.deviceName,
          socketUrl: `ws://${getLocalIpAddress()}:${PORT}/api/socket`,
        });
      } catch (error) {
        return pairingError(res, 400, "INVALID_REQUEST", error.message);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/device") {
      try {
        const body = await readJson(req);
        const token = getBearer(req, body);
        const session = authenticate(token);
        if (!session) return pairingError(res, 401, "TOKEN_REJECTED", "The remembered pairing is no longer authorized.");
        const action = String(body.action || "rename");
        if (action === "rename") {
          session.deviceName = sanitizeDeviceName(body.deviceName);
          saveSessions();
          notifyConnectionStatus();
          return json(res, 200, { ok: true, device: publicDevices().find((item) => item.deviceId === session.deviceId) });
        }
        if (action === "revoke") {
          pairedSessions.delete(token);
          connectedSockets.get(session.deviceId)?.close();
          connectedSockets.delete(session.deviceId);
          saveSessions();
          notifyConnectionStatus();
          return json(res, 200, { ok: true });
        }
        return pairingError(res, 400, "INVALID_REQUEST", "Unsupported device update action.");
      } catch (error) {
        return pairingError(res, 400, "INVALID_REQUEST", error.message);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/command") {
      try {
        const body = await readJson(req);
        const session = authenticate(getBearer(req, body));
        if (!session) return json(res, 401, { ok: false, error: "Unauthorized pairing token." });
        const ack = await dispatchCommand(normalizeCommand(body.command || body));
        return json(res, ack.ok ? 200 : 504, { ok: ack.ok, ack });
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/unpair") {
      try {
        const body = await readJson(req);
        const token = getBearer(req, body);
        const session = authenticate(token);
        if (!session) return json(res, 401, { ok: false, error: "Unauthorized pairing token." });
        pairedSessions.delete(token);
        connectedSockets.get(session.deviceId)?.close();
        connectedSockets.delete(session.deviceId);
        saveSessions();
        notifyConnectionStatus();
        return json(res, 200, { ok: true, paired: pairedSessions.size > 0 });
      } catch (error) {
        return json(res, 400, { ok: false, error: error.message });
      }
    }

    return json(res, 404, { ok: false, error: "Not Found" });
  });

  configureSockets();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SmartConnect] v${PROTOCOL_VERSION} listening at http://${getLocalIpAddress()}:${PORT}`);
    startServiceAdvertisement();
  });
  server.on("error", (error) => console.error("[SmartConnect] Server error:", error.message));
  app.once("before-quit", stopServiceAdvertisement);
}

ipcMain.handle("smart-connect:get-info", async () => {
  ensureFreshPin();
  const ip = getLocalIpAddress();
  const qrPayload = `orion://connect?ip=${encodeURIComponent(ip)}&port=${PORT}&pin=${encodeURIComponent(currentPin)}`;
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
  };
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
