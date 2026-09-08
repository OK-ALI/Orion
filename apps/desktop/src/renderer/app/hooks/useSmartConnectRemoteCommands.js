import { useEffect, useRef } from "react";
import {
  clearDetachedRemotePointerTarget,
  resolveRemotePointerTarget,
  setDetachedRemotePointerTarget,
} from "../../features/player/services/remotePointerSurfaces";
import {
  createRemotePointerTarget,
  stepRemotePointerVisual,
} from "../../features/player/services/remotePointerSmoothing";

const REMOTE_CURSOR_INACTIVITY_MS = 4_000;
let lastCursorActivityAt = 0;
let latestCursorTarget = null;
let renderedCursorPosition = null;
let lastCursorFrameAt = 0;
let hoverCheckTimer = null;
let rafHandle = null;
let remoteCursorInactivityTimer = null;
let hoveredRemoteElement = null;
let pressedCursorTimer = null;

const rendererDiagnosticsEnabled =
  globalThis.__ORION_SMART_CONNECT_DIAGNOSTICS__ === true;
const rendererRealtimeDiagnostics = {
  received: 0,
  cursorMoveCalled: 0,
  nativeMovesDispatched: 0,
  rafTicks: 0,
  cursorFramesRendered: 0,
  interpolatedFrames: 0,
  settledFrames: 0,
  maxVisualLagPx: 0,
  maxVisualSettleMs: 0,
};

const SIDEBAR_PAGES = [
  "home",
  "search",
  "discover",
  "constellation",
  "library",
  "downloads",
  "music-home",
  "settings",
];

function getScrollContainer() {
  return (
    document.querySelector(".app-content") ||
    document.querySelector(".music-planet-container") ||
    document.querySelector(".page-content") ||
    document.scrollingElement ||
    window
  );
}

function getOrCreateVirtualCursor() {
  let cursor = document.querySelector(".orion-virtual-cursor");
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.className = "orion-virtual-cursor";
    const glyph = document.createElement("span");
    glyph.className = "orion-virtual-cursor__glyph";
    cursor.appendChild(glyph);
    cursor.style.opacity = "0";
    document.body.appendChild(cursor);
  }
  return cursor;
}

function clearRemoteCursor() {
  const detachedRoute = latestCursorTarget?.route?.kind === "detached"
    ? latestCursorTarget.route
    : null;

  latestCursorTarget = null;
  renderedCursorPosition = null;
  lastCursorFrameAt = 0;
  lastCursorActivityAt = 0;

  if (detachedRoute) {
    window.electron?.sendRemotePointerMove?.({
      ...detachedRoute,
      visualAction: "hide",
    });
  }

  if (remoteCursorInactivityTimer) {
    window.clearTimeout(remoteCursorInactivityTimer);
    remoteCursorInactivityTimer = null;
  }

  if (rafHandle) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
  if (pressedCursorTimer) {
    window.clearTimeout(pressedCursorTimer);
    pressedCursorTimer = null;
  }
  if (hoverCheckTimer) {
    window.clearTimeout(hoverCheckTimer);
    hoverCheckTimer = null;
  }

  const cursor = document.querySelector(".orion-virtual-cursor");

  if (cursor) {
    cursor.style.opacity = "0";
    cursor.classList.remove("is-pressed");
    cursor.dataset.kind = "default";
  }

  hoveredRemoteElement?.classList.remove("spatial-remote-focused");
  hoveredRemoteElement = null;
}

