import { getReadyWebContentsId } from "./webviewLifecycle";

const surfaces = new Map();
let registrationRevision = 0;
let detachedTarget = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRatio(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : fallback;
}

function resolveElement(surface) {
  const element = surface.getElement?.() || surface.element || null;
  return element?.isConnected ? element : null;
}

function surfaceContainsPoint(element, x, y) {
  const rect = element.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  return rect;
}

function isSurfaceTopmost(element, topElement) {
  if (!topElement) return true;
  return topElement === element || element.contains?.(topElement);
}

export function setDetachedRemotePointerTarget(webContentsId, surfaceId = "player:popout") {
  const id = Number(webContentsId);
  detachedTarget = Number.isInteger(id) && id > 0
    ? { surfaceId: String(surfaceId || "player:popout"), webContentsId: id }
    : null;
}

export function clearDetachedRemotePointerTarget(webContentsId = null) {
  const id = Number(webContentsId);
  if (
    detachedTarget &&
    Number.isInteger(id) &&
    id > 0 &&
    detachedTarget.webContentsId !== id
  ) {
    return;
  }
  detachedTarget = null;
}

export function registerRemotePointerSurface(surface = {}) {
  const id = String(surface.id || "").trim();
  if (!id) return () => {};

  const revision = ++registrationRevision;
  surfaces.set(id, {
    ...surface,
    id,
    revision,
    priority: Number(surface.priority) || 0,
  });

  return () => {
    if (surfaces.get(id)?.revision === revision) surfaces.delete(id);
  };
}

export function resolveRemotePointerTarget(clientX, clientY, options = {}) {
  const x = Number(clientX);
  const y = Number(clientY);
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;

  if (detachedTarget) {
    const fallbackX = typeof window !== "undefined" && window.innerWidth > 0
      ? clamp(safeX / window.innerWidth, 0, 1)
      : 0;
    const fallbackY = typeof window !== "undefined" && window.innerHeight > 0
      ? clamp(safeY / window.innerHeight, 0, 1)
      : 0;
    return {
      surfaceId: detachedTarget.surfaceId,
      kind: "detached",
      webContentsId: detachedTarget.webContentsId,
      x: 0,
      y: 0,
      xRatio: normalizeRatio(options.xRatio, fallbackX),
      yRatio: normalizeRatio(options.yRatio, fallbackY),
    };
  }

  const topElement = document.elementFromPoint?.(safeX, safeY) || null;

  const candidates = [...surfaces.values()]
    .filter((surface) => surface.isActive?.() !== false)
    .sort((a, b) => b.priority - a.priority || b.revision - a.revision);

  for (const surface of candidates) {
    const element = resolveElement(surface);
    if (!element) continue;
    const rect = surfaceContainsPoint(element, safeX, safeY);
    if (!rect || !isSurfaceTopmost(element, topElement)) continue;

    if (surface.kind === "webview") {
      let webContentsId = null;
      try {
        webContentsId = Number(surface.getWebContentsId?.() || getReadyWebContentsId(element));
      } catch {
        webContentsId = null;
      }
      if (!Number.isInteger(webContentsId) || webContentsId <= 0) continue;
      return {
        surfaceId: surface.id,
        kind: "webview",
        webContentsId,
        x: Math.round(clamp(safeX - rect.left, 0, Math.max(0, rect.width - 1))),
        y: Math.round(clamp(safeY - rect.top, 0, Math.max(0, rect.height - 1))),
      };
    }

    return {
      surfaceId: surface.id,
      kind: "renderer",
      webContentsId: null,
      x: Math.round(Math.max(0, safeX)),
      y: Math.round(Math.max(0, safeY)),
    };
  }

  return {
    surfaceId: "renderer:main",
    kind: "renderer",
    webContentsId: null,
    x: Math.round(Math.max(0, safeX)),
    y: Math.round(Math.max(0, safeY)),
  };
}

export function resetRemotePointerSurfacesForTests() {
  surfaces.clear();
  detachedTarget = null;
}
