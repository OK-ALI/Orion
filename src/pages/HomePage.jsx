import { useState, useEffect, useMemo, useCallback } from "react";
import HeroBanner from "../components/media/HeroBanner";
import MediaCarousel from "../components/media/MediaCarousel";
import MediaCard from "../components/media/MediaCard";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { tmdbFetch } from "../utils/api";
import { loadHomeLayout } from "../utils/homeLayout";

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
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [topRatedItems, setTopRatedItems] = useState([]);
  const [kDramaItems, setKDramaItems] = useState([]);
  const [layout] = useState(() => loadHomeLayout() || { order: ["continue", "recommended", "trendingMovies", "trendingTV", "kdramas", "topRated"], visible: { continue: true, recommended: true, trendingMovies: true, trendingTV: true, kdramas: true, topRated: true } });
  const { order: rowOrder, visible: rowVisible } = layout;

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
    if (!apiKey || offline || !history || history.length === 0) return;
    const sources = getRecentHistoryItems(history, 5);
    if (sources.length === 0) return;

    const controller = new AbortController();
    const watchedIds = new Set(
      (history || []).map((h) => `${h.media_type || "movie"}_${h.id}`),
    );

    const fetches = sources.map((source) => {
      const type = source.media_type === "tv" ? "tv" : "movie";
      return tmdbFetch(`/${type}/${source.id}/recommendations`, apiKey)
        .then((data) => {
          const results = (data.results || []).map((i) => ({
            ...i,
            media_type: type,
          }));
          if (results.length > 0) return results;
          return tmdbFetch(`/${type}/${source.id}/similar`, apiKey).then((d) =>
            (d.results || []).map((i) => ({ ...i, media_type: type })),
          );
        })
        .catch(() => []);
    });

    Promise.all(fetches)
      .then((arrays) => {
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
  }, [apiKey, offline, history?.length]);

  // Fetch top rated movies + TV
  useEffect(() => {
    if (!apiKey || offline) return;
    const controller = new AbortController();
    Promise.all([
      tmdbFetch("/movie/top_rated?page=1", apiKey),
      tmdbFetch("/tv/top_rated?page=1", apiKey),
    ])
      .then(([moviesData, tvData]) => {
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
  }, [apiKey, offline]);

  // Fetch Korean drama / K-series row.
  useEffect(() => {
    if (!apiKey || offline) return;
    const controller = new AbortController();
    tmdbFetch(
      "/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&vote_count.gte=80&page=1",
      apiKey,
    )
      .then((data) => {
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
  }, [apiKey, offline]);

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
                onClick={() => onSelect(item)}
                progress={progress[pk] || 0}
                watched={watched}
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

  if (offline) {
    return (
      <div className="offline-placeholder">
        <div className="offline-icon">📡</div>
        <h2>No Internet Connection</h2>
        <p>Trending and discovery require an internet connection. Your downloads and library still work offline.</p>
        <button className="btn btn-primary" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner" />
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
                  onClick={() => onSelect(item)}
                  ageRating={getRating(item).cert}
                  restricted={itemRestricted(item)}
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
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
