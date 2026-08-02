import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { mmkvStorageAdapter } from '../services/storageAdapter';
import {
  TmdbMediaItem,
  type ContinueWatchingEntry,
  type MobilePlaybackEvidence,
  type PlaybackProgressV3,
} from '@orion/shared/types';
import { tmdbFetch } from '@orion/shared/api';
import { canPersistVerifiedPlayback } from '../features/playback/playbackEvidence';
import { updateMobileDiagnostics } from '../services/mobileDiagnostics';
import {
  historyEntryKey,
  markProgressRecordWatched,
  normalizePlaybackProgress,
  playbackProgressKey,
  selectContinueWatching,
  withoutHistoryEntry,
  withoutProgressRecord,
} from '../features/library/playbackLibrary';

function getLibraryMediaType(item: any = {}) {
  return item.media_type || (item.first_air_date || item.name ? "tv" : "movie");
}

function getLibraryTitle(item: any = {}) {
  return item.title || item.name || "Untitled";
}

function getLibraryYear(item: any = {}) {
  return String(item.release_date || item.first_air_date || item.year || "").slice(0, 4);
}

function toLibraryRecord(item: any = {}, mediaType = getLibraryMediaType(item)) {
  const releaseDate = item.release_date || "";
  const firstAirDate = item.first_air_date || "";
  const title = mediaType === "tv" ? item.name || item.title || "Untitled" : getLibraryTitle(item);
  return {
    ...item,
    id: item.id,
    media_type: mediaType,
    title,
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    release_date: releaseDate,
    first_air_date: firstAirDate,
    vote_average: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : null,
    year: getLibraryYear({ ...item, release_date: releaseDate, first_air_date: firstAirDate }),
  };
}

const STORAGE_KEYS = {
  SAVED: 'saved',
  SAVED_ORDER: 'savedOrder',
  PROGRESS: 'progress',
  HISTORY: 'history',
  WATCHED: 'watched',
};

