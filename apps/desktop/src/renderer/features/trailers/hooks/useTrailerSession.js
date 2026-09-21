import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyVimeoError, classifyYouTubeError } from "../trailerProviders";

const MAX_SAME_CANDIDATE_RETRIES = 1;

export function useTrailerSession(visible, candidates) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [state, setState] = useState("idle");
  const [attempt, setAttempt] = useState(0);
  const [transport, setTransport] = useState("wrapper");
  const [error, setError] = useState(null);
  const retriesRef = useRef({});
  const attemptedRef = useRef(new Set());
  const rotationTimerRef = useRef(null);
  const candidateKey = candidates.map((candidate) => candidate.id).join("|");

  const activeCandidate = candidates[activeIndex] || null;
  const exhausted = candidates.length > 0 && attemptedRef.current.size >= candidates.length;

  useEffect(() => {
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    rotationTimerRef.current = null;
    if (!visible) {
      setState("idle");
      return undefined;
    }
    setActiveIndex(0);
    setAttempt(0);
    setTransport("wrapper");
    setError(null);
    setState(candidates.length ? "preparing" : "exhausted");
    retriesRef.current = {};
    attemptedRef.current = new Set();
    return () => {
      if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    };
  }, [visible, candidateKey]);

  const select = useCallback((index) => {
    if (index < 0 || index >= candidates.length) return;
    setActiveIndex(index);
    setTransport("wrapper");
    setError(null);
    setState("preparing");
    setAttempt((value) => value + 1);
  }, [candidates.length]);

  const next = useCallback(() => {
    if (!candidates.length) {
      setState("exhausted");
      return;
    }
    const afterCurrent = candidates.findIndex(
      (item, index) => index > activeIndex && !attemptedRef.current.has(item.id),
    );
    const wrapped = afterCurrent >= 0
      ? afterCurrent
      : candidates.findIndex((item) => !attemptedRef.current.has(item.id));
    if (wrapped < 0) {
      setState("exhausted");
      return;
    }
    setState("rotating");
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    rotationTimerRef.current = setTimeout(() => {
      rotationTimerRef.current = null;
      select(wrapped);
    }, 120);
  }, [activeIndex, candidates, select]);

  const fail = useCallback((providerError) => {
    if (!activeCandidate) return;
    setError(providerError);
    const retries = retriesRef.current[activeCandidate.id] || 0;
    if (providerError.retryable && retries < MAX_SAME_CANDIDATE_RETRIES) {
      retriesRef.current[activeCandidate.id] = retries + 1;
      setTransport("direct");
      setState("preparing");
      setAttempt((value) => value + 1);
      return;
    }

    attemptedRef.current.add(activeCandidate.id);
    const stateByCategory = {
      removed: "removed",
      private: "private",
      "embed-disabled": "embed-disabled",
      "client-identity": "client-identity-error",
      network: "network-error",
    };
    setState(stateByCategory[providerError.category] || "playback-error");
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    rotationTimerRef.current = setTimeout(() => {
      rotationTimerRef.current = null;
      next();
    }, 700);
  }, [activeCandidate, next]);

  const handleMessage = useCallback((raw) => {
    if (!activeCandidate) return;
    try {
      const message = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
      if (!message || message.candidateId !== activeCandidate.id) return;
      if (message.type === "ready" || message.type === "direct-loaded") setState("ready");
      else if (message.type === "playing") {
        setError(null);
        setState("playing");
      } else if (message.type === "paused") setState("paused");
      else if (message.type === "buffering" || message.type === "autoplay-blocked") setState("ready");
      else if (message.type === "network-error") {
        fail({ provider: activeCandidate.site, category: "network", publicCode: null, retryable: true });
      } else if (message.type === "timeout") {
        fail({ provider: activeCandidate.site, category: "timeout", publicCode: null, retryable: true });
      } else if (message.type === "provider-error") {
        const code = message.detail?.code ?? null;
        fail(activeCandidate.site === "YouTube"
          ? classifyYouTubeError(code)
          : classifyVimeoError(code));
      }
    } catch {
      // Ignore provider console chatter and malformed guest messages.
    }
  }, [activeCandidate, fail]);

  const retry = useCallback(() => {
    if (!activeCandidate) return;
    attemptedRef.current.delete(activeCandidate.id);
    retriesRef.current[activeCandidate.id] = 0;
    setTransport("wrapper");
    setError(null);
    setState("preparing");
    setAttempt((value) => value + 1);
  }, [activeCandidate]);

  return useMemo(() => ({
    activeCandidate,
    activeIndex,
    state,
    attempt,
    transport,
    error,
    exhausted,
    select,
    next,
    retry,
    handleMessage,
  }), [activeCandidate, activeIndex, attempt, error, exhausted, handleMessage, next, retry, select, state, transport]);
}
