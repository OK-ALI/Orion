import { useEffect } from "react";

const REMOTE_CURSOR_INACTIVITY_MS = 4_000;
let remoteCursorInactivityTimer = null;

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

function clearRemoteCursor() {
  if (remoteCursorInactivityTimer) {
    window.clearTimeout(remoteCursorInactivityTimer);
    remoteCursorInactivityTimer = null;
  }
  document.querySelector(".orion-virtual-cursor")?.remove();
  document
    .querySelectorAll(".spatial-remote-focused")
    .forEach((node) => node.classList.remove("spatial-remote-focused"));
}

function scheduleRemoteCursorCleanup() {
  if (remoteCursorInactivityTimer) {
    window.clearTimeout(remoteCursorInactivityTimer);
  }
  remoteCursorInactivityTimer = window.setTimeout(() => {
    clearRemoteCursor();
  }, REMOTE_CURSOR_INACTIVITY_MS);
}

function moveCursor(payload) {
  let cursor = document.querySelector(".orion-virtual-cursor");
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.className = "orion-virtual-cursor";
    document.body.appendChild(cursor);
  }
  const pointer = payload?.pointer || payload?.value || payload || {};
  const x = Math.max(0, Math.min(1, Number(pointer.x ?? pointer.xRatio) || 0));
  const y = Math.max(0, Math.min(1, Number(pointer.y ?? pointer.yRatio) || 0));
  const clientX = x * window.innerWidth;
  const clientY = y * window.innerHeight;
  cursor.style.left = `${clientX}px`;
  cursor.style.top = `${clientY}px`;
  cursor.style.display = "block";

  const element = document.elementFromPoint(clientX, clientY);
  const interactive = element?.closest(
    ".media-card, button, a, [role='button'], [tabindex='0']",
  );
  document
    .querySelectorAll(".spatial-remote-focused")
    .forEach((node) => node.classList.remove("spatial-remote-focused"));
  interactive?.classList.add("spatial-remote-focused");
  scheduleRemoteCursorCleanup();
}

function clickCursor() {
  const cursor = document.querySelector(".orion-virtual-cursor");
  if (!cursor) return;
  scheduleRemoteCursorCleanup();
  const rect = cursor.getBoundingClientRect();
  const element = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
  const clickable =
    element?.closest(".media-card, button, a, [role='button'], input") ||
    element;
  clickable?.click?.();
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
  useEffect(() => {
    const handleRemoteCommand = async (payload) => {
      const { action, value } = payload || {};
      const targetScroll = getScrollContainer();
      let commandResult = { ok: true };

      if (action === "cursor_move") moveCursor(payload);
      if (action === "cursor_click") clickCursor();
      if (action === "navigate_page" && value) baseNavigate(value);
      if (action === "sidebar_next" || action === "sidebar_prev") {
        const current = SIDEBAR_PAGES.indexOf(pageRef.current || "home");
        const offset = action === "sidebar_next" ? 1 : -1;
        const next = (current + offset + SIDEBAR_PAGES.length) % SIDEBAR_PAGES.length;
        baseNavigate(SIDEBAR_PAGES[next]);
      }
      if (action === "focus_card_next" || action === "focus_card_prev") {
        moveSpatialFocus(action);
      }
      if (action === "seek_to") {
        const seconds = Number(value);
        commandResult = Number.isFinite(seconds)
          ? await handleSystemMediaCommand(`seek:${seconds}`)
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
        const top = action === "up" ? -280 : 280;
        if (typeof targetScroll.scrollBy === "function") {
          targetScroll.scrollBy({ top, behavior: "smooth" });
        } else {
          window.scrollBy({ top, behavior: "smooth" });
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
      if (action === "back") baseNavigateBack();
      if (action === "home") baseNavigate("home");
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
        commandResult = await handleSystemMediaCommand(mediaCommands[action]);
      }
      if (action === "set_speed") {
        commandResult = await handleSystemMediaCommand(`speed:${Number(value)}`);
      }
      if (action === "toggle_fullscreen") {
        commandResult = (await window.electron?.toggleFullscreen?.()) || {
          ok: false,
          error: "Desktop fullscreen control is unavailable.",
        };
      }
      if (action === "toggle_pip") createMiniHandoff();

      if (payload?.id && window.electron?.acknowledgeSmartConnectCommand) {
        window.electron
          .acknowledgeSmartConnectCommand({
            id: payload.id,
            sequence: payload.sequence || 0,
            ok: commandResult?.ok !== false,
            error: commandResult?.error,
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
