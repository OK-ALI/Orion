import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import {
  EPISODE_GROUP_IDS,
  applyEpisodeMapping,
  buildEpisodeGroupMap,
} from "../../../shared/utils/episodeMappings";
import {
  tmdbFetch,
  imgUrl,
  PLAYER_SOURCES,
  getSourceUrl,
  sourceSupportsProgress,
  sourceProgressViaFrames,
  sourceIsAsync,
  fetchAnilistData,
  fetchEpisodeGroup,
  buildAnilistSeasons,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
  getNextNonAsyncSource,
} from "../../../services/tmdb";
import {
  BookmarkIcon,
  BookmarkFillIcon,
  BackIcon,
  StarIcon,
  PlayIcon,
  TVIcon,
  DownloadIcon,
  WatchedIcon,
  TrailerIcon,
  RatingShieldIcon,
  RatingLockIcon,
  SourceIcon,
  ShieldBlockIcon,
  PopOutIcon,
  MiniPlayerIcon,
} from "../../../components/common/Icons";
import { setupAmbientGlow } from "../../../shared/utils/playerAmbient";
import DownloadModal from "../../../components/DownloadModal";
import TrailerModal from "../../../components/TrailerModal";
import BlockedStatsModal from "../../../components/BlockedStatsModal";
import { formatDate } from "../../../shared/utils/date";
import { useBlockedStats } from "../../../shared/utils/useBlockedStats";
import {
  storage,
  STORAGE_KEYS,
  getFailoverSource,
  setFailoverSource,
  clearFailoverSource,
} from "../../../services/settingsStore";
import { useAutoplay } from "../../../shared/utils/useAutoplay";
import { fetchAniSkipTimings } from "../../../shared/utils/aniSkip";
import {
  fetchTVRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../../../shared/utils/ageRating";

export function useTVEpisodeActions(context) {
  const { autoplayDoneRef, currentSeasonEpisodes, d, downloadsByEpisodeKey, item, localCountdownStartedRef, onGoToDownloads, onHistory, playing, resetAutoplayRef, resolveError, resolvingUrl, restricted, selectedEp, selectedSeason, setCountdownStartedRef, setPendingEpToPlay, setResumeTime, setShowDownload, setShowResumePrompt, showFailoverPrompt, startPlayingEp, triggerAutoplayRef, webviewLoading } = context;
const playEpisode = useCallback(
    (ep) => {
      const epProgressKey = `tv_${item.id}_s${selectedSeason}e${ep.episode_number}`;
      const savedTime = storage.get("dlTime_" + epProgressKey) || 0;
      if (savedTime > 15) {
        setResumeTime(savedTime);
        setPendingEpToPlay(ep);
        setShowResumePrompt(true);
      } else {
        startPlayingEp(ep, 0);
      }
    },
    [item.id, selectedSeason, d, onHistory]
  );
  useEffect(() => {
    if (item.autoplay && currentSeasonEpisodes.length > 0 && !autoplayDoneRef.current) {
      autoplayDoneRef.current = true;
      // Locate target episode
      const targetEpNum = item.episode ? Number(item.episode) : 1;
      const ep = currentSeasonEpisodes.find((e) => e.episode_number === targetEpNum) || currentSeasonEpisodes[0];
      if (ep) {
        if (Number(item.handoffTime) > 0) startPlayingEp(ep, Number(item.handoffTime));
        else playEpisode(ep);
      }
    }
  }, [item.autoplay, item.handoffTime, currentSeasonEpisodes, playEpisode, startPlayingEp]);

  const startEpisodeDownload = useCallback(
    (ep) => {
      const existing = downloadsByEpisodeKey.get(
        `s${selectedSeason}e${ep.episode_number}`,
      );
      if (existing) {
        onGoToDownloads?.(existing.id);
        return;
      }
      startPlayingEp(ep, 0);
      setShowDownload(true);
    },
    [downloadsByEpisodeKey, onGoToDownloads, selectedSeason],
  );

  const startSeasonDownload = useCallback(() => {
    const firstPending =
      currentSeasonEpisodes.find(
        (ep) =>
          !downloadsByEpisodeKey.has(`s${selectedSeason}e${ep.episode_number}`),
      ) || currentSeasonEpisodes[0];
    if (!firstPending) return;
    startEpisodeDownload(firstPending);
  }, [
    currentSeasonEpisodes,
    downloadsByEpisodeKey,
    selectedSeason,
    startEpisodeDownload,
  ]);

  const nextEp = useMemo(() => {
    if (!selectedEp || !currentSeasonEpisodes) return null;
    const idx = currentSeasonEpisodes.findIndex(
      (e) => e.episode_number === selectedEp.episode_number,
    );
    if (idx >= 0 && idx < currentSeasonEpisodes.length - 1) {
      return currentSeasonEpisodes[idx + 1];
    }
    return null;
  }, [selectedEp, currentSeasonEpisodes]);

  const prevEp = useMemo(() => {
    if (!selectedEp || !currentSeasonEpisodes) return null;
    const idx = currentSeasonEpisodes.findIndex(
      (e) => e.episode_number === selectedEp.episode_number,
    );
    if (idx > 0) return currentSeasonEpisodes[idx - 1];
    return null;
  }, [selectedEp, currentSeasonEpisodes]);

  const {
    autoplayCountdown,
    countdownStarted,
    setCountdownStarted,
    triggerAutoplay,
    cancelAutoplay,
    playNow,
    resetAutoplay,
  } = useAutoplay({ nextEp, playEpisode, restricted });

  useEffect(() => {
    resetAutoplayRef.current = resetAutoplay;
    triggerAutoplayRef.current = triggerAutoplay;
    setCountdownStartedRef.current = setCountdownStarted;
  }, [resetAutoplay, triggerAutoplay, setCountdownStarted]);

  useEffect(() => {
    localCountdownStartedRef.current = countdownStarted;
  }, [countdownStarted]);

  const autoplayNextLayout =
    storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_LAYOUT) || "right";

  const sourceHealth = resolveError
    ? "Failed"
    : showFailoverPrompt
      ? "Slow"
      : webviewLoading || resolvingUrl
        ? "Loading"
        : playing
          ? "Playing"
          : "Ready";
  return { autoplayCountdown, autoplayNextLayout, cancelAutoplay, nextEp, playEpisode, playNow, prevEp, sourceHealth, startEpisodeDownload, startSeasonDownload };
}
