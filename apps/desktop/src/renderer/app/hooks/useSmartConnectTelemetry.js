import { useEffect, useRef } from "react";
import { getRegisteredSource } from "@orion/shared/sources";
import { playbackTargetKey, readRemotePlaybackState } from "../../features/player/services/remotePlaybackSession";
import { settlePlaybackStateWithin } from "../../features/player/services/playbackSession";
import { getPlaybackOwner, subscribePlaybackOwner } from "../playback/PlaybackCoordinator";
import { getRemoteMusicSession } from "../../features/music/services/remoteMusicSession";

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
  if (session?.kind === "music") return "music";
  if (session?.mode === "mini") return "mini-player";
  if (session?.mode === "popout") return "popout";
  if (session?.local) return "local-player";
  if (session) return "embedded-player";
  return "browse";
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sourceIdentity(session) {
  const sourceId = session?.sourceId || session?.playerSource || null;
  const descriptor = sourceId ? getRegisteredSource(sourceId) : null;
  return {
    sourceId,
    sourceLabel: descriptor?.label || session?.sourceLabel || (session?.local ? "Local media" : "Orion Player"),
  };
}

function controlTruth(session, observable, surface, preparing, state) {
  const identity = sourceIdentity(session);
  const hasDirectBoundary = Boolean(session?.webContentsId || session?.controlPlayback);
  const hasMediaSession = surface === "music";
  const ready = state?.controlReady ?? (Number(state?.readyState) >= 2);
  const strategy = hasMediaSession ? "media-session" : hasDirectBoundary ? "direct-video" : "unavailable";
  const readiness = !session ? "unavailable" : hasDirectBoundary
    ? (ready ? "ready" : preparing ? "loading" : "unobservable")
    : hasMediaSession ? "limited" : "unavailable";
  // Cross-origin/unobservable players remain playable through their own UI, but
  // are never advertised as remotely controllable until an actual video is found.
  const canControl = readiness === "ready";
  const capabilities = {
    canPlayPause: canControl,
    canPlay: canControl,
    canPause: canControl,
    canSkipPrevious: Boolean(session?.previousAction),
    canSkipNext: Boolean(session?.nextAction),
    canSeek: canControl && observable,
    canSetVolume: canControl,
    canSetSpeed: canControl && observable,
    canToggleSubtitles: Boolean(session?.webContentsId),
    canToggleFullscreen: Boolean(session) && !hasMediaSession,
    canTogglePip: Boolean(session) && !hasMediaSession,
    canNavigate: true,
  };
  return {
    ...identity,
    strategy,
    readiness,
    capabilities,
    target: session ? {
      version: 1,
      ownerRevision: session.remoteRevision,
      sessionId: String(session.id || session.mediaId || session.item?.id || "active"),
      ...identity,
      surface,
      strategy,
      readiness,
      capabilities,
      observedAt: Date.now(),
    } : undefined,
  };
}

/** Publishes redacted UI context and observable playback truth only while a remote is live. */
export function useSmartConnectTelemetry({ page, playbackSession }) {
  const sequenceRef = useRef(0);
  const connectedRef = useRef(false);
  const sessionRef = useRef(playbackSession);
  const pageRef = useRef(page);
  const targetSeenRef = useRef({ key: "", at: 0 });
  const publishRef = useRef(() => {});
  sessionRef.current = playbackSession;
  pageRef.current = page;

  useEffect(() => {
    if (!window.electron?.onSmartConnectStatus) return undefined;
    const apply = (status) => { connectedRef.current = Boolean(status?.connected); publishRef.current(); };
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
        const playbackOwner = getPlaybackOwner();
        const session = playbackOwner === "music" ? getRemoteMusicSession() : sessionRef.current;
        const queriedKey = playbackTargetKey(session);
        const state = await settlePlaybackStateWithin(readRemotePlaybackState(session, window.electron), 350);
        if (cancelled || !connectedRef.current || playbackOwner !== getPlaybackOwner()
          || queriedKey !== playbackTargetKey(getPlaybackOwner() === "music" ? getRemoteMusicSession() : sessionRef.current)) return;
        const role = focusedRole();
        const currentTime = finite(state?.currentTime);
        const duration = finite(state?.duration);
        const observable = currentTime != null && duration != null && duration > 0;
        const owner = !session ? "none" : playbackOwner === "music" ? "music" : session.local ? "local-video" : "cinema";
        const surface = surfaceFor(pageRef.current, session);
        const targetKey = queriedKey;
        if (targetSeenRef.current.key !== targetKey) targetSeenRef.current = { key: targetKey, at: Date.now() };
        const preparing = Boolean(session) && Date.now() - targetSeenRef.current.at < 5_000;
        const control = controlTruth(session, observable, surface, preparing, state);
        const context = {
          version: 1, playbackProtocolVersion: 1, route: String(pageRef.current || "home"), surface,
          focusedRole: role,
          canType: Boolean(
            role === "text-input" ||
            role === "search" ||
            ["search", "constellation", "settings"].includes(pageRef.current) ||
            String(pageRef.current || "").startsWith("music") ||
            (typeof document !== "undefined" && Boolean(document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.isContentEditable)))
          ),
          playbackOwner: owner,
          fullscreen: Boolean(document.fullscreenElement || session?.fullscreen), miniPlayer: session?.mode === "mini", popout: session?.mode === "popout",
          capabilities: control.capabilities, controlTarget: control.target, observedAt: Date.now(),
        };
        const telemetry = session ? {
          version: 1, sessionId: String(session.id || session.mediaId || session.item?.id || "active"), sequence: ++sequenceRef.current,
          title: session.title || session.item?.name || session.item?.title || "Now Playing", mediaId: session.mediaId || session.item?.id || null,
          playbackKind: session.kind === "music" ? "music" : session.local ? "local-video" : "cinema", sourceId: control.sourceId, sourceLabel: control.sourceLabel,
          surface, controlState: control.readiness, controlStrategy: control.strategy,
          currentTime, duration, bufferedTime: finite(state?.bufferedTime),
          state: observable ? (state?.buffering ? "buffering" : state?.paused ? "paused" : "playing") : "unobservable",
          volume: Number.isFinite(Number(state?.volume)) ? Number(state.volume) : 1, muted: Boolean(state?.muted), speed: Number(state?.playbackRate) || 1,
          canSeek: observable, evidence: observable ? "desktop-player-event" : "unobservable", observedAt: Date.now(),
        } : null;
        await window.electron.updateSmartConnectTelemetry({ context, telemetry });
      } finally { running = false; }
    };
    publishRef.current = publish;
    const unsubscribeOwner = subscribePlaybackOwner(publish);
    publish();
    const timer = window.setInterval(publish, 500);
    document.addEventListener("focusin", publish);
    document.addEventListener("fullscreenchange", publish);
    return () => {
      cancelled = true; window.clearInterval(timer);
      publishRef.current = () => {};
      unsubscribeOwner();
      document.removeEventListener("focusin", publish);
      document.removeEventListener("fullscreenchange", publish);
    };
  }, []);

  useEffect(() => { publishRef.current(); }, [page, playbackSession]);
}
