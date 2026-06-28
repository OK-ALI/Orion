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
import { ContextMenu, EpisodeDesc, PartialCircleIcon, VoiceBoostIcon } from "./EpisodeUi";
import EpisodeCard from "./EpisodeCard";

export default function TVEpisodes({ model }) {
  const { currentSeasonEpisodes, downloadsByEpisodeKey, episodeGroupCurrentEpisodes, item, loadingSeason, onGoToDownloads, playEpisode, playing, progress, restricted, seasonData, seasonWatchedMap, seasons, selectedEp, selectedSeason, setEpMenu, setSeasonMenu, setSelectedSeason, startEpisodeDownload, startSeasonDownload, watched } = model;
  return (
<div className="section">
            <div className="section-title">Episodes</div>
            {seasons.length > 0 && (
              <div className="season-toolbar">
              <div className="season-selector">
                {seasons.map((s) => {
                  const sw = seasonWatchedMap[s.season_number] ?? "none";
                  return (
                    <button
                      key={s.season_number}
                      className={`season-btn ${selectedSeason === s.season_number ? "active" : ""} ${sw === "all" ? "season-watched" : sw.startsWith("some") ? "season-partial" : ""}`}
                      onClick={() => setSelectedSeason(s.season_number)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSeasonMenu({
                          x: e.clientX,
                          y: e.clientY,
                          seasonNum: s.season_number,
                        });
                      }}
                      title="Right-click to mark season as watched/unwatched"
                    >
                      {sw === "all" && (
                        <span className="season-watched-icon">✓</span>
                      )}
                      {sw === "some25" && <PartialCircleIcon pct={25} />}
                      {sw === "some50" && <PartialCircleIcon pct={50} />}
                      {sw === "some75" && <PartialCircleIcon pct={75} />}
                      {s.season_number === 0
                        ? "Specials"
                        : `Season ${s.season_number}`}
                    </button>
                  );
                })}
              </div>
              {!restricted && currentSeasonEpisodes.length > 0 && (
                <button
                  className="btn btn-secondary season-download-btn"
                  onClick={startSeasonDownload}
                  title="Starts download capture for the first episode in this season that is not already downloaded."
                >
                  <DownloadIcon /> Download Season
                </button>
              )}
              </div>
            )}
            {selectedSeason === 0 && !loadingSeason && (
              <div
                style={{
                  margin: "8px 0",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(255,200,50,0.08)",
                  border: "1px solid rgba(255,200,50,0.2)",
                  fontSize: 12,
                  color: "var(--text3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>
                  Specials support varies by provider. If the wrong episode
                  plays, try switching to a different source. But it can't be
                  guaranteed that the correct Episode will be available.
                </span>
              </div>
            )}
            {loadingSeason && (
              <div className="loader">
                <div className="spinner" />
              </div>
            )}
            {!loadingSeason &&
              (seasonData?.episodes || episodeGroupCurrentEpisodes?.length) && (
                <div className="episodes-grid">
                  {currentSeasonEpisodes.map((ep) => {
                    const pk = `tv_${item.id}_s${selectedSeason}e${ep.episode_number}`;
                    return (
                      <EpisodeCard
                        key={ep.episode_number}
                        ep={ep}
                        itemId={item.id}
                        selectedSeason={selectedSeason}
                        epPct={progress[pk] || 0}
                        epWatched={!!watched?.[pk]}
                        playing={playing}
                        selectedEpNumber={selectedEp?.episode_number}
                        downloadsByEpisodeKey={downloadsByEpisodeKey}
                        restricted={restricted}
                        onPlay={playEpisode}
                        onDownload={startEpisodeDownload}
                        onContextMenu={setEpMenu}
                        onGoToDownloads={onGoToDownloads}
                      />
                    );
                  })}
                </div>
              )}
          </div>
  );
}
