import { useEffect, useRef, useState } from 'react';
import { tmdbFetch } from '@orion/shared/api';
import { useNetworkStatus } from '../../context/NetworkContext';
import { useRemoteRecoveryEffect } from '../../context/useRemoteRecoveryEffect';


function hasPlayableVideo(videos: any[]) {
  return videos.some((video) => {
    const site = String(video?.site || '').toLowerCase();
    return !!String(video?.key || '').trim() && (site === 'youtube' || site === 'vimeo');
  });
}

function mergeVideos(primary: any[], fallback: any[]) {
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const video of [...primary, ...fallback]) {
    const site = String(video?.site || '').toLowerCase();
    const key = String(video?.key || '').trim();
    const identity = site && key ? `${site}:${key}` : String(video?.id || `${site}:${key}:${merged.length}`);
    if (seen.has(identity)) continue;
    seen.add(identity);
    merged.push(primary.includes(video) ? video : { ...video, originalLanguageAlternative: true });
  }
  return merged;
}

function originalVideoLanguage(data: any) {
  return String(data?.original_language || '').trim().toLowerCase();
}

export function mediaDetailConnectionCopy(state: string, local = false) {
  if (state === 'degraded') return 'Orion Cinema is temporarily unavailable.';
  if (state === 'reconnecting') return 'Reconnecting to Orion Cinema.';
  if (state === 'checking') return 'Checking Cinema connection.';
  if (state === 'offline') return local ? "You're offline. This title is available from your Orion Library." : 'This title needs a connection.';
  return 'Remote title information is unavailable.';
}

