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

export default function MovieDetails({ model }) {
  const { d, displayGenres, displayOverview, displayPct, displayScore, handlePlay, hasProgress, isSaved, isUnreleased, isWatched, movieDownload, onBack, onGoToDownloads, onMarkUnwatched, onMarkWatched, onSave, playing, progressKey, progressLabel, rating, restricted, saveProgress, setShowDownload, setShowTrailer, title, trailerKey } = model;
  return (
<div className="detail-hero">
        <div
          className="detail-bg"
          style={{
            backgroundImage: `url(${imgUrl(d.backdrop_path, "w1280")})`,
          }}
        />
        <div className="detail-gradient" />
        <div className="detail-content">
          <div className="detail-poster" style={{ position: "relative" }}>
            {d.poster_path ? (
              <img src={imgUrl(d.poster_path)} alt={title} loading="lazy" />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text3)",
                }}
              >
                <FilmIcon />
              </div>
            )}
            {isWatched && (
              <div className="detail-watched-badge">
                <WatchedIcon size={36} />
              </div>
            )}
          </div>
          <div className="detail-info">
            <div className="detail-type">Movie</div>
            <div className="detail-title">{title}</div>
            <div className="genres">
              {displayGenres.map((g) => (
                <span key={g.id} className="genre-tag">
                  {g.name}
                </span>
              ))}
            </div>
            <div className="detail-meta">
              {displayScore && (
                <span className="detail-rating">
                  <StarIcon /> {displayScore}
                </span>
              )}
              {d.release_date && <span>{formatDate(d.release_date)}</span>}
              {d.runtime && <span>{d.runtime} min</span>}
              {d.original_language && (
                <span>{d.original_language?.toUpperCase()}</span>
              )}
            </div>
            {rating.cert && (
              <div
                className={`age-rating-pill${restricted ? " age-rating-pill--restricted" : ""}`}
              >
                {restricted ? (
                  <RatingLockIcon size={13} />
                ) : (
                  <RatingShieldIcon size={13} />
                )}
                <span className="age-rating-pill-cert">{rating.cert}</span>
                {restricted && (
                  <span className="age-rating-pill-label">
                    Inappropriate for your age setting
                  </span>
                )}
              </div>
            )}
            <p className="detail-overview">{displayOverview}</p>
            {!isWatched && displayPct > 0 && (
              <div className="progress-bar-row" style={{ marginBottom: 12 }}>
                <div className="progress-bar-outer">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(displayPct, 100)}%` }}
                  />
                </div>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {progressLabel}
                </span>
              </div>
            )}
            <div className="detail-actions">
              {isUnreleased ? (
                <button
                  className="btn btn-primary btn-restricted"
                  disabled
                  title="This movie has not been released yet"
                >
                  🔒 Unreleased
                </button>
              ) : restricted ? (
                <button
                  className="btn btn-primary btn-restricted"
                  disabled
                  title="Inappropriate for your age rating setting"
                >
                  🔒 Restricted
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handlePlay}>
                  <PlayIcon /> {playing ? "Restart" : "Play"}
                </button>
              )}
              {trailerKey &&
                (restricted ? (
                  <button
                    className="btn btn-secondary btn-restricted"
                    disabled
                    title="Inappropriate for your age rating setting"
                  >
                    🔒 Trailer
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowTrailer(true)}
                  >
                    <TrailerIcon /> Trailer
                  </button>
                ))}
              <button className="btn btn-secondary" onClick={onSave}>
                {isSaved ? <BookmarkFillIcon /> : <BookmarkIcon />}
                {isSaved ? "Saved" : "Save"}
              </button>
              {!isUnreleased && !restricted && (
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    movieDownload
                      ? onGoToDownloads?.(movieDownload.id)
                      : setShowDownload(true)
                  }
                  title={
                    movieDownload
                      ? movieDownload.status === "downloading"
                        ? "Downloading - view in Downloads"
                        : "Already downloaded - view in Downloads"
                      : "Download this movie"
                  }
                >
                  <DownloadIcon />
                  {movieDownload
                    ? movieDownload.status === "downloading"
                      ? "Downloading"
                      : "Downloaded"
                    : "Download"}
                </button>
              )}
              {!isUnreleased &&
                (isWatched ? (
                  <button
                    className="btn btn-ghost watched-btn"
                    onClick={() => onMarkUnwatched?.(progressKey)}
                  >
                    <WatchedIcon size={16} /> Watched
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={() => onMarkWatched?.(progressKey)}
                    >
                      ✓ Mark Watched
                    </button>
                    {hasProgress && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 13 }}
                        onClick={() => {
                          saveProgress(progressKey, 0);
                          storage.set("dlTime_" + progressKey, null);
                        }}
                      >
                        ⊘ Not Started
                      </button>
                    )}
                  </>
                ))}
              <button className="btn btn-ghost" onClick={onBack}>
                <BackIcon /> Back
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}
