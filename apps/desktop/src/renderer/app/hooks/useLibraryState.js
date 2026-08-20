import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isContinueWatchingProgressEligible } from "@orion/shared/api/continueWatchingPolicy";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { tmdbFetch } from "../../services/tmdb";
import { buildDesktopPortableViewingStatePreview } from "../../features/library/viewingStatePortableAdapter";
import { VERIFIED_HISTORY_UPDATED_EVENT } from "../../services/viewingStateVerification";
import { WATCHED_SYNC_APPLIED_EVENT } from "../../services/watchedOneShotLocalStore";
import { MY_LIST_SYNC_APPLIED_EVENT } from "../../services/myListSyncLocalStore";
import { VIEWING_ACTIVITY_SYNC_APPLIED_EVENT } from "../../services/viewingActivityOneShotLocalStore";
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
    const handleVerifiedHistoryUpdated = (event) => {
      const enabled = storage.get(STORAGE_KEYS.HISTORY_ENABLED);
      if (enabled === 0 || enabled === false) return;
      setHistory(event.detail?.history || storage.get(STORAGE_KEYS.HISTORY) || []);
    };
    window.addEventListener("orion:history-enabled-changed", handleHistorySettingChanged);
    window.addEventListener(VERIFIED_HISTORY_UPDATED_EVENT, handleVerifiedHistoryUpdated);
    return () => {
      window.removeEventListener("orion:history-enabled-changed", handleHistorySettingChanged);
      window.removeEventListener(VERIFIED_HISTORY_UPDATED_EVENT, handleVerifiedHistoryUpdated);
    };
  }, []);

  useEffect(() => {
    const handleWatchedSyncApplied = (event) => {
      setWatched(event.detail?.watched || storage.get("watched") || {});
    };
    window.addEventListener(WATCHED_SYNC_APPLIED_EVENT, handleWatchedSyncApplied);
    return () => window.removeEventListener(WATCHED_SYNC_APPLIED_EVENT, handleWatchedSyncApplied);
  }, []);

  useEffect(() => {
    const handleMyListSyncApplied = (event) => {
      setSaved(event.detail?.saved || storage.get("saved") || {});
      setSavedOrder(event.detail?.savedOrder || storage.get("savedOrder") || []);
    };
    window.addEventListener(MY_LIST_SYNC_APPLIED_EVENT, handleMyListSyncApplied);
    return () => window.removeEventListener(MY_LIST_SYNC_APPLIED_EVENT, handleMyListSyncApplied);
  }, []);

  useEffect(() => {
    const handleViewingActivitySyncApplied = (event) => {
      const enabled = storage.get(STORAGE_KEYS.HISTORY_ENABLED);
      if (enabled === 0 || enabled === false) return;
      setHistory(event.detail?.history || storage.get("history") || []);
      setProgress(event.detail?.progress || storage.get("progress") || {});
    };
    window.addEventListener(VIEWING_ACTIVITY_SYNC_APPLIED_EVENT, handleViewingActivitySyncApplied);
    return () => window.removeEventListener(VIEWING_ACTIVITY_SYNC_APPLIED_EVENT, handleViewingActivitySyncApplied);
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
      const sameEntry = (candidate) => String(candidate?.id) === String(entry.id)
        && candidate?.media_type === entry.media_type
        && (entry.media_type !== "tv"
          || (Number(candidate?.season) === entry.season && Number(candidate?.episode) === entry.episode));
      const matchingEntries = previous.filter(sameEntry);
      const existing = matchingEntries.find((candidate) => candidate.playbackVerified === true) || matchingEntries[0];
      const verifiedFields = existing?.playbackVerified === true
        ? {
            playbackVerified: true,
            playbackVerifiedAt: existing.playbackVerifiedAt || existing.lastPlayedAt || null,
            lastPlayedAt: existing.lastPlayedAt || existing.playbackVerifiedAt || null,
          }
        : {};
      const nextEntry = {
        ...entry,
        ...verifiedFields,
        rewatchCount: (existing?.rewatchCount || 0) + (existing ? 1 : 0),
        completedAt: existing?.completedAt || null,
      };
      const next = [nextEntry, ...previous.filter((candidate) => !sameEntry(candidate))].slice(0, 250);
      storage.set("history", next);
      return next;
    });
  }, [getMediaType]);

  const saveProgress = useCallback((key, percent) => {
    if (percent === null) {
      setProgress((previous) => {
        if (!(key in previous)) return previous;
        const next = { ...previous };
        delete next[key];
        storage.set("progress", next);
        return next;
      });
      return;
    }
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
      const next = previous.filter((candidate) => String(candidate?.id) !== String(item.id)
        || candidate?.media_type !== item.media_type
        || (item.media_type === "tv"
          && (Number(candidate?.season) !== Number(item.season)
            || Number(candidate?.episode) !== Number(item.episode))));
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

  const inProgress = useMemo(() => {
    const progressDetails = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
    const portable = buildDesktopPortableViewingStatePreview({
      watched,
      history,
      progress,
      progressDetails,
    });
    const historyByKey = new Map(
      historyWithKeys.map((entry) => [entry._pk, entry]),
    );
    const candidates = Object.values(portable.progress)
      .filter((record) => isContinueWatchingProgressEligible(record))
      .sort((a, b) => Number(b.lastPlayedAt || 0) - Number(a.lastPlayedAt || 0));
    const seen = new Set();
    const selected = [];

    for (const record of candidates) {
      const media = record.media;
      const localKey = media.mediaType === "movie"
        ? `movie_${media.id}`
        : `tv_${media.id}_s${media.season}e${media.episode}`;
      const groupKey = media.mediaType === "tv"
        ? `tv_${media.id}`
        : localKey;
      if (seen.has(groupKey)) continue;
      const entry = historyByKey.get(localKey);
      if (!entry) continue;
      seen.add(groupKey);
      selected.push(entry);
    }

    return selected;
  }, [history, historyWithKeys, progress, watched]);

  const savedList = useMemo(() => {
    const keys = mergeLibraryOrder(saved, savedOrder);
    const list = keys.map((key) => saved[key]).filter(Boolean);
    return sortLibraryItems(list, librarySort);
  }, [librarySort, saved, savedOrder]);

  const handleReorderSaved = useCallback((nextOrder) => {
    setSavedOrder(nextOrder);
    storage.set("savedOrder", nextOrder);
  }, []);

  return { addHistory, clearHistory, getMediaType, handleReorderSaved, history, inProgress, isSaved, markUnwatched, markWatched, progress, removeHistory, saved, savedList, savedOrder, saveProgress, showToast, toggleSave, watched };
}
