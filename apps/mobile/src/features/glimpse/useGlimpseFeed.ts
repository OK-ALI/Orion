import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GlimpseReel } from './glimpseModel';
import { classifyGlimpseLoadFailure, type GlimpseLoadFailure } from './glimpseLoadFailure';
import { GlimpseFeedEngine } from './GlimpseFeedEngine';
import { createGlimpseCatalog, glimpseDiscoveryCatalog, tmdbGlimpseVideoSource } from './tmdbGlimpseSource';
import { defaultGlimpseFilters, filterGlimpseReels, type GlimpseFilters } from './glimpseBrowse';

type FeedState = { owner: GlimpseFeedEngine; reels: GlimpseReel[]; status: 'idle' | 'loading' | 'ready' | 'error'; exhausted: boolean; failure: GlimpseLoadFailure | null };
export function useGlimpseFeed(enabled: boolean, titleBudget: number, restoredReel: GlimpseReel | null = null,
  view?: { filters: GlimpseFilters; query: string }) {
  const initialReel = useRef(restoredReel).current;
  const viewKey = JSON.stringify(view || null);
  const engine = useMemo(() => {
    const filters = view?.filters || defaultGlimpseFilters(), query = view?.query || '';
    const catalog = view ? createGlimpseCatalog(filters, query) : glimpseDiscoveryCatalog;
    const source = view ? { candidates: async (item: Parameters<typeof tmdbGlimpseVideoSource.candidates>[0], signal: AbortSignal) =>
      filterGlimpseReels(await tmdbGlimpseVideoSource.candidates(item, signal), filters, query) } : tmdbGlimpseVideoSource;
    const unfiltered = !query.trim() && filters.type === 'all' && !filters.genre && filters.region === 'all' && !filters.year && filters.rating === '0';
    const seed = unfiltered ? initialReel : null;
    return new GlimpseFeedEngine(catalog, source, seed, !!query.trim());
  }, [viewKey]);
  const engineRef = useRef(engine); engineRef.current = engine;
  const request = useRef<{ owner: GlimpseFeedEngine; controller: AbortController } | null>(null);
  const activeId = useRef<string | null>(null);
  const mounted = useRef(true);
  const retries = useRef({ owner: engine, count: 0 });
  if (retries.current.owner !== engine) retries.current = { owner: engine, count: 0 };
  const initialState = (): FeedState => ({ owner: engine, reels: engine.snapshot().reels,
    status: engine.snapshot().reels.length ? 'ready' : 'idle', exhausted: false, failure: null });
  const [published, setPublished] = useState<FeedState>(initialState);
  const state = published.owner === engine ? published : initialState();
  const enabledRef = useRef(enabled);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  enabledRef.current = enabled;
  const loadMore = useCallback(async () => {
    if (!mounted.current || !enabledRef.current || engine.snapshot().exhausted) return;
    if (request.current?.owner !== engine) { request.current?.controller.abort(); request.current = null; }
    if (request.current) return;
    const controller = new AbortController();
    let timedOut = false;
    request.current = { owner: engine, controller };
    const current = () => mounted.current && enabledRef.current && engineRef.current === engine && request.current?.controller === controller;
    const publish = (patch: Partial<FeedState>) => {
      if (current()) setPublished(previous => ({ ...(previous.owner === engine ? previous : initialState()), ...patch }));
    };
    publish({ status: 'loading', failure: null });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      let snapshot = engine.snapshot();
      // Barren/duplicate batches are not exhaustion. Bound work per request and
      // let the screen schedule additional probes only while more reels are needed.
      for (let probe = 0; probe < 4; probe++) {
        // Each bounded extension gets its own deadline. Clip-less probes must not consume the next probe's time.
        deadline = setTimeout(() => {
          timedOut = true;
          publish({ status: 'error', failure: { kind: 'timeout', retryable: true }, reels: engine.snapshot().reels });
          controller.abort();
        }, 20000);
        snapshot = await engine.extend(controller.signal, titleBudget, () => activeId.current, engine.snapshot().reels.length === 0);
        clearTimeout(deadline);
        if (controller.signal.aborted || !current()) return;
        publish({ reels: snapshot.reels, exhausted: snapshot.exhausted });
        if (snapshot.addedCount > 0 || snapshot.exhausted) break;
      }
      if (current()) retries.current.count = 0;
      publish({ reels: snapshot.reels, exhausted: snapshot.exhausted, status: 'ready', failure: null });
    } catch (error) {
      if (!controller.signal.aborted) publish({ status: 'error', failure: classifyGlimpseLoadFailure(error), reels: engine.snapshot().reels });
    } finally {
      clearTimeout(deadline);
      const ownsRequest = request.current?.controller === controller;
      if (controller.signal.aborted && !timedOut && mounted.current && engineRef.current === engine && ownsRequest) {
        setPublished(previous => ({ ...(previous.owner === engine ? previous : initialState()),
          reels: engine.snapshot().reels, status: engine.snapshot().reels.length ? 'ready' : 'idle' }));
      }
      if (ownsRequest) request.current = null;
      if (controller.signal.aborted && !timedOut && mounted.current && enabledRef.current
        && engineRef.current === engine && !engine.snapshot().reels.length) void loadRef.current();
    }
  }, [engine, titleBudget]);
  loadRef.current = loadMore;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.controller.abort(); };
  }, []);
  useEffect(() => {
    if (enabled) {
      retries.current.count = 0;
      if (!engine.snapshot().reels.length || state.status === 'error') void loadRef.current();
    }
    return () => { request.current?.controller.abort(); };
  }, [enabled, engine]);
  useEffect(() => {
    if (!enabled || state.status !== 'error' || state.failure?.retryable === false || retries.current.count >= 2) return;
    const timer = setTimeout(() => {
      retries.current.count++; void loadRef.current();
    }, 1500 * 2 ** retries.current.count);
    return () => clearTimeout(timer);
  }, [enabled, engine, state.status, state.failure]);
  return { reels: state.reels, status: state.status, failure: state.failure, exhausted: state.exhausted, loadMore, activeId };
}