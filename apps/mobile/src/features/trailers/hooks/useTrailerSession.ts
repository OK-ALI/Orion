import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  TrailerCandidateV1,
  TrailerPlaybackState,
  TrailerProviderError,
} from '@orion/shared/types';
import { classifyVimeoError, classifyYouTubeError, isTerminalTrailerError } from '../trailerProviders';

const MAX_SAME_CANDIDATE_RETRIES = 1;

export function useTrailerSession(visible: boolean, incomingCandidates: TrailerCandidateV1[], titleKey = '') {
  const [candidates, setCandidates] = useState(incomingCandidates);
  const [activeIndex, setActiveIndex] = useState(0);
  const [state, setState] = useState<TrailerPlaybackState>('idle');
  const [attempt, setAttempt] = useState(0);
  const [transport, setTransport] = useState<'wrapper' | 'direct'>('wrapper');
  const [error, setError] = useState<TrailerProviderError | null>(null);
  const retriesRef = useRef<Record<string, number>>({});
  const attemptedRef = useRef<Set<string>>(new Set());
  const terminalFailuresRef = useRef<Set<string>>(new Set());
  const playedRef = useRef<Set<string>>(new Set());
  const rotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scope = visible ? titleKey : null;
  const scopeRef = useRef(scope);
  const generationRef = useRef(0);
  const [generation, setGeneration] = useState(0);
  const attemptRef = useRef(0);
  const settledFailureRef = useRef(false);
  const instanceRef = useRef<string | null>(null);
  if (!instanceRef.current) instanceRef.current = Math.random().toString(36).slice(2);
  const messageToken = `${instanceRef.current}:${generation}:${attempt}`;
  const candidateKey = incomingCandidates.map(candidate => candidate.id).join('|');
  const activeCandidate = visible && scopeRef.current === scope ? candidates[activeIndex] || null : null;
  const exhausted = state === 'exhausted';
  const eligibleExternal = (item: TrailerCandidateV1) => !terminalFailuresRef.current.has(item.id);
  const bestExternalCandidate = activeCandidate ?
    (playedRef.current.has(activeCandidate.id) && eligibleExternal(activeCandidate) ? activeCandidate : null) ||
    candidates.find(item => playedRef.current.has(item.id) && eligibleExternal(item)) ||
    (eligibleExternal(activeCandidate) ? activeCandidate : null) || candidates.find(eligibleExternal) || null : null;

  const clearRotation = useCallback(() => {
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    rotationTimerRef.current = null;
  }, []);

  useEffect(() => {
    clearRotation();
    if (scopeRef.current !== scope) generationRef.current++;
    scopeRef.current = scope;
    setGeneration(generationRef.current);
    attemptRef.current = 0;
    settledFailureRef.current = false;
    setAttempt(0);
    setCandidates(incomingCandidates);
    setActiveIndex(0);
    setTransport('wrapper');
    setError(null);
    setState(visible ? incomingCandidates.length ? 'preparing' : 'exhausted' : 'idle');
    retriesRef.current = {};
    attemptedRef.current = new Set();
    terminalFailuresRef.current = new Set();
    playedRef.current = new Set();
    return () => { scopeRef.current = null; settledFailureRef.current = true; clearRotation(); };
  }, [visible, titleKey, clearRotation]);

  useEffect(() => {
    if (!visible) return;
    // Append late season alternatives without replacing the current player or its ordering.
    const additions = incomingCandidates.filter(item => !candidates.some(current => current.id === item.id));
    if (!additions.length) return;
    if (!candidates.length) setState('preparing');
    setCandidates(current => [...current, ...additions.filter(item => !current.some(value => value.id === item.id))]);
  }, [visible, titleKey, candidateKey]);

  const startAttempt = useCallback(() => {
    settledFailureRef.current = false;
    attemptRef.current++;
    setAttempt(attemptRef.current);
  }, []);

  const select = useCallback((index: number) => {
    if (!visible || index < 0 || index >= candidates.length) return;
    clearRotation();
    attemptedRef.current.delete(candidates[index].id);
    retriesRef.current[candidates[index].id] = 0;
    setActiveIndex(index);
    setTransport('wrapper');
    setError(null);
    setState('preparing');
    startAttempt();
  }, [visible, candidates, clearRotation, startAttempt]);

  const next = useCallback(() => {
    clearRotation();
    if (activeCandidate) attemptedRef.current.add(activeCandidate.id);
    const nextIndex = candidates.findIndex((item, index) => index > activeIndex && !attemptedRef.current.has(item.id));
    const wrappedIndex = nextIndex >= 0 ? nextIndex : candidates.findIndex(item => !attemptedRef.current.has(item.id));
    if (wrappedIndex < 0) return setState('exhausted');
    setState('rotating');
    rotationTimerRef.current = setTimeout(() => { rotationTimerRef.current = null; select(wrappedIndex); }, 120);
  }, [activeCandidate, activeIndex, candidates, clearRotation, select]);

  const fail = useCallback((providerError: TrailerProviderError) => {
    if (!activeCandidate || settledFailureRef.current) return;
    settledFailureRef.current = true;
    clearRotation();
    setError(providerError);
    const retries = retriesRef.current[activeCandidate.id] || 0;
    // Retain the existing single direct-transport retry only for explicit player errors.
    if (providerError.retryable && retries < MAX_SAME_CANDIDATE_RETRIES) {
      retriesRef.current[activeCandidate.id] = retries + 1;
      setTransport('direct');
      setState('preparing');
      startAttempt();
      return;
    }
    const stateByCategory: Partial<Record<TrailerProviderError['category'], TrailerPlaybackState>> = {
      removed: 'removed', private: 'private', 'embed-disabled': 'embed-disabled',
      'client-identity': 'client-identity-error', network: 'network-error',
    };
    setState(stateByCategory[providerError.category] || 'playback-error');
    // Client identity, network and unknown errors do not prove an upload is unusable.
    if (!isTerminalTrailerError(providerError)) return;
    terminalFailuresRef.current.add(activeCandidate.id);
    attemptedRef.current.add(activeCandidate.id);
    rotationTimerRef.current = setTimeout(() => { rotationTimerRef.current = null; next(); }, 700);
  }, [activeCandidate, clearRotation, next, startAttempt]);

  const handleMessage = useCallback((raw: string) => {
    if (!visible || !activeCandidate || scopeRef.current !== scope || settledFailureRef.current) return;
    const currentToken = `${instanceRef.current}:${generationRef.current}:${attemptRef.current}`;
    if (messageToken !== currentToken) return;
    try {
      const message = JSON.parse(raw || '{}');
      if (!message || message.candidateId !== activeCandidate.id || message.attemptToken !== messageToken) return;
      if (message.type === 'ready' || message.type === 'direct-loaded') setState('ready');
      else if (message.type === 'playing') {
        terminalFailuresRef.current.delete(activeCandidate.id);
        playedRef.current.add(activeCandidate.id);
        clearRotation(); setState('playing'); setError(null);
      }
      else if (message.type === 'paused') setState('paused');
      else if (message.type === 'buffering' || message.type === 'autoplay-blocked') setState('ready');
      else if (message.type === 'network-error') fail({ provider: activeCandidate.site, category: 'network', publicCode: null, retryable: false });
      else if (message.type === 'provider-error') {
        const code = message.detail?.code ?? null;
        if (code === null || (typeof code !== 'number' && typeof code !== 'string')) return;
        fail(activeCandidate.site === 'YouTube' ? classifyYouTubeError(code) : classifyVimeoError(code));
      }
      // No-event timeouts, buffering and blocked autoplay never trigger transport or candidate changes.
    } catch { /* Ignore console chatter and malformed bridge payloads. */ }
  }, [visible, activeCandidate, scope, messageToken, clearRotation, fail]);

  useEffect(() => {
    if (visible && exhausted && attemptedRef.current.size && candidates.some(item => !attemptedRef.current.has(item.id))) next();
  }, [visible, exhausted, candidates, next]);

  const retry = useCallback(() => { if (activeCandidate) select(activeIndex); }, [activeCandidate, activeIndex, select]);

  return useMemo(() => ({
    candidates, activeCandidate, bestExternalCandidate, activeIndex, state, attempt, messageToken, transport, error, exhausted,
    select, next, retry, handleMessage,
  }), [candidates, activeCandidate, bestExternalCandidate, activeIndex, attempt, messageToken, error, exhausted, handleMessage, next, retry, select, state, transport]);
}
