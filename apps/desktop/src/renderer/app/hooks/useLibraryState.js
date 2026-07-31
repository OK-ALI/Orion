import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { tmdbFetch } from "../../services/tmdb";
import {
  getLibraryMediaType,
  mergeLibraryOrder,
  needsLibraryMetadata,
  sortLibraryItems,
  toLibraryRecord,
} from "../../shared/utils/library";

export function useLibraryState({ librarySort, setToast, apiKey }) {
  const [saved, setSaved] = useState(() => storage.get("saved") || {});
  const [savedOrder, setSavedOrder] = useState(() => storage.get("savedOrder") || null);
  const [progress, setProgress] = useState(() => storage.get("progress") || {});
  const [history, setHistory] = useState(() => storage.get("history") || []);
  const [watched, setWatched] = useState(() => storage.get("watched") || {});
  const toastTimerRef = useRef(null);
  const savedRef = useRef(saved);
  const hydrationAttemptsRef = useRef(new Set());

  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);
  useEffect(() => {
    const handleHistorySettingChanged = (event) => {
      const enabled = event.detail !== false && event.detail !== 0;
      if (enabled) {
        setHistory(storage.get("history") || []);
        setProgress(storage.get("progress") || {});
      } else {
        // Preserve stored history so enabling it later restores the user's data,
        // while removing it from the active UI immediately.
        setHistory([]);
        setProgress({});
      }
    };
    window.addEventListener("orion:history-enabled-changed", handleHistorySettingChanged);
    return () => window.removeEventListener("orion:history-enabled-changed", handleHistorySettingChanged);
  }, []);

  const showToast = useCallback((message) => {
    clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, [setToast]);

  const getMediaType = useCallback((item) => getLibraryMediaType(item), []);

  useEffect(() => {
    if (!apiKey) return undefined;
    const candidates = Object.entries(saved).filter(([key, item]) => {
      if (!needsLibraryMetadata(item) || hydrationAttemptsRef.current.has(key)) return false;
      hydrationAttemptsRef.current.add(key);
      return true;
    });
    if (!candidates.length) return undefined;
    let cancelled = false;
    Promise.allSettled(candidates.map(async ([key, item]) => {
      const mediaType = getLibraryMediaType(item);
      const details = await tmdbFetch(`/${mediaType}/${item.id}`, apiKey);
      return [key, toLibraryRecord({ ...item, ...details }, mediaType)];
    })).then((outcomes) => {
      if (cancelled) return;
      const repaired = outcomes.flatMap((outcome) => outcome.status === "fulfilled" ? [outcome.value] : []);
      if (!repaired.length) return;
      setSaved((previous) => {
        const next = { ...previous };
        let changed = false;
        for (const [key, item] of repaired) {
          if (!next[key]) continue;
          next[key] = item;
          changed = true;
        }
        if (!changed) return previous;
        storage.set(STORAGE_KEYS.SAVED, next);
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [apiKey, saved]);

  const toggleSave = useCallback((item) => {
    const mediaType = getMediaType(item);
    const key = `${mediaType}_${item.id}`;
    const current = savedRef.current;
    const next = { ...current };
    if (current[key]) {
      delete next[key];
      showToast("Removed from watchlist");
      setSavedOrder((previous) => {
        const order = (previous || Object.keys(current)).filter((itemKey) => itemKey !== key);
        storage.set("savedOrder", order);
        return order;
      });
    } else {
      next[key] = toLibraryRecord(item, mediaType);
      showToast("Added to watchlist");
      setSavedOrder((previous) => {
        const order = [...(previous || Object.keys(current)), key];
        storage.set("savedOrder", order);
        return order;
      });
    }
    setSaved(next);
    storage.set("saved", next);
  }, [getMediaType, showToast]);

  const isSaved = useCallback((item) => !!saved[`${getMediaType(item)}_${item.id}`], [getMediaType, saved]);

  const addHistory = useCallback((item) => {
    const enabled = storage.get(STORAGE_KEYS.HISTORY_ENABLED);
    if (enabled === 0 || enabled === false) return;
    const entry = {
      id: item.id,
      title: item.title || item.name,
      poster_path: item.poster_path,
      media_type: getMediaType(item),
      watchedAt: Date.now(),
      season: item.season != null ? Number(item.season) : null,
      episode: item.episode != null ? Number(item.episode) : null,
      episodeName: item.episodeName || null,
      lastWatchedAt: Date.now(),
    };
    setHistory((previous) => {
      const sameEntry = (candidate) => candidate.id === entry.id && candidate.media_type === entry.media_type && (entry.media_type !== "tv" || (candidate.season === entry.season && candidate.episode === entry.episode));
      const existing = previous.find(sameEntry);
      const nextEntry = { ...entry, rewatchCount: (existing?.rewatchCount || 0) + (existing ? 1 : 0), completedAt: existing?.completedAt || null };
      const next = [nextEntry, ...previous.filter((candidate) => !sameEntry(candidate))].slice(0, 100);
      storage.set("history", next);
      return next;
    });
  }, [getMediaType]);

  const saveProgress = useCallback((key, percent) => {
    const enabled = storage.get(STORAGE_KEYS.HISTORY_ENABLED);
    if (enabled === 0 || enabled === false) return;
    setProgress((previous) => {
      if (previous[key] === percent) return previous;
      const next = { ...previous, [key]: percent };
      storage.set("progress", next);
      return next;
    });
  }, []);

  const markWatched = useCallback((key) => {
    setWatched((previous) => {
      const next = { ...previous, [key]: true };
      storage.set("watched", next);
      return next;
    });
  }, []);

  const markUnwatched = useCallback((key) => {
    setWatched((previous) => {
      const next = { ...previous };
      delete next[key];
      storage.set("watched", next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((item) => {
    setHistory((previous) => {
      const next = previous.filter((candidate) => candidate.id !== item.id || candidate.media_type !== item.media_type || (item.media_type === "tv" && (candidate.season !== item.season || candidate.episode !== item.episode)));
      storage.set("history", next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    storage.set("history", []);
  }, []);

  const historyWithKeys = useMemo(() => history
    .filter((entry) => entry.media_type !== "tv" || (entry.season != null && entry.episode != null))
    .map((entry) => ({ ...entry, _pk: entry.media_type === "movie" ? `movie_${entry.id}` : `tv_${entry.id}_s${entry.season}e${entry.episode}` })), [history]);

  const inProgress = useMemo(() => historyWithKeys.filter((entry) => {
    const percent = progress[entry._pk];
    return !watched[entry._pk] && percent != null && percent > 2 && percent < 98;
  }), [historyWithKeys, progress, watched]);

  const savedList = useMemo(() => {
    const keys = mergeLibraryOrder(saved, savedOrder);
    const list = keys.map((key) => saved[key]).filter(Boolean);
    return sortLibraryItems(list, librarySort);
  }, [librarySort, saved, savedOrder]);

  const handleReorderSaved = useCallback((nextOrder) => {
    setSavedOrder(nextOrder);
    storage.set("savedOrder", nextOrder);
  }, []);

  return { addHistory, clearHistory, getMediaType, handleReorderSaved, history, inProgress, isSaved, markUnwatched, markWatched, progress, removeHistory, saved, savedList, saveProgress, showToast, toggleSave, watched };
}
