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

export function useTVEpisodeCatalog(context) {
  const { anilistData, anilistLoading, anilistSeasons, d, downloads, episodeGroupData, episodeGroupMap, failedSeasons, isAnime, item, onMarkUnwatched, onMarkWatched, seasonData, selectedEp, selectedSeason, setSelectedEp, watched } = context;
const tmdbSeasons = useMemo(
    () => (d.seasons || []).filter((s) => s.season_number > 0),
    [d.seasons],
  );
  // tmdbSeasonsWithSpecials includes season 0 for display purposes.
  // Excluded for anime: AllManga
  const tmdbSeasonsWithSpecials = useMemo(() => {
    if (isAnime) return tmdbSeasons;
    if (failedSeasons.has(0)) return tmdbSeasons;
    const specials = (d.seasons || []).filter((s) => s.season_number === 0);
    return [...tmdbSeasons, ...specials];
  }, [d.seasons, tmdbSeasons, isAnime, failedSeasons]);
  const useAnilistSeasons = useMemo(
    () =>
      isAnime &&
      anilistSeasons?.length > 0 &&
      (tmdbSeasons.length <= 1 || anilistSeasons.length > tmdbSeasons.length),
    [isAnime, anilistSeasons, tmdbSeasons],
  );

  // Episode-group virtual seasons (highest priority, e.g. Netflix order)
  const episodeGroupSeasons = useMemo(() => {
    if (!episodeGroupData?.groups) return null;
    return [...episodeGroupData.groups]
      .sort((a, b) => a.order - b.order)
      .map((g, i) => ({
        season_number: i + 1,
        name: g.name || `Season ${i + 1}`,
        episode_count: (g.episodes || []).length,
      }));
  }, [episodeGroupData]);

  const seasons = useMemo(() => {
    if (episodeGroupSeasons) return episodeGroupSeasons;
    if (useAnilistSeasons)
      return anilistSeasons.map((s) => ({
        season_number: s.seasonNum,
        name: s.title || `Season ${s.seasonNum}`,
        episode_count: s.episodes || 0,
      }));
    return tmdbSeasonsWithSpecials;
  }, [
    episodeGroupSeasons,
    useAnilistSeasons,
    anilistSeasons,
    tmdbSeasonsWithSpecials,
  ]);

  // Episodes for the currently selected season from episode group
  const episodeGroupCurrentEpisodes = useMemo(() => {
    if (!episodeGroupData?.groups) return null;
    const sortedGroups = [...episodeGroupData.groups].sort(
      (a, b) => a.order - b.order,
    );
    const group = sortedGroups[selectedSeason - 1];
    if (!group) return null;
    return [...(group.episodes || [])]
      .sort((a, b) => a.order - b.order)
      .map((ep, i) => ({
        ...ep,
        episode_number: i + 1, // display number within this group-season
        _tmdbSeason: ep.season_number, // real TMDB season for player mapping
        _tmdbAbsolute: ep.episode_number, // real TMDB episode for player mapping
      }));
  }, [episodeGroupData, selectedSeason]);

  // ── Episode slice (AniList virtual seasons only) ───────────────────────────
  const getSeasonEpisodes = useCallback(
    (rawEpisodes) => {
      if (!useAnilistSeasons || !rawEpisodes) return rawEpisodes;
      if (tmdbSeasons.length > 1) return rawEpisodes;
      let offset = 0;
      for (const s of anilistSeasons) {
        if (s.seasonNum < selectedSeason) offset += s.episodes || 0;
      }
      const count =
        anilistSeasons.find((s) => s.seasonNum === selectedSeason)?.episodes ||
        rawEpisodes.length;
      return rawEpisodes.slice(offset, offset + count).map((ep, i) => ({
        ...ep,
        episode_number: i + 1,
        _tmdbAbsolute: ep.episode_number,
      }));
    },
    [useAnilistSeasons, tmdbSeasons.length, anilistSeasons, selectedSeason],
  );

  // ── Player episode mapping
  const playerEp = useMemo(() => {
    if (!selectedEp) return { season: selectedSeason, episode: undefined };
    // In episode-group mode: use the real TMDB season/episode stored on the ep
    const rawSeason = selectedEp._tmdbSeason ?? selectedSeason;
    const rawEpisode = selectedEp._tmdbAbsolute ?? selectedEp.episode_number;
    return applyEpisodeMapping(item.id, rawSeason, rawEpisode, episodeGroupMap);
  }, [selectedEp, selectedSeason, item.id, episodeGroupMap]);

  // ── Memoized current season episodes ──────────────────────────────────────
  // While episode group or AniList data is still loading, return [] to prevent
  // a flash of wrong TMDB episodes before the correct data arrives.
  const episodeGroupPending = useMemo(
    () => !!EPISODE_GROUP_IDS[Number(item.id)] && !episodeGroupData,
    [item.id, episodeGroupData],
  );
  const currentSeasonEpisodes = useMemo(() => {
    if (episodeGroupPending) return [];
    if (anilistLoading) return [];
    return (
      episodeGroupCurrentEpisodes ||
      getSeasonEpisodes(seasonData?.episodes) ||
      []
    );
  }, [
    episodeGroupPending,
    anilistLoading,
    episodeGroupCurrentEpisodes,
    getSeasonEpisodes,
    seasonData,
  ]);

  // Auto-select specific episode when navigating from "Continue Watching" / history.
  // Key includes item.id + item.episode so the ref resets whenever the target changes.
  const autoSelectKeyRef = useRef(null);
  useEffect(() => {
    if (!item.episode || currentSeasonEpisodes.length === 0) return;
    const key = `${item.id}_e${item.episode}`;
    if (autoSelectKeyRef.current === key) return; // already handled this target
    const target = Number(item.episode);
    const ep = currentSeasonEpisodes.find((e) => e.episode_number === target);
    if (ep) {
      autoSelectKeyRef.current = key;
      setSelectedEp(ep);
    }
  }, [item.id, item.episode, currentSeasonEpisodes]);

  // ── Downloads lookup map: O(1) per episode instead of O(n) ───────────────
  const downloadsByEpisodeKey = useMemo(() => {
    const map = new Map();
    for (const dl of downloads || []) {
      if (
        dl.mediaType === "tv" &&
        (dl.tmdbId === item.id || dl.mediaId === item.id) &&
        (dl.status === "completed" ||
          dl.status === "local" ||
          dl.status === "downloading")
      ) {
        map.set(`s${dl.season}e${dl.episode}`, dl);
      }
    }
    return map;
  }, [downloads, item.id]);

  // Prefer AniList metadata for anime when available
  const displaySeasonCount = useMemo(
    () => (anilistLoading ? null : seasons.length || d.number_of_seasons || 0),
    [anilistLoading, seasons, d.number_of_seasons],
  );
  const displayEpisodeCount = useMemo(
    () =>
      anilistLoading
        ? null
        : useAnilistSeasons
          ? anilistSeasons.reduce((sum, s) => sum + (s.episodes || 0), 0)
          : d.number_of_episodes || 0,
    [anilistLoading, useAnilistSeasons, anilistSeasons, d.number_of_episodes],
  );

  const displayOverview = useMemo(
    () =>
      anilistLoading
        ? null
        : isAnime && anilistData?.description
          ? cleanAnilistDescription(anilistData.description)
          : d.overview,
    [anilistLoading, isAnime, anilistData?.description, d.overview],
  );
  const displayScore = useMemo(
    () =>
      anilistLoading
        ? null
        : isAnime && anilistData?.averageScore
          ? (anilistData.averageScore / 10).toFixed(1)
          : d.vote_average > 0
            ? d.vote_average.toFixed(1)
            : null,
    [anilistLoading, isAnime, anilistData?.averageScore, d.vote_average],
  );
  const displayGenres = useMemo(
    () =>
      anilistLoading
        ? []
        : isAnime && anilistData?.genres?.length
          ? anilistData.genres.map((g, i) => ({ id: i, name: g }))
          : d.genres || [],
    [anilistLoading, isAnime, anilistData?.genres, d.genres],
  );

  // ── Season watched helpers ─────────────────────────────────────────────────
  // Memoized map: seasonNum → "all" | "some" | "none"
  // Recomputed only when watched/seasons change, not on every render.
  const seasonWatchedMap = useMemo(() => {
    const map = {};
    for (const s of seasons) {
      const num = s.season_number;
      const count =
        num === selectedSeason
          ? currentSeasonEpisodes.length || s.episode_count || 0
          : s.episode_count || 0;
      if (!count) {
        map[num] = "none";
        continue;
      }
      let watchedCount = 0;
      for (let i = 1; i <= count; i++) {
        if (watched?.[`tv_${item.id}_s${num}e${i}`]) watchedCount++;
      }
      if (watchedCount === 0) {
        map[num] = "none";
      } else if (watchedCount === count) {
        map[num] = "all";
      } else {
        const pct = watchedCount / count;
        map[num] = pct < 0.375 ? "some25" : pct < 0.625 ? "some50" : "some75";
      }
    }
    return map;
  }, [seasons, selectedSeason, currentSeasonEpisodes, watched, item.id]);

  const isSeasonWatched = useCallback(
    (seasonNum) => seasonWatchedMap[seasonNum] === "all",
    [seasonWatchedMap],
  );

  const markSeasonWatched = useCallback(
    (seasonNum) => {
      const seasonInfo = seasons.find((s) => s.season_number === seasonNum);
      const episodes =
        seasonNum === selectedSeason ? currentSeasonEpisodes : null;
      const count = episodes?.length || seasonInfo?.episode_count || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = 1; i <= count; i++) {
        if (episodes) {
          const ep = episodes.find((e) => e.episode_number === i);
          if (ep?.air_date && new Date(ep.air_date) > today) continue;
        }
        onMarkWatched?.(`tv_${item.id}_s${seasonNum}e${i}`);
      }
    },
    [seasons, selectedSeason, currentSeasonEpisodes, item.id, onMarkWatched],
  );

  const markSeasonUnwatched = useCallback(
    (seasonNum) => {
      const seasonInfo = seasons.find((s) => s.season_number === seasonNum);
      const episodes =
        seasonNum === selectedSeason ? currentSeasonEpisodes : null;
      const count = episodes?.length || seasonInfo?.episode_count || 0;
      for (let i = 1; i <= count; i++) {
        onMarkUnwatched?.(`tv_${item.id}_s${seasonNum}e${i}`);
      }
    },
    [seasons, selectedSeason, currentSeasonEpisodes, item.id, onMarkUnwatched],
  );
  return { currentSeasonEpisodes, displayEpisodeCount, displayGenres, displayOverview, displayScore, displaySeasonCount, downloadsByEpisodeKey, episodeGroupCurrentEpisodes, isSeasonWatched, markSeasonUnwatched, markSeasonWatched, playerEp, seasonWatchedMap, seasons, tmdbSeasons };
}
