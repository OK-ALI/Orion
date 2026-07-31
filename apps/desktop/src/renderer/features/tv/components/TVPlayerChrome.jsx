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

export default function TVPlayerChrome({ model }) {
  const { currentProgressKey, durationRef, progress, saveProgress, skipTimings } = model;
  return (
<>
{currentProgressKey &&
                (() => {
                  const epPct = progress[currentProgressKey] || 0;
                  const dur = durationRef.current;
                  const hasMarkers =
                    dur > 0 && (skipTimings?.intro || skipTimings?.outro);
                  return epPct > 0 || hasMarkers ? (
                    <div className="progress-bar-row">
                      <div
                        className="progress-bar-outer"
                        style={{ position: "relative" }}
                      >
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${Math.min(epPct, 100)}%` }}
                        />
                        {/* AniSkip intro/outro markers */}
                        {dur > 0 && skipTimings?.intro && (
                          <div
                            title="Intro"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: `${(skipTimings.intro.startTime / dur) * 100}%`,
                              width: `${((skipTimings.intro.endTime - skipTimings.intro.startTime) / dur) * 100}%`,
                              height: "100%",
                              background: "rgba(251,191,36,0.75)",
                              borderRadius: 2,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                        {dur > 0 && skipTimings?.outro && (
                          <div
                            title="Outro"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: `${(skipTimings.outro.startTime / dur) * 100}%`,
                              width: `${((skipTimings.outro.endTime - skipTimings.outro.startTime) / dur) * 100}%`,
                              height: "100%",
                              background: "rgba(251,191,36,0.75)",
                              borderRadius: 2,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text3)" }}>
                        {epPct > 0 ? `${epPct.toFixed(0)}% watched` : ""}
                      </span>
                    </div>
                  ) : null;
                })()}
{currentProgressKey && (
                <div className="progress-mark-row">
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text3)",
                      marginRight: 4,
                    }}
                  >
                    Mark progress:
                  </span>
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      className="btn btn-ghost"
                      style={{ padding: "5px 14px", fontSize: 12 }}
                      onClick={() => saveProgress(currentProgressKey, p)}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              )}
</>
  );
}
