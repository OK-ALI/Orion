import { useEffect, useMemo, useRef, useState } from "react";
import MediaCard from "../../components/media/MediaCard";
import PersonCard from "../../components/media/PersonCard";
import { SearchIcon } from "../../components/common/Icons";
import { appendUniqueSearchResults, searchTmdb } from "../../services/search";

const FILTERS = [
  ["all", "All"],
  ["movie", "Movies"],
  ["tv", "TV Series"],
  ["person", "People"],
];

export default function SearchResultsPage({ apiKey, item: initialQuery, onNavigate, isActive }) {
  const [query, setQuery] = useState(typeof initialQuery === "string" ? initialQuery : "");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const inputRef = useRef();
  const requestRef = useRef(0);

  useEffect(() => {
    if (typeof initialQuery === "string") setQuery(initialQuery);
  }, [initialQuery]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!isActive) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isActive]);

  useEffect(() => {
    setFilter("all");
  }, [query]);

  useEffect(() => {
    const term = query.trim();
    const requestId = ++requestRef.current;
    setPage(1); setTotalPages(0); setError("");
    if (!term || !apiKey) { setResults([]); setLoading(false); return undefined; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await searchTmdb(term, 1, apiKey);
        if (requestRef.current !== requestId) return;
        setResults(response.results); setPage(response.page); setTotalPages(response.totalPages);
      } catch {
        if (requestRef.current === requestId) { setResults([]); setError("Search is temporarily unavailable. Check your connection and retry."); }
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, apiKey, retryKey]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([value]) => [
    value,
    value === "all" ? results.length : results.filter((item) => item.media_type === value).length,
  ])), [results]);
  const displayedResults = useMemo(() => filter === "all" ? results : results.filter((item) => item.media_type === filter), [results, filter]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    const requestId = ++requestRef.current;
    setLoadingMore(true); setError("");
    try {
      const response = await searchTmdb(query, page + 1, apiKey);
      if (requestRef.current !== requestId) return;
      setResults((previous) => appendUniqueSearchResults(previous, response.results));
      setPage(response.page); setTotalPages(response.totalPages);
    } catch {
      if (requestRef.current === requestId) setError("More results could not be loaded. Please retry.");
    } finally {
      if (requestRef.current === requestId) setLoadingMore(false);
    }
  };

  return (
    <div className="search-results-page">
      <div className="search-results-header">
        <span className="eyebrow">Explore Orion</span><h1>Search</h1>
        <div className="search-bar-full"><SearchIcon size={22} className="search-icon-inside" /><input ref={inputRef} type="search" className="search-input-full" placeholder="Search movies, series and people…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        {query.trim() && <div className="search-filter-tabs" role="tablist" aria-label="Search result type">{FILTERS.map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} className={`filter-tab${filter === value ? " active" : ""}`} onClick={() => setFilter(value)} key={value}>{label} ({counts[value]})</button>)}</div>}
      </div>

      <div className="search-results-content" aria-live="polite">
        {loading && <div className="loader"><div className="spinner" /><span>Searching Orion…</span></div>}
        {!loading && error && <div className="search-error-state"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={() => setRetryKey((value) => value + 1)}>Retry</button></div>}
        {!loading && !error && query.trim() && displayedResults.length === 0 && <div className="search-empty-state"><p>No {filter === "all" ? "" : `${FILTERS.find(([value]) => value === filter)?.[1].toLowerCase()} `}results found for “{query.trim()}”.</p></div>}
        {!loading && !query.trim() && <div className="search-prompt-state"><SearchIcon size={30} /><p>Search titles, performers, directors and creators.</p></div>}
        {!loading && displayedResults.length > 0 && <div className="search-results-grid fade-in">{displayedResults.map((result) => result.media_type === "person" ? <PersonCard key={`person_${result.id}`} person={result} onSelect={(person) => onNavigate("person", person)} /> : <MediaCard key={`${result.media_type}_${result.id}`} item={result} onClick={(selected) => onNavigate(selected.media_type || result.media_type, selected)} />)}</div>}
        {!loading && results.length > 0 && page < totalPages && <div className="search-load-more"><button type="button" className="btn btn-secondary" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading…" : "Load more"}</button><span>Page {page} of {totalPages}</span></div>}
      </div>
    </div>
  );
}
