import { useCallback, useEffect, useRef } from "react";
import { updateCinemaSourceHealth } from "../sources/registry";
import { isAdvancingPlayback, normalizePlayerEventProgress } from "../services/playerEventProgress";

/**
 * Shared runtime evidence boundary for Movie and TV provider webviews.
 * A loaded page is never considered healthy until playback time advances.
 */
export function useCinemaPlaybackEvidence({
  playing,
  sourceId,
  mediaType,
  resetKey,
  webviewRef,
  durationRef = null,
  lastKnownTimeRef,
  setWebviewLoading,
  setShowFailoverPrompt,
}) {
  const healthStartedAtRef = useRef(Date.now());
  const healthEvidenceRef = useRef({ lastTime: null, advances: 0, ready: false });
  const playerEventProgressRef = useRef(null);
  const attemptedSourcesRef = useRef([]);

  const reportSourceHealth = useCallback((state, reasonCode = null, message = "") => {
    window.electron?.recordCinemaSourceHealth?.({
      sourceId,
      mediaType,
      state,
      reasonCode,
      message,
      startupMs: state === "ready" ? Date.now() - healthStartedAtRef.current : undefined,
    }).catch(() => {});
  }, [sourceId, mediaType]);

  useEffect(() => {
    healthStartedAtRef.current = Date.now();
    healthEvidenceRef.current = { lastTime: null, advances: 0, ready: false };
    playerEventProgressRef.current = null;
    if (playing) reportSourceHealth("checking");
  }, [playing, sourceId, resetKey, reportSourceHealth]);

  useEffect(() => { attemptedSourcesRef.current = []; }, [resetKey]);

  useEffect(() => {
    if (!playing) return undefined;
    let cancelled = false;
    window.electron?.listCinemaSourceHealth?.(mediaType).then((records) => {
      if (!cancelled) updateCinemaSourceHealth(records);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [playing, sourceId, mediaType]);

  useEffect(() => {
    if (!playing) return undefined;
    const webview = webviewRef.current;
    if (!webview) return undefined;
    const handlePlayerEvent = (event) => {
      if (event?.channel !== "orion-player-event") return;
      const progress = normalizePlayerEventProgress(event.args?.[0]);
      if (!progress) return;
      playerEventProgressRef.current = progress;
      if (progress.duration <= 0) return;
      if (durationRef) durationRef.current = progress.duration;
      const evidence = healthEvidenceRef.current;
      if (isAdvancingPlayback(evidence.lastTime, progress)) evidence.advances += 1;
      else if (!progress.paused && !progress.buffering && evidence.lastTime != null) evidence.advances = 0;
      evidence.lastTime = progress.currentTime;
      if (evidence.advances >= 2 && !evidence.ready) {
        evidence.ready = true;
        reportSourceHealth("ready");
      }
      if (!progress.paused && !progress.buffering) {
        lastKnownTimeRef.current = progress.currentTime;
        setWebviewLoading(false);
        setShowFailoverPrompt(false);
      }
    };
    webview.addEventListener("ipc-message", handlePlayerEvent);
    return () => webview.removeEventListener("ipc-message", handlePlayerEvent);
  }, [playing, sourceId, reportSourceHealth, durationRef, lastKnownTimeRef, setWebviewLoading, setShowFailoverPrompt, webviewRef]);

  return { healthEvidenceRef, playerEventProgressRef, attemptedSourcesRef, reportSourceHealth };
}
