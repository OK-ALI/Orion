import { useCallback, useMemo, useState, useEffect } from "react";
import MediaCard from "../components/media/MediaCard";
import { imgUrl } from "../utils/api";
import { EyeIcon, WatchedIcon } from "../components/common/Icons";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { storage, STORAGE_KEYS } from "../utils/storage";

export default function LibraryPage({
  history,
  inProgress,
  saved,
  progress,
  onSelect,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  onRemoveHistory,
  onReorderSaved,
}) {
  const allItems = useMemo(
    () => [...inProgress, ...saved],
    [inProgress, saved],
  );
  const { ratingsMap, ageLimitSetting } = useRatings(allItems);

  const [sort, setSort] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_SORT) || "manual",
  );
  const [activeTab, setActiveTab] = useState("all");
  useEffect(() => {
    const handler = (e) => setSort(e.detail);
    window.addEventListener("orion:library-sort-changed", handler);
    return () =>
      window.removeEventListener("orion:library-sort-changed", handler);
  }, []);

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...saved];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);

    const newOrderKeys = reordered.map((item) => `${item.media_type}_${item.id}`);

    if (onReorderSaved) {
      onReorderSaved(newOrderKeys);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const sortLabels = {
    manual: "Custom order",
    title: "A-Z",
    rating: "Top rated",
    year: "Newest first",
  };

  const tabs = [
    { id: "all", label: "All", count: inProgress.length + saved.length + history.length },
    { id: "continue", label: "Continue", count: inProgress.length },
    { id: "list", label: "My List", count: saved.length },
    { id: "history", label: "History", count: history.length },
  ];

  const getRating = useCallback(
    (item) => getRatingForItem(item, ratingsMap),
    [ratingsMap],
  );
  const itemRestricted = useCallback(
    (item) => isRestricted(getRating(item).minAge, ageLimitSetting),
    [getRating, ageLimitSetting],
  );

  return (
    <div className="fade-in">
      <div className="library-header">
        <div className="library-title">My Library</div>
        <div className="library-sub">
          Continue watching, saved titles, and recent history
        </div>
        <div className="library-tabs" role="tablist" aria-label="Library sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`library-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {(activeTab === "all" || activeTab === "continue") && inProgress.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">Continue Watching</div>
          <div className="cards-grid library-card-grid library-card-grid--compact">
            {inProgress.map((item, i) => {
              const pk =
                item.media_type === "movie"
                  ? `movie_${item.id}`
                  : `tv_${item.id}_s${item.season}e${item.episode}`;
              const r = getRating(item);
              const restr = itemRestricted(item);
              return (
                <MediaCard
                  key={pk}
                  item={item}
                  onClick={() => onSelect(item)}
                  progress={progress[pk] || 0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                  ageRating={r.cert}
                  restricted={restr}
                />
              );
            })}
          </div>
        </div>
      )}

      {(activeTab === "all" || activeTab === "list") && saved.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">
            My List ({saved.length})
            {sort !== "manual" && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--text3)",
                  marginLeft: 10,
                }}
              >
                {sortLabels[sort]}
              </span>
            )}
          </div>
          <div className="cards-grid library-card-grid">
            {saved.map((item, index) => {
              const r = getRating(item);
              const restr = itemRestricted(item);
              const itemId = `${item.media_type}_${item.id}`;
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              return (
                <div
                  key={itemId}
                  className={`watchlist-drag-card${isDragging ? " is-dragging" : ""}${isDragOver ? " drag-over" : ""}`}
                  draggable={sort === "manual"}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{ cursor: sort === "manual" ? "grab" : "default" }}
                >
                  <MediaCard
                    item={item}
                    onClick={() => onSelect(item)}
                    watched={watched}
                    onMarkWatched={onMarkWatched}
                    onMarkUnwatched={onMarkUnwatched}
                    ageRating={r.cert}
                    restricted={restr}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(activeTab === "all" || activeTab === "history") && history.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">Watch History</div>
          <div className="history-rows">
            {history.map((item, i) => {
              const pk =
                item.media_type === "movie"
                  ? `movie_${item.id}`
                  : `tv_${item.id}_s${item.season}e${item.episode}`;
              const isWatched = !!watched?.[pk];
              return (
                <div
                  key={`${pk}_${item.watchedAt}`}
                  className="history-row"
                  onClick={() => onSelect(item)}
                >
                  <div className="history-thumb">
                    {item.poster_path && (
                      <img src={imgUrl(item.poster_path, "w92")} alt="" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {item.title}
                      {isWatched && <WatchedIcon size={16} />}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>
                      {item.media_type === "tv" &&
                        item.season != null &&
                        item.episode != null && (
                          <>
                            {`S${item.season}E${item.episode}`}
                            {item.episodeName ? ` · ${item.episodeName}` : ""}
                            {" · "}
                          </>
                        )}
                      {new Date(item.watchedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {progress[pk] != null && progress[pk] > 0 && !isWatched && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginTop: 6,
                          maxWidth: 200,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 4,
                            background: "var(--surface3)",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${progress[pk]}%`,
                              height: "100%",
                              background: "var(--accent)",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 500 }}>
                          {Math.round(progress[pk])}%
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`search-result-type ${item.media_type === "tv" ? "type-tv" : "type-movie"}`}
                  >
                    {item.media_type === "tv" ? "Series" : "Movie"}
                  </span>
                  {onRemoveHistory && (
                    <button
                      className="history-remove-btn"
                      title="Remove from history"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveHistory(item);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "list" && saved.length === 0 && (
        <div className="empty-state">
          <EyeIcon />
          <h3>Your My List is empty</h3>
          <p>Use Save or My List on a movie or series and it will appear here.</p>
        </div>
      )}

      {activeTab === "continue" && inProgress.length === 0 && (
        <div className="empty-state">
          <EyeIcon />
          <h3>Nothing in progress</h3>
          <p>Start watching something and it will show up here.</p>
        </div>
      )}

      {activeTab === "history" && history.length === 0 && (
        <div className="empty-state">
          <EyeIcon />
          <h3>No watch history yet</h3>
          <p>Recently watched titles will appear here.</p>
        </div>
      )}

      {history.length === 0 && saved.length === 0 && inProgress.length === 0 && activeTab === "all" && (
        <div className="empty-state">
          <EyeIcon />
          <h3>Nothing here yet</h3>
          <p>
            Start watching a movie or series and your history will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
