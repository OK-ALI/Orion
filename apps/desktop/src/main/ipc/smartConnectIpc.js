// Orion Smart Connect v3 - encrypted, device-bound local remote-control transport.
const https = require("https");
const os = require("os");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app, ipcMain, safeStorage } = require("electron");
const { WebSocketServer } = require("ws");
const QRCode = require("qrcode");
const { SMART_CONNECT_PROTOCOL_VERSION, normalizeSmartConnectCommand, normalizePlaybackTelemetry } = require("@orion/shared/smart-connect-protocol");
const { loadOrCreateSecureIdentity, signChallenge, verifyDeviceSignature } = require("../smartConnect/secureIdentity");
const { createTrustState, eligibleLanAddresses, privateAddress } = require("../smartConnect/secureTrust");
const { createRealtimeDiagnostics } = require("../smartConnect/realtimeDiagnostics");
const { createControllerOwnership } = require("../smartConnect/controllerOwnership");
const { createReliableCommandScheduler } = require("../smartConnect/reliableCommandScheduler");
const { createServiceAdvertisement } = require("../smartConnect/serviceAdvertisement");
const { dispatchPlaybackCommand, initSystemControlBroadcasting, systemControl } = require("../smartConnect/playbackDispatch");
const { createPairingStore, sanitizeDeviceName } = require("../smartConnect/pairingStore");

const PORT = 8924;
const PROTOCOL_VERSION = SMART_CONNECT_PROTOCOL_VERSION;
const PIN_TTL_MS = 5 * 60 * 1000;
const TOKEN_IDLE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 1800;
const MAX_PAIR_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = PIN_TTL_MS;
const LOCKOUT_MS = 2 * 60 * 1000;
const ALLOWED_REMOTE_ORIGIN = "orion://mobile";
const COMMAND_RATE_WINDOW_MS = 1000;
const REALTIME_IPC_COALESCE_MS = 4;

let server = null;
let socketServer = null;
let getMainWindowRef = null;
let currentPlayback = null;
let currentContext = null;
let telemetrySequence = 0;
const pendingCommands = new Map();
const connectedSockets = new Map();
const secureTrust = createTrustState();
const controllerOwnership = createControllerOwnership();
const authChallenges = new Map();
let secureIdentity = null;
let activePairingId = null;

const pairingStore = createPairingStore({
  pinTtlMs: PIN_TTL_MS, attemptWindowMs: ATTEMPT_WINDOW_MS, lockoutMs: LOCKOUT_MS,
  maxPairAttempts: MAX_PAIR_ATTEMPTS, tokenIdleTtlMs: TOKEN_IDLE_TTL_MS,
});
const {
  pairedSessions, ensureDesktopInstanceId, createPin, ensureFreshPin,
  setPin, getPinState, pairingGuardSnapshot, recordFailure,
  clearPairingGuard, loadPairingGuard, savePairingGuard, /* smart-connect-pairing-guard.json savePairingGuard() */
  loadSessions, saveSessions, secureSession,
} = pairingStore;

function completeSecurePairing(transcript) {
  const session = pairingStore.completeSecurePairing(transcript);
  if (!session) return null;
  activePairingId = null;
  notifyConnectionStatus();
  return session;
}
function socketIsOpen(socket) { return Boolean(socket && socket.readyState === 1); }
function originAllowed(req) { return !req.headers.origin || req.headers.origin === ALLOWED_REMOTE_ORIGIN; }

function acceptCommandRate(socket, droppable, action) {
  const now = Date.now();
  const policy = secureTrust.networkPolicy();
  const isRealtime = action === "cursor_move" || action === "scroll";
  if (isRealtime) {
    if (!socket.realtimeRateWindowAt || now - socket.realtimeRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
      socket.realtimeRateWindowAt = now; socket.realtimeRateCount = 0;
    }
    socket.realtimeRateCount += 1;
    const maxRealtime = Number(policy.realtimeCommandRatePerSecond || policy.commandRatePerSecond || 120);
    return socket.realtimeRateCount <= maxRealtime ? { ok: true } : { ok: false, droppable: true, reason: "REALTIME_RATE_LIMITED" };
  }
  if (!socket.reliableRateWindowAt || now - socket.reliableRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
    socket.reliableRateWindowAt = now; socket.reliableRateCount = 0;
  }
  socket.reliableRateCount += 1;
  const maxReliable = Number(policy.reliableCommandRatePerSecond || 60);
  return socket.reliableRateCount <= maxReliable ? { ok: true } : { ok: false, droppable: Boolean(droppable), reason: "COMMAND_RATE_LIMITED" };
}

