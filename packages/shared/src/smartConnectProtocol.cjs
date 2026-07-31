"use strict";

const SMART_CONNECT_PROTOCOL_VERSION = 2;

function clampRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function normalizePointer(input) {
  if (!input || typeof input !== "object") return undefined;
  return {
    x: clampRatio(input.x ?? input.xRatio),
    y: clampRatio(input.y ?? input.yRatio),
  };
}

function normalizeSmartConnectCommand(input = {}, createId = () => "") {
  const legacyPointer = input.action === "cursor_move" ? normalizePointer(input.value) : undefined;
  return {
    id: String(input.id || createId()),
    sequence: Math.max(0, Number(input.sequence) || 0),
    action: String(input.action || ""),
    value: input.action === "cursor_move" ? undefined : input.value,
    pointer: normalizePointer(input.pointer) || legacyPointer,
    sentAt: Number(input.sentAt) || Date.now(),
  };
}

module.exports = {
  SMART_CONNECT_PROTOCOL_VERSION,
  clampRatio,
  normalizePointer,
  normalizeSmartConnectCommand,
};