interface LibraryContextType {
  saved: Record<string, any>;
  savedOrder: string[];
  history: any[];
  watched: Record<string, any>;
  progress: Record<string, any>;
  toggleSave: (item: TmdbMediaItem) => void;
  isSaved: (item: TmdbMediaItem) => boolean;
  markWatched: (item: TmdbMediaItem, options?: { isEpisode?: boolean, seriesId?: number | string }) => void;
  markUnwatched: (item: TmdbMediaItem, options?: { isEpisode?: boolean, seriesId?: number | string }) => void;
  isWatched: (item: TmdbMediaItem, options?: { isEpisode?: boolean, seriesId?: number | string }) => boolean;
  clearHistory: () => void;
  removeHistoryEntry: (key: string) => void;
  removeProgress: (key: string) => void;
  markProgressWatched: (key: string) => void;
  getContinueWatching: () => ContinueWatchingEntry[];
  enrichPlaybackMetadata: (key: string) => Promise<void>;
  recordPlayback: (record: {
    item: any;
    mediaType: 'movie' | 'tv';
    currentTime: number;
    duration: number;
    sourceId?: string | null;
    season?: number | null;
    episode?: number | null;
    evidence?: MobilePlaybackEvidence | null;
    sessionId?: string | null;
  }) => void;
  getPlaybackProgress: (mediaType: 'movie' | 'tv', id: string | number, season?: number | null, episode?: number | null) => PlaybackProgressV3 | null;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

function safeParse(str: string | null, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Record<string, any>>(() => safeParse(mmkvStorageAdapter.get(STORAGE_KEYS.SAVED), {}));
  const [savedOrder, setSavedOrder] = useState<string[]>(() => safeParse(mmkvStorageAdapter.get(STORAGE_KEYS.SAVED_ORDER), []));
  const [history, setHistory] = useState<any[]>(() => safeParse(mmkvStorageAdapter.get(STORAGE_KEYS.HISTORY), []));
  const [watched, setWatched] = useState<Record<string, any>>(() => safeParse(mmkvStorageAdapter.get(STORAGE_KEYS.WATCHED), {}));
  const [progress, setProgress] = useState<Record<string, any>>(() => safeParse(mmkvStorageAdapter.get(STORAGE_KEYS.PROGRESS), {}));

  const savedRef = useRef(saved);
  const watchedRef = useRef(watched);
  const historyRef = useRef(history);
  const progressRef = useRef(progress);
  const metadataRequestsRef = useRef(new Map<string, Promise<void>>());

  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => { watchedRef.current = watched; }, [watched]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const getMediaType = useCallback((item: any) => getLibraryMediaType(item), []);

  const toggleSave = useCallback((item: TmdbMediaItem) => {
    const mediaType = getMediaType(item);
    const key = `${mediaType}_${item.id}`;
    const current = savedRef.current;
    const next = { ...current };

    if (current[key]) {
      delete next[key];
      setSavedOrder(prev => {
        const order = (prev.length ? prev : Object.keys(current)).filter(k => k !== key);
        mmkvStorageAdapter.set(STORAGE_KEYS.SAVED_ORDER, JSON.stringify(order));
        return order;
      });
    } else {
      next[key] = toLibraryRecord(item, mediaType);
      setSavedOrder(prev => {
        const order = [...(prev.length ? prev : Object.keys(current)), key];
        mmkvStorageAdapter.set(STORAGE_KEYS.SAVED_ORDER, JSON.stringify(order));
        return order;
      });
    }

    savedRef.current = next;
    setSaved(next);
    mmkvStorageAdapter.set(STORAGE_KEYS.SAVED, JSON.stringify(next));
  }, [getMediaType]);

  const isSaved = useCallback((item: TmdbMediaItem) => {
    const key = `${getMediaType(item)}_${item.id}`;
    return !!savedRef.current[key];
  }, [getMediaType]);

  const getWatchedKey = useCallback((item: any, options?: { isEpisode?: boolean, seriesId?: number | string }) => {
    if (options?.isEpisode && options.seriesId) {
      return `tv_${options.seriesId}_episode_${item.id}`;
    }
    return `${getMediaType(item)}_${item.id}`;
  }, [getMediaType]);

  const markWatched = useCallback((item: any, options?: { isEpisode?: boolean, seriesId?: number | string }) => {
    const key = getWatchedKey(item, options);
    const mediaType = getMediaType(item);
    
    const record = toLibraryRecord(item, mediaType);
    if (options?.isEpisode && options.seriesId) {
      record.is_episode = true;
      record.series_id = options.seriesId;
      // Add episode number prefix if available
      if (item.episode_number) {
        record.title = `E${item.episode_number} - ${record.title}`;
      }
    }

    const next = { ...watchedRef.current, [key]: { ...record, timestamp: Date.now() } };
    watchedRef.current = next;
    setWatched(next);
    mmkvStorageAdapter.set(STORAGE_KEYS.WATCHED, JSON.stringify(next));
  }, [getWatchedKey, getMediaType]);

  const markUnwatched = useCallback((item: any, options?: { isEpisode?: boolean, seriesId?: number | string }) => {
    const key = getWatchedKey(item, options);
    const next = { ...watchedRef.current };
    delete next[key];
    watchedRef.current = next;
    setWatched(next);
    mmkvStorageAdapter.set(STORAGE_KEYS.WATCHED, JSON.stringify(next));
  }, [getWatchedKey]);

  const isWatched = useCallback((item: any, options?: { isEpisode?: boolean, seriesId?: number | string }) => {
    const key = getWatchedKey(item, options);
    return !!watchedRef.current[key];
  }, [getWatchedKey]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
    mmkvStorageAdapter.set(STORAGE_KEYS.HISTORY, JSON.stringify([]));
  }, []);

  const removeHistoryEntry = useCallback((key: string) => {
    const next = withoutHistoryEntry(historyRef.current, key);
    historyRef.current = next;
    setHistory(next);
    mmkvStorageAdapter.set(STORAGE_KEYS.HISTORY, JSON.stringify(next));
  }, []);

