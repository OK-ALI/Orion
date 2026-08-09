import { useEffect, useRef } from "react";

function focusedRole() {
  const element = document.activeElement;
  if (!element || element === document.body) return "none";
  const type = String(element.getAttribute?.("type") || "").toLowerCase();
  if (type === "password") return "protected-input";
  if (element.matches?.("input[type='search'], [role='searchbox']")) return "search";
  if (element.matches?.("input, textarea, [contenteditable='true']")) return "text-input";
  if (element.matches?.("button, [role='button']")) return "button";
  if (element.matches?.("a, [role='link']")) return "link";
  return "none";
}

function surfaceFor(page, session) {
  if (String(page).startsWith("music-")) return "music";
  if (session?.mode === "mini") return "mini-player";
  if (session?.mode === "popout") return "popout";
  if (session?.local) return "local-player";
  if (session) return "embedded-player";
  return "browse";
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Publishes redacted UI context and observable playback truth only while a remote is live. */
export function useSmartConnectTelemetry({ page, playbackSession }) {
  const sequenceRef = useRef(0);
  const connectedRef = useRef(false);
  const sessionRef = useRef(playbackSession);
  const pageRef = useRef(page);
  sessionRef.current = playbackSession;
  pageRef.current = page;

  useEffect(() => {
    if (!window.electron?.onSmartConnectStatus) return undefined;
    const apply = (status) => { connectedRef.current = Boolean(status?.connected); };
    window.electron.getSmartConnectInfo?.().then(apply).catch(() => {});
    return window.electron.onSmartConnectStatus(apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    const publish = async () => {
      if (cancelled || running || !connectedRef.current || !window.electron?.updateSmartConnectTelemetry) return;
      running = true;
      try {
        const session = sessionRef.current;
        const role = focusedRole();
        const state = session?.webContentsId
          ? await window.electron.queryVideoProgress?.(session.webContentsId).catch(() => null)
          : session?.playbackState || null;
        if (cancelled) return;
        const currentTime = finite(state?.currentTime);
        const duration = finite(state?.duration);
        const observable = currentTime != null && duration != null && duration > 0;
        const owner = String(pageRef.current).startsWith("music-") ? "music" : session?.local ? "local-video" : session ? "cinema" : "none";
        const context = {
          version: 1, route: String(pageRef.current || "home"), surface: surfaceFor(pageRef.current, session),
          focusedRole: role, canType: role === "text-input" || role === "search", playbackOwner: owner,
          fullscreen: Boolean(document.fullscreenElement || session?.fullscreen), miniPlayer: session?.mode === "mini", popout: session?.mode === "popout",
          capabilities: {
            canPlayPause: Boolean(session), canSeek: observable, canSetVolume: Boolean(session), canSetSpeed: Boolean(session),
            canToggleSubtitles: Boolean(session), canToggleFullscreen: Boolean(session), canTogglePip: Boolean(session), canNavigate: true,
          }, observedAt: Date.now(),
        };
        const telemetry = session ? {
          version: 1, sessionId: String(session.id || session.mediaId || session.item?.id || "active"), sequence: ++sequenceRef.current,
          title: session.title || session.item?.name || session.item?.title || "Now Playing", mediaId: session.mediaId || session.item?.id || null,
          playbackKind: session.local ? "local-video" : "cinema", currentTime, duration, bufferedTime: finite(state?.bufferedTime),
          state: observable ? (state?.buffering ? "buffering" : state?.paused ? "paused" : "playing") : "unobservable",
          volume: Number.isFinite(Number(state?.volume)) ? Number(state.volume) : 1, muted: Boolean(state?.muted), speed: Number(state?.playbackRate) || 1,
          canSeek: observable, evidence: observable ? "desktop-player-event" : "unobservable", observedAt: Date.now(),
        } : null;
        await window.electron.updateSmartConnectTelemetry({ context, telemetry });
      } finally { running = false; }
    };
    publish();
    const timer = window.setInterval(publish, 500);
    document.addEventListener("focusin", publish);
    document.addEventListener("fullscreenchange", publish);
    return () => {
      cancelled = true; window.clearInterval(timer);
      document.removeEventListener("focusin", publish);
      document.removeEventListener("fullscreenchange", publish);
    };
  }, []);
}
