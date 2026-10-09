import { useCallback, useEffect, useRef, useState } from 'react';
import { isAnimeContent, lookupAnimeEntries, tmdbFetch, type AnimeIdentityResult } from '@orion/shared/api';
import { getRegisteredSource, isManualAnimeProvider } from '@orion/shared/sources';
import { createAnimeIdentityTrace } from './animeIdentityDiagnostics';
import { resolveAnimeTestIdentity } from './animeIdentityRequest';
import { getAnimeFlowChoice, preferredAnimeSource, setAnimeFlowChoice,
  type AnimeVariant } from './animeSourceAffinity';

export interface AnimeSourceSelection {
  providerId?: string;
  identity: Extract<AnimeIdentityResult, { state: 'verified' }>;
  variant: AnimeVariant;
}
type State = { key: string; phase: 'checking' | 'general' | 'anime' | 'failed'; detail: any;
  selection: AnimeSourceSelection | null; error: string | null; providerId?: string };

/** Identity/affinity integration only. Resume and progress belong to Orion's existing player. */
export function useAnimeSource({ id, type, season, episode, enabled, routedSource, routedVariant, preference, onPreferred }: {
  id: string; type: 'movie' | 'tv'; season: number | null; episode: number | null; enabled: boolean;
  preference?: { sourceId: string; variant?: string } | null;
  routedSource?: string; routedVariant?: string; onPreferred(selection: AnimeSourceSelection): void;
}) {
  const key = `${type}:${id}:${season}:${episode}`;
  const eligible = enabled && type === 'tv' && (season ?? 0) > 0 && (episode ?? 0) > 0;
  const [state, setState] = useState<State>({ key: '', phase: 'checking', detail: null, selection: null, error: null });
  const request = useRef<AbortController | null>(null);
  const detailRef = useRef<any>(null);
  const preferred = useRef(onPreferred); preferred.current = onPreferred;
  const selectionRef = useRef<AnimeSourceSelection | null>(null);
  const preferenceRef = useRef(preference); preferenceRef.current = preference;
  const manualChoice = useRef(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const resolve = useCallback(async (variant: AnimeVariant, detail: any, signal: AbortSignal, providerId = 'aniembed') => {
    if (!isManualAnimeProvider(providerId) || !getRegisteredSource(providerId)?.animeProvider?.variants.includes(variant)) return null;
    const diagnostic = createAnimeIdentityTrace();
    try {
      const result = await resolveAnimeTestIdentity({ id, type, season, episode, detail, variant, signal },
        { fetchSeason: tmdbFetch, lookup: lookupAnimeEntries }, diagnostic);
      return !signal.aborted && result.state === 'verified' ? { identity: result, variant, providerId } : null;
    } catch {
      diagnostic({ stage: 'decision', outcome: 'rejected', reason: 'selection-failed' });
      return null;
    }
  }, [episode, id, season, type]);

  useEffect(() => {
    const scope = new AbortController(); request.current = scope;
    detailRef.current = null; selectionRef.current = null; manualChoice.current = false;
    setState({ key, phase: eligible ? 'checking' : 'general', detail: null, selection: null, error: null });
    if (!eligible) return () => scope.abort();
    // Bound the catalog request as well as AniList lookup. No stale episode may be activated.
    const timer = setTimeout(() => scope.abort(), 20_000);
    const failure = () => {
      const flow = getAnimeFlowChoice(id);
      const manualGeneral = Boolean((routedSource && !isManualAnimeProvider(routedSource)) || (flow && 'generalSourceId' in flow));
      const providerId = routedSource || (flow && 'providerId' in flow ? flow.providerId : preferenceRef.current?.sourceId) || 'aniembed';
      const continuation = !manualGeneral && (isManualAnimeProvider(providerId) && (Boolean(routedSource || preferenceRef.current?.sourceId || flow)));
      setState({ key, phase: continuation ? 'failed' : 'general', detail: detailRef.current, selection: null,
        providerId, error: continuation ? `Could not continue this episode with ${getRegisteredSource(providerId)?.label}.` : null });
    };
    let disposed = false;
    (async () => {
      try {
        const detail = await tmdbFetch<any>(`/${type}/${id}?append_to_response=alternative_titles`, { signal: scope.signal });
        if (scope.signal.aborted || disposed || manualChoice.current) return;
        if (String(detail?.id) !== id || !isAnimeContent(detail)) {
          failure(); return;
        }
        detailRef.current = detail;
        const affinity = preferredAnimeSource(id, routedSource, routedVariant, preferenceRef.current);
        if (!affinity) {
          if (isManualAnimeProvider(routedSource)) failure();
          else setState({ key, phase: 'general', detail, selection: null, error: null });
          return;
        }
        const selection = await resolve(affinity.variant, detail, scope.signal, affinity.providerId);
        if (scope.signal.aborted || disposed || manualChoice.current) return;
        if (!selection) { failure(); return; }
        selectionRef.current = selection;
        setState({ key, phase: 'anime', detail, selection, error: null });
        preferred.current(selection);
      } catch { if (!disposed && !manualChoice.current) failure(); }
      finally { clearTimeout(timer); }
    })();
    const abort = () => { if (!disposed && !manualChoice.current) failure(); };
    scope.signal.addEventListener('abort', abort, { once: true });
    return () => { disposed = true; scope.signal.removeEventListener('abort', abort); clearTimeout(timer); scope.abort(); };
  }, [eligible, id, key, resolve, retryAttempt, routedSource, routedVariant, type]);

  const prepare = useCallback(async (variant: AnimeVariant, providerId = 'aniembed') => {
    const scope = request.current;
    if (!scope || scope.signal.aborted || !detailRef.current) return null;
    const attempt = new AbortController();
    const abort = () => attempt.abort(); scope.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 20_000);
    try { return await resolve(variant, detailRef.current, attempt.signal, providerId); }
    finally { clearTimeout(timer); scope.signal.removeEventListener('abort', abort); }
  }, [resolve]);
  const activate = useCallback((selection: AnimeSourceSelection) => {
    const providerId = selection.providerId || 'aniembed';
    if (!isManualAnimeProvider(providerId) || !getRegisteredSource(providerId)?.animeProvider?.variants.includes(selection.variant)) return false;
    if (selection.identity.tmdbId !== id || selection.identity.season !== season || selection.identity.episode !== episode) return false;
    manualChoice.current = true;
    selectionRef.current = selection;
    setAnimeFlowChoice(id, { providerId, variant: selection.variant });
    setState((current) => ({ ...current, phase: 'anime', selection, error: null })); return true;
  }, [episode, id, season]);
  const manualGeneral = useCallback((generalSourceId: string) => {
    manualChoice.current = true;
    setAnimeFlowChoice(id, { generalSourceId });
    selectionRef.current = null;
    setState((current) => ({ ...current, phase: 'general', selection: null, error: null }));
  }, [id]);
  const recordSuccess = useCallback((sourceId: string) => {
    const selection = selectionRef.current;
    if (!selection || sourceId !== (selection.providerId || 'aniembed') || !isManualAnimeProvider(sourceId)) return;
    const affinity = { providerId: sourceId, variant: selection.variant };
    setAnimeFlowChoice(id, affinity);
  }, [id]);
  const current = state.key === key ? state : { key, phase: eligible ? 'checking' as const : 'general' as const,
    detail: null, selection: null, error: null };
  return { ...current, prepare, activate, manualGeneral, recordSuccess, retry: () => setRetryAttempt((value) => value + 1) };
}
