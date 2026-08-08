import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  TrailerCandidateV1,
  TrailerPlaybackState,
  TrailerProviderError,
} from '@orion/shared/types';
import { classifyVimeoError, classifyYouTubeError } from '../trailerProviders';

const MAX_SAME_CANDIDATE_RETRIES = 1;

export function useTrailerSession(visible: boolean, candidates: TrailerCandidateV1[]) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [state, setState] = useState<TrailerPlaybackState>('idle');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<TrailerProviderError | null>(null);
  const retriesRef = useRef<Record<string, number>>({});
  const attemptedRef = useRef<Set<string>>(new Set());
  const rotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candidateKey = candidates.map((candidate) => candidate.id).join('|');

  const activeCandidate = candidates[activeIndex] || null;
  const exhausted = candidates.length > 0 && attemptedRef.current.size >= candidates.length;

  useEffect(() => {
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
    if (!visible) {
      setState('idle');
      return;
    }
    setActiveIndex(0);
    setAttempt(0);
    setError(null);
    setState(candidates.length ? 'preparing' : 'exhausted');
    retriesRef.current = {};
    attemptedRef.current = new Set();
    return () => {
      if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    };
  }, [visible, candidateKey]);

  const select = useCallback((index: number) => {
    if (index < 0 || index >= candidates.length) return;
    setActiveIndex(index);
    setError(null);
    setState('preparing');
    setAttempt((value) => value + 1);
  }, [candidates.length]);

  const next = useCallback(() => {
    if (!candidates.length) return setState('exhausted');
    const nextIndex = candidates.findIndex((item, index) => index > activeIndex && !attemptedRef.current.has(item.id));
    const wrappedIndex = nextIndex >= 0 ? nextIndex : candidates.findIndex((item) => !attemptedRef.current.has(item.id));
    if (wrappedIndex < 0) return setState('exhausted');
    setState('rotating');
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    rotationTimerRef.current = setTimeout(() => {
      rotationTimerRef.current = null;
      select(wrappedIndex);
    }, 120);
  }, [activeIndex, candidates, select]);

  const fail = useCallback((providerError: TrailerProviderError) => {
    if (!activeCandidate) return;
    setError(providerError);
    const retries = retriesRef.current[activeCandidate.id] || 0;
    if (providerError.retryable && retries < MAX_SAME_CANDIDATE_RETRIES) {
      retriesRef.current[activeCandidate.id] = retries + 1;
      setState('preparing');
      setAttempt((value) => value + 1);
      return;
    }
    attemptedRef.current.add(activeCandidate.id);
    const stateByCategory: Partial<Record<TrailerProviderError['category'], TrailerPlaybackState>> = {
      removed: 'removed', private: 'private', 'embed-disabled': 'embed-disabled',
      'client-identity': 'client-identity-error', network: 'network-error',
    };
    setState(stateByCategory[providerError.category] || 'playback-error');
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    rotationTimerRef.current = setTimeout(() => {
      rotationTimerRef.current = null;
      next();
    }, 700);
  }, [activeCandidate, next]);

  const handleMessage = useCallback((raw: string) => {
    if (!activeCandidate) return;
    try {
      const message = JSON.parse(raw || '{}');
      if (message.candidateId !== activeCandidate.id) return;
      if (message.type === 'ready') setState('ready');
      else if (message.type === 'playing') { setState('playing'); setError(null); }
      else if (message.type === 'paused') setState('paused');
      else if (message.type === 'buffering' || message.type === 'autoplay-blocked') setState('ready');
      else if (message.type === 'network-error') fail({ provider: activeCandidate.site, category: 'network', publicCode: null, retryable: true });
      else if (message.type === 'timeout') fail({ provider: activeCandidate.site, category: 'timeout', publicCode: null, retryable: false });
      else if (message.type === 'provider-error') {
        const code = message.detail?.code ?? null;
        fail(activeCandidate.site === 'YouTube' ? classifyYouTubeError(code) : classifyVimeoError(code));
      }
    } catch {
      // Ignore provider console chatter that is not an Orion bridge message.
    }
  }, [activeCandidate, fail]);

  const retry = useCallback(() => {
    if (!activeCandidate) return;
    attemptedRef.current.delete(activeCandidate.id);
    retriesRef.current[activeCandidate.id] = 0;
    setError(null);
    setState('preparing');
    setAttempt((value) => value + 1);
  }, [activeCandidate]);

  return useMemo(() => ({
    activeCandidate, activeIndex, state, attempt, error, exhausted,
    select, next, retry, handleMessage,
  }), [activeCandidate, activeIndex, attempt, error, exhausted, handleMessage, next, retry, select, state]);
}
