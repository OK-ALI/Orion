import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon, CloseIcon } from "../common/Icons";
import { filterSearchResults, findDuplicateSearchTitles, getSearchTitleKey, SEARCH_CINEMAS, searchTmdb } from "../../services/search";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import SearchResultRow from "../media/SearchResultRow";
import { resolveQuickSearchPlacement } from "../search/searchOrbGeometry";
import QuickSearchFilterRail from "../search/QuickSearchFilterRail";
import MusicQuickSearchRow from "../search/MusicQuickSearchRow";
import { MUSIC_QUICK_FILTERS, useMusicQuickSearch } from "../search/useMusicQuickSearch";
import { useOptionalMusic } from "../../features/music/context/MusicProvider";
import { isMediaItemWatched } from "../../shared/utils/library";

const HISTORY_KEY = "searchHistory";
const MAX_HISTORY = 12;
const QUICK_RESULT_LIMIT = 12;
const QUICK_FILTERS = [["all", "All"], ["movie", "Movies"], ["tv", "TV"], ["person", "People"]];
const historyKeyFor = (world) => world === "music" ? STORAGE_KEYS.MUSIC_SEARCH_HISTORY : HISTORY_KEY;
const loadHistory = (world) => storage.get(historyKeyFor(world)) || [];

export default function SearchModal({
  isOpen,
  apiKey,
  onSelect,
  onViewAll,
  onMusicNavigate,
  onClose,
  offline,
  anchorRect = null,
  searchWorld = "cinema",
  isSaved,
  watched = {},
}) {
  const music = useOptionalMusic();
  const isMusic = searchWorld === "music";
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animState, setAnimState] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [cinemaLoading, setCinemaLoading] = useState(false);
  const [cinemaError, setCinemaError] = useState("");
  const [history, setHistory] = useState(() => loadHistory(searchWorld));
  const [quickFilter, setQuickFilter] = useState("all");
  const [cinemaFilter, setCinemaFilter] = useState("global");
  const [musicFilter, setMusicFilter] = useState("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef();
  const requestRef = useRef(0);
  const musicQuick = useMusicQuickSearch(isMusic ? query : "", musicFilter);

  useEffect(() => {
    setHistory(loadHistory(searchWorld));
    setQuery("");
    setResults([]);
    setQuickFilter("all");
    setCinemaFilter("global");
    setMusicFilter("all");
    setActiveIndex(0);
  }, [searchWorld]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setAnimState("entering");
      const timer = window.setTimeout(() => setAnimState("entered"), 16);
      return () => window.clearTimeout(timer);
    }
    if (!shouldRender) return undefined;
    setAnimState("exiting");
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setAnimState("");
      setQuery("");
      setResults([]);
      setQuickFilter("all");
      setCinemaFilter("global");
      setMusicFilter("all");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isOpen, shouldRender]);

  const anchored = Boolean(anchorRect);
  useEffect(() => {
    if (!shouldRender) return undefined;
    const previousOverflow = document.body.style.overflow;
    if (!anchored) document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => { window.clearTimeout(timer); document.body.style.overflow = previousOverflow; };
  }, [anchored, shouldRender, searchWorld]);

  useEffect(() => {
    if (isMusic) { setResults([]); setCinemaLoading(false); setCinemaError(""); return undefined; }
    const term = query.trim();
    const requestId = ++requestRef.current;
    setActiveIndex(0); setCinemaError("");
    if (!term || offline) { setResults([]); setCinemaLoading(false); return undefined; }
    const timer = window.setTimeout(async () => {
      setCinemaLoading(true);
      try {
        const response = await searchTmdb(term, 1, apiKey);
        if (requestRef.current === requestId) setResults(response.results);
      } catch {
        if (requestRef.current === requestId) { setResults([]); setCinemaError("Search is temporarily unavailable."); }
      } finally {
        if (requestRef.current === requestId) setCinemaLoading(false);
      }
    }, 380);
    return () => window.clearTimeout(timer);
  }, [apiKey, isMusic, offline, query]);

  const saveHistory = useCallback((next) => storage.set(historyKeyFor(searchWorld), next), [searchWorld]);
  const addToHistory = useCallback((term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((previous) => {
      const next = [trimmed, ...previous.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, [saveHistory]);
  const removeFromHistory = useCallback((event, term) => {
    event.stopPropagation();
    setHistory((previous) => { const next = previous.filter((entry) => entry !== term); saveHistory(next); return next; });
  }, [saveHistory]);
  const clearHistory = useCallback(() => { setHistory([]); saveHistory([]); }, [saveHistory]);

  const cinemaCounts = useMemo(() => Object.fromEntries(QUICK_FILTERS.map(([value]) => [
    value, filterSearchResults(results, value, cinemaFilter).length,
  ])), [cinemaFilter, results]);
  const cinemaScopeCounts = useMemo(() => Object.fromEntries(SEARCH_CINEMAS.map(({ id }) => [
    id, filterSearchResults(results, quickFilter, id).length,
  ])), [quickFilter, results]);
  const filteredResults = useMemo(() => filterSearchResults(results, quickFilter, cinemaFilter), [cinemaFilter, quickFilter, results]);
  const visibleCinemaResults = useMemo(() => filteredResults.slice(0, QUICK_RESULT_LIMIT), [filteredResults]);
  const visibleMusicResults = useMemo(() => musicQuick.items.slice(0, QUICK_RESULT_LIMIT), [musicQuick.items]);
  const duplicateTitles = useMemo(() => findDuplicateSearchTitles(filteredResults), [filteredResults]);
  const visibleResults = isMusic ? visibleMusicResults : visibleCinemaResults;
  const loading = isMusic ? musicQuick.loading : cinemaLoading;
  const error = isMusic ? musicQuick.error : cinemaError;

  useEffect(() => { setActiveIndex(0); }, [cinemaFilter, musicFilter, quickFilter, searchWorld]);
  useEffect(() => {
    if (activeIndex >= visibleResults.length) setActiveIndex(Math.max(0, visibleResults.length - 1));
  }, [activeIndex, visibleResults.length]);

  const handleCinemaSelect = useCallback((result) => {
    addToHistory(query);
    onSelect?.(result);
    onClose();
  }, [addToHistory, onClose, onSelect, query]);

  const handleMusicSelect = useCallback(async (entry) => {
    addToHistory(query);
    if (entry.kind === "track") music?.playTrack?.(entry.item, musicQuick.tracks);
    else if (entry.kind === "artist") onMusicNavigate?.("music-artist", entry.item);
    else if (entry.kind === "album") onMusicNavigate?.("music-album", entry.item);
    else if (entry.kind === "playlist") {
      const result = await window.electron?.musicGetDetails?.("playlist", entry.item);
      const tracks = result?.value?.tracks || [];
      if (tracks.length) music?.playTrack?.(tracks[0], tracks);
      else onMusicNavigate?.("music-search", { query: entry.title });
    }
    onClose();
  }, [addToHistory, music, musicQuick.tracks, onClose, onMusicNavigate, query]);

  const handleViewAll = useCallback(() => {
    const term = query.trim();
    if (!term) return;
    addToHistory(term);
    onViewAll?.(term);
    onClose();
  }, [addToHistory, onClose, onViewAll, query]);

  const handleKey = (event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key === "ArrowDown" && visibleResults.length) { event.preventDefault(); setActiveIndex((index) => (index + 1) % visibleResults.length); return; }
    if (event.key === "ArrowUp" && visibleResults.length) { event.preventDefault(); setActiveIndex((index) => (index - 1 + visibleResults.length) % visibleResults.length); return; }
    if (event.key === "Enter" && query.trim()) {
      event.preventDefault();
      const active = visibleResults[activeIndex];
      if (active) {
        if (isMusic) handleMusicSelect(active);
        else handleCinemaSelect(active);
      } else handleViewAll();
    }
  };

  if (!shouldRender) return null;
  const showHistory = !query && history.length > 0;
  const searchUnavailable = !isMusic && offline;
  const placement = anchored ? resolveQuickSearchPlacement(anchorRect, { width: window.innerWidth, height: window.innerHeight }) : null;
  const placementStyle = placement ? { ...placement.style, width: `${placement.width}px`, "--quick-search-panel-max-height": `${placement.style.maxHeight}px` } : undefined;
  const activeDescendant = isMusic
    ? visibleMusicResults[activeIndex] ? `quick-search-music-${visibleMusicResults[activeIndex].id}` : undefined
    : visibleCinemaResults[activeIndex] ? `quick-search-${visibleCinemaResults[activeIndex].media_type}-${visibleCinemaResults[activeIndex].id}` : undefined;

  return (
    <div className={`quick-search-overlay ${animState}${anchored ? " anchored" : ""}`} onClick={(event) => event.target === event.currentTarget && onClose()} role="dialog" aria-modal={anchored ? "false" : "true"} aria-label={`${isMusic ? "Music Planet" : "Cinema"} quick search`}>
      <div className={`search-box ${animState}${anchored ? ` anchored opens-${placement.horizontal} opens-${placement.vertical}` : ""}${isMusic ? " is-music-search" : ""}`} style={placementStyle}>
        <div className="search-input-wrap">
          <SearchIcon />
          <input ref={inputRef} className="search-input" placeholder={isMusic ? "Search tracks, artists and albums…" : "Search movies, series and people…"} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKey} aria-activedescendant={activeDescendant} />
          <button type="button" className="btn btn-ghost btn-icon" onClick={query ? () => setQuery("") : onClose} aria-label={query ? "Clear search" : "Close search"}><CloseIcon /></button>
        </div>
        <div className="search-results" aria-live="polite">
          {searchUnavailable && <div className="search-offline">No internet connection. Cinema search is unavailable.</div>}
          {!searchUnavailable && loading && <div className="loader"><div className="spinner" /></div>}
          {!searchUnavailable && !loading && error && <div className="search-empty">{error}</div>}

          {!searchUnavailable && !loading && !error && query.trim() && isMusic && musicQuick.counts.all > 0 && (
            <div className="quick-search-filter-stack quick-search-filter-stack--music">
              <QuickSearchFilterRail label="Music" ariaLabel="Music quick search result type">
                {MUSIC_QUICK_FILTERS.map(([value, label]) => <button type="button" role="tab" aria-selected={musicFilter === value} className={musicFilter === value ? "active" : ""} key={value} onClick={() => setMusicFilter(value)}>{label}<span>{musicQuick.counts[value]}</span></button>)}
              </QuickSearchFilterRail>
            </div>
          )}

          {!searchUnavailable && !loading && !error && query.trim() && !isMusic && results.length > 0 && (
            <div className="quick-search-filter-stack">
              <QuickSearchFilterRail label="Type" ariaLabel="Quick search result type">
                {QUICK_FILTERS.map(([value, label]) => <button type="button" role="tab" aria-selected={quickFilter === value} className={quickFilter === value ? "active" : ""} key={value} onClick={() => { setQuickFilter(value); if (value === "person") setCinemaFilter("global"); }}>{label}<span>{cinemaCounts[value]}</span></button>)}
              </QuickSearchFilterRail>
              <QuickSearchFilterRail label="Cinema" ariaLabel="Quick search cinema" className="quick-search-cinema-filters">
                {SEARCH_CINEMAS.map(({ id, label }) => <button type="button" role="tab" aria-selected={cinemaFilter === id} className={cinemaFilter === id ? "active" : ""} key={id} onClick={() => { setCinemaFilter(id); if (id !== "global" && quickFilter === "person") setQuickFilter("all"); }}>{label}<span>{cinemaScopeCounts[id]}</span></button>)}
              </QuickSearchFilterRail>
            </div>
          )}

          {!loading && !error && query.trim().length >= (isMusic ? 2 : 1) && (isMusic ? musicQuick.counts.all === 0 : results.length === 0) && <div className="search-empty">No results for “{query}”</div>}
          {!isMusic && !loading && !error && results.length > 0 && visibleCinemaResults.length === 0 && <div className="search-empty">No matching {cinemaFilter === "global" ? "results" : SEARCH_CINEMAS.find(({ id }) => id === cinemaFilter)?.label} titles on this result page.</div>}

          {!loading && visibleResults.length > 0 && (
            <div className="quick-search-result-grid">
              {isMusic
                ? visibleMusicResults.map((entry, index) => <MusicQuickSearchRow key={entry.id} entry={entry} active={activeIndex === index} onHover={() => setActiveIndex(index)} onActivate={() => handleMusicSelect(entry)} />)
                : visibleCinemaResults.map((result, index) => <SearchResultRow key={`${result.media_type}_${result.id}`} result={result} active={activeIndex === index} duplicateTitle={duplicateTitles.has(getSearchTitleKey(result))} onHover={() => setActiveIndex(index)} onActivate={() => handleCinemaSelect(result)} inMyList={!!isSaved?.(result)} watched={isMediaItemWatched(result, watched)} />)}
            </div>
          )}

          {!searchUnavailable && !loading && !error && query.trim() && (
            <button type="button" className="search-view-all" onClick={handleViewAll}>
              {isMusic ? "View all Music results for" : "View all results for"} “{query.trim()}”
            </button>
          )}
          {showHistory && <div className="search-history"><div className="search-history-header"><span className="search-history-label">Recent {isMusic ? "music " : ""}searches</span><button type="button" className="search-history-clear" onClick={clearHistory}>Clear all</button></div>{history.map((term) => <div key={term} className="search-history-item" role="button" tabIndex={0} onClick={() => { setQuery(term); inputRef.current?.focus(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setQuery(term); inputRef.current?.focus(); } }}><span className="search-history-icon"><SearchIcon /></span><span className="search-history-term">{term}</span><button type="button" className="search-history-remove" onClick={(event) => removeFromHistory(event, term)} title="Remove recent search" aria-label={`Remove ${term} from recent searches`}><CloseIcon /></button></div>)}</div>}
          {!query && history.length === 0 && <div className="search-hint">{isMusic ? "Search tracks, artists, albums and playlists" : "Search movies, series and people"} · <kbd>ESC</kbd> to close</div>}
        </div>
      </div>
    </div>
  );
}
