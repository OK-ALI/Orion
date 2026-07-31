import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon, CloseIcon } from "../common/Icons";
import { filterSearchResults, findDuplicateSearchTitles, getSearchTitleKey, SEARCH_CINEMAS, searchTmdb } from "../../services/search";
import { storage } from "../../services/settingsStore";
import SearchResultRow from "../media/SearchResultRow";

const HISTORY_KEY = "searchHistory";
const MAX_HISTORY = 12;
const QUICK_RESULT_LIMIT = 12;
const QUICK_FILTERS = [["all", "All"], ["movie", "Movies"], ["tv", "TV"], ["person", "People"]];
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
  const [quickFilter, setQuickFilter] = useState("all");
  const [cinemaFilter, setCinemaFilter] = useState("global");
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
    const timer = setTimeout(() => { setShouldRender(false); setAnimState(""); setQuery(""); setResults([]); setQuickFilter("all"); setCinemaFilter("global"); }, 300);
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
        if (requestRef.current === requestId) setResults(response.results);
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

  const counts = useMemo(() => Object.fromEntries(QUICK_FILTERS.map(([value]) => [
    value,
    filterSearchResults(results, value, cinemaFilter).length,
  ])), [cinemaFilter, results]);
  const cinemaCounts = useMemo(() => Object.fromEntries(SEARCH_CINEMAS.map(({ id }) => [
    id, filterSearchResults(results, quickFilter, id).length,
  ])), [quickFilter, results]);
  const filteredResults = useMemo(() => filterSearchResults(results, quickFilter, cinemaFilter), [cinemaFilter, quickFilter, results]);
  const visibleResults = useMemo(() => filteredResults.slice(0, QUICK_RESULT_LIMIT), [filteredResults]);
  const duplicateTitles = useMemo(() => findDuplicateSearchTitles(filteredResults), [filteredResults]);

  useEffect(() => { setActiveIndex(0); }, [cinemaFilter, quickFilter]);
  useEffect(() => {
    if (activeIndex >= visibleResults.length) setActiveIndex(Math.max(0, visibleResults.length - 1));
  }, [activeIndex, visibleResults.length]);

  const handleKey = (event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key === "ArrowDown" && visibleResults.length) { event.preventDefault(); setActiveIndex((index) => (index + 1) % visibleResults.length); }
    if (event.key === "ArrowUp" && visibleResults.length) { event.preventDefault(); setActiveIndex((index) => (index - 1 + visibleResults.length) % visibleResults.length); }
    if (event.key === "Enter" && query.trim()) {
      event.preventDefault();
      if (visibleResults[activeIndex]) handleSelect(visibleResults[activeIndex]);
      else addToHistory(query);
    }
  };

  if (!shouldRender) return null;
  const showHistory = !query && history.length > 0;
  return (
    <div className={`quick-search-overlay ${animState}`} onClick={(event) => event.target === event.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Quick search">
      <div className={`search-box ${animState}`}>
        <div className="search-input-wrap"><SearchIcon /><input ref={inputRef} className="search-input" placeholder="Search movies, series and people…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKey} aria-activedescendant={visibleResults[activeIndex] ? `quick-search-${visibleResults[activeIndex].media_type}-${visibleResults[activeIndex].id}` : undefined} /><button type="button" className="btn btn-ghost btn-icon" onClick={query ? () => setQuery("") : onClose} aria-label={query ? "Clear search" : "Close search"}><CloseIcon /></button></div>
        <div className="search-results" aria-live="polite">
          {offline && <div className="search-offline">No internet connection. Search is unavailable.</div>}
          {!offline && loading && <div className="loader"><div className="spinner" /></div>}
          {!offline && !loading && error && <div className="search-empty">{error}</div>}
          {!offline && !loading && !error && query.trim() && results.length > 0 && <div className="quick-search-filter-stack">
            <div className="quick-search-filter-row"><span>Type</span><div className="quick-search-filters" role="tablist" aria-label="Quick search result type">{QUICK_FILTERS.map(([value, label]) => <button type="button" role="tab" aria-selected={quickFilter === value} className={quickFilter === value ? "active" : ""} key={value} onClick={() => { setQuickFilter(value); if (value === "person") setCinemaFilter("global"); }}>{label}<span>{counts[value]}</span></button>)}</div></div>
            <div className="quick-search-filter-row"><span>Cinema</span><div className="quick-search-filters quick-search-cinema-filters" role="tablist" aria-label="Quick search cinema">{SEARCH_CINEMAS.map(({ id, label }) => <button type="button" role="tab" aria-selected={cinemaFilter === id} className={cinemaFilter === id ? "active" : ""} key={id} onClick={() => { setCinemaFilter(id); if (id !== "global" && quickFilter === "person") setQuickFilter("all"); }}>{label}<span>{cinemaCounts[id]}</span></button>)}</div></div>
          </div>}
          {!loading && !error && query && results.length === 0 && <div className="search-empty">No results for “{query}”</div>}
          {!loading && !error && results.length > 0 && visibleResults.length === 0 && <div className="search-empty">No matching {cinemaFilter === "global" ? "results" : SEARCH_CINEMAS.find(({ id }) => id === cinemaFilter)?.label} titles on this result page.</div>}
          {!loading && visibleResults.length > 0 && <div className="quick-search-result-grid">{visibleResults.map((result, index) => <SearchResultRow key={`${result.media_type}_${result.id}`} result={result} active={activeIndex === index} duplicateTitle={duplicateTitles.has(getSearchTitleKey(result))} onHover={() => setActiveIndex(index)} onActivate={() => handleSelect(result)} />)}</div>}
          {!offline && !loading && !error && query.trim() && <button type="button" className="search-view-all" onClick={handleViewAll}>View all results for “{query.trim()}”</button>}
          {showHistory && <div className="search-history"><div className="search-history-header"><span className="search-history-label">Recent searches</span><button type="button" className="search-history-clear" onClick={clearHistory}>Clear all</button></div>{history.map((term) => <div key={term} className="search-history-item" role="button" tabIndex={0} onClick={() => { setQuery(term); inputRef.current?.focus(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setQuery(term); inputRef.current?.focus(); } }}><span className="search-history-icon"><SearchIcon /></span><span className="search-history-term">{term}</span><button type="button" className="search-history-remove" onClick={(event) => removeFromHistory(event, term)} title="Remove recent search" aria-label={`Remove ${term} from recent searches`}><CloseIcon /></button></div>)}</div>}
          {!query && history.length === 0 && <div className="search-hint">Search movies, series and people · <kbd>ESC</kbd> to close</div>}
        </div>
      </div>
    </div>
  );
}