function updateRemoteHover(element) {
  const candidate = element?.closest?.(".media-card, button, a, [role='button'], [tabindex='0'], input, textarea, [contenteditable='true']") || null;
  if (candidate !== hoveredRemoteElement) {
    hoveredRemoteElement?.classList.remove("spatial-remote-focused");
    hoveredRemoteElement = candidate;
    hoveredRemoteElement?.classList.add("spatial-remote-focused");
  }
  const cursor = getOrCreateVirtualCursor();
  const input = candidate?.matches?.("input:not([type='password']), textarea, [contenteditable='true']");
  cursor.dataset.kind = input ? "text" : candidate ? "interactive" : "default";
}
function scheduleRemoteCursorCleanup({ showMainCursor = true } = {}) {
  lastCursorActivityAt = performance.now();

  if (showMainCursor) {
    const cursor = getOrCreateVirtualCursor();
    cursor.style.opacity = "1";
  }

  if (remoteCursorInactivityTimer) {
    window.clearTimeout(remoteCursorInactivityTimer);
  }

  remoteCursorInactivityTimer = window.setTimeout(() => {
    remoteCursorInactivityTimer = null;
    clearRemoteCursor();
  }, REMOTE_CURSOR_INACTIVITY_MS);
}
function prefersReducedRemotePointerMotion() {
  try {
    return Boolean(
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  } catch {
    return false;
  }
}

function applyRemoteCursorVisual(cursor, position) {
  if (!cursor || !position) return;

  cursor.style.transform =
    `translate3d(${position.x}px, ${position.y}px, 0)`;
  cursor.style.opacity = "1";
  cursor.dataset.renderX = String(position.x);
  cursor.dataset.renderY = String(position.y);
}

function scheduleRemoteHoverCheck() {
  if (hoverCheckTimer) return;

  hoverCheckTimer = window.setTimeout(() => {
    hoverCheckTimer = null;

    const target = latestCursorTarget;
    if (!target || target.route?.kind === "detached") {
      updateRemoteHover(null);
      return;
    }

    const element = document.elementFromPoint(target.x, target.y);
    updateRemoteHover(element);
  }, 50);
}

function moveCursor(payload) {
  rendererRealtimeDiagnostics.cursorMoveCalled += 1;

  const pointer = payload?.pointer || payload?.value || payload || {};
  const target = createRemotePointerTarget(
    pointer,
    window.innerWidth,
    window.innerHeight,
    performance.now(),
  );
  target.route = resolveRemotePointerTarget(target.x, target.y, {
    xRatio: target.xRatio,
    yRatio: target.yRatio,
  });
  latestCursorTarget = target;

  // Route the newest authoritative point immediately. Visual interpolation is
  // deliberately decoupled so smoothing never adds a renderer-frame delay to
  // provider/native pointer input.
  window.electron?.sendRemotePointerMove?.(target.route);
  rendererRealtimeDiagnostics.nativeMovesDispatched += 1;

  if (target.route?.kind === "detached") {
    if (rafHandle) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    renderedCursorPosition = null;
    lastCursorFrameAt = 0;
    const mainCursor = document.querySelector(".orion-virtual-cursor");
    if (mainCursor) {
      mainCursor.style.opacity = "0";
      mainCursor.classList.remove("is-pressed");
    }
    hoveredRemoteElement?.classList.remove("spatial-remote-focused");
    hoveredRemoteElement = null;
    scheduleRemoteCursorCleanup({ showMainCursor: false });
    return;
  }

  const cursor = getOrCreateVirtualCursor();
  cursor.dataset.x = String(target.x);
  cursor.dataset.y = String(target.y);
  cursor.dataset.xRatio = String(target.xRatio);
  cursor.dataset.yRatio = String(target.yRatio);

  try {
    const elementUnderCursor = document.elementFromPoint(target.x, target.y);
    if (elementUnderCursor) {
      elementUnderCursor.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: target.x,
          clientY: target.y,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  } catch {}

  scheduleRemoteCursorCleanup();
  scheduleRemoteHoverCheck();

  if (!renderedCursorPosition) {
    renderedCursorPosition = { x: target.x, y: target.y };
    lastCursorFrameAt = target.receivedAt;
    applyRemoteCursorVisual(cursor, renderedCursorPosition);
    rendererRealtimeDiagnostics.cursorFramesRendered += 1;
    rendererRealtimeDiagnostics.settledFrames += 1;
    return;
  }

  if (!rafHandle) {
    rafHandle = requestAnimationFrame(renderCursorFrame);
  }
}

function renderCursorFrame(timestamp) {
  rafHandle = null;
  rendererRealtimeDiagnostics.rafTicks += 1;

  const target = latestCursorTarget;
  if (!target) return;

  const frameAt = Number.isFinite(Number(timestamp))
    ? Number(timestamp)
    : performance.now();
  const deltaMs =
    lastCursorFrameAt > 0 ? frameAt - lastCursorFrameAt : 16.67;
  lastCursorFrameAt = frameAt;

  const result = stepRemotePointerVisual(
    renderedCursorPosition,
    target,
    deltaMs,
    { reducedMotion: prefersReducedRemotePointerMotion() },
  );

  renderedCursorPosition = result.position;
  rendererRealtimeDiagnostics.cursorFramesRendered += 1;

  const visualLagPx = Math.hypot(
    target.x - renderedCursorPosition.x,
    target.y - renderedCursorPosition.y,
  );
  rendererRealtimeDiagnostics.maxVisualLagPx = Math.max(
    rendererRealtimeDiagnostics.maxVisualLagPx,
    visualLagPx,
  );

  if (result.settled) {
    rendererRealtimeDiagnostics.settledFrames += 1;
    rendererRealtimeDiagnostics.maxVisualSettleMs = Math.max(
      rendererRealtimeDiagnostics.maxVisualSettleMs,
      Math.max(0, frameAt - target.receivedAt),
    );
  } else {
    rendererRealtimeDiagnostics.interpolatedFrames += 1;
  }

  applyRemoteCursorVisual(
    getOrCreateVirtualCursor(),
    renderedCursorPosition,
  );

  if (!result.settled && latestCursorTarget) {
    rafHandle = requestAnimationFrame(renderCursorFrame);
  }
}

async function clickCursor() {
  const cursor = document.querySelector(".orion-virtual-cursor");
  if (!latestCursorTarget && !cursor) return { ok: true };

  const target = latestCursorTarget || {
    x: Number(cursor.dataset.x) || (cursor.getBoundingClientRect().left + 10),
    y: Number(cursor.dataset.y) || (cursor.getBoundingClientRect().top + 10),
    xRatio: Math.max(0, Math.min(1, Number(cursor.dataset.xRatio) || 0)),
    yRatio: Math.max(0, Math.min(1, Number(cursor.dataset.yRatio) || 0)),
  };

  const route =
    target.route ||
    resolveRemotePointerTarget(target.x, target.y, {
      xRatio: target.xRatio,
      yRatio: target.yRatio,
    });

  const detached = route?.kind === "detached";
  scheduleRemoteCursorCleanup({ showMainCursor: !detached });

  if (!detached && cursor) {
    // A click is a reliable action. Visually converge to the authoritative
    // point before dispatch so the click never lands ahead of the cursor.
    renderedCursorPosition = { x: target.x, y: target.y };
    applyRemoteCursorVisual(cursor, renderedCursorPosition);

    cursor.classList.add("is-pressed");
    if (pressedCursorTimer) window.clearTimeout(pressedCursorTimer);
    pressedCursorTimer = window.setTimeout(() => {
      cursor.classList.remove("is-pressed");
      pressedCursorTimer = null;
    }, 120);
  }

  if (window.electron?.clickRemotePointer) {
    try {
      const result = await window.electron.clickRemotePointer(route);
      return result?.ok
        ? { ok: true }
        : {
            ok: false,
            error:
              result?.error ||
              "The remote pointer target did not accept the click.",
          };
    } catch {
      return {
        ok: false,
        error: "The remote pointer target did not accept the click.",
      };
    }
  }

  // Compatibility fallback for renderer environments without the native input
  // bridge. Production P11.3 builds use the surface-aware path above.
  const element = document.elementFromPoint(target.x, target.y);
  const clickable =
    element?.closest(".media-card, button, a, [role='button'], input") ||
    element;
  clickable?.click?.();
  return { ok: true };
}

function moveSpatialFocus(action) {
  const selector =
    ".media-card, [role='button'], .poster-container, .card, .search-media-result";
  let cards = Array.from(document.querySelectorAll(selector));
  if (cards.length === 0) {
    cards = Array.from(document.querySelectorAll("button, [tabindex='0']"));
  }
  if (cards.length === 0) return;
  cards.forEach((element) => {
    if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
  });
  const focused = document.querySelector(".spatial-remote-focused");
  let index = focused ? cards.indexOf(focused) : cards.indexOf(document.activeElement);
  const nextIndex =
    action === "focus_card_next"
      ? index === -1
        ? 0
        : (index + 1) % cards.length
      : index === -1
        ? cards.length - 1
        : (index - 1 + cards.length) % cards.length;
  document
    .querySelectorAll(".spatial-remote-focused")
    .forEach((element) => element.classList.remove("spatial-remote-focused"));
  const target = cards[nextIndex];
  target?.classList.add("spatial-remote-focused");
  target?.focus?.();
  target?.scrollIntoView?.({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
}

export function useSmartConnectRemoteCommands({
  baseNavigate,
  baseNavigateBack,
  createMiniHandoff,
  handleSystemMediaCommand,
  pageRef,
  setShowSearch,
}) {
  const pendingPlaybackRef = useRef(new Map());
  useEffect(() => () => {
    pendingPlaybackRef.current.forEach((controller) => controller.abort());
    pendingPlaybackRef.current.clear();
  }, []);

  useEffect(() => {
    let disposed = false;

    const syncPopoutPointerTarget = async () => {
      try {
        const id = await window.electron?.getPipWebContentsId?.();
        if (disposed) return;
        if (Number.isInteger(Number(id)) && Number(id) > 0) {
          setDetachedRemotePointerTarget(Number(id));
        } else {
          clearDetachedRemotePointerTarget();
        }
      } catch {
        if (!disposed) clearDetachedRemotePointerTarget();
      }
    };

    const openedHandler = window.electron?.onPipOpened?.(() => {
      clearRemoteCursor();
      syncPopoutPointerTarget();
    });
    const closedHandler = window.electron?.onPipClosed?.(() => {
      clearRemoteCursor();
      clearDetachedRemotePointerTarget();
    });

    syncPopoutPointerTarget();

    return () => {
      disposed = true;
      if (openedHandler) window.electron?.offPipOpened?.(openedHandler);
      if (closedHandler) window.electron?.offPipClosed?.(closedHandler);
      clearDetachedRemotePointerTarget();
    };
  }, []);

  useEffect(() => {
const rendererDiagnosticsTimer = rendererDiagnosticsEnabled ? window.setInterval(() => {
  const diagnostics = rendererRealtimeDiagnostics;

  console.log(
    `[SmartConnect renderer] received=${diagnostics.received} cursorMoveCalled=${diagnostics.cursorMoveCalled} nativeMoves=${diagnostics.nativeMovesDispatched} rafTicks=${diagnostics.rafTicks} cursorFrames=${diagnostics.cursorFramesRendered} interpolated=${diagnostics.interpolatedFrames} settled=${diagnostics.settledFrames} maxVisualLagPx=${diagnostics.maxVisualLagPx.toFixed(1)} maxVisualSettleMs=${diagnostics.maxVisualSettleMs.toFixed(1)}`,
  );

  diagnostics.received = 0;
  diagnostics.cursorMoveCalled = 0;
  diagnostics.nativeMovesDispatched = 0;
  diagnostics.rafTicks = 0;
  diagnostics.cursorFramesRendered = 0;
  diagnostics.interpolatedFrames = 0;
  diagnostics.settledFrames = 0;
  diagnostics.maxVisualLagPx = 0;
  diagnostics.maxVisualSettleMs = 0;
}, 1000) : null;
    const handleRemoteCommand = async (payload) => {
      const { action, value } = payload || {};
      if (action === "cancel_playback_operation") {
        pendingPlaybackRef.current.get(payload.id)?.abort();
        return;
      }
      const controller = new AbortController();
      const execution = { deadlineAt: payload?.deadlineAt, signal: controller.signal };
      const expected = { ...(value && typeof value === "object" ? value : {}), ownerRevision: payload?.ownerRevision };
      if (payload?.id) pendingPlaybackRef.current.set(payload.id, controller);

if (rendererDiagnosticsEnabled && (action === "cursor_move" || action === "scroll")) {
  rendererRealtimeDiagnostics.received += 1;
}

const targetScroll = getScrollContainer();
      let commandResult = { ok: true };

      try {
      if (controller.signal.aborted) throw new Error("Controller operation cancelled.");
      if (execution.deadlineAt && Date.now() >= execution.deadlineAt) throw new Error("Command expired.");
      if (action === "cursor_move") moveCursor(payload);
      if (action === "cursor_click") commandResult = await clickCursor();
      if (action === "scroll") {
        const deltaY = Math.max(-240, Math.min(240, Number(value?.deltaY) || 0));
        getScrollContainer()?.scrollBy?.({ top: deltaY, behavior: "auto" });
      }
      if (action === "navigate_page" && value) await baseNavigate(value);
      if (action === "sidebar_next" || action === "sidebar_prev") {
        const current = SIDEBAR_PAGES.indexOf(pageRef.current || "home");
        const offset = action === "sidebar_next" ? 1 : -1;
        const next = (current + offset + SIDEBAR_PAGES.length) % SIDEBAR_PAGES.length;
        await baseNavigate(SIDEBAR_PAGES[next]);
      }
      if (action === "focus_card_next" || action === "focus_card_prev") {
        moveSpatialFocus(action);
      }
      if (action === "seek_to") {
        const seconds = Number(value?.seconds ?? value);
        commandResult = Number.isFinite(seconds)
          ? await handleSystemMediaCommand(`seek:${seconds}`, expected, execution)
          : { ok: false, error: "The requested seek position is invalid." };
      }
      if (action === "play_media") {
        const targetType = payload?.mediaType || payload?.type || "movie";
        const targetId = payload?.id || value;
        if (targetId) baseNavigate(targetType, targetId);
      }
      if (action === "constellation_search") {
        baseNavigate("constellation");
        window.dispatchEvent(
          new CustomEvent("orion:constellation-search", { detail: value }),
        );
      }
      if (action === "up" || action === "down") {
        const active = document.activeElement;
        if (active && active !== document.body) {
          active.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: action === "up" ? "ArrowUp" : "ArrowDown",
              bubbles: true,
            }),
          );
        } else {
          const top = action === "up" ? -280 : 280;
          if (typeof targetScroll.scrollBy === "function") {
            targetScroll.scrollBy({ top, behavior: "smooth" });
          } else {
            window.scrollBy({ top, behavior: "smooth" });
          }
        }
      }
      if (action === "left" || action === "right") {
        const active = document.activeElement;
        if (active && active !== document.body) {
          active.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: action === "left" ? "ArrowLeft" : "ArrowRight",
              bubbles: true,
            }),
          );
        } else {
          targetScroll.scrollBy({
            left: action === "left" ? -240 : 240,
            behavior: "smooth",
          });
        }
      }
      if (action === "select") {
        const focused = document.querySelector(".spatial-remote-focused");
        const active = document.activeElement;
        if (focused?.click) focused.click();
        else if (active && active !== document.body && active.click) active.click();
        else {
          window.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: "Enter",
              bubbles: true,
            }),
          );
        }
      }
      if (action === "back") await baseNavigateBack();
      if (action === "home") await baseNavigate("home");
      if (action === "menu") {
        window.dispatchEvent(new CustomEvent("orion:toggle-sidebar"));
      }
      if (action === "send_text") {
        setShowSearch(true);
        if (value) baseNavigate("search", value);
      }

      const mediaCommands = {
        toggle_play: "toggle",
        play_pause: "toggle",
        play: "play",
        pause: "pause",
        "seek_-10": "seekBackward",
        "seek_+10": "seekForward",
        previous: "previous",
        next: "next",
        toggle_mute: "toggleMute",
        volume_up: "volumeUp",
        volume_down: "volumeDown",
        toggle_subtitles: "toggleSubtitles",
      };
      if (mediaCommands[action]) {
        commandResult = await handleSystemMediaCommand(mediaCommands[action], expected, execution);
      }
      if (action === "set_speed") {
        commandResult = await handleSystemMediaCommand(`speed:${Number(value)}`, expected, execution);
      }
      if (action === "toggle_fullscreen") {
        commandResult = (await window.electron?.toggleFullscreen?.()) || {
          ok: false,
          error: "Desktop fullscreen control is unavailable.",
        };
      }
      if (action === "toggle_pip") createMiniHandoff();

      } catch {
        commandResult = { ok: false, error: "Desktop could not apply this command." };
      } finally {
        if (payload?.id) pendingPlaybackRef.current.delete(payload.id);
      }
      const isRealtimeCommand = action === "cursor_move" || action === "scroll";
