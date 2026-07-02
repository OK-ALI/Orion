import { useState, useEffect, useRef, useCallback, memo } from "react";
import { imgUrl, isAnimeContent } from "../../services/tmdb";
import { formatDate } from "../../shared/utils/date";
import {
  PlayIcon,
  FilmIcon,
  TVIcon,
  WatchedIcon,
  RatingShieldIcon,
  RatingLockIcon,
} from "../common/Icons";

const MediaCard = memo(function MediaCard({
  item,
  onClick,
  progress,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  ageRating,
  restricted,
}) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const isTV = item.media_type === "tv";
  const isAnime = isAnimeContent(item);

  // Unreleased detection
  const rawDate = item.release_date || item.first_air_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isUnreleased = rawDate ? new Date(rawDate) > today : false;

  const watchedKey = isTV
    ? item.season != null && item.episode != null
      ? `tv_${item.id}_s${item.season}e${item.episode}`
      : `tv_${item.id}`
    : `movie_${item.id}`;

  const isWatched = !!watched?.[watchedKey];

  // Context menu state
  const [menu, setMenu] = useState(null); // { x, y }
  const menuRef = useRef(null);

  const canMarkWatched = !isTV || (item.season != null && item.episode != null);

  const openMenu = useCallback(
    (e) => {
      if (!canMarkWatched) return;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY });
    },
    [canMarkWatched],
  );

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  const handleMarkWatched = (e) => {
    e.stopPropagation();
    onMarkWatched?.(watchedKey);
    setMenu(null);
  };
  const handleMarkUnwatched = (e) => {
    e.stopPropagation();
    onMarkUnwatched?.(watchedKey);
    setMenu(null);
  };

  const handlePlayClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onClick) {
      onClick({ ...item, autoplay: true });
    }
  };

  return (
    <>
      <div
        className={`media-card${isWatched ? " watched" : ""}${isUnreleased ? " unreleased" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Open ${title}`}
        onClick={() => {
          if (onClick) onClick(item);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onClick?.(item);
        }}
        onContextMenu={isUnreleased ? undefined : openMenu}
      >
        <div className="media-card-poster">
          {item.poster_path ? (
            <img
              src={imgUrl(item.poster_path, "w342")}
              alt={title}
              loading="lazy"
            />
          ) : (
            <div className="media-card-placeholder">
              {isTV ? <TVIcon size={32} /> : <FilmIcon size={32} />}
              <span>No Image</span>
            </div>
          )}
          {ageRating && (
            <div
              className={`media-card-age-badge${restricted ? " restricted" : ""}`}
            >
              {restricted ? (
                <RatingLockIcon size={10} />
              ) : (
                <RatingShieldIcon size={10} />
              )}
              {ageRating}
            </div>
          )}

          <div className="media-card-overlay">
            {isUnreleased ? (
              <div className="media-card-unreleased-overlay">
                <span>🔒 Soon</span>
              </div>
            ) : (
              <div className="media-card-play-btn" onClick={handlePlayClick}>
                <PlayIcon size={24} />
              </div>
            )}
          </div>
          {!isUnreleased && progress > 0 && !isWatched && (
            <div className="media-card-progress-bar">
              <div
                className="media-card-progress-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
          {!isUnreleased && isWatched && (
            <div className="media-card-watched-badge">
              <WatchedIcon size={24} />
            </div>
          )}
        </div>
        <div className="media-card-info">
          <div className="media-card-title" title={title}>
            {title}
          </div>
          <div className="media-card-meta">
            {isTV && item.season != null && item.episode != null
              ? `S${item.season}E${item.episode}${item.episodeName ? ` · ${item.episodeName}` : ""}`
              : `${formatDate(item.release_date || item.first_air_date)} · ${isTV ? "Series" : "Movie"}`}
          </div>
        </div>
        <span
          className={`media-card-type-badge${isUnreleased ? " soon" : isAnime ? " anime" : isTV ? " tv" : ""}`}
        >
          {isUnreleased ? "SOON" : isAnime ? "ANIME" : isTV ? "TV" : "HD"}
        </span>
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {isWatched ? (
            <button className="context-menu-item" onClick={handleMarkUnwatched}>
              ↩ Mark as Unwatched
            </button>
          ) : (
            <button className="context-menu-item" onClick={handleMarkWatched}>
              ✓ Mark as Watched
            </button>
          )}
        </div>
      )}
    </>
  );
});

export default MediaCard;
