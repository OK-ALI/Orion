import { useCallback } from "react";
import { advanceDownloadSourceRecovery, resolveDownloadRecoveryConsent } from "../services/downloadSourceRecovery";

export function useDownloadSourceRecovery({
  mediaType, sourceId, captureSessionId, active, recoveryRef, consent, setConsent,
  fail, setCandidateContext, setCandidateUrl, setVerifiedCandidateId,
  setCaptureSessionId, setCaptureNonce, setTarget, setPlayerSource,
}) {
  const continueRecovery = useCallback((sessionId, result) => {
    const recovery = recoveryRef.current;
    const next = advanceDownloadSourceRecovery(mediaType, sourceId, result, recovery);
    if (next.action === "fail") return fail(next.error);
    if (next.action === "consent") {
      setConsent({ ...next, sessionId, result });
      return;
    }
    setCandidateContext(null);
    setCandidateUrl(null);
    setVerifiedCandidateId("");
    recovery.lastFailure = null;
    if (next.action === "refresh") {
      setCaptureSessionId(null);
      setCaptureNonce((value) => value + 1);
      return;
    }
    setTarget((current) => current && {
      ...current,
      sourceId: next.sourceId,
      key: current.mediaType === "movie"
        ? `movie:${current.mediaId}:${next.sourceId}`
        : `tv:${current.mediaId}:${current.season}:${current.episode}:${next.sourceId}`,
    });
    setPlayerSource(next.sourceId);
  }, [mediaType, sourceId, recoveryRef, fail, setConsent, setCandidateContext,
    setCandidateUrl, setVerifiedCandidateId, setCaptureSessionId, setCaptureNonce,
    setTarget, setPlayerSource]);

  const recover = useCallback((sessionId, result) => {
    if (!sessionId || sessionId !== captureSessionId || !active) return;
    const recovery = recoveryRef.current;
    if (recovery.handledSession === sessionId) return;
    recovery.handledSession = sessionId;
    continueRecovery(sessionId, result);
  }, [captureSessionId, active, recoveryRef, continueRecovery]);

  const answerConsent = useCallback((approved) => {
    const pending = consent;
    setConsent(null);
    if (!pending || !active || pending.sessionId !== captureSessionId) return;
    resolveDownloadRecoveryConsent(recoveryRef.current, pending.kind, approved);
    continueRecovery(pending.sessionId, pending.result);
  }, [consent, setConsent, active, captureSessionId, recoveryRef, continueRecovery]);

  return { recover, answerConsent };
}
