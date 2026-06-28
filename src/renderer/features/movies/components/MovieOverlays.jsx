import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
import {
  tmdbFetch,
  imgUrl,
  PLAYER_SOURCES,
  getSourceUrl,
  sourceSupportsProgress,
  sourceProgressViaFrames,
  sourceIsAsync,
  fetchAnilistData,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
  getNextNonAsyncSource,
} from "../../../services/tmdb";
import {
  PlayIcon,
  BookmarkIcon,
  BookmarkFillIcon,
  BackIcon,
  StarIcon,
  FilmIcon,
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
import DownloadModal from "../../../components/DownloadModal";
import TrailerModal from "../../../components/TrailerModal";
import BlockedStatsModal from "../../../components/BlockedStatsModal";
import { formatDate } from "../../../shared/utils/date";
import { useBlockedStats } from "../../../shared/utils/useBlockedStats";
import MediaCard from "../../../components/media/MediaCard";
import CollectionCard from "./CollectionCard";
import { setupAmbientGlow } from "../../../shared/utils/playerAmbient";
import {
  storage,
  STORAGE_KEYS,
  getFailoverSource,
  setFailoverSource,
  clearFailoverSource,
} from "../../../services/settingsStore";
import {
  fetchMovieRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../../../shared/utils/ageRating";

export default function MovieOverlays({ model }) {
  const { blockedAlltime, blockedSession, collection, d, downloaderFolder, formatResumeTime, getBlockedDomains, handleSetDownloaderFolder, interceptedSubs, item, m3u8Context, m3u8Url, mediaName, onDownloadStarted, onMarkUnwatched, onMarkWatched, onSelect, onSettings, progress, resumeTime, setShowBlockedModal, setShowDownload, setShowResumePrompt, setShowTrailer, showBlockedModal, showDownload, showResumePrompt, showTrailer, startMoviePlayback, title, trailerKey, watched } = model;
  return (
<>
{collection && onSelect && (
        <div className="section">
          <div className="section-title">{collection.name}</div>
          <div className="scroll-row">
            {collection.parts.map((part) => {
              const pk = `movie_${part.id}`;
              const isCurrent = part.id === item.id;
              return (
                <CollectionCard
                  key={part.id}
                  part={part}
                  pk={pk}
                  isCurrent={isCurrent}
                  onSelect={onSelect}
                  progress={progress[pk] || 0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                />
              );
            })}
          </div>
        </div>
      )}
{showTrailer && trailerKey && (
        <TrailerModal
          trailerKey={trailerKey}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}
{showResumePrompt && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="resume-prompt-modal">
            <h2>Resume Playback?</h2>
            <p>
              You watched this movie previously. Continue where you left off or
              start from the beginning.
            </p>
            <div className="resume-time-display">
              Resume {title} from {formatResumeTime(resumeTime)}
            </div>
            <div className="resume-prompt-actions">
              <button
                className="btn btn-primary"
                onClick={() => startMoviePlayback(resumeTime)}
              >
                Resume Playback
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => startMoviePlayback(0)}
              >
                Start Over
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowResumePrompt(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
          mediaType="movie"
          posterPath={d.poster_path}
          tmdbId={item.id}
        />
      )}
</>
  );
}
