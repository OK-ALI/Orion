"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SMART_CONNECT_PROTOCOL_VERSION,
  clampRatio,
  normalizePointer,
  normalizeSmartConnectCommand,
} = require("../../../packages/shared/src/smartConnectProtocol.cjs");

test("Smart Connect protocol stays versioned", () => {
  assert.equal(SMART_CONNECT_PROTOCOL_VERSION, 3);
});

test("pointer ratios are finite and clamped", () => {
  assert.deepEqual(normalizePointer({ x: -4, y: 2 }), { x: 0, y: 1 });
  assert.deepEqual(normalizePointer({ xRatio: 0.25, yRatio: 0.75 }), { x: 0.25, y: 0.75 });
  assert.equal(clampRatio(Number.NaN), 0);
});

test("legacy pointer values normalize into the one documented payload shape", () => {
  const command = normalizeSmartConnectCommand({
    action: "cursor_move",
    value: { xRatio: 0.4, yRatio: 0.6 },
    sequence: 3,
  }, () => "generated");
  assert.equal(command.id, "generated");
  assert.equal(command.sequence, 3);
  assert.equal(command.value, undefined);
  assert.deepEqual(command.pointer, { x: 0.4, y: 0.6 });
});
