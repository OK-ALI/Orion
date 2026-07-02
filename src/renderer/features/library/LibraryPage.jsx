import { useCallback, useMemo, useState, useEffect } from "react";
import MediaCard from "../../components/media/MediaCard";
import { imgUrl } from "../../services/tmdb";
import { EyeIcon, WatchedIcon } from "../../components/common/Icons";
import { useRatings, getRatingForItem } from "../../shared/utils/useRatings";
import { isRestricted } from "../../shared/utils/ageRating";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import ConfirmModal from "../../components/common/ConfirmModal";
import LocalPlayer from "../downloads/components/LocalPlayer";

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
  onClearHistory,
  onReorderSaved,
  downloads = [],
  onHistory,
  onSaveProgress,
  onOpenMiniPlayer,
  onDeleteDownload,
}) {
  const allItems = useMemo(
    () => [...inProgress, ...saved],
    [inProgress, saved],
  );
  const { ratingsMap, ageLimitSetting } = useRatings(allItems);

  const [sort, setSort] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_SORT) || "manual",
  );
  const [activeTab, setActiveTab] = useState(
    () => {
      const savedTab = storage.get(STORAGE_KEYS.LIBRARY_TAB) || "overview";
      return savedTab === "all" ? "overview" : savedTab;
    },
  );
  const [query, setQuery] = useState("");
  const [selectedDownload, setSelectedDownload] = useState(null);
  const [historyFilter, setHistoryFilter] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_HISTORY_FILTER) || "all",
  );
  const [historyVisibleCount, setHistoryVisibleCount] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_HISTORY_VISIBLE) || 10,
  );

  useEffect(() => {
    storage.set(STORAGE_KEYS.LIBRARY_TAB, activeTab);
    setHistoryVisibleCount(activeTab === "history" ? 25 : 10);
  }, [activeTab]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.LIBRARY_HISTORY_FILTER, historyFilter);
    setHistoryVisibleCount(activeTab === "history" ? 25 : 10);
  }, [historyFilter, activeTab]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.LIBRARY_HISTORY_VISIBLE, historyVisibleCount);
  }, [historyVisibleCount]);

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
    if (query.trim()) return;
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

  const completedDownloads = useMemo(() => downloads.filter((item) => item.status === "completed"), [downloads]);
  const progressDetails = useMemo(() => storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {}, [progress]);
  const continueItems = useMemo(() => {
    const sorted = [...inProgress].sort((a, b) => {
      const keyA = a.media_type === "movie" ? `movie_${a.id}` : `tv_${a.id}_s${a.season}e${a.episode}`;
      const keyB = b.media_type === "movie" ? `movie_${b.id}` : `tv_${b.id}_s${b.season}e${b.episode}`;
      return (progressDetails[keyB]?.updatedAt || b.watchedAt || 0) - (progressDetails[keyA]?.updatedAt || a.watchedAt || 0);
    });
    const seen = new Set();
    return sorted.filter((item) => {
      const identity = `${item.media_type}_${item.id}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [inProgress, progressDetails]);
  const uniqueOverviewCount = useMemo(() => new Set([...continueItems, ...saved, ...history].map((item) => `${item.media_type}_${item.id}`)).size, [continueItems, saved, history]);
  const tabs = [
    { id: "overview", label: "Overview", count: uniqueOverviewCount },
    { id: "continue", label: "Continue", count: continueItems.length },
    { id: "list", label: "My List", count: saved.length },
    { id: "downloads", label: "Downloads", count: completedDownloads.length },
    { id: "history", label: "History", count: history.length },
  ];

  const matchesQuery = useCallback((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item.title || item.name || ""} ${item.episodeName || ""}`.toLowerCase().includes(needle);
  }, [query]);
  const visibleSaved = useMemo(() => saved.filter(matchesQuery), [saved, matchesQuery]);
  const visibleContinue = useMemo(() => continueItems.filter(matchesQuery), [continueItems, matchesQuery]);

  const downloadedKeys = useMemo(() => {
    const keys = new Set();
    for (const dl of downloads || []) {
      if (!dl || dl.status !== "completed") continue;
      if (dl.mediaType === "movie" && (dl.tmdbId || dl.mediaId)) {
        keys.add(`movie_${dl.tmdbId || dl.mediaId}`);
      }
      if (dl.mediaType === "tv" && (dl.tmdbId || dl.mediaId) && dl.season && dl.episode) {
        keys.add(`tv_${dl.tmdbId || dl.mediaId}_s${dl.season}e${dl.episode}`);
      }
    }
    return keys;
  }, [downloads]);

  const historyFilters = [
    { id: "all", label: "All" },
    { id: "movie", label: "Movies" },
    { id: "tv", label: "Series" },
    { id: "downloaded", label: "Downloaded" },
    { id: "watched", label: "Watched" },
    { id: "progress", label: "In Progress" },
  ];

  const getHistoryKey = useCallback(
    (item) =>
      item.media_type === "movie"
        ? `movie_${item.id}`
        : `tv_${item.id}_s${item.season}e${item.episode}`,
    [],
  );

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (!matchesQuery(item)) return false;
      const pk = getHistoryKey(item);
      if (historyFilter === "movie") return item.media_type === "movie";
      if (historyFilter === "tv") return item.media_type === "tv";
      if (historyFilter === "downloaded") return downloadedKeys.has(pk);
      if (historyFilter === "watched") return !!watched?.[pk];
      if (historyFilter === "progress") {
        const pct = progress?.[pk] || 0;
        return !watched?.[pk] && pct > 2 && pct < 98;
      }
      return true;
    });
  }, [history, historyFilter, downloadedKeys, watched, progress, getHistoryKey, matchesQuery]);

  const visibleHistory = useMemo(
    () => filteredHistory.slice(0, historyVisibleCount),
    [filteredHistory, historyVisibleCount],
  );

  const historyBaseCount = activeTab === "history" ? 25 : 10;
  const hasMoreHistory = historyVisibleCount < filteredHistory.length;

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearHistory = useCallback(() => {
    if (!onClearHistory) return;
    setShowClearConfirm(true);
  }, [onClearHistory]);

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
        <div className="library-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your library" aria-label="Search your library" />
          <select value={sort} onChange={(event) => {
            const value = event.target.value;
            setSort(value);
            storage.set(STORAGE_KEYS.LIBRARY_SORT, value);
            window.dispatchEvent(new CustomEvent("orion:library-sort-changed", { detail: value }));
          }} aria-label="Sort My List">
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
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

      {(activeTab === "overview" || activeTab === "continue") && visibleContinue.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">Continue watching</div>
          <div className="continue-landscape-grid">
            {visibleContinue.map((item) => {
              const pk =
                item.media_type === "movie"
                  ? `movie_${item.id}`
                  : `tv_${item.id}_s${item.season}e${item.episode}`;
              const detail = progressDetails[pk] || {};
              const pct = progress[pk] || detail.percent || 0;
              const remaining = detail.duration > detail.currentTime ? Math.ceil((detail.duration - detail.currentTime) / 60) : null;
              return (
                <article className="continue-landscape-card" key={pk}>
                  <button className="continue-landscape-art" onClick={() => onSelect(item)}>
                    {item.backdrop_path || item.poster_path ? <img src={imgUrl(item.backdrop_path || item.poster_path, "w500")} alt="" /> : <span />}
                    <i style={{ width: `${pct}%` }} />
                  </button>
                  <div className="continue-landscape-copy">
                    <strong>{item.title || item.name}</strong>
                    <span>{item.media_type === "tv" ? `S${item.season}E${item.episode}${item.episodeName ? ` · ${item.episodeName}` : ""}` : "Movie"}</span>
                    <small>{Math.round(pct)}% watched{remaining ? ` · ${remaining} min remaining` : ""}</small>
                    <div><button className="btn btn-primary btn--sm" onClick={() => onSelect({ ...item, autoplay: true })}>Resume</button><button className="btn btn-ghost btn--sm" onClick={() => {
                      storage.remove("dlTime_" + pk);
                      const details = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
                      delete details[pk]; storage.set(STORAGE_KEYS.PROGRESS_DETAILS, details);
                      onSaveProgress?.(pk, 0);
                    }}>Remove</button><button className="btn btn-ghost btn--sm" onClick={() => onMarkWatched?.(pk)}>Mark watched</button></div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {(activeTab === "overview" || activeTab === "list") && visibleSaved.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">
            My List ({visibleSaved.length})
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
            {visibleSaved.map((item, index) => {
              const r = getRating(item);
              const restr = itemRestricted(item);
              const itemId = `${item.media_type}_${item.id}`;
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              return (
                <div
                  key={itemId}
                  className={`watchlist-drag-card${isDragging ? " is-dragging" : ""}${isDragOver ? " drag-over" : ""}`}
                  draggable={sort === "manual" && !query.trim()}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{ cursor: sort === "manual" && !query.trim() ? "grab" : "default" }}
                >
                  <MediaCard
                    item={item}
                    onClick={(itemData) => onSelect(itemData && !itemData.nativeEvent ? itemData : item)}
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

      {(activeTab === "overview" || activeTab === "downloads") && completedDownloads.length > 0 && (
        <div className="library-section">
          <div className="library-section-title">Downloads ({completedDownloads.length})</div>
          <div className="library-download-grid">
            {completedDownloads.filter((item) => matchesQuery({ title: item.name })).map((download) => (
              <article className="library-download-card" key={download.id}>
                {download.posterPath ? <img src={imgUrl(download.posterPath, "w185")} alt="" /> : <div className="library-download-placeholder" />}
                <div><strong>{download.name}</strong><span>{download.mediaType === "tv" ? `S${download.season}E${download.episode}` : "Movie"} · {download.qualityPreset === "best" ? "Best quality" : `${download.qualityPreset}p`}</span><button className="btn btn-primary btn--sm" onClick={() => setSelectedDownload(download)}>Play in Orion</button></div>
              </article>
            ))}
          </div>
        </div>
      )}

      {(activeTab === "overview" || activeTab === "history") && history.length > 0 && (
        <div className="library-section">
          <div className="library-section-title library-section-title--actions">
            <span>
              Watch History ({filteredHistory.length}
              {filteredHistory.length !== history.length ? ` of ${history.length}` : ""})
            </span>
            <div className="library-section-actions">
              {onClearHistory && (
                <button className="btn btn-ghost btn--sm" onClick={handleClearHistory}>
                  Clear history
                </button>
              )}
            </div>
          </div>
          <div className="library-filters" role="toolbar" aria-label="History filters">
            {historyFilters.map((filter) => (
              <button
                key={filter.id}
                className={`library-filter${historyFilter === filter.id ? " active" : ""}`}
                onClick={() => setHistoryFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="history-rows">
            {visibleHistory.map((item, i) => {
              const pk = getHistoryKey(item);
              const isWatched = !!watched?.[pk];
              const isDownloaded = downloadedKeys.has(pk);
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
                  {isDownloaded && (
                    <span className="search-result-type type-downloaded">
                      Downloaded
                    </span>
                  )}
                  <div className="history-actions">
                    <button
                      className="btn btn-primary btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(item);
                      }}
                    >
                      Resume
                    </button>
                    {isWatched ? (
                      <button
                        className="btn btn-ghost btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkUnwatched?.(pk);
                        }}
                      >
                        Unwatch
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkWatched?.(pk);
                        }}
                      >
                        Mark watched
                      </button>
                    )}
                  </div>
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
          {filteredHistory.length === 0 && (
            <div className="empty-state empty-state--compact">
              <EyeIcon />
              <h3>No matching history</h3>
              <p>Try another filter or start watching something new.</p>
            </div>
          )}
          {filteredHistory.length > historyBaseCount && (
            <div className="library-show-more">
              {hasMoreHistory ? (
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    setHistoryVisibleCount((count) =>
                      Math.min(count + historyBaseCount, filteredHistory.length),
                    )
                  }
                >
                  Load more
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={() => setHistoryVisibleCount(historyBaseCount)}
                >
                  Show less
                </button>
              )}
            </div>
          )}
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

      {activeTab === "downloads" && completedDownloads.length === 0 && (
        <div className="empty-state"><EyeIcon /><h3>No completed downloads</h3><p>Completed movies and episodes will be playable here.</p></div>
      )}

      {history.length === 0 && saved.length === 0 && inProgress.length === 0 && completedDownloads.length === 0 && activeTab === "overview" && (
        <div className="empty-state">
          <EyeIcon />
          <h3>Nothing here yet</h3>
          <p>
            Start watching a movie or series and your history will appear here.
          </p>
        </div>
      )}

      {showClearConfirm && (
        <ConfirmModal
          title="Clear Watch History"
          message="Clear all watch history? This will not remove saved titles or downloads."
          confirmText="Clear History"
          cancelText="Cancel"
          onConfirm={() => {
            setShowClearConfirm(false);
            onClearHistory?.();
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
      {selectedDownload && (
        <LocalPlayer download={selectedDownload} onClose={() => setSelectedDownload(null)} onHistory={onHistory} onSaveProgress={onSaveProgress} onMarkWatched={onMarkWatched} onOpenMiniPlayer={onOpenMiniPlayer} onForget={async (item) => { const result = await window.electron.deleteDownload({ id: item.id, filePath: null }); if (result?.ok) onDeleteDownload?.(item.id); }} />
      )}
    </div>
  );
}
