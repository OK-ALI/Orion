import { useEffect, useState } from "react";
import { SearchIcon, SettingsIcon } from "../../../components/common/Icons";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";

export default function MusicHeader({ onNavigate, showSearch = true }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState(() => storage.get(STORAGE_KEYS.MUSIC_SEARCH_HISTORY) || []);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      const request = window.electron?.musicGetSearchSuggestions?.(query.trim());
      if (!request) return;
      Promise.resolve(request).then((result) => { if (!cancelled) setSuggestions(result?.suggestions || []); }).catch(() => {});
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const search = (value) => {
    const safe = String(value || "").trim();
    if (!safe) return;
    const nextHistory = [safe, ...history.filter((entry) => entry.toLowerCase() !== safe.toLowerCase())].slice(0, 10);
    setHistory(nextHistory); storage.set(STORAGE_KEYS.MUSIC_SEARCH_HISTORY, nextHistory);
    setQuery(safe); setFocused(false); onNavigate("music-search", { query: safe });
  };

  return <header className="music-header">
    <button className="music-header-title" onClick={() => onNavigate("music-home")} aria-label="Music Planet Home"><span className="music-header-planet" aria-hidden="true"><i /></span><span>Music Planet</span></button>
    {showSearch && <form className="music-header-search-form" onSubmit={(event) => { event.preventDefault(); search(query); }} role="search">
      <label className="music-header-search-input-wrapper"><SearchIcon size={18} /><span className="sr-only">Search Music Planet</span><input type="search" placeholder="Search tracks, artists and albums" value={query} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 140)} onChange={(event) => setQuery(event.target.value)} /></label>
      {focused && (suggestions.length > 0 || (!query && history.length > 0)) && <div className="music-search-suggestions" role="listbox">
        <header><span>{query ? "Suggestions" : "Recent searches"}</span>{!query && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setHistory([]); storage.set(STORAGE_KEYS.MUSIC_SEARCH_HISTORY, []); }}>Clear</button>}</header>
        {(query ? suggestions : history).map((item) => <button type="button" role="option" key={item} onMouseDown={(event) => event.preventDefault()} onClick={() => search(item)}><SearchIcon size={15} />{item}</button>)}
      </div>}
    </form>}
    <div className="music-header-controls"><button className="music-header-icon-btn" onClick={() => onNavigate("music-settings")} title="Music settings" aria-label="Open Music settings"><SettingsIcon size={20} /></button></div>
  </header>;
}
