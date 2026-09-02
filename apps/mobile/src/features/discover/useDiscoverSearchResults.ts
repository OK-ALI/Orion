import { useEffect, useMemo, useState } from 'react';
import { fetchSearch, isAnimeContent } from '@orion/shared/api';
import type { TmdbMediaItem } from '@orion/shared/types';

interface DiscoverSearchOptions {
  query: string;
  activeFilter: string;
  refreshKey: number;
  generationRef: { current: number };
  remoteReadyRef: { current: boolean };
}

export function useDiscoverSearchResults({
  query, activeFilter, refreshKey, generationRef, remoteReadyRef,
}: DiscoverSearchOptions) {
  const trimmedQuery = query.trim();
  const requestKey = JSON.stringify([trimmedQuery, refreshKey]);
  const [response, setResponse] = useState<{
    key: string;
    results: TmdbMediaItem[];
    status: 'loading' | 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    if (!trimmedQuery || !remoteReadyRef.current) {
      setResponse(null);
      return;
    }

    const generation = generationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled &&
      generation === generationRef.current && remoteReadyRef.current;
    setResponse({ key: requestKey, results: [], status: 'loading' });

    const timeoutId = setTimeout(async () => {
      if (!isCurrent()) return;
      try {
        const data = await fetchSearch(trimmedQuery);
        if (isCurrent()) {
          setResponse({ key: requestKey, results: data.results || [], status: 'success' });
        }
      } catch (error) {
        if (isCurrent()) {
          console.error('Discover search failed:', error);
          setResponse({ key: requestKey, results: [], status: 'error' });
        }
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [generationRef, trimmedQuery, requestKey, remoteReadyRef]);

  const currentResponse = remoteReadyRef.current && trimmedQuery &&
    response?.key === requestKey ? response : null;
  const filteredSearchResults = useMemo(() => (currentResponse?.results || []).filter((result) => {
    // TMDB multi-search also returns people; the shared catalog type excludes them.
    const mediaType = (result as { media_type?: string }).media_type;
    if (mediaType !== 'movie' && mediaType !== 'tv' && mediaType !== 'person' && !!mediaType) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'anime') return mediaType !== 'person' && isAnimeContent(result);
    return mediaType === activeFilter;
  }), [activeFilter, currentResponse]);

  return {
    filteredSearchResults,
    loading: Boolean(trimmedQuery && remoteReadyRef.current &&
      (!currentResponse || currentResponse.status === 'loading')),
    searchSucceeded: currentResponse?.status === 'success',
  };
}