  const getProgressKey = useCallback((
    mediaType: 'movie' | 'tv',
    id: string | number,
    season?: number | null,
    episode?: number | null,
  ) => {
    return playbackProgressKey(mediaType, id, season, episode);
  }, []);

  const removeProgress = useCallback((key: string) => {
    const next = withoutProgressRecord(progressRef.current, key);
    if (next === progressRef.current) return;
    progressRef.current = next;
    setProgress(next);
    mmkvStorageAdapter.set(STORAGE_KEYS.PROGRESS, JSON.stringify(next));
  }, []);

  const markProgressWatched = useCallback((key: string) => {
    const next = markProgressRecordWatched(progressRef.current, watchedRef.current, key);
    if (!next) return;
    watchedRef.current = next.watched;
    progressRef.current = next.progress;
    setWatched(next.watched);
    setProgress(next.progress);
    mmkvStorageAdapter.set(STORAGE_KEYS.WATCHED, JSON.stringify(next.watched));
    mmkvStorageAdapter.set(STORAGE_KEYS.PROGRESS, JSON.stringify(next.progress));
  }, []);

  const getContinueWatching = useCallback(
    () => selectContinueWatching(progressRef.current, watchedRef.current),
    [],
  );

  const recordPlayback = useCallback(({
    item,
    mediaType,
    currentTime,
    duration,
    sourceId = null,
    season = null,
    episode = null,
    evidence = null,
    sessionId = null,
  }: {
    item: any;
    mediaType: 'movie' | 'tv';
    currentTime: number;
    duration: number;
    sourceId?: string | null;
    season?: number | null;
    episode?: number | null;
    evidence?: MobilePlaybackEvidence | null;
    sessionId?: string | null;
  }) => {
    const id = item?.id;
    if (id == null || !canPersistVerifiedPlayback(evidence, sessionId)) return;
    const safeCurrent = Math.max(0, Number(currentTime) || 0);
    const safeDuration = Math.max(0, Number(duration) || 0);
    const key = getProgressKey(mediaType, id, season, episode);
    const percent = safeDuration > 0 ? Math.min(100, (safeCurrent / safeDuration) * 100) : null;
    const updatedAt = Date.now();
    const existing = normalizePlaybackProgress(key, progressRef.current[key]);
    const progressRecord: PlaybackProgressV3 = {
      schemaVersion: 3,
      key,
      mediaIdentity: {
        id,
        mediaType,
        title: getLibraryTitle(item),
        year: Number(getLibraryYear(item)) || null,
        season,
        episode,
      },
      presentation: {
        posterPath: item.poster_path || item.posterPath || existing?.presentation.posterPath || null,
        backdropPath: item.backdrop_path || item.backdropPath || existing?.presentation.backdropPath || null,
        seriesTitle: item.series_title || item.seriesTitle || existing?.presentation.seriesTitle || null,
        episodeTitle: item.episode_title || item.episodeTitle || existing?.presentation.episodeTitle || null,
      },
      currentTime: safeCurrent,
      duration: safeDuration,
      percent,
      sourceId,
      evidence,
      sessionId,
      completed: percent != null && percent >= 90,
      startedAt: existing?.startedAt || updatedAt,
      lastPlayedAt: updatedAt,
    };
    const nextProgress = { ...progressRef.current, [key]: progressRecord };
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    mmkvStorageAdapter.set(STORAGE_KEYS.PROGRESS, JSON.stringify(nextProgress));
    updateMobileDiagnostics({ lastProgressPersistedAt: updatedAt });

    const historyRecord = {
      ...toLibraryRecord(item, mediaType),
      season,
      episode,
      currentTime: safeCurrent,
      duration: safeDuration,
      sourceId,
      evidence,
      sessionId,
      lastPlayedAt: updatedAt,
      updatedAt,
    };
    const nextHistory = [
      historyRecord,
      ...historyRef.current.filter((entry) => getProgressKey(
        entry.media_type || mediaType,
        entry.id,
        entry.season,
        entry.episode,
      ) !== key),
    ].slice(0, 250);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    mmkvStorageAdapter.set(STORAGE_KEYS.HISTORY, JSON.stringify(nextHistory));
    updateMobileDiagnostics({ lastHistoryPersistedAt: updatedAt });
  }, [getProgressKey]);

