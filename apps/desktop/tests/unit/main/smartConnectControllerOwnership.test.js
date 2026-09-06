const test = require("node:test");
const assert = require("node:assert/strict");
const { createControllerOwnership } = require("../../../src/main/smartConnect/controllerOwnership");

test("first trusted phone becomes active while later phones stay passive", () => {
  const ownership = createControllerOwnership();
  const first = ownership.connect("phone-a");
  const second = ownership.connect("phone-b");

  assert.equal(first.changed, true);
  assert.equal(ownership.isActive("phone-a"), true);
  assert.equal(second.changed, false);
  assert.equal(ownership.isActive("phone-b"), false);
  assert.equal(ownership.snapshot("phone-b", () => "Phone A").role, "passive");
});

test("explicit takeover moves authority and increments the controller revision", () => {
  const ownership = createControllerOwnership();
  const initial = ownership.connect("phone-a");
  const takeover = ownership.takeControl("phone-b");

  assert.equal(takeover.changed, true);
  assert.equal(takeover.previousDeviceId, "phone-a");
  assert.ok(takeover.revision > initial.revision);
  assert.equal(ownership.isActive("phone-a"), false);
  assert.equal(ownership.isActive("phone-b"), true);
});

test("active-controller disconnect leaves authority vacant for passive peers", () => {
  const ownership = createControllerOwnership();
  ownership.connect("phone-a");
  ownership.connect("phone-b");
  const disconnected = ownership.disconnect("phone-a");

  assert.equal(disconnected.changed, true);
  assert.equal(ownership.snapshot("phone-b").role, "vacant");
  assert.equal(ownership.isActive("phone-b"), false);
});

test("previous controller may reclaim a vacant slot but another phone cannot silently steal it", () => {
  const ownership = createControllerOwnership();
  ownership.connect("phone-a");
  ownership.connect("phone-b");
  ownership.disconnect("phone-a");

  assert.equal(ownership.connect("phone-b").changed, false);
  assert.equal(ownership.isActive("phone-b"), false);
  assert.equal(ownership.connect("phone-a").changed, true);
  assert.equal(ownership.isActive("phone-a"), true);
});

test("forgetting the previous controller clears its reclaim preference", () => {
  const ownership = createControllerOwnership();
  ownership.connect("phone-a");
  ownership.disconnect("phone-a");
  ownership.forget("phone-a");

  assert.equal(ownership.connect("phone-b").changed, true);
  assert.equal(ownership.isActive("phone-b"), true);
});
