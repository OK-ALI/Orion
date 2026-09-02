import { useEffect, useState } from 'react';
import { tmdbFetch } from '@orion/shared/api';
import type { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { getRegionQueryParams } from './discoverCatalog';

interface DiscoverRegionOptions {
  region: string;
  subfilter: string;
  genreType: 'all' | 'movie' | 'tv';
  enabled: boolean;
  refreshKey: number;
  generationRef: { current: number };
  remoteReadyRef: { current: boolean };
}

export function useDiscoverRegionResults({
  region, subfilter, genreType, enabled, refreshKey, generationRef, remoteReadyRef,
}: DiscoverRegionOptions) {
  const requestKey = JSON.stringify([region, subfilter, genreType, enabled, refreshKey]);
  const [response, setResponse] = useState<{
    key: string;
    results: TmdbMediaItem[];
    status: 'loading' | 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    if (!enabled || !remoteReadyRef.current) {
      setResponse(null);
      return;
    }

    const generation = generationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled &&
      generation === generationRef.current && remoteReadyRef.current;
    setResponse({ key: requestKey, results: [], status: 'loading' });
    const { countryParam, languageParam } = getRegionQueryParams(region, subfilter);
    const requestTypes = genreType === 'all' ? ['movie', 'tv'] as const : [genreType];

    Promise.all(requestTypes.map((mediaType) =>
      tmdbFetch<TmdbPaginatedResponse>(`/discover/${mediaType}?sort_by=popularity.desc${countryParam}${languageParam}&page=1`)
    ))
      .then((responses) => {
        if (!isCurrent()) return;
        const merged = responses
          .flatMap((data, index) => (data.results || []).map((item) => ({ ...item, media_type: requestTypes[index] })))
          .filter((item) => item.poster_path)
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        setResponse({ key: requestKey, results: merged, status: 'success' });
      })
      .catch((error) => {
        if (isCurrent()) {
          console.error('Region content fetch failed:', error);
          setResponse({ key: requestKey, results: [], status: 'error' });
        }
      });

    return () => { cancelled = true; };
  }, [enabled, generationRef, genreType, region, requestKey, remoteReadyRef, subfilter]);

  const currentResponse = enabled && remoteReadyRef.current &&
    response?.key === requestKey ? response : null;
  return {
    regionResults: currentResponse?.results || [],
    regionLoading: Boolean(enabled && remoteReadyRef.current &&
      (!currentResponse || currentResponse.status === 'loading')),
    regionSucceeded: currentResponse?.status === 'success',
  };
}
