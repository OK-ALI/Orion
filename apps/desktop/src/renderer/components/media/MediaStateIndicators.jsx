import { BookmarkFillIcon, WatchedIcon } from "../common/Icons";

function getStateLabel(inMyList, watched) {
  if (inMyList && watched) return "In My List, Watched";
  if (inMyList) return "In My List";
  if (watched) return "Watched";
  return "";
}

export default function MediaStateIndicators({
  inMyList = false,
  watched = false,
  variant = "poster",
  className = "",
}) {
  if (!inMyList && !watched) return null;

  const label = getStateLabel(inMyList, watched);
  const rootClass = `media-state-indicators media-state-indicators--${variant}${className ? ` ${className}` : ""}`;
  const iconSize = variant === "inline" ? 16 : 24;
  const bookmarkSize = variant === "inline" ? 14 : 17;

  if (variant === "inline") {
    return (
      <span className={rootClass} aria-label={label} title={label}>
        {inMyList && (
          <span className="media-state-indicator media-state-indicator--saved" data-media-state="saved">
            <BookmarkFillIcon size={bookmarkSize} aria-hidden="true" />
          </span>
        )}
        {watched && (
          <span className="media-state-indicator media-state-indicator--watched" data-media-state="watched">
            <WatchedIcon size={iconSize} aria-hidden="true" />
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={rootClass} aria-label={label} title={label}>
      <span className="media-state-indicator-slot media-state-indicator-slot--saved">
        {inMyList && (
          <span className="media-state-indicator media-state-indicator--saved" data-media-state="saved">
            <BookmarkFillIcon size={bookmarkSize} aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="media-state-indicator-slot media-state-indicator-slot--watched">
        {watched && (
          <span className="media-state-indicator media-state-indicator--watched" data-media-state="watched">
            <WatchedIcon size={iconSize} aria-hidden="true" />
          </span>
        )}
      </span>
    </span>
  );
}
