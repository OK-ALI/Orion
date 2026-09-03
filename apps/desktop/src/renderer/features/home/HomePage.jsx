import { useState, useEffect, useMemo, useCallback } from "react";
import HeroBanner from "../../components/media/HeroBanner";
import MediaCarousel from "../../components/media/MediaCarousel";
import MediaCard from "../../components/media/MediaCard";
import { useRatings, getRatingForItem } from "../../shared/utils/useRatings";
import { isRestricted } from "../../shared/utils/ageRating";
import { tmdbFetch } from "../../services/tmdb";
import { loadHomeLayout } from "../../shared/utils/homeLayout";
import { findLocalDownloadForItem } from "../../shared/utils/localMediaAvailability";

function getRecentHistoryItems(history, count = 5) {
  if (!history || history.length === 0) return [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = history
    .filter((h) => h.watchedAt && h.watchedAt > thirtyDaysAgo)
    .sort((a, b) => b.watchedAt - a.watchedAt);

  const seen = new Set();
  const unique = [];
  for (const item of recent) {
    const key = `${item.media_type || "movie"}_${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= count) break;
  }
  return unique;
}

export default function HomePage({
  trending,
  trendingTV,
  loading,
  onSelect,
  progress,
  inProgress,
  offline,
  connectionState = offline ? "offline" : "online",
  recoveryEpoch = 0,
  downloads = [],
  onPlayLocal,
  onCheckConnection,
  onRetry,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  history,
  saved = [],
  apiKey,
  onNavigate,
  onSave,
  isSaved,
}) {
  const canRequest = connectionState === "online" || connectionState === "degraded";
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [topRatedItems, setTopRatedItems] = useState([]);
  const [kDramaItems, setKDramaItems] = useState([]);
  const [loadingAge, setLoadingAge] = useState(0);
  const [layout] = useState(() => loadHomeLayout() || { order: ["continue", "recommended", "trendingMovies", "trendingTV", "kdramas", "topRated"], visible: { continue: true, recommended: true, trendingMovies: true, trendingTV: true, kdramas: true, topRated: true } });
  const { order: rowOrder, visible: rowVisible } = layout;
  const localContinue = useMemo(() => inProgress.flatMap((item) => {
    const download = findLocalDownloadForItem(item, downloads);
    return download ? [{ item, download }] : [];
  }), [inProgress, downloads]);

  useEffect(() => {
    if (!loading) {
      setLoadingAge(0);
      return undefined;
    }
    const startedAt = Date.now();
    setLoadingAge(0);
    const timer = setInterval(() => setLoadingAge(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  // Merge items for batch ratings fetch
  const allItems = useMemo(() => {
    return [
      ...inProgress,
      ...trending.map((i) => ({ ...i, media_type: "movie" })),
      ...trendingTV.map((i) => ({ ...i, media_type: "tv" })),
      ...recommendedItems,
      ...saved,
      ...kDramaItems,
      ...topRatedItems,
    ];
  }, [inProgress, trending, trendingTV, recommendedItems, saved, kDramaItems, topRatedItems]);

  const { ratingsMap, ageLimitSetting } = useRatings(allItems);

  const getRating = useCallback(
    (item) => getRatingForItem(item, ratingsMap),
    [ratingsMap],
  );

  const itemRestricted = useCallback(
    (item) =>
      isRestricted(getRatingForItem(item, ratingsMap).minAge, ageLimitSetting),
    [ratingsMap, ageLimitSetting],
  );

  const enrichedRatingsMap = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(ratingsMap)) {
      out[k] = { ...v, restricted: isRestricted(v.minAge, ageLimitSetting) };
    }
    return out;
  }, [ratingsMap, ageLimitSetting]);

  const filteredRecommendedItems = useMemo(() => {
    return recommendedItems.filter((item) => !itemRestricted(item));
  }, [recommendedItems, itemRestricted]);

  // Personalised recommendations based on history
  useEffect(() => {
    if (!apiKey || !canRequest || !history || history.length === 0) return;
    const sources = getRecentHistoryItems(history, 5);
    if (sources.length === 0) return;

    const controller = new AbortController();
    const watchedIds = new Set(
      (history || []).map((h) => `${h.media_type || "movie"}_${h.id}`),
    );

    const fetches = sources.map((source) => {
      const type = source.media_type === "tv" ? "tv" : "movie";
      return tmdbFetch(`/${type}/${source.id}/recommendations`, apiKey, { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted) return [];
          const results = (data.results || []).map((i) => ({
            ...i,
            media_type: type,
          }));
          if (results.length > 0) return results;
          return tmdbFetch(`/${type}/${source.id}/similar`, apiKey, { signal: controller.signal }).then((d) =>
            (d.results || []).map((i) => ({ ...i, media_type: type })),
          );
        })
        .catch(() => []);
    });

    Promise.all(fetches)
      .then((arrays) => {
        if (controller.signal.aborted) return;
        const merged = [];
        const maxLen = Math.max(...arrays.map((a) => a.length));
        for (let i = 0; i < maxLen; i++) {
          for (const arr of arrays) {
            if (arr[i]) merged.push(arr[i]);
          }
        }

        const seen = new Set();
        const deduped = merged.filter((item) => {
          const key = `${item.media_type}_${item.id}`;
          if (seen.has(key) || watchedIds.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRecommendedItems(deduped.slice(0, 20));
      })
      .catch((e) => {
        console.warn("Recommendations fetch failed", e);
      });

    return () => controller.abort();
  }, [apiKey, canRequest, recoveryEpoch, history?.length]);

  // Fetch top rated movies + TV
  useEffect(() => {
    if (!apiKey || !canRequest) return;
    const controller = new AbortController();
    Promise.all([
      tmdbFetch("/movie/top_rated?page=1", apiKey, { signal: controller.signal }),
      tmdbFetch("/tv/top_rated?page=1", apiKey, { signal: controller.signal }),
    ])
      .then(([moviesData, tvData]) => {
        if (controller.signal.aborted) return;
        const movies = (moviesData.results || [])
          .slice(0, 8)
          .map((i) => ({ ...i, media_type: "movie" }));
        const tv = (tvData.results || [])
          .slice(0, 8)
          .map((i) => ({ ...i, media_type: "tv" }));
        
        const merged = [];
        const max = Math.max(movies.length, tv.length);
        for (let i = 0; i < max; i++) {
          if (movies[i]) merged.push(movies[i]);
          if (tv[i]) merged.push(tv[i]);
        }
        setTopRatedItems(merged);
      })
      .catch((e) => {
        console.warn("Top rated fetch failed", e);
      });
    return () => controller.abort();
  }, [apiKey, canRequest, recoveryEpoch]);

  // Fetch Korean drama / K-series row.
  useEffect(() => {
    if (!apiKey || !canRequest) return;
    const controller = new AbortController();
    tmdbFetch(
      "/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&vote_count.gte=80&page=1",
      apiKey,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const results = (data.results || [])
          .filter((i) => i.poster_path || i.backdrop_path)
          .slice(0, 20)
          .map((i) => ({ ...i, media_type: "tv" }));
        setKDramaItems(results);
      })
      .catch((e) => {
        console.warn("K-drama fetch failed", e);
      });
    return () => controller.abort();
  }, [apiKey, canRequest, recoveryEpoch]);

  const trendingMovieItems = useMemo(
    () => trending.slice(0, 20).map((i) => ({ ...i, media_type: "movie" })),
    [trending],
  );
  const trendingTVItems = useMemo(
    () => trendingTV.slice(0, 20).map((i) => ({ ...i, media_type: "tv" })),
    [trendingTV],
  );

  // Spotlight is first 5 trending items for HeroBanner
  const spotlightItems = useMemo(() => {
    const list = [];
    const len = Math.max(trendingMovieItems.length, trendingTVItems.length);
    for (let i = 0; i < len; i++) {
      if (trendingMovieItems[i]) list.push(trendingMovieItems[i]);
      if (trendingTVItems[i]) list.push(trendingTVItems[i]);
    }
    return list.slice(0, 5);
  }, [trendingMovieItems, trendingTVItems]);

  const renderContinueSection = () => {
    if (inProgress.length === 0) return null;
    return (
      <div key="continue" className="home-section">
        <h2 className="section-title">Continue Watching</h2>
        <div className="continue-grid">
          {inProgress.map((item) => {
            const pk =
              item.media_type === "movie"
                ? `movie_${item.id}`
                : `tv_${item.id}_s${item.season}e${item.episode}`;
            const r = getRating(item);
            return (
              <MediaCard
                key={`${item.media_type}_${item.id}_${item.season || ""}_${item.episode || ""}`}
                item={item}
                onClick={(itemData) => onSelect(itemData && !itemData.nativeEvent ? itemData : item)}
                progress={progress[pk] || 0}
                watched={watched}
                inMyList={!!isSaved?.(item)}
                onMarkWatched={onMarkWatched}
                onMarkUnwatched={onMarkUnwatched}
                ageRating={r.cert}
                restricted={itemRestricted(item)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  if (connectionState !== "online" || (loading && localContinue.length > 0)) {
    const stateCopy = {
      offline: ["You're offline", "Open your downloads or library while Cinema discovery is unavailable."],
      checking: ["Checking connection", "Keep watching locally while Orion checks the connection."],
      reconnecting: ["Reconnecting", "Keep watching locally while Orion checks the connection."],
      degraded: ["Cinema service is limited", "Some remote content is unavailable. Your downloads and library remain available."],
      online: ["Loading Cinema", "Your local stories are ready while Cinema loads."],
    }[connectionState] || ["Checking connection", "Keep watching locally while Orion checks the connection."];

    return (
      <div className="homepage-container home-local-continuity">
        <div className="homepage-content">
          <section className="home-connection-state" aria-labelledby="home-local-title">
            <div role="status" aria-live="polite" aria-atomic="true">
              <p className="page-state-eyebrow">{stateCopy[0]}</p>
              <h1 id="home-local-title">Your local Orion is still available.</h1>
              <p className="home-connection-description">{stateCopy[1]}</p>
            </div>
            <div className="home-local-actions">
              <button className="btn btn-primary" onClick={() => onNavigate?.("downloads")}>Open Downloads</button>
              <button className="btn btn-secondary" onClick={() => onNavigate?.("library")}>Open Library</button>
              <button className="btn btn-ghost" onClick={() => (onCheckConnection || onRetry)?.()}>Check connection</button>
            </div>
          </section>
          {localContinue.length > 0 && (
            <section className="home-section" aria-labelledby="home-local-continue-title">
              <h2 id="home-local-continue-title" className="section-title">Continue Watching</h2>
              <ul className="home-local-continue">
                {localContinue.map(({ item, download }) => {
                  const title = item.title || item.name;
                  const episode = item.media_type === "tv" ? "S" + item.season + " E" + item.episode : "";
                  const key = item.media_type === "tv"
                    ? "tv_" + item.id + "_s" + item.season + "e" + item.episode
                    : "movie_" + item.id;
                  const percent = Math.max(0, Math.min(100, Math.round(Number(progress[key]) || 0)));
                  return (
                    <li key={key}>
                      <button
                        className="home-local-resume"
                        aria-label={"Resume " + title + (episode ? " " + episode : "") + " locally"}
                        onClick={() => onPlayLocal ? onPlayLocal(download) : onNavigate?.("downloads")}
                      >
                        <span className="home-local-story">
                          <strong>{title}</strong>
                          <span>{episode ? episode + " · " : ""}{percent}% watched</span>
                        </span>
                        <span className="home-local-resume-label">Resume local file</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="home-loading-shell" role="status" aria-live="polite">
        <div className="home-loading-hero skeleton" />
        <div className="home-loading-content">
          {[0, 1].map((row) => (
            <section className="home-loading-row" key={row}>
              <div className="home-loading-heading skeleton" />
              <div className="home-loading-cards">
                {[0, 1, 2, 3, 4, 5].map((card) => <i className="skeleton" key={card} />)}
              </div>
            </section>
          ))}
          {loadingAge >= 5000 && (
            <div className="home-loading-message">
              <strong>{loadingAge >= 12000 ? "Cinema is taking longer than expected" : "Still preparing your stories…"}</strong>
              <span>{loadingAge >= 12000 ? "Check the connection or retry without leaving this page." : "Orion is waiting for the first catalog response."}</span>
              {loadingAge >= 12000 && <button className="btn btn-secondary" onClick={onRetry}>Retry</button>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in homepage-container">
      {spotlightItems.length > 0 && (
        <HeroBanner
          items={spotlightItems}
          onSelect={onSelect}
          onSave={onSave}
          isSaved={isSaved}
        />
      )}

      <div className="homepage-content">
        {renderContinueSection()}

        {saved.length > 0 && saved.length <= 3 && (
          <section className="home-section home-my-list-section">
            <div className="home-section-header">
              <h2 className="section-title">My <span>List</span></h2>
              {onNavigate && (
                <button
                  className="section-link-btn"
                  onClick={() => onNavigate("library")}
                >
                  View all in My Library
                </button>
              )}
            </div>
            <div className="home-compact-shelf">
              {saved.map((item) => (
                <MediaCard
                  key={`${item.media_type || "movie"}_${item.id}`}
                  item={item}
                  onClick={(itemData) => onSelect(itemData && !itemData.nativeEvent ? itemData : item)}
                  ageRating={getRating(item).cert}
                  restricted={itemRestricted(item)}
                  watched={watched}
                  inMyList
                />
              ))}
            </div>
          </section>
        )}

        {saved.length > 3 && (
          <MediaCarousel
            key="myList"
            items={saved}
            title="My"
            titleHighlight="List"
            onSelect={onSelect}
            ratingsMap={enrichedRatingsMap}
            isSaved={isSaved}
            watched={watched}
          />
        )}

        {rowOrder.map((id) => {
          if (!rowVisible[id]) return null;

          if (id === "continue") {
            return null;
          }

          if (id === "recommended") {
            if (filteredRecommendedItems.length === 0) return null;
            return (
              <MediaCarousel
                key="recommended"
                items={filteredRecommendedItems}
                title="Recommended"
                titleHighlight="for You"
                onSelect={onSelect}
                ratingsMap={enrichedRatingsMap}
                isSaved={isSaved}
                watched={watched}
              />
            );
          }

          if (id === "trendingMovies") {
            if (trendingMovieItems.length === 0) return null;
            return (
              <MediaCarousel
                key="trendingMovies"
                items={trendingMovieItems}
                title="Trending"
                titleHighlight="Movies"
                onSelect={onSelect}
                ratingsMap={enrichedRatingsMap}
                isSaved={isSaved}
                watched={watched}
              />
            );
          }

          if (id === "trendingTV") {
            if (trendingTVItems.length === 0) return null;
            return (
              <MediaCarousel
                key="trendingTV"
                items={trendingTVItems}
                title="Trending"
                titleHighlight="TV Shows"
                onSelect={onSelect}
                ratingsMap={enrichedRatingsMap}
                isSaved={isSaved}
                watched={watched}
              />
            );
          }

          if (id === "kdramas") {
            if (kDramaItems.length === 0) return null;
            return (
              <MediaCarousel
                key="kdramas"
                items={kDramaItems}
                title="K-Dramas"
                titleHighlight="K-Series"
                onSelect={onSelect}
                ratingsMap={enrichedRatingsMap}
                isSaved={isSaved}
                watched={watched}
              />
            );
          }

          if (id === "topRated") {
            if (topRatedItems.length === 0) return null;
            return (
              <MediaCarousel
                key="topRated"
                items={topRatedItems}
                title="Top"
                titleHighlight="Rated"
                onSelect={onSelect}
                ratingsMap={enrichedRatingsMap}
                isSaved={isSaved}
                watched={watched}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