function controllerDeviceName(deviceId) {
  return pairingStore.controllerDeviceName(deviceId);
}

function controllerStatusFor(deviceId) {
  return controllerOwnership.snapshot(deviceId, controllerDeviceName);
}

function controllerSummary() {
  const activeDeviceId = controllerOwnership.activeControllerId();
  return {
    revision: controllerStatusFor("").revision,
    hasActiveController: Boolean(activeDeviceId),
    activeControllerName: activeDeviceId ? controllerDeviceName(activeDeviceId) : "",
  };
}

function publicDevices() {
  return pairingStore.publicDevices(connectedSockets, controllerOwnership);
}

const serviceAdvertisement = createServiceAdvertisement({
  port: PORT,
  protocolVersion: PROTOCOL_VERSION,
  getInstanceId: ensureDesktopInstanceId,
  getFingerprint: () => secureIdentity?.certificateFingerprint || "",
});

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

function getAllLocalIpAddresses() {
  return eligibleLanAddresses();
}

function getLocalIpAddress() {
  return getAllLocalIpAddresses()[0] || "127.0.0.1";
}
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

function requireSecureRequest(req, body = {}) {
  const deviceId = String(req.headers["x-orion-device"] || body.deviceId || "");
  const signature = String(req.headers["x-orion-signature"] || body.signature || "");
  const timestamp = Number(req.headers["x-orion-timestamp"] || body.timestamp || 0);
  const session = secureSession(deviceId);
  if (!session || !signature || Math.abs(Date.now() - timestamp) > 30_000) return null;
  return verifyDeviceSignature(session.publicKey, `${req.method}\n${req.url}\n${timestamp}`, signature) ? session : null;
}

function normalizeCommand(input = {}) { return normalizeSmartConnectCommand(input, () => crypto.randomUUID()); }
function dispatchCommand(command, socket) {
  return dispatchPlaybackCommand(command, socket, pendingCommands, notifyDesktopRenderer, COMMAND_TIMEOUT_MS);
}

function cancelPendingCommandsForSocket(socket, reason) {
  if (!socket) return;
  for (const [id, pending] of pendingCommands) {
    if (pending.socket !== socket) continue;
    clearTimeout(pending.timer);
    pendingCommands.delete(id);
    notifyDesktopRenderer("orion:remote-command", { action: "cancel_playback_operation", id });
    pending.resolve({ id, sequence: pending.sequence, ok: false, error: reason, controllerRevision: pending.controllerRevision });
  }
}

function clearControllerSocketWork(socket, reason) {
  socket?.clearSmartConnectRealtime?.();
  if (socket?.clearSmartConnectReliable) socket.clearSmartConnectReliable(reason);
  else cancelPendingCommandsForSocket(socket, reason);
}

function broadcastControllerStatus() {
  for (const [deviceId, socket] of connectedSockets) {
    if (socketIsOpen(socket)) sendSocket(socket, "status", deviceId, { connected: true, controller: controllerStatusFor(deviceId) });
  }
}

