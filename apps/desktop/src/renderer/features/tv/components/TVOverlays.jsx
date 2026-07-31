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

export default function TVOverlays({ model }) {
  const { blockedAlltime, blockedSession, d, downloaderFolder, epMenu, getBlockedDomains, handleSetDownloaderFolder, interceptedSubs, isSeasonWatched, item, m3u8Context, m3u8Url, markSeasonUnwatched, markSeasonWatched, mediaName, onDownloadStarted, onMarkUnwatched, onMarkWatched, onSettings, pendingEpToPlay, progress, resumeTime, saveProgress, seasonMenu, selectedEp, selectedSeason, setEpMenu, setSeasonMenu, setShowBlockedModal, setShowDownload, setShowResumePrompt, setShowTrailer, showBlockedModal, showDownload, showResumePrompt, showTrailer, startPlayingEp, title, trailerKey, watched } = model;
  return (
<>
{showTrailer && trailerKey && (
        <TrailerModal
          trailerKey={trailerKey}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}
{showResumePrompt && pendingEpToPlay && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="resume-prompt-modal">
            <h2>Resume Playback?</h2>
            <p>You watched this episode previously. Would you like to continue where you left off?</p>
            <div className="resume-time-display">
              Resume Season {selectedSeason} E{pendingEpToPlay.episode_number} from {
                (() => {
                  const m = Math.floor(resumeTime / 60);
                  const s = Math.floor(resumeTime % 60);
                  return `${m}:${String(s).padStart(2, "0")}`;
                })()
              }
            </div>
            <div className="resume-prompt-actions">
              <button className="btn btn-primary" onClick={() => startPlayingEp(pendingEpToPlay, resumeTime)}>
                Resume Playback
              </button>
              {resumeTime > 45 && (
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    startPlayingEp(pendingEpToPlay, Math.max(0, resumeTime - 30))
                  }
                >
                  Replay Last 30s
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => startPlayingEp(pendingEpToPlay, 0)}>
                Start Over
              </button>
              <button className="btn btn-ghost" onClick={() => setShowResumePrompt(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
{epMenu && (
        <ContextMenu
          x={epMenu.x}
          y={epMenu.y}
          isWatched={!!watched?.[epMenu.pk]}
          hasProgress={(progress?.[epMenu.pk] ?? 0) > 0}
          watchedLabel="Mark as Watched"
          unwatchedLabel="Mark as Unwatched"
          onMarkWatched={() => onMarkWatched?.(epMenu.pk)}
          onMarkUnwatched={() => onMarkUnwatched?.(epMenu.pk)}
          onMarkNotStarted={() => {
            onMarkUnwatched?.(epMenu.pk);
            saveProgress?.(epMenu.pk, 0);
            storage.set("dlTime_" + epMenu.pk, null);
          }}
          onClose={() => setEpMenu(null)}
        />
      )}
{seasonMenu && (
        <ContextMenu
          x={seasonMenu.x}
          y={seasonMenu.y}
          isWatched={isSeasonWatched(seasonMenu.seasonNum)}
          watchedLabel="Mark Season as Watched"
          unwatchedLabel="Mark Season as Unwatched"
          onMarkWatched={() => markSeasonWatched(seasonMenu.seasonNum)}
          onMarkUnwatched={() => markSeasonUnwatched(seasonMenu.seasonNum)}
          onClose={() => setSeasonMenu(null)}
        />
      )}
{showBlockedModal && (
        <BlockedStatsModal
          sessionDomains={getBlockedDomains()}
          sessionTotal={blockedSession}
          alltimeTotal={blockedAlltime}
          onClose={() => setShowBlockedModal(false)}
        />
      )}
{showDownload && (
        <DownloadModal
          onClose={() => setShowDownload(false)}
          captureSessionId={model.captureSessionId}
          m3u8Url={m3u8Url}
          m3u8Context={m3u8Context}
          subtitles={interceptedSubs}
          mediaName={mediaName}
          downloaderFolder={downloaderFolder}
          setDownloaderFolder={handleSetDownloaderFolder}
          onOpenSettings={onSettings}
          onDownloadStarted={onDownloadStarted}
          mediaId={item.id}
          mediaType="tv"
          season={selectedSeason}
          episode={selectedEp?.episode_number}
          posterPath={d.poster_path}
          tmdbId={item.id}
        />
      )}
</>
  );
}
