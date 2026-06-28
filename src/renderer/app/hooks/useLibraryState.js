import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";

export function useLibraryState({ librarySort, setToast }) {
  const [saved, setSaved] = useState(() => storage.get("saved") || {});
  const [savedOrder, setSavedOrder] = useState(() => storage.get("savedOrder") || null);
  const [progress, setProgress] = useState(() => storage.get("progress") || {});
  const [history, setHistory] = useState(() => storage.get("history") || []);
  const [watched, setWatched] = useState(() => storage.get("watched") || {});
  const toastTimerRef = useRef(null);
  const savedRef = useRef(saved);

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

  const getMediaType = useCallback(
    (item) => item.media_type || (item.first_air_date ? "tv" : "movie"),
    [],
  );

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
      next[key] = {
        id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        media_type: mediaType,
        vote_average: item.vote_average,
        year: (item.release_date || item.first_air_date || "").slice(0, 4),
      };
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
    const keys = savedOrder ? savedOrder.filter((key) => saved[key]) : Object.keys(saved);
    const list = keys.map((key) => saved[key]).filter(Boolean);
    if (librarySort === "title") return [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (librarySort === "rating") return [...list].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    if (librarySort === "year") return [...list].sort((a, b) => (b.year || "").localeCompare(a.year || ""));
    return list;
  }, [librarySort, saved, savedOrder]);

  const handleReorderSaved = useCallback((nextOrder) => {
    setSavedOrder(nextOrder);
    storage.set("savedOrder", nextOrder);
  }, []);

  return { addHistory, clearHistory, getMediaType, handleReorderSaved, history, inProgress, isSaved, markUnwatched, markWatched, progress, removeHistory, saved, savedList, saveProgress, showToast, toggleSave, watched };
}