function sendSocket(socket, type, deviceId, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.outgoingSequence = Number(socket.outgoingSequence || 0) + 1;
    socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type, deviceId, connectionId: socket.smartConnectConnectionId, sequence: socket.outgoingSequence, payload }));
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
    const realtimeDiagnostics = createRealtimeDiagnostics();
    let pendingRealtimeCursor = null;
    let pendingRealtimeScroll = null;
    let realtimeIpcTimer = null;
    const flushRealtimeIpc = () => {
      if (realtimeIpcTimer) clearTimeout(realtimeIpcTimer);
      realtimeIpcTimer = null;
      const commands = [pendingRealtimeCursor, pendingRealtimeScroll]
        .filter(Boolean)
        .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));
      pendingRealtimeCursor = null;
      pendingRealtimeScroll = null;
      for (const command of commands) {
        realtimeDiagnostics.record("forwarded");
        notifyDesktopRenderer("orion:remote-command", command);
      }
    };
    const queueRealtimeIpc = (command) => {
      if (command.action === "cursor_move") {
        if (pendingRealtimeCursor) realtimeDiagnostics.record("coalesced");
        pendingRealtimeCursor = command;
      } else if (command.action === "scroll") {
        const deltaY = Number(command.value?.deltaY) || 0;
        const deltaX = Number(command.value?.deltaX) || 0;
        if (pendingRealtimeScroll) realtimeDiagnostics.record("coalesced");
        const accumulatedY = Math.max(
          -240,
          Math.min(240, Number(pendingRealtimeScroll?.value?.deltaY || 0) + deltaY),
        );
        const accumulatedX = Math.max(
          -240,
          Math.min(240, Number(pendingRealtimeScroll?.value?.deltaX || 0) + deltaX),
        );
        pendingRealtimeScroll = {
          ...command,
          value: { ...(command.value || {}), deltaY: accumulatedY, deltaX: accumulatedX },
        };
      }
      if (!realtimeIpcTimer) realtimeIpcTimer = setTimeout(flushRealtimeIpc, REALTIME_IPC_COALESCE_MS);
    };
    const clearRealtimeIpc = () => {
      if (realtimeIpcTimer) clearTimeout(realtimeIpcTimer);
      realtimeIpcTimer = null;
      pendingRealtimeCursor = null;
      pendingRealtimeScroll = null;
    };
    socket.clearSmartConnectRealtime = clearRealtimeIpc;
    const controllerRevisionNow = () => Number(controllerStatusFor(session.deviceId).revision) || 0;
    const reliableScheduler = createReliableCommandScheduler({
      maxDepth: 24,
      isCurrent: (entry) => (
        connectedSockets.get(session.deviceId) === socket
        && socketIsOpen(socket)
        && socket.smartConnectConnectionId === entry.connectionId
        && controllerOwnership.isActive(session.deviceId)
        && controllerRevisionNow() === entry.controllerRevision
      ),
      isPreemptible: (entry) => (
        entry.command?.action === "play"
        && entry.command?.playbackProtocolVersion === 1
      ),
      execute: (entry) => dispatchCommand(entry.command, socket),
      cancelActive: (_entry, reason) => cancelPendingCommandsForSocket(socket, reason),
      deliver: (entry, ack) => {
        sendSocket(socket, "ack", session.deviceId, {
          ...ack,
          controllerRevision: entry.controllerRevision,
          controller: controllerStatusFor(session.deviceId),
        });
      },
    });
    socket.clearSmartConnectReliable = (reason) => reliableScheduler.invalidate(() => true, reason);
    controllerOwnership.connect(session.deviceId);
    broadcastControllerStatus();
    if (currentContext) sendSocket(socket, "context", session.deviceId, currentContext);
    if (currentPlayback) sendSocket(socket, "telemetry", session.deviceId, currentPlayback);
    sendSocket(socket, "system_status", session.deviceId, systemControl.getSystemSnapshot());
    void Promise.all([systemControl.getSystemVolume(), systemControl.getDisplayBrightness()]).then(() => {
      sendSocket(socket, "system_status", session.deviceId, systemControl.getSystemSnapshot());
    }).catch(() => {});
    notifyConnectionStatus();
    socket.on("message", async (raw) => {
      let envelope;
      try {
        socket.lastSmartConnectHeartbeat = Date.now();
        envelope = JSON.parse(String(raw));
        if (envelope.version !== PROTOCOL_VERSION || envelope.deviceId !== session.deviceId) throw new Error("Unsupported Smart Connect envelope.");
        if (envelope.connectionId !== socket.smartConnectConnectionId) throw new Error("Connection identity mismatch.");
        if (envelope.type === "heartbeat") {
          session.lastSeenAt = Date.now();
          socket.lastSmartConnectHeartbeat = Date.now();
          sendSocket(socket, "heartbeat", session.deviceId, { at: Date.now() });
          return;
        }
        if (envelope.type !== "command") return;
        const action = envelope.payload?.action;
        const isLiveTyping = action === "send_text" && envelope.payload?.value && typeof envelope.payload.value === "object" && envelope.payload.value.submit === false;
        const realtimeAction = action === "cursor_move" || action === "scroll" || isLiveTyping;

if (realtimeAction) realtimeDiagnostics.record("received");

const droppable = realtimeAction;
        const rate = acceptCommandRate(socket, droppable, action);
if (!rate.ok) {
  if (realtimeAction) realtimeDiagnostics.record("rateRejected");

  if (!rate.droppable) sendSocket(socket, "error", session.deviceId, { error: rate.reason, commandId: String(envelope.commandId || envelope.payload?.id || ""), sequence: envelope.payload?.sequence });
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

          if (realtimeAction) realtimeDiagnostics.record("replayRejected");
          if (!replay.droppable) sendSocket(socket, "error", session.deviceId, { error: "Replay or duplicate command rejected.", commandId: String(envelope.commandId || envelope.payload?.id || ""), sequence: envelope.payload?.sequence });
          return;
        }
        if (!realtimeAction) flushRealtimeIpc();
        if (action === "smart_connect_take_control") {
          const transition = controllerOwnership.takeControl(session.deviceId);
          if (transition.changed && transition.previousDeviceId) {
            const previousSocket = connectedSockets.get(transition.previousDeviceId);
            if (previousSocket && previousSocket !== socket) {
              clearControllerSocketWork(previousSocket, "Controller ownership changed.");
            }
          }
          broadcastControllerStatus();
          notifyConnectionStatus();
          sendSocket(socket, "ack", session.deviceId, {
            id: envelope.payload?.id,
            sequence: envelope.payload?.sequence,
            ok: true,
            appliedAt: Date.now(),
            controller: controllerStatusFor(session.deviceId),
          });
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
          controllerOwnership.forget(session.deviceId);
          clearControllerSocketWork(socket, "The controller was unpaired.");
          saveSessions();
          sendSocket(socket, "ack", session.deviceId, {
            id: envelope.payload?.id, sequence: envelope.payload?.sequence, ok: true, appliedAt: Date.now(),
          });
          connectedSockets.delete(session.deviceId);
          broadcastControllerStatus();
          setTimeout(() => socket.close(), 30);
          notifyConnectionStatus();
          return;
        }
        if (!controllerOwnership.isActive(session.deviceId)) {
          if (!realtimeAction) {
            sendSocket(socket, "error", session.deviceId, {
              code: "CONTROLLER_NOT_ACTIVE",
              error: controllerStatusFor(session.deviceId).hasActiveController
                ? "Another trusted phone is the active Orion controller."
                : "Take control of Orion Desktop before sending remote commands.",
              commandId: String(envelope.commandId || envelope.payload?.id || ""),
              sequence: envelope.payload?.sequence,
              controller: controllerStatusFor(session.deviceId),
            });
          }
          return;
        }
        const controllerRevision = controllerRevisionNow();
        const suppliedControllerRevision = envelope.payload?.controllerRevision;
        if (suppliedControllerRevision != null && Number(suppliedControllerRevision) !== controllerRevision) {
          if (!realtimeAction) {
            sendSocket(socket, "error", session.deviceId, {
              code: "CONTROLLER_REVISION_STALE",
              error: "Controller ownership changed before this command reached Orion Desktop.",
              commandId: String(envelope.commandId || envelope.payload?.id || ""),
              sequence: envelope.payload?.sequence,
              controllerRevision,
              controller: controllerStatusFor(session.deviceId),
            });
          }
          return;
        }
        if (action === 'cursor_move' || action === 'scroll') {
          const command = normalizeCommand(envelope.payload);
          command.controllerRevision = controllerRevision;
          queueRealtimeIpc(command);
          return;
        }
        if (isLiveTyping) {
          const command = normalizeCommand(envelope.payload);
          command.controllerRevision = controllerRevision;
          notifyDesktopRenderer("orion:remote-command", command);
          return;
        }
        const command = normalizeCommand(envelope.payload);
        command.controllerRevision = controllerRevision;
        const scheduled = reliableScheduler.enqueue({
          command,
          controllerRevision,
          connectionId: socket.smartConnectConnectionId,
        });
        if (!scheduled.ok) {
          sendSocket(socket, "error", session.deviceId, {
            code: scheduled.code,
            error: scheduled.code === "RELIABLE_QUEUE_FULL"
              ? "Reliable remote input is temporarily saturated. Try again."
              : "Reliable remote input is unavailable.",
            commandId: String(envelope.commandId || envelope.payload?.id || ""),
            sequence: envelope.payload?.sequence,
            controllerRevision,
            controller: controllerStatusFor(session.deviceId),
          });
        }
      } catch (error) {
        sendSocket(socket, "error", session.deviceId, { error: error.message, commandId: String(envelope?.commandId || envelope?.payload?.id || ""), sequence: envelope?.payload?.sequence });
      }
    });
    const watchdog = setInterval(() => {
      if (Date.now() - socket.lastSmartConnectHeartbeat > 45_000) socket.close();
    }, 15_000);
    socket.on("close", () => {
      clearInterval(watchdog);
      clearControllerSocketWork(socket, "The controller disconnected.");
      realtimeDiagnostics.stop();
      if (connectedSockets.get(session.deviceId) === socket) {
        connectedSockets.delete(session.deviceId);
        controllerOwnership.disconnect(session.deviceId);
        broadcastControllerStatus();
        notifyConnectionStatus();
      }
    });
    socket.on("error", () => {
      clearInterval(watchdog);
      clearControllerSocketWork(socket, "The controller connection failed.");
      realtimeDiagnostics.stop();
      if (connectedSockets.get(session.deviceId) === socket) {
        connectedSockets.delete(session.deviceId);
        controllerOwnership.disconnect(session.deviceId);
        broadcastControllerStatus();
        notifyConnectionStatus();
      }
    });
  });
}

