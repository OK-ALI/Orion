import { useEffect } from "react";

export function useDownloadCandidatePreflight({
  active, target, playing, captureSessionId, candidateContext,
  preflightRef, recoveryRef, onFailure, setActive, setPlaying, setShowDownload,
}) {
  useEffect(() => {
    if (!active || !target || !playing || !captureSessionId) return undefined;
    if (candidateContext?.sessionId && candidateContext.sessionId !== captureSessionId) return undefined;
    const candidateId = candidateContext?.candidateId || candidateContext?.id;
    if (!candidateId || preflightRef.current.has(candidateId)) return undefined;
    preflightRef.current.add(candidateId);

    let disposed = false;
    Promise.resolve(window.electron?.preflightStream?.(candidateId))
      .then((result) => {
        if (disposed) return;
        if (!result?.ok) return onFailure(captureSessionId, result);
        if (recoveryRef.current.handledSession === captureSessionId) return;
        recoveryRef.current.handledSession = captureSessionId;
        setActive(false);
        setPlaying(false);
        setShowDownload(true);
      })
      .catch(() => {
        if (!disposed) onFailure(captureSessionId, {
          code: "network", error: "Orion could not verify this source. Try another source.",
        });
      });
    return () => { disposed = true; };
  }, [active, target, playing, captureSessionId, candidateContext, preflightRef,
    recoveryRef, onFailure, setActive, setPlaying, setShowDownload]);
}