if (!isRealtimeCommand && payload?.id && window.electron?.acknowledgeSmartConnectCommand) {
        window.electron
          .acknowledgeSmartConnectCommand({
            id: payload.id,
            sequence: payload.sequence || 0,
            controllerRevision: Number.isFinite(Number(payload?.controllerRevision)) ? Number(payload.controllerRevision) : undefined,
            ok: commandResult?.ok !== false,
            error: commandResult?.error,
            commandResult: commandResult?.commandResult,
            pointer:
              action === "cursor_move"
                ? {
                    x: Math.max(
                      0,
                      Math.min(
                        1,
                        Number(
                          payload?.pointer?.x ??
                            payload?.value?.x ??
                            payload?.value?.xRatio,
                        ) || 0,
                      ),
                    ),
                    y: Math.max(
                      0,
                      Math.min(
                        1,
                        Number(
                          payload?.pointer?.y ??
                            payload?.value?.y ??
                            payload?.value?.yRatio,
                        ) || 0,
                      ),
                    ),
                  }
                : undefined,
          })
          .catch(() => {});
      }
    };

    const unsubscribe = window.electron?.onRemoteCommand?.(handleRemoteCommand);
    const handleSmartConnectStatus = (status) => {
      const devices = Array.isArray(status?.devices) ? status.devices : [];
      const connected = Boolean(
        status?.connected || devices.some((device) => device?.connected),
      );
      if (!connected) clearRemoteCursor();
    };
    const unsubscribeStatus = window.electron?.onSmartConnectStatus?.(
      handleSmartConnectStatus,
    );
    const initialStatus = window.electron?.getSmartConnectInfo?.();
    initialStatus
      ?.then(handleSmartConnectStatus)
      .catch(() => clearRemoteCursor());
    let channel;
    try {
      if (typeof window.BroadcastChannel !== "undefined") {
        channel = new window.BroadcastChannel("orion_smart_connect");
        channel.onmessage = (event) => {
          if (event.data?.type === "REMOTE_COMMAND") {
            handleRemoteCommand(event.data);
          }
        };
      }
    } catch {
      // BroadcastChannel is an optional browser fallback.
    }
    const handleCustomRemote = (event) => handleRemoteCommand(event.detail);
    window.addEventListener("orion:remote-command-custom", handleCustomRemote);
    return () => {
      if (rafHandle) cancelAnimationFrame(rafHandle);
      if (rendererDiagnosticsTimer) window.clearInterval(rendererDiagnosticsTimer);
unsubscribe?.();
      unsubscribeStatus?.();
      clearRemoteCursor();
      try {
        channel?.close();
      } catch {
        // The channel may already be closed during renderer teardown.
      }
      window.removeEventListener(
        "orion:remote-command-custom",
        handleCustomRemote,
      );
    };
  }, [
    baseNavigate,
    baseNavigateBack,
    createMiniHandoff,
    handleSystemMediaCommand,
    pageRef,
    setShowSearch,
  ]);
}
