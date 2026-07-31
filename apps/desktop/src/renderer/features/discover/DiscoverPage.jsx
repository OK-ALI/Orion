import { useState, useEffect, useCallback, useRef } from "react";
import { tmdbFetch } from "../../services/tmdb";
import MediaCard from "../../components/media/MediaCard";
import { REGION_PRESETS, SUBFILTER_PRESETS, getRegionQueryParams } from "../../shared/utils/discoverRegions";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { PROVIDER_HUBS, WORLD_HUBS, findProviderIds, inferWatchRegion } from "./discoveryHubs";

const MOVIE_GENRES = [
  { id: 28, name: "Action", gradient: "linear-gradient(135deg, #e50914 0%, #7d0008 100%)" },
  { id: 12, name: "Adventure", gradient: "linear-gradient(135deg, #ff8c00 0%, #8b4500 100%)" },
  { id: 16, name: "Animation", gradient: "linear-gradient(135deg, #20b2aa 0%, #008b8b 100%)" },
  { id: 35, name: "Comedy", gradient: "linear-gradient(135deg, #ff1493 0%, #c71585 100%)" },
  { id: 80, name: "Crime", gradient: "linear-gradient(135deg, #4b0082 0%, #310062 100%)" },
  { id: 99, name: "Documentary", gradient: "linear-gradient(135deg, #2e8b57 0%, #1e5e3a 100%)" },
  { id: 18, name: "Drama", gradient: "linear-gradient(135deg, #4682b4 0%, #204e7a 100%)" },
  { id: 10751, name: "Family", gradient: "linear-gradient(135deg, #ff69b4 0%, #db7093 100%)" },
  { id: 14, name: "Fantasy", gradient: "linear-gradient(135deg, #9370db 0%, #663399 100%)" },
  { id: 36, name: "History", gradient: "linear-gradient(135deg, #8b4513 0%, #5c2d0c 100%)" },
  { id: 27, name: "Horror", gradient: "linear-gradient(135deg, #2b2b2b 0%, #0f0f0f 100%)" },
  { id: 9648, name: "Mystery", gradient: "linear-gradient(135deg, #708090 0%, #475058 100%)" },
  { id: 10749, name: "Romance", gradient: "linear-gradient(135deg, #ff4500 0%, #b22222 100%)" },
  { id: 878, name: "Sci-Fi", gradient: "linear-gradient(135deg, #00bfff 0%, #00008b 100%)" },
  { id: 53, name: "Thriller", gradient: "linear-gradient(135deg, #ff4757 0%, #c21c2c 100%)" },
  { id: 10752, name: "War", gradient: "linear-gradient(135deg, #8fbc8f 0%, #556b2f 100%)" },
  { id: 37, name: "Western", gradient: "linear-gradient(135deg, #cd853f 0%, #8b5a2b 100%)" },
];

const TV_GENRES = [
  { id: 10759, name: "Action & Adventure", gradient: "linear-gradient(135deg, #e50914 0%, #7d0008 100%)" },
  { id: 16, name: "Animation", gradient: "linear-gradient(135deg, #20b2aa 0%, #008b8b 100%)" },
  { id: 35, name: "Comedy", gradient: "linear-gradient(135deg, #ff1493 0%, #c71585 100%)" },
  { id: 80, name: "Crime", gradient: "linear-gradient(135deg, #4b0082 0%, #310062 100%)" },
  { id: 99, name: "Documentary", gradient: "linear-gradient(135deg, #2e8b57 0%, #1e5e3a 100%)" },
  { id: 18, name: "Drama", gradient: "linear-gradient(135deg, #4682b4 0%, #204e7a 100%)" },
  { id: 10751, name: "Family", gradient: "linear-gradient(135deg, #ff69b4 0%, #db7093 100%)" },
  { id: 10762, name: "Kids", gradient: "linear-gradient(135deg, #ffbd59 0%, #cc902c 100%)" },
  { id: 9648, name: "Mystery", gradient: "linear-gradient(135deg, #708090 0%, #475058 100%)" },
  { id: 10763, name: "News", gradient: "linear-gradient(135deg, #546e7a 0%, #37474f 100%)" },
  { id: 10764, name: "Reality", gradient: "linear-gradient(135deg, #ab47bc 0%, #7b1fa2 100%)" },
  { id: 10765, name: "Sci-Fi & Fantasy", gradient: "linear-gradient(135deg, #00bfff 0%, #00008b 100%)" },
  { id: 10766, name: "Soap", gradient: "linear-gradient(135deg, #f48fb1 0%, #c2185b 100%)" },
  { id: 10767, name: "Talk", gradient: "linear-gradient(135deg, #26a69a 0%, #00695c 100%)" },
  { id: 10768, name: "War & Politics", gradient: "linear-gradient(135deg, #556b2f 0%, #3b4d20 100%)" },
  { id: 37, name: "Western", gradient: "linear-gradient(135deg, #cd853f 0%, #8b5a2b 100%)" },
];

