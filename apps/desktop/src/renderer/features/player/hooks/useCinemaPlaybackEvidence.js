import { useCallback, useEffect, useRef } from "react";
import { markHistoryPlaybackVerified } from "../../../services/viewingStateVerification";
import { updateCinemaSourceHealth } from "../sources/registry";
import {
  normalizePlayerEventProgress,
  observePlaybackEvidence,
} from "../services/playerEventProgress";

/**
 * Shared runtime evidence boundary for Movie and TV provider webviews.
 * A loaded page is never considered healthy until playback time advances.
 */
export function useCinemaPlaybackEvidence({
  playing,
  sourceId,
  mediaType,
  resetKey,
  viewingKey = null,
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
  const viewingKeyRef = useRef(viewingKey);
  viewingKeyRef.current = viewingKey;

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

  const observePlaybackProgress = useCallback((progress) => {
    if (!progress || progress.duration <= 0) return healthEvidenceRef.current.ready === true;
    const transition = observePlaybackEvidence(healthEvidenceRef.current, progress);
    if (transition.becameReady) {
      const verifiedAt = Date.now();
      reportSourceHealth("ready");
      if (viewingKeyRef.current) markHistoryPlaybackVerified(viewingKeyRef.current, verifiedAt);
    }
    return transition.ready;
  }, [reportSourceHealth]);

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
      observePlaybackProgress(progress);
      if (!progress.paused && !progress.buffering) {
        lastKnownTimeRef.current = progress.currentTime;
        setWebviewLoading(false);
        setShowFailoverPrompt(false);
      }
    };
    webview.addEventListener("ipc-message", handlePlayerEvent);
    return () => webview.removeEventListener("ipc-message", handlePlayerEvent);
  }, [playing, sourceId, durationRef, lastKnownTimeRef, observePlaybackProgress, setWebviewLoading, setShowFailoverPrompt, webviewRef]);

  return {
    healthEvidenceRef,
    playerEventProgressRef,
    attemptedSourcesRef,
    observePlaybackProgress,
    reportSourceHealth,
  };
}
