import { useEffect, useRef, useState } from "react";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { tmdbFetch } from "../../services/tmdb";

export function useEpisodeNotifications({ apiKey, apiKeyLoaded, saved }) {
  const [episodeCheckStatus, setEpisodeCheckStatus] = useState(null);
  const episodeDismissTimerRef = useRef(null);

  useEffect(() => {
    if (!apiKeyLoaded) return;
    const notifyPref = storage.get(STORAGE_KEYS.NOTIFY_NEW_EPISODE);
    if (notifyPref === false || notifyPref === 0) return;

    let cancelled = false;

    async function checkNewEpisodes() {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (cancelled || !apiKey) return;

      const tvSeries = Object.values(saved).filter(
        (item) => item && item.media_type === "tv" && item.id,
      );
      if (!tvSeries.length) return;

      const cache = storage.get(STORAGE_KEYS.EPISODE_RELEASE_CACHE) || {};
      const now = Date.now();
      const cacheTtl = 12 * 60 * 60 * 1000;
      const toCheck = tvSeries.filter(
        (series) =>
          !cache[series.id] ||
          now - (cache[series.id].checkedAt || 0) > cacheTtl,
      );

      if (!toCheck.length) {
        setEpisodeCheckStatus("none");
        episodeDismissTimerRef.current = setTimeout(() => {
          if (!cancelled) setEpisodeCheckStatus(null);
        }, 2000);
        return;
      }

      setEpisodeCheckStatus("checking");
      const batchSize = 3;
      const newEpisodeEntries = [];

      for (let index = 0; index < toCheck.length && !cancelled; index += batchSize) {
        const batch = toCheck.slice(index, index + batchSize);
        await Promise.all(
          batch.map(async (series) => {
            try {
              const data = await tmdbFetch(`/tv/${series.id}`, apiKey);
              if (cancelled) return;

              const previous = cache[series.id] || {};
              const lastEpisode = data.last_episode_to_air;
              const lastDate = lastEpisode?.air_date || null;
              const isFirstCheck = !previous.checkedAt;
              const parseLocalDate = (date) => {
                if (!date) return null;
                const [year, month, day] = date.split("-").map(Number);
                return new Date(year, month - 1, day);
              };
              const todayLocal = new Date();
              todayLocal.setHours(0, 0, 0, 0);
              const sevenDaysAgo = new Date(todayLocal);
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

              const addEntry = () => {
                newEpisodeEntries.push({
                  title:
                    series.title ||
                    series.name ||
                    data.name ||
                    "Unknown series",
                  season: lastEpisode?.season_number ?? null,
                  id: series.id,
                  seriesItem: series,
                });
              };

              if (isFirstCheck) {
                const lastParsed = parseLocalDate(lastDate);
                if (lastParsed && lastParsed >= sevenDaysAgo) addEntry();
              } else {
                const previousLastDate = previous.lastEpDate ?? null;
                const isMigratingOldCache =
                  previous.checkedAt && previousLastDate === null;
                if (!isMigratingOldCache) {
                  const lastParsed = parseLocalDate(lastDate);
                  const previousParsed = parseLocalDate(previousLastDate);
                  const isNewEpisode =
                    lastDate &&
                    lastDate !== previousLastDate &&
                    lastParsed &&
                    lastParsed >= sevenDaysAgo &&
                    (!previousParsed || lastParsed > previousParsed);
                  if (isNewEpisode) addEntry();
                }
              }

              cache[series.id] = {
                lastEpDate: lastDate,
                nextEpDate: data.next_episode_to_air?.air_date || null,
                checkedAt: now,
              };
            } catch {}
          }),
        );
        if (index + batchSize < toCheck.length && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }

      if (cancelled) return;
      storage.set(STORAGE_KEYS.EPISODE_RELEASE_CACHE, cache);
      if (newEpisodeEntries.length === 0) {
        setEpisodeCheckStatus("none");
        episodeDismissTimerRef.current = setTimeout(() => {
          if (!cancelled) setEpisodeCheckStatus(null);
        }, 2000);
        return;
      }

      setEpisodeCheckStatus({ entries: newEpisodeEntries });
      if (window.electron?.showNotification) {
        const names = newEpisodeEntries.map((entry) => entry.title);
        const body =
          names.length === 1
            ? `${names[0]} has a new episode.`
            : `${names.slice(0, 3).join(", ")}${
                names.length > 3 ? ` and ${names.length - 3} more` : ""
              } have new episodes.`;
        window.electron.showNotification({
          title: "New episodes available",
          body,
          silent: false,
        });
      }
    }

    checkNewEpisodes().catch(() => {
      if (!cancelled) setEpisodeCheckStatus(null);
    });
    return () => {
      cancelled = true;
      clearTimeout(episodeDismissTimerRef.current);
    };
  }, [apiKeyLoaded]);

  return {
    episodeCheckStatus,
    episodeDismissTimerRef,
    setEpisodeCheckStatus,
  };
}
