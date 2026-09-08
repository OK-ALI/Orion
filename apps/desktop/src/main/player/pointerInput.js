const POINTER_COORD_LIMIT = 32_767;

function normalizeCoordinate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(POINTER_COORD_LIMIT, Math.round(numeric)));
}

function normalizeRatio(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(1, numeric));
}

function normalizePointerPayload(payload = {}) {
  return {
    x: normalizeCoordinate(payload.x),
    y: normalizeCoordinate(payload.y),
    xRatio: normalizeRatio(payload.xRatio),
    yRatio: normalizeRatio(payload.yRatio),
    webContentsId: Number.isInteger(Number(payload.webContentsId)) && Number(payload.webContentsId) > 0
      ? Number(payload.webContentsId)
      : null,
  };
}

function ownerWindowId(contents) {
  try {
    return Number(contents?.getOwnerBrowserWindow?.()?.id) || null;
  } catch {
    return null;
  }
}

function contentsType(contents) {
  try {
    return String(contents?.getType?.() || "");
  } catch {
    return "";
  }
}

function isAllowedPointerTarget(
  sender,
  target,
  getMainWindow,
  isTrustedDetachedTarget = () => false,
) {
  if (!sender || !target || target.isDestroyed?.()) return false;
  if (target.id === sender.id) return true;

  const mainWindow = getMainWindow?.();
  if (!mainWindow || mainWindow.isDestroyed?.() || mainWindow.webContents?.id !== sender.id) {
    return false;
  }

  if (isTrustedDetachedTarget(sender, target)) return true;

  // A player <webview> is a guest WebContents owned by the trusted main
  // renderer. Prefer the explicit host relationship when Electron exposes it,
  // with the owner BrowserWindow/type check as a compatibility fallback.
  if (target.hostWebContents?.id === sender.id) return true;
  return contentsType(target) === "webview" && ownerWindowId(target) === Number(mainWindow.id);
}

function coordinatesForTarget(target, normalized) {
  if (normalized.xRatio === null || normalized.yRatio === null) {
    return { x: normalized.x, y: normalized.y };
  }

  try {
    const bounds = target?.getOwnerBrowserWindow?.()?.getContentBounds?.();
    const width = Math.max(1, Number(bounds?.width) || 1);
    const height = Math.max(1, Number(bounds?.height) || 1);
    return {
      x: normalizeCoordinate(normalized.xRatio * Math.max(0, width - 1)),
      y: normalizeCoordinate(normalized.yRatio * Math.max(0, height - 1)),
    };
  } catch {
    return { x: normalized.x, y: normalized.y };
  }
}

function createPointerInputRouter({
  getMainWindow,
  resolveWebContentsById,
  isTrustedDetachedTarget,
}) {
  function sendDetachedVisual(resolved, action) {
    if (!resolved?.detached || typeof resolved.target?.send !== "function") return;
    try {
      resolved.target.send("popout-remote-pointer", {
        action,
        x: resolved.x,
        y: resolved.y,
        sentAt: Date.now(),
      });
    } catch {
      // Visual feedback is best-effort and must never delay or fail native input.
    }
  }

  function resolve(sender, payload) {
    const normalized = normalizePointerPayload(payload);
    const target = normalized.webContentsId
      ? resolveWebContentsById?.(normalized.webContentsId)
      : sender;

    if (!isAllowedPointerTarget(sender, target, getMainWindow, isTrustedDetachedTarget)) {
      return { ok: false, error: "The remote pointer target is no longer available." };
    }

    const coordinates = coordinatesForTarget(target, normalized);
    const detached = Boolean(
      target?.id !== sender?.id && isTrustedDetachedTarget?.(sender, target),
    );
    return { ok: true, target, detached, ...normalized, ...coordinates };
  }

  function move(sender, payload) {
    const resolved = resolve(sender, payload);
    if (!resolved.ok) return resolved;

    if (payload?.visualAction === "hide") {
      sendDetachedVisual(resolved, "hide");
      return { ok: true, targetId: resolved.target.id };
    }

    try {
      resolved.target.sendInputEvent({
        type: "mouseMove",
        x: resolved.x,
        y: resolved.y,
      });
      // Preserve the P11.3 latency invariant: native input is dispatched first.
      sendDetachedVisual(resolved, "move");
      return { ok: true, targetId: resolved.target.id };
    } catch {
      return { ok: false, error: "The remote pointer target rejected movement." };
    }
  }

  function click(sender, payload) {
    const resolved = resolve(sender, payload);
    if (!resolved.ok) return resolved;

    try {
      resolved.target.focus?.();
      resolved.target.sendInputEvent({
        type: "mouseMove",
        x: resolved.x,
        y: resolved.y,
      });
      resolved.target.sendInputEvent({
        type: "mouseDown",
        x: resolved.x,
        y: resolved.y,
        button: "left",
        clickCount: 1,
      });
      resolved.target.sendInputEvent({
        type: "mouseUp",
        x: resolved.x,
        y: resolved.y,
        button: "left",
        clickCount: 1,
      });
      sendDetachedVisual(resolved, "click");
      return { ok: true, targetId: resolved.target.id };
    } catch {
      return { ok: false, error: "The remote pointer target rejected the click." };
    }
  }

  return { click, move, resolve };
}

module.exports = {
  POINTER_COORD_LIMIT,
  coordinatesForTarget,
  createPointerInputRouter,
  isAllowedPointerTarget,
  normalizePointerPayload,
};