export default function DiscoverPage({ apiKey, onNavigate, offline = false }) {
  const [type, setType] = useState("movie"); // "all" | "movie" | "tv"
  const [selectedGenre, setSelectedGenre] = useState(null); // null or genre object
  const [region, setRegion] = useState("all"); // "all" | "hollywood" | "bollywood" | "asian"
  const [subfilter, setSubfilter] = useState("all"); // active regional subfilter
  const [regionItems, setRegionItems] = useState([]);
  const [loadingRegionItems, setLoadingRegionItems] = useState(false);
  const [selectedHub, setSelectedHub] = useState(null);
  const [hubFilter, setHubFilter] = useState("all");
  const [watchRegion, setWatchRegion] = useState(
    () => storage.get(STORAGE_KEYS.DISCOVERY_REGION) || inferWatchRegion(),
  );
  const [providerCatalog, setProviderCatalog] = useState({ movie: [], tv: [] });

  // Filter & Sorting state
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [year, setYear] = useState("");
  const [minRating, setMinRating] = useState("0");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const scrollRef = useRef(null);

  const genres = type === "movie" ? MOVIE_GENRES : type === "tv" ? TV_GENRES : [];

  // Reset genre and items when type changes
  const handleTypeChange = (newType) => {
    setType(newType);
    if (!selectedHub) setSelectedGenre(null);
    setItems([]);
  };

  useEffect(() => {
    if (!apiKey || offline) return;
    let active = true;
    const cacheKey = `watchProviderCatalog_${watchRegion}`;
    const cached = storage.get(cacheKey);
    if (cached?.at && Date.now() - cached.at < 86_400_000) {
      setProviderCatalog(cached.results || { movie: [], tv: [] });
      return;
    }
    Promise.all([
      tmdbFetch(`/watch/providers/movie?watch_region=${watchRegion}`, apiKey),
      tmdbFetch(`/watch/providers/tv?watch_region=${watchRegion}`, apiKey),
    ]).then(([movie, tv]) => {
        if (!active) return;
        const results = { movie: movie.results || [], tv: tv.results || [] };
        setProviderCatalog(results);
        storage.set(cacheKey, { at: Date.now(), results });
      })
      .catch(() => setProviderCatalog({ movie: [], tv: [] }));
    return () => { active = false; };
  }, [apiKey, offline, watchRegion]);

  const handleRegionChange = (newRegion) => {
    setRegion(newRegion);
    setSubfilter("all");
  };

  // Fetch regional trending items when region or subfilter or type changes, if no genre is selected
  useEffect(() => {
    if (region === "all" || selectedGenre || !apiKey || offline) {
      setRegionItems([]);
      return;
    }

    let mounted = true;
    const fetchRegionItems = async () => {
      setLoadingRegionItems(true);
      setRequestError("");
      try {
        const { countryParam, languageParam } = getRegionQueryParams(region, subfilter);
        const requestTypes = type === "all" ? ["movie", "tv"] : [type];
        const responses = await Promise.all(requestTypes.map((mediaType) => tmdbFetch(`/discover/${mediaType}?sort_by=popularity.desc${countryParam}${languageParam}&page=1`, apiKey)));
        const merged = responses.flatMap((data, index) => (data.results || []).map((item) => ({ ...item, media_type: requestTypes[index] })));
        if (mounted) {
          setRegionItems(merged.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)));
        }
      } catch (err) {
        console.error("Failed to fetch region items:", err);
        if (mounted) setRequestError("Regional titles could not be refreshed. Existing results remain available.");
      } finally {
        if (mounted) setLoadingRegionItems(false);
      }
    };

    fetchRegionItems();
    return () => {
      mounted = false;
    };
  }, [region, subfilter, type, selectedGenre, apiKey, offline]);

  // Fetch results when filters/genre/region/subfilter change
  const fetchDiscoverResults = useCallback(
    async (pageNum = 1) => {
      if (!selectedGenre || !apiKey || offline) return;
      setLoading(true);
      setRequestError("");
      try {
        const { countryParam, languageParam } = getRegionQueryParams(region, subfilter);
        const requestTypes = type === "all" ? ["movie", "tv"] : [type];
        const responses = await Promise.all(requestTypes.map((mediaType) => {
          const yearParam = year ? (mediaType === "movie" ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`) : "";
          const ratingParam = minRating !== "0" ? `&vote_average.gte=${minRating}` : "";
          const genreParam = !selectedHub && selectedGenre.id && selectedGenre.id !== "all" ? `&with_genres=${selectedGenre.id}` : "";
          let hubParam = "";
          if (selectedHub?.kind === "provider") {
            const providerIds = findProviderIds(providerCatalog[mediaType] || [], selectedHub);
            if (!providerIds.length) return Promise.resolve({ results: [], page: pageNum, total_pages: 1 });
            hubParam = `&watch_region=${watchRegion}&with_watch_providers=${providerIds.join("|")}`;
          } else if (selectedHub?.kind === "world") {
            const filter = selectedHub.filters.find((entry) => entry.id === hubFilter) || selectedHub.filters[0];
            hubParam = `&${filter[mediaType]}`;
          }
          const mediaSort = sortBy === "primary_release_date.desc" && mediaType === "tv" ? "first_air_date.desc" : sortBy;
          return tmdbFetch(`/discover/${mediaType}?sort_by=${mediaSort}${genreParam}${hubParam}${countryParam}${languageParam}${yearParam}${ratingParam}&page=${pageNum}`, apiKey);
        }));
        const seen = new Set();
        const merged = responses.flatMap((data, index) => (data.results || []).map((item) => ({ ...item, media_type: requestTypes[index] })))
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .filter((item) => { const key = `${item.media_type}_${item.id}`; if (seen.has(key)) return false; seen.add(key); return true; });

        if (pageNum === 1) {
          setItems(merged);
        } else {
          setItems((prev) => [...prev, ...merged.filter((item) => !prev.some((old) => old.id === item.id && old.media_type === item.media_type))]);
        }
        setPage(pageNum);
        setTotalPages(Math.max(...responses.map((data) => data.total_pages || 1)));
      } catch (err) {
        console.error("Discover fetch failed:", err);
        setRequestError("Discover results could not be refreshed. Check the connection and retry.");
      } finally {
        setLoading(false);
      }
    },
    [selectedGenre, selectedHub, hubFilter, providerCatalog, watchRegion, type, sortBy, year, minRating, region, subfilter, apiKey, offline],
  );

  useEffect(() => {
    if (selectedGenre) {
      setItems([]);
      setPage(1);
      fetchDiscoverResults(1);
    }
  }, [selectedGenre, selectedHub, hubFilter, sortBy, year, minRating, region, subfilter, fetchDiscoverResults]);

  const loadMore = () => {
    if (page < totalPages && !loading) {
      fetchDiscoverResults(page + 1);
    }
  };

  const handleSelectGenre = (genre) => {
    setSelectedHub(null);
    setSelectedGenre(genre);
  };

  const handleSelectHub = (hub, kind) => {
    setSelectedHub({ ...hub, kind });
    setHubFilter(hub.filters?.[0]?.id || "all");
    setSelectedGenre({ id: "hub", name: hub.name, gradient: hub.gradient });
    setItems([]);
  };

  const handleBackToGenres = () => {
    setSelectedGenre(null);
    setSelectedHub(null);
    setItems([]);
  };

  return (
    <div className="discover-container" ref={scrollRef}>
      {(offline || requestError) && <div className="constellation-warning"><span>{offline ? "Discover is offline. Saved library items and downloads remain available." : requestError}</span>{!offline && <button className="btn btn-ghost" onClick={() => selectedGenre ? fetchDiscoverResults(page || 1) : setRequestError("")}>Retry</button>}</div>}
      {/* ── Page Header ── */}
      <div className="discover-header">
        <div className="discover-title-row">
          <h1>Discover</h1>
          <div className="type-toggle">
            <button
              className={`toggle-btn ${type === "all" ? "active" : ""}`}
              onClick={() => handleTypeChange("all")}
            >
              All
            </button>
            <button
              className={`toggle-btn ${type === "movie" ? "active" : ""}`}
              onClick={() => handleTypeChange("movie")}
            >
              Movies
            </button>
            <button
              className={`toggle-btn ${type === "tv" ? "active" : ""}`}
              onClick={() => handleTypeChange("tv")}
            >
              TV Shows
            </button>
          </div>
        </div>

        {!selectedGenre && (
          <>
            <section className="discovery-hubs" aria-labelledby="discovery-hubs-title">
              <div className="discovery-hubs-heading">
                <div><span className="eyebrow">Editorial hubs</span><h2 id="discovery-hubs-title">Choose your orbit</h2></div>
                <label className="discovery-region-select">Provider region
                  <select value={watchRegion} onChange={(event) => {
                    const value = event.target.value;
                    setWatchRegion(value);
                    storage.set(STORAGE_KEYS.DISCOVERY_REGION, value);
                  }}>
                    {["US", "GB", "PK", "IN", "CA", "AU", "DE", "FR", "JP", "KR", "AE"].map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </label>
              </div>
              <div className="discovery-hub-label">Streaming providers</div>
              <div className="discovery-hub-grid discovery-hub-grid--providers">
                {PROVIDER_HUBS.map((hub) => {
                  const available = type === "all"
                    ? Boolean(findProviderIds(providerCatalog.movie, hub).length || findProviderIds(providerCatalog.tv, hub).length)
                    : Boolean(findProviderIds(providerCatalog[type] || [], hub).length);
                  return <button key={hub.id} className="discovery-hub-card" style={{ "--hub-gradient": hub.gradient }} onClick={() => handleSelectHub(hub, "provider")} disabled={!available}>
                    <span>{hub.name}</span><small>{available ? `Explore in ${watchRegion}` : `Not listed in ${watchRegion}`}</small>
                  </button>;
                })}
              </div>
              <div className="discovery-hub-label">Story worlds</div>
              <div className="discovery-hub-grid">
                {WORLD_HUBS.map((hub) => <button key={hub.id} className="discovery-hub-card" style={{ "--hub-gradient": hub.gradient }} onClick={() => handleSelectHub(hub, "world")}>
                  <span>{hub.name}</span><small>{hub.filters.length} curated paths</small>
                </button>)}
              </div>
              <p className="discovery-availability-note">Streaming availability is supplied by TMDB and can change. Orion does not guarantee that a title is currently included with a subscription.</p>
            </section>

            <div className={`region-filter-bar${region !== "all" ? " has-subfilters" : ""}`}>
              {Object.entries(REGION_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  className={`toggle-btn ${region === id ? "active" : ""}`}
                  onClick={() => handleRegionChange(id)}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {region !== "all" && SUBFILTER_PRESETS[region] && (
              <div className="subfilter-bar">
                {SUBFILTER_PRESETS[region].map((sf) => (
                  <button
                    key={sf.id}
                    className={`toggle-btn ${subfilter === sf.id ? "active" : ""}`}
                    onClick={() => setSubfilter(sf.id)}
                  >
                    {sf.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selectedGenre && (
          <div className="discover-filters">
            <button className="btn btn-secondary btn-back" onClick={handleBackToGenres}>
              ← Genres
            </button>
            <span className="current-genre-label" style={{ background: selectedGenre.gradient || "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)" }}>
              {selectedGenre.name}
            </span>

            {selectedHub?.kind === "world" && (
              <div className="discovery-world-filters" role="tablist" aria-label={`${selectedHub.name} categories`}>
                {selectedHub.filters.map((filter) => (
                  <button key={filter.id} className={`library-filter${hubFilter === filter.id ? " active" : ""}`} onClick={() => setHubFilter(filter.id)} role="tab" aria-selected={hubFilter === filter.id}>
                    {filter.name}
                  </button>
                ))}
              </div>
            )}

            <div className="filter-controls">
              {/* Region Filter */}
              <div className="filter-select-wrap">
                <select value={region} onChange={(e) => handleRegionChange(e.target.value)}>
                  {Object.entries(REGION_PRESETS).map(([id, preset]) => (
                    <option key={id} value={id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subfilter Filter */}
              {region !== "all" && SUBFILTER_PRESETS[region] && (
                <div className="filter-select-wrap">
                  <select value={subfilter} onChange={(e) => setSubfilter(e.target.value)}>
                    {SUBFILTER_PRESETS[region].map((sf) => (
                      <option key={sf.id} value={sf.id}>
                        {sf.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Year Filter */}
              <div className="filter-select-wrap">
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">Year (All)</option>
                  {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating Filter */}
              <div className="filter-select-wrap">
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                  <option value="0">Rating (Any)</option>
                  <option value="8">★ 8.0 & Above</option>
                  <option value="7">★ 7.0 & Above</option>
                  <option value="6">★ 6.0 & Above</option>
                  <option value="5">★ 5.0 & Above</option>
                </select>
              </div>

              {/* Sort Filter */}
              <div className="filter-select-wrap">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="popularity.desc">Most Popular</option>
                  <option value="vote_average.desc">Top Rated</option>
                  <option value="primary_release_date.desc">Newest</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="discover-content">
        {!selectedGenre ? (
          <div className="fade-in">
            {/* Regional Popular Shelf */}
            {region !== "all" && (
              <div style={{ marginBottom: "36px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Popular in {REGION_PRESETS[region].name}
                  </h2>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSelectGenre({ id: "all", name: "All Titles" })}
                    style={{ padding: "6px 14px", fontSize: "13px", fontWeight: 600 }}
                  >
                    Browse All
                  </button>
                </div>
                {loadingRegionItems ? (
                  <div className="loader" style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="spinner" />
                  </div>
                ) : regionItems.length > 0 ? (
                  <div className="scroll-row">
                    {regionItems.map((item) => (
                      <MediaCard
                        key={`${item.id}_${item.media_type || type}`}
                        item={{ ...item, media_type: item.media_type || type }}
                        onClick={(itemData) => { const mediaType = item.media_type || type; onNavigate(mediaType, itemData && !itemData.nativeEvent ? itemData : { ...item, media_type: mediaType }); }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--text3)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    No trending titles found for this region.
                  </div>
                )}
              </div>
            )}

            {/* Genre list */}
            {genres.length > 0 ? <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "16px", color: "var(--text)" }}>
                Browse by Genre
              </h2>
              <div className="genre-grid">
                {genres.map((genre) => (
                  <div
                    key={genre.id}
                    className="genre-card"
                    style={{ background: genre.gradient }}
                    onClick={() => handleSelectGenre(genre)}
                  >
                    <div className="genre-card-overlay" />
                    <span className="genre-card-name">{genre.name}</span>
                  </div>
                ))}
              </div>
            </div> : <div className="discover-empty-state"><p>Select Movies or TV Shows to browse by genre, or choose an editorial hub above to explore both together.</p></div>}
          </div>
        ) : (
          /* Discover Results Grid View */
          <div className="discover-results-view fade-in">
            <div className="discover-results-grid">
              {items.map((item) => (
                <MediaCard
                  key={`${item.id}_${item.media_type || type}`}
                  item={{ ...item, media_type: item.media_type || type }}
                  onClick={(itemData) => { const mediaType = item.media_type || type; onNavigate(mediaType, itemData && !itemData.nativeEvent ? itemData : { ...item, media_type: mediaType }); }}
                />
              ))}
            </div>

            {loading && (
              <div className="loader">
                <div className="spinner" />
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="discover-empty-state">
                <p>No titles match the selected filters. Try adjusting your search criteria!</p>
              </div>
            )}

            {!loading && page < totalPages && items.length > 0 && (
              <div className="load-more-container">
                <button className="btn btn-secondary load-more-btn" onClick={loadMore}>
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
