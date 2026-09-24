import { useEffect } from "react";

export function useDownloadCandidatePreflight({
  active, target, playing, captureSessionId,
  preflightRef, recoveryRef, onVerified, setActive, setPlaying, setShowDownload,
}) {
  useEffect(() => {
    if (!active || !target || !playing || !captureSessionId) return undefined;
    let disposed = false;
    let inFlight = false;
    const scan = async () => {
      if (inFlight || recoveryRef.current.handledSession === captureSessionId) return;
      inFlight = true;
      try {
        const streams = await window.electron?.listStreamCandidates?.({ sessionId: captureSessionId });
        if (disposed || !Array.isArray(streams)) return;
        for (const candidate of streams) {
          if (disposed || recoveryRef.current.handledSession === captureSessionId) return;
          if (!candidate?.id || candidate.sessionId !== captureSessionId
            || candidate.sourceId !== target.sourceId || preflightRef.current.has(candidate.id)) continue;
          preflightRef.current.add(candidate.id);
          let result;
          try {
            result = await window.electron?.preflightStream?.(candidate.id);
          } catch {
            result = { ok: false, code: "network", error: "Orion could not verify this source. Try another source." };
          }
          if (disposed) return;
          if (result?.ok && result?.verified === true) {
            recoveryRef.current.handledSession = captureSessionId;
            onVerified(candidate.id);
            setActive(false);
            setPlaying(false);
            setShowDownload(true);
            return;
          }
          recoveryRef.current.lastFailure = result || {
            ok: false, code: "network", error: "Orion could not verify this source. Try another source.",
          };
        }
      } finally {
        inFlight = false;
      }
    };
    scan();
    const timer = window.setInterval(scan, 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [active, target, playing, captureSessionId, preflightRef,
    recoveryRef, onVerified, setActive, setPlaying, setShowDownload]);
}