function notifyConnectionStatus() {
  const devices = publicDevices();
  const { currentPin, pinExpiresAt } = getPinState();
  notifyDesktopRenderer("orion:smart-connect-status", {
    paired: devices.length > 0,
    connected: devices.some((device) => device.connected),
    devices,
    controller: controllerSummary(),
    pin: currentPin,
    pinExpiresAt,
    pendingPairing: activePairingId ? secureTrust.transcript(activePairingId) : null,
    networkPolicy: secureTrust.networkPolicy(),
  });
}

async function startSmartConnectServer(getMainWindow) {
  getMainWindowRef = getMainWindow;
  if (server) return;
  const instanceId = ensureDesktopInstanceId();
  ensureFreshPin();
  loadSessions();
  loadPairingGuard();
  secureIdentity = await loadOrCreateSecureIdentity(app.getPath("userData"), instanceId);

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
      const instanceId = ensureDesktopInstanceId();
      return json(res, 200, {
        ok: true, version: PROTOCOL_VERSION, instanceId, displayName: `Orion Desktop (${os.hostname()})`,
        ip: getLocalIpAddress(), availableIps: getAllLocalIpAddresses(), port: PORT,
        paired: Boolean(session), connected: session ? socketIsOpen(connectedSockets.get(session.deviceId)) : false,
        ...(session
          ? { device: session.deviceName, controller: controllerStatusFor(session.deviceId), playback: currentPlayback }
          : { rePairRequired: publicDevices().some((d) => d.rePairRequired) }),
        pairingGuard: pairingGuardSnapshot(), certificateFingerprint: secureIdentity.certificateFingerprint, secureTransport: true,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/pair/start") {
      try {
        const data = await readJson(req);
        const now = Date.now();
        const guard = pairingGuardSnapshot(now);
        if (guard.lockedUntil) return pairingError(res, 429, "LOCKED_OUT", "Pairing is temporarily locked.", guard.retryAfterMs, 0);
        const pinState = getPinState();
        if (!pinState.currentPin || now >= pinState.pinExpiresAt) {
          ensureFreshPin();
          return pairingError(res, 401, "CODE_EXPIRED", "The pairing code expired.", undefined, guard.attemptsRemaining);
        }
        if (String(data.pin || "") !== pinState.currentPin) {
          const updated = recordFailure(now);
          return pairingError(res, updated.lockedUntil ? 429 : 401, updated.lockedUntil ? "LOCKED_OUT" : "INVALID_CODE",
            updated.lockedUntil ? "Pairing is temporarily locked." : "The pairing code is invalid.",
            updated.retryAfterMs || undefined, updated.attemptsRemaining);
        }
        if (!data.deviceId || !data.publicKey) return pairingError(res, 400, "INVALID_REQUEST", "A device-bound public identity is required.");
        const transcript = secureTrust.beginTranscript({
          desktopInstanceId: ensureDesktopInstanceId(),
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
          instanceId: ensureDesktopInstanceId(),
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
        instanceId: ensureDesktopInstanceId(), certificateFingerprint: secureIdentity.certificateFingerprint,
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
  initSystemControlBroadcasting(() => connectedSockets, sendSocket);
  const listenAddress = eligibleLanAddresses()[0];
  if (!listenAddress) throw new Error("SMART_CONNECT_PRIVATE_LAN_UNAVAILABLE");
  server.listen(PORT, listenAddress, () => {
    console.log(`[SmartConnect] secure v${PROTOCOL_VERSION} listening at https://${listenAddress}:${PORT}`);
    serviceAdvertisement.start();
  });
  server.on("error", (error) => console.error("[SmartConnect] Server error:", error.message));
  app.once("before-quit", () => serviceAdvertisement.stop());
}

ipcMain.handle("smart-connect:get-info", async () => {
  ensureFreshPin();
  const { currentPin, pinExpiresAt } = getPinState();
  const ip = getLocalIpAddress();
  const qrPayload = `orion://connect?ip=${encodeURIComponent(ip)}&port=${PORT}&pin=${encodeURIComponent(currentPin)}&version=3`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 256, margin: 2, errorCorrectionLevel: "M" }).catch(() => "");
  const devList = publicDevices();
  return {
    ok: true,
    version: PROTOCOL_VERSION,
    instanceId: ensureDesktopInstanceId(),
    ip,
    availableIps: getAllLocalIpAddresses(),
    port: PORT,
    pin: currentPin,
    pinExpiresAt,
    qrDataUrl,
    paired: pairedSessions.size > 0,
    connected: devList.some((device) => device.connected),
    devices: devList,
    controller: controllerSummary(),
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
  const state = setPin(pin);
  notifyConnectionStatus();
  return { ok: true, pin: state.currentPin, pinExpiresAt: state.pinExpiresAt };
});

ipcMain.handle("smart-connect:update-playback", (_, data) => {
  currentPlayback = data ? normalizePlaybackTelemetry(data, telemetrySequence) : null;
  telemetrySequence = currentPlayback?.sequence || telemetrySequence;
  for (const [deviceId, socket] of connectedSockets) sendSocket(socket, "telemetry", deviceId, currentPlayback);
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
  const expectedRevision = Number(pending.controllerRevision) || 0;
  const acknowledgedRevision = Number(ack?.controllerRevision) || 0;
  if (expectedRevision && acknowledgedRevision !== expectedRevision) return { ok: false, error: "Stale controller acknowledgement." };
  clearTimeout(pending.timer);
  pendingCommands.delete(String(ack.id));
  pending.resolve({
    id: String(ack.id), sequence: Number(ack.sequence) || 0, ok: ack.ok !== false, appliedAt: Date.now(),
    error: ack.error || undefined, pointer: ack.pointer || undefined, authoritativeTelemetry: currentPlayback || undefined,
    commandResult: ack.commandResult || undefined, controllerRevision: expectedRevision || undefined,
  });
  return { ok: true };
});

ipcMain.handle("smart-connect:revoke-device", (_, deviceId) => {
  const target = String(deviceId || "");
  if (!target) return { ok: false, error: "A paired device ID is required." };
  let removed = false;
  for (const [token, session] of pairedSessions) {
    if (session.deviceId === target) { pairedSessions.delete(token); removed = true; }
  }
  const targetSocket = connectedSockets.get(target);
  if (targetSocket) { clearControllerSocketWork(targetSocket, "The controller was revoked."); targetSocket.close(); }
  connectedSockets.delete(target);
  controllerOwnership.forget(target);
  broadcastControllerStatus();
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
  for (const socket of connectedSockets.values()) {
    clearControllerSocketWork(socket, "Smart Connect was disconnected.");
    socket.close();
  }
  connectedSockets.clear();
  controllerOwnership.reset();
  saveSessions();
  createPin();
  notifyConnectionStatus();
  return { ok: true };
});

module.exports = { startSmartConnectServer, getLocalIpAddress };
