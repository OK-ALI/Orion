"use strict";

function normalizeDeviceId(value) {
  return String(value || "").trim();
}

function createControllerOwnership() {
  let activeDeviceId = "";
  let preferredDeviceId = "";
  let revision = 0;

  const bump = () => {
    revision += 1;
    return revision;
  };

  const transition = (previousDeviceId, changed) => ({
    changed,
    previousDeviceId: previousDeviceId || null,
    activeDeviceId: activeDeviceId || null,
    preferredDeviceId: preferredDeviceId || null,
    revision,
  });

  function connect(deviceId) {
    const id = normalizeDeviceId(deviceId);
    if (!id) return transition(activeDeviceId, false);
    if (activeDeviceId) return transition(activeDeviceId, false);
    if (preferredDeviceId && preferredDeviceId !== id) return transition("", false);

    const previous = activeDeviceId;
    activeDeviceId = id;
    preferredDeviceId = id;
    bump();
    return transition(previous, true);
  }

  function takeControl(deviceId) {
    const id = normalizeDeviceId(deviceId);
    if (!id) return transition(activeDeviceId, false);
    if (activeDeviceId === id) return transition(activeDeviceId, false);

    const previous = activeDeviceId;
    activeDeviceId = id;
    preferredDeviceId = id;
    bump();
    return transition(previous, true);
  }

  function disconnect(deviceId) {
    const id = normalizeDeviceId(deviceId);
    if (!id || activeDeviceId !== id) return transition(activeDeviceId, false);

    const previous = activeDeviceId;
    activeDeviceId = "";
    bump();
    return transition(previous, true);
  }

  function forget(deviceId) {
    const id = normalizeDeviceId(deviceId);
    if (!id) return transition(activeDeviceId, false);

    const previous = activeDeviceId;
    const changed = activeDeviceId === id || preferredDeviceId === id;
    if (activeDeviceId === id) activeDeviceId = "";
    if (preferredDeviceId === id) preferredDeviceId = "";
    if (changed) bump();
    return transition(previous, changed);
  }

  function reset() {
    const previous = activeDeviceId;
    const changed = Boolean(activeDeviceId || preferredDeviceId);
    activeDeviceId = "";
    preferredDeviceId = "";
    if (changed) bump();
    return transition(previous, changed);
  }

  function isActive(deviceId) {
    const id = normalizeDeviceId(deviceId);
    return Boolean(id && activeDeviceId && id === activeDeviceId);
  }

  function activeControllerId() {
    return activeDeviceId || null;
  }

  function snapshot(deviceId, resolveDeviceName = () => "") {
    const id = normalizeDeviceId(deviceId);
    const hasActiveController = Boolean(activeDeviceId);
    const isActiveController = Boolean(id && activeDeviceId === id);
    const role = isActiveController ? "active" : hasActiveController ? "passive" : "vacant";
    return {
      revision,
      role,
      hasActiveController,
      isActiveController,
      canTakeControl: Boolean(id && !isActiveController),
      activeControllerName: hasActiveController
        ? String(resolveDeviceName(activeDeviceId) || "Orion Mobile").slice(0, 80)
        : "",
    };
  }

  return {
    activeControllerId,
    connect,
    disconnect,
    forget,
    isActive,
    reset,
    snapshot,
    takeControl,
  };
}

module.exports = { createControllerOwnership };
