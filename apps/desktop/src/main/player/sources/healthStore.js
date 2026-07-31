const fs = require("fs");
const path = require("path");

const STORE_VERSION = 1;
const MAX_RECORDS = 80;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const VALID_STATES = new Set(["unknown", "checking", "ready", "slow", "degraded", "failed", "disabled"]);
const VALID_REASONS = new Set([
  "navigation-blocked",
  "provider-unavailable",
  "title-unavailable",
  "media-server-unavailable",
  "startup-timeout",
  "provider-error-page",
  "unsupported-player",
  "network-offline",
  "subtitle-failure",
  "main-frame-failed",
  "playback-stalled",
  "unknown",
]);

const cleanText = (value) => String(value || "")
  .replace(/https?:\/\/\S+/gi, "[redacted-url]")
  .replace(/[?&](token|key|signature|sig|auth)=[^\s&]+/gi, "&$1=[redacted]")
  .slice(0, 240);

function createSourceHealthStore({ filePath = null, now = () => Date.now() } = {}) {
  const records = new Map();
  const keyFor = (sourceId, mediaType) => `${sourceId}:${mediaType}`;

  const publicRecord = (record) => ({
    sourceId: record.sourceId,
    mediaType: record.mediaType,
    state: record.state,
    lastSuccessAt: record.lastSuccessAt || null,
    lastFailureAt: record.lastFailureAt || null,
    consecutiveFailures: record.consecutiveFailures || 0,
    startupMs: Number.isFinite(record.startupMs) ? record.startupMs : null,
    cooldownUntil: record.cooldownUntil || null,
    reasonCode: record.reasonCode || null,
    redactedMessage: record.redactedMessage || "",
    updatedAt: record.updatedAt || null,
  });

  const save = () => {
    if (!filePath) return;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify({ version: STORE_VERSION, records: [...records.values()] }, null, 2));
      fs.renameSync(tempPath, filePath);
    } catch {}
  };

  const prune = () => {
    if (records.size <= MAX_RECORDS) return;
    const ordered = [...records.entries()].sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    records.clear();
    for (const [key, record] of ordered.slice(0, MAX_RECORDS)) records.set(key, record);
  };

  const load = () => {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
      const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (value?.version !== STORE_VERSION || !Array.isArray(value.records)) return;
      for (const record of value.records) {
        if (!record?.sourceId || !record?.mediaType || !VALID_STATES.has(record.state)) continue;
        records.set(keyFor(record.sourceId, record.mediaType), { ...record, redactedMessage: cleanText(record.redactedMessage) });
      }
      prune();
    } catch {}
  };

  const record = (event = {}) => {
    const sourceId = String(event.sourceId || "").trim().toLowerCase();
    const mediaType = ["movie", "tv", "anime"].includes(event.mediaType) ? event.mediaType : "movie";
    if (!/^[a-z0-9-]+$/.test(sourceId)) throw new Error("Invalid Cinema source ID.");
    const key = keyFor(sourceId, mediaType);
    const previous = records.get(key) || {
      sourceId, mediaType, state: "unknown", consecutiveFailures: 0,
      lastSuccessAt: null, lastFailureAt: null, cooldownUntil: null,
    };
    const timestamp = now();
    const requestedState = VALID_STATES.has(event.state) ? event.state : previous.state;
    const successful = requestedState === "ready";
    const failed = requestedState === "failed" || requestedState === "degraded";
    const consecutiveFailures = successful ? 0 : failed ? previous.consecutiveFailures + 1 : previous.consecutiveFailures;
    const next = {
      ...previous,
      state: requestedState,
      startupMs: Number.isFinite(event.startupMs) && event.startupMs >= 0 ? Math.round(event.startupMs) : previous.startupMs,
      consecutiveFailures,
      lastSuccessAt: successful ? timestamp : previous.lastSuccessAt,
      lastFailureAt: failed ? timestamp : previous.lastFailureAt,
      cooldownUntil: successful ? null : consecutiveFailures >= 2 ? timestamp + FAILURE_COOLDOWN_MS : previous.cooldownUntil,
      reasonCode: event.reasonCode && VALID_REASONS.has(event.reasonCode) ? event.reasonCode : failed ? "unknown" : null,
      redactedMessage: cleanText(event.message),
      updatedAt: timestamp,
    };
    records.set(key, next);
    prune();
    save();
    return publicRecord(next);
  };

  const list = (mediaType = null) => [...records.values()]
    .filter((record) => !mediaType || record.mediaType === mediaType)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(publicRecord);

  const get = (sourceId, mediaType) => publicRecord(records.get(keyFor(sourceId, mediaType)) || {
    sourceId, mediaType, state: "unknown", consecutiveFailures: 0,
  });

  const isCoolingDown = (sourceId, mediaType) => (records.get(keyFor(sourceId, mediaType))?.cooldownUntil || 0) > now();
  const clear = () => { records.clear(); save(); };

  load();
  return { record, list, get, isCoolingDown, clear, constants: { STORE_VERSION, MAX_RECORDS, FAILURE_COOLDOWN_MS } };
}

module.exports = { createSourceHealthStore, cleanText };
