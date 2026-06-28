import { useState, useEffect, useRef } from "react";
import { tmdbFetch } from "../../services/tmdb";
import MediaCard from "../../components/media/MediaCard";
import { SearchIcon } from "../../components/common/Icons";

export default function SearchResultsPage({ apiKey, item: initialQuery, onNavigate, isActive }) {
  const [query, setQuery] = useState(typeof initialQuery === "string" ? initialQuery : "");
  const [filter, setFilter] = useState("all"); // "all" | "movie" | "tv"
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (typeof initialQuery === "string") {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isActive) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isActive]);

  useEffect(() => {
    const qStr = typeof query === "string" ? query : "";
    if (!qStr.trim() || !apiKey) {
      setResults([]);
      return;
    }

    let mounted = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await tmdbFetch(
          `/search/multi?query=${encodeURIComponent(query)}&page=1`,
          apiKey,
        );
        if (mounted) {
          // Filter out people or other media types that are not movies/tv
          const filteredResults = (data.results || []).filter(
            (r) => r.media_type === "movie" || r.media_type === "tv"
          );
          setResults(filteredResults);
        }
      } catch (err) {
        console.error("Full page search fetch failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 400);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query, apiKey]);

  const displayedResults = results.filter((r) => {
    if (filter === "all") return true;
    return r.media_type === filter;
  });

  return (
    <div className="search-results-page">
      <div className="search-results-header">
        <h1>Search Results</h1>
        <div className="search-bar-full">
          <SearchIcon size={22} className="search-icon-inside" />
          <input
            ref={inputRef}
            type="text"
            className="search-input-full"
            placeholder="Type titles, genres, or keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.trim() && (
          <div className="search-filter-tabs">
            <button
              className={`filter-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({results.length})
            </button>
            <button
              className={`filter-tab ${filter === "movie" ? "active" : ""}`}
              onClick={() => setFilter("movie")}
            >
              Movies ({results.filter((r) => r.media_type === "movie").length})
            </button>
            <button
              className={`filter-tab ${filter === "tv" ? "active" : ""}`}
              onClick={() => setFilter("tv")}
            >
              TV Series ({results.filter((r) => r.media_type === "tv").length})
            </button>
          </div>
        )}
      </div>

      <div className="search-results-content">
        {loading && (
          <div className="loader">
            <div className="spinner" />
          </div>
        )}

        {!loading && query.trim() && displayedResults.length === 0 && (
          <div className="search-empty-state">
            <p>No results found for "{query}" matching your criteria.</p>
          </div>
        )}

        {!loading && !query.trim() && (
          <div className="search-prompt-state">
            <p>Enter search keywords above to begin exploration.</p>
          </div>
        )}

        {!loading && displayedResults.length > 0 && (
          <div className="search-results-grid fade-in">
            {displayedResults.map((item) => (
              <MediaCard
                key={`${item.media_type}_${item.id}`}
                item={item}
                onClick={(itemData) => {
                  const actualItem = itemData && !itemData.nativeEvent ? itemData : item;
                  onNavigate(actualItem.media_type || "movie", actualItem);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
