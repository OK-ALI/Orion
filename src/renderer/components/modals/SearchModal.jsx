import { useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon, CloseIcon } from "../common/Icons";
import { searchTmdb } from "../../services/search";
import { imgUrl } from "../../services/tmdb";
import { storage } from "../../services/settingsStore";

const HISTORY_KEY = "searchHistory";
const MAX_HISTORY = 12;
const loadHistory = () => storage.get(HISTORY_KEY) || [];
const saveHistory = (history) => storage.set(HISTORY_KEY, history);

export default function SearchModal({ isOpen, apiKey, onSelect, onViewAll, onClose, offline }) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animState, setAnimState] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(loadHistory);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef();
  const requestRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true); setAnimState("entering");
      const timer = setTimeout(() => setAnimState("entered"), 10);
      return () => clearTimeout(timer);
    }
    setAnimState("exiting");
    const timer = setTimeout(() => { setShouldRender(false); setAnimState(""); setQuery(""); setResults([]); }, 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => { clearTimeout(timer); document.body.style.overflow = previousOverflow; };
  }, [shouldRender]);

  useEffect(() => {
    const term = query.trim();
    const requestId = ++requestRef.current;
    setActiveIndex(0); setError("");
    if (!term || offline) { setResults([]); setLoading(false); return undefined; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await searchTmdb(term, 1, apiKey);
        if (requestRef.current === requestId) setResults(response.results.slice(0, 12));
      } catch {
        if (requestRef.current === requestId) { setResults([]); setError("Search is temporarily unavailable."); }
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 380);
    return () => clearTimeout(timer);
  }, [query, apiKey, offline]);

  const addToHistory = useCallback((term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((previous) => {
      const next = [trimmed, ...previous.filter((entry) => entry !== trimmed)].slice(0, MAX_HISTORY);
      saveHistory(next); return next;
    });
  }, []);
  const removeFromHistory = useCallback((event, term) => {
    event.stopPropagation();
    setHistory((previous) => { const next = previous.filter((entry) => entry !== term); saveHistory(next); return next; });
  }, []);
  const clearHistory = useCallback(() => { setHistory([]); saveHistory([]); }, []);
  const handleSelect = useCallback((result) => { addToHistory(query); onSelect(result); onClose(); }, [addToHistory, onClose, onSelect, query]);
  const handleViewAll = useCallback(() => {
    const term = query.trim();
    if (!term) return;
    addToHistory(term);
    onViewAll?.(term);
    onClose();
  }, [addToHistory, onClose, onViewAll, query]);

  const handleKey = (event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setActiveIndex((index) => (index + 1) % results.length); }
    if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setActiveIndex((index) => (index - 1 + results.length) % results.length); }
    if (event.key === "Enter" && query.trim()) {
      event.preventDefault();
      if (results[activeIndex]) handleSelect(results[activeIndex]);
      else addToHistory(query);
    }
  };

  if (!shouldRender) return null;
  const showHistory = !query && history.length > 0;
  return (
    <div className={`quick-search-overlay ${animState}`} onClick={(event) => event.target === event.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Quick search">
      <div className={`search-box ${animState}`}>
        <div className="search-input-wrap"><SearchIcon /><input ref={inputRef} className="search-input" placeholder="Search movies, series and people…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKey} aria-activedescendant={results[activeIndex] ? `quick-search-${results[activeIndex].media_type}-${results[activeIndex].id}` : undefined} /><button type="button" className="btn btn-ghost btn-icon" onClick={query ? () => setQuery("") : onClose} aria-label={query ? "Clear search" : "Close search"}><CloseIcon /></button></div>
        <div className="search-results" aria-live="polite">
          {offline && <div className="search-offline">No internet connection. Search is unavailable.</div>}
          {!offline && loading && <div className="loader"><div className="spinner" /></div>}
          {!offline && !loading && error && <div className="search-empty">{error}</div>}
          {!loading && !error && query && results.length === 0 && <div className="search-empty">No results for “{query}”</div>}
          {!loading && results.map((result, index) => {
            const isPerson = result.media_type === "person";
            const metadata = isPerson
              ? (result.known_for || []).map((known) => known.title || known.name).filter(Boolean).slice(0, 2).join(" · ") || result.known_for_department || "Person"
              : `${(result.release_date || result.first_air_date || "").slice(0, 4)}${result.vote_average ? ` · ★ ${result.vote_average.toFixed(1)}` : ""}`;
            return <button type="button" id={`quick-search-${result.media_type}-${result.id}`} key={`${result.media_type}_${result.id}`} className={`search-result${activeIndex === index ? " active" : ""}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => handleSelect(result)}><span className="search-result-image">{result.poster_path || result.profile_path ? <img src={imgUrl(result.poster_path || result.profile_path, "w92")} alt="" /> : <span>{(result.title || result.name || "?")[0]}</span>}</span><span className="search-result-info"><span className="search-result-title">{result.title || result.name}</span><span className="search-result-meta">{metadata}</span></span><span className={`search-result-type ${isPerson ? "type-person" : result.media_type === "tv" ? "type-tv" : "type-movie"}`}>{isPerson ? "Person" : result.media_type === "tv" ? "Series" : "Movie"}</span></button>;
          })}
          {!offline && !loading && !error && query.trim() && <button type="button" className="search-view-all" onClick={handleViewAll}>View all results for “{query.trim()}”</button>}
          {showHistory && <div className="search-history"><div className="search-history-header"><span className="search-history-label">Recent searches</span><button type="button" className="search-history-clear" onClick={clearHistory}>Clear all</button></div>{history.map((term) => <div key={term} className="search-history-item" role="button" tabIndex={0} onClick={() => { setQuery(term); inputRef.current?.focus(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setQuery(term); inputRef.current?.focus(); } }}><span className="search-history-icon"><SearchIcon /></span><span className="search-history-term">{term}</span><button type="button" className="search-history-remove" onClick={(event) => removeFromHistory(event, term)} title="Remove recent search" aria-label={`Remove ${term} from recent searches`}><CloseIcon /></button></div>)}</div>}
          {!query && history.length === 0 && <div className="search-hint">Search movies, series and people · <kbd>ESC</kbd> to close</div>}
        </div>
      </div>
    </div>
  );
}