  const getPlaybackProgress = useCallback((
    mediaType: 'movie' | 'tv',
    id: string | number,
    season?: number | null,
    episode?: number | null,
  ) => {
    const key = getProgressKey(mediaType, id, season, episode);
    return normalizePlaybackProgress(key, progressRef.current[key]);
  }, [getProgressKey]);

  const enrichPlaybackMetadata = useCallback((key: string): Promise<void> => {
    const existingRequest = metadataRequestsRef.current.get(key);
    if (existingRequest) return existingRequest;
    const task = (async () => {
      const progressEntry = normalizePlaybackProgress(key, progressRef.current[key]);
      if (!progressEntry) return;
      const { mediaIdentity, presentation } = progressEntry;
      const needsSeries = !presentation.posterPath
        || !presentation.backdropPath
        || (mediaIdentity.mediaType === 'tv' && !presentation.seriesTitle);
      const needsEpisode = mediaIdentity.mediaType === 'tv'
        && mediaIdentity.season != null
        && mediaIdentity.episode != null
        && !presentation.episodeTitle;
      if (!needsSeries && !needsEpisode) return;

      const details = needsSeries
        ? await tmdbFetch<any>(`/${mediaIdentity.mediaType}/${mediaIdentity.id}`).catch(() => null)
        : null;
      const episodeDetails = needsEpisode
        ? await tmdbFetch<any>(`/tv/${mediaIdentity.id}/season/${mediaIdentity.season}/episode/${mediaIdentity.episode}`).catch(() => null)
        : null;
      if (!details && !episodeDetails) return;

      const latest = normalizePlaybackProgress(key, progressRef.current[key]);
      if (!latest) return;
      const seriesTitle = mediaIdentity.mediaType === 'tv'
        ? details?.name || latest.presentation.seriesTitle || latest.mediaIdentity.title
        : null;
      const nextEntry: PlaybackProgressV3 = {
        ...latest,
        mediaIdentity: {
          ...latest.mediaIdentity,
          title: mediaIdentity.mediaType === 'tv'
            ? seriesTitle || latest.mediaIdentity.title
            : details?.title || latest.mediaIdentity.title,
          year: latest.mediaIdentity.year
            || Number(String(details?.release_date || details?.first_air_date || '').slice(0, 4))
            || null,
        },
        presentation: {
          posterPath: details?.poster_path || latest.presentation.posterPath,
          backdropPath: episodeDetails?.still_path || details?.backdrop_path || latest.presentation.backdropPath,
          seriesTitle,
          episodeTitle: episodeDetails?.name || latest.presentation.episodeTitle,
        },
      };
      const nextProgress = { ...progressRef.current, [key]: nextEntry };
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      mmkvStorageAdapter.set(STORAGE_KEYS.PROGRESS, JSON.stringify(nextProgress));

      const nextHistory = historyRef.current.map((entry) => historyEntryKey(entry) === key ? {
        ...entry,
        title: nextEntry.mediaIdentity.title,
        name: nextEntry.presentation.seriesTitle || entry.name,
        poster_path: nextEntry.presentation.posterPath,
        backdrop_path: nextEntry.presentation.backdropPath,
        episode_title: nextEntry.presentation.episodeTitle,
      } : entry);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      mmkvStorageAdapter.set(STORAGE_KEYS.HISTORY, JSON.stringify(nextHistory));
    })().finally(() => metadataRequestsRef.current.delete(key));
    metadataRequestsRef.current.set(key, task);
    return task;
  }, []);

  const value = {
    saved,
    savedOrder,
    history,
    watched,
    progress,
    toggleSave,
    isSaved,
    markWatched,
    markUnwatched,
    isWatched,
    clearHistory,
    removeHistoryEntry,
    removeProgress,
    markProgressWatched,
    getContinueWatching,
    enrichPlaybackMetadata,
    recordPlayback,
    getPlaybackProgress,
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within a LibraryProvider');
  return context;
}
