import { useState, useEffect, useCallback, useRef } from "react";
import { tmdbFetch } from "../utils/api";
import MediaCard from "../components/media/MediaCard";

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
  { id: 10752, name: "War", gradient: "linear-gradient(135deg, #556b2f 0%, #3b4d20 100%)" },
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

const REGION_PRESETS = {
  all: {
    name: "Global",
    countries: "",
  },
  hollywood: {
    name: "Hollywood",
    countries: "US",
  },
  bollywood: {
    name: "Bollywood",
    countries: "IN",
  },
  asian: {
    name: "Asian Content",
    countries: "KR|JP|CN|TW|HK|TH",
  },
};

export default function DiscoverPage({ apiKey, onNavigate }) {
  const [type, setType] = useState("movie"); // "movie" | "tv"
  const [selectedGenre, setSelectedGenre] = useState(null); // null or genre object
  const [region, setRegion] = useState("all"); // "all" | "hollywood" | "bollywood" | "asian"
  const [regionItems, setRegionItems] = useState([]);
  const [loadingRegionItems, setLoadingRegionItems] = useState(false);

  // Filter & Sorting state
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [year, setYear] = useState("");
  const [minRating, setMinRating] = useState("0");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const genres = type === "movie" ? MOVIE_GENRES : TV_GENRES;

  // Reset genre and items when type changes
  const handleTypeChange = (newType) => {
    setType(newType);
    setSelectedGenre(null);
    setItems([]);
  };

  // Fetch regional trending items when region or type changes, if no genre is selected
  useEffect(() => {
    if (region === "all" || selectedGenre || !apiKey) {
      setRegionItems([]);
      return;
    }

    let mounted = true;
    const fetchRegionItems = async () => {
      setLoadingRegionItems(true);
      try {
        const countries = REGION_PRESETS[region].countries;
        const path = `/discover/${type}?sort_by=popularity.desc&with_origin_country=${countries}&page=1`;
        const data = await tmdbFetch(path, apiKey);
        if (mounted) {
          setRegionItems(data.results || []);
        }
      } catch (err) {
        console.error("Failed to fetch region items:", err);
      } finally {
        if (mounted) setLoadingRegionItems(false);
      }
    };

    fetchRegionItems();
    return () => {
      mounted = false;
    };
  }, [region, type, selectedGenre, apiKey]);

  // Fetch results when filters/genre/region change
  const fetchDiscoverResults = useCallback(
    async (pageNum = 1) => {
      if (!selectedGenre || !apiKey) return;
      setLoading(true);
      try {
        const yearParam = year ? (type === "movie" ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`) : "";
        const ratingParam = minRating !== "0" ? `&vote_average.gte=${minRating}` : "";
        const countries = REGION_PRESETS[region]?.countries || "";
        const countryParam = countries ? `&with_origin_country=${countries}` : "";
        const path = `/discover/${type}?with_genres=${selectedGenre.id}${countryParam}&sort_by=${sortBy}${yearParam}${ratingParam}&page=${pageNum}`;
        const data = await tmdbFetch(path, apiKey);

        if (pageNum === 1) {
          setItems(data.results || []);
        } else {
          setItems((prev) => [...prev, ...(data.results || [])]);
        }
        setPage(data.page || 1);
        setTotalPages(data.total_pages || 1);
      } catch (err) {
        console.error("Discover fetch failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedGenre, type, sortBy, year, minRating, region, apiKey],
  );

  useEffect(() => {
    if (selectedGenre) {
      setItems([]);
      setPage(1);
      fetchDiscoverResults(1);
    }
  }, [selectedGenre, sortBy, year, minRating, region, fetchDiscoverResults]);

  const loadMore = () => {
    if (page < totalPages && !loading) {
      fetchDiscoverResults(page + 1);
    }
  };

  const handleSelectGenre = (genre) => {
    setSelectedGenre(genre);
  };

  const handleBackToGenres = () => {
    setSelectedGenre(null);
    setItems([]);
  };

  return (
    <div className="discover-container" ref={scrollRef}>
      {/* ── Page Header ── */}
      <div className="discover-header">
        <div className="discover-title-row">
          <h1>Discover</h1>
          <div className="type-toggle">
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
          <div className="region-filter-bar" style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            {Object.entries(REGION_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                className={`toggle-btn ${region === id ? "active" : ""}`}
                onClick={() => setRegion(id)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: region === id ? "var(--accent)" : "var(--surface)",
                  color: region === id ? "#fff" : "var(--text3)",
                  transition: "all var(--duration-normal) var(--ease-out)"
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        )}

        {selectedGenre && (
          <div className="discover-filters">
            <button className="btn btn-secondary btn-back" onClick={handleBackToGenres}>
              ← Genres
            </button>
            <span className="current-genre-label" style={{ background: selectedGenre.gradient }}>
              {selectedGenre.name}
            </span>

            <div className="filter-controls">
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
                <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "16px", color: "var(--text)" }}>
                  Popular in {REGION_PRESETS[region].name}
                </h2>
                {loadingRegionItems ? (
                  <div className="loader" style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="spinner" />
                  </div>
                ) : regionItems.length > 0 ? (
                  <div className="scroll-row">
                    {regionItems.map((item) => (
                      <MediaCard
                        key={`${item.id}_${item.media_type || type}`}
                        item={{ ...item, media_type: type }}
                        onClick={() => onNavigate(type, item)}
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
            <div>
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
            </div>
          </div>
        ) : (
          /* Discover Results Grid View */
          <div className="discover-results-view fade-in">
            <div className="discover-results-grid">
              {items.map((item) => (
                <MediaCard
                  key={`${item.id}_${item.media_type || type}`}
                  item={{ ...item, media_type: type }}
                  onClick={() => onNavigate(type, item)}
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