export function useMediaDetailRemoteState({ id, type, selectedSeason, activeTab, showTrailerModal }: {
  id: string; type: 'movie' | 'tv'; selectedSeason: number; activeTab: string; showTrailerModal: boolean;
}) {
  const network = useNetworkStatus();
  const routeKey = `${type}:${id}`;
  const routeRef = useRef(routeKey);
  routeRef.current = routeKey;
  const remoteReadyRef = useRef(network.remoteReady);
  remoteReadyRef.current = network.remoteReady;
  const generationRef = useRef(0);
  const previousReadyRef = useRef(network.remoteReady);
  const lastRefreshEpochRef = useRef(network.recoveryEpoch);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [detail, setDetail] = useState<{ key: string; data: any } | null>(null);
  const [detailStatus, setDetailStatus] = useState<{ key: string; error: boolean } | null>(null);
  const [episodeResponse, setEpisodeResponse] = useState<{ key: string; episodes: any[] } | null>(null);
  const [episodeStatus, setEpisodeStatus] = useState<{ key: string; error: boolean } | null>(null);
  const [videos, setVideos] = useState<{ key: string; results: any[] } | null>(null);
  const detailRequestKey = `${routeKey}:${refreshKey}:${reloadKey}`;
  const episodeKey = `${routeKey}:${selectedSeason}`;
  const episodeRequestKey = `${episodeKey}:${refreshKey}`;
  const isMovie = type === 'movie';

  useEffect(() => {
    const wasReady = previousReadyRef.current;
    previousReadyRef.current = network.remoteReady;
    generationRef.current += 1;
    if ((wasReady && !network.remoteReady) ||
      (network.remoteReady && !wasReady && network.recoveryEpoch === lastRefreshEpochRef.current)) {
      setRefreshKey((value) => value + 1);
    }
  }, [network.remoteReady, network.recoveryEpoch, routeKey]);
  useRemoteRecoveryEffect((epoch) => {
    lastRefreshEpochRef.current = epoch;
    setRefreshKey((value) => value + 1);
  });

  useEffect(() => {
    if (!remoteReadyRef.current) return;
    let cancelled = false;
    const generation = generationRef.current;
    const isCurrent = () => !cancelled && remoteReadyRef.current &&
      generation === generationRef.current && routeRef.current === routeKey;
    tmdbFetch<any>(`/${type}/${id}?append_to_response=credits,videos,recommendations`)
      .then((res) => {
        if (!isCurrent()) return;
        setDetail({ key: routeKey, data: res });
        setDetailStatus({ key: detailRequestKey, error: false });
        const primaryVideos = Array.isArray(res?.videos?.results) ? res.videos.results : [];
        const fallbackLanguage = originalVideoLanguage(res);
        if (fallbackLanguage) {
          tmdbFetch<any>(`/${type}/${id}/videos`, { language: fallbackLanguage })
            .then((fallback) => {
              if (!isCurrent()) return;
              const fallbackVideos = Array.isArray(fallback?.results) ? fallback.results : [];
              if (!hasPlayableVideo(fallbackVideos)) return;
              setDetail({ key: routeKey, data: {
                ...res,
                videos: { ...(res.videos || {}), results: mergeVideos(primaryVideos, fallbackVideos) },
              } });
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (isCurrent()) setDetailStatus({ key: detailRequestKey, error: true });
      });
    return () => { cancelled = true; };
  }, [id, type, routeKey, detailRequestKey]);

  useEffect(() => {
    if (isMovie || activeTab !== 'episodes' || !selectedSeason) return;
    if (!remoteReadyRef.current) return;
    let cancelled = false;
    const generation = generationRef.current;
    const isCurrent = () => !cancelled && remoteReadyRef.current &&
      generation === generationRef.current && routeRef.current === routeKey;
    tmdbFetch<any>(`/tv/${id}/season/${selectedSeason}`)
      .then((res) => {
        if (!isCurrent()) return;
        setEpisodeResponse({ key: episodeKey, episodes: res.episodes || [] });
        setEpisodeStatus({ key: episodeRequestKey, error: false });
      })
      .catch(() => {
        if (isCurrent()) setEpisodeStatus({ key: episodeRequestKey, error: true });
      });
    return () => { cancelled = true; };
  }, [activeTab, id, isMovie, selectedSeason, routeKey, episodeKey, episodeRequestKey]);

  const currentDetail = detail?.key === routeKey ? detail.data : null;
  const titleHasPlayableVideo = hasPlayableVideo(currentDetail?.videos?.results || []);
  const latestSeason = Math.max(1, Number(currentDetail?.number_of_seasons) || 1);
  useEffect(() => {
    if (type !== 'tv' || !currentDetail || !selectedSeason || !remoteReadyRef.current) return;
    const shouldProbeFallback = !titleHasPlayableVideo;
    if (!showTrailerModal && !shouldProbeFallback) return;
    let cancelled = false;
    const generation = generationRef.current;
    const seasons = [...new Set(showTrailerModal
      ? [selectedSeason]
      : [selectedSeason, latestSeason]
    )].filter((season) => season > 0).slice(0, 2);
    const fallbackLanguage = originalVideoLanguage(currentDetail);
    for (const season of seasons) {
      tmdbFetch<any>(`/tv/${id}/season/${season}/videos`, fallbackLanguage ? { language: fallbackLanguage } : {})
        .then((result) => {
          if (cancelled || !remoteReadyRef.current || generation !== generationRef.current || routeRef.current !== routeKey) return;
          setVideos((current) => ({ key: routeKey, results: [
            ...(current?.key === routeKey ? current.results.filter((video) => video.seasonNum !== season) : []),
            ...(result.results || []).map((video: any) => ({ ...video, seasonNum: season })),
          ] }));
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [id, type, selectedSeason, showTrailerModal, routeKey, refreshKey, titleHasPlayableVideo, latestSeason, currentDetail?.original_language]);

  const data = detail?.key === routeKey ? detail.data : null;
  const episodes = episodeResponse?.key === episodeKey ? episodeResponse.episodes : [];
  const episodesLoaded = episodeResponse?.key === episodeKey;
  return {
    network, refreshKey, generationRef, remoteReadyRef, data, episodes,
    loading: network.remoteReady && detailStatus?.key !== detailRequestKey,
    loadError: detailStatus?.key === detailRequestKey && detailStatus.error ? 'Orion could not refresh this title. Please try again.' : null,
    episodesLoaded,
    episodesLoading: network.remoteReady && activeTab === 'episodes' && !episodesLoaded && episodeStatus?.key !== episodeRequestKey,
    episodesError: episodeStatus?.key === episodeRequestKey && episodeStatus.error,
    seasonVideos: videos?.key === routeKey ? videos.results : [],
    retry: () => { if (remoteReadyRef.current) setReloadKey((value) => value + 1); },
  };
}

export type MediaDetailRemoteState = ReturnType<typeof useMediaDetailRemoteState>;
