import { useEffect, useState } from "react";

export default function IntroSection({ onSearch }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return undefined; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      window.electron?.musicGetSearchSuggestions?.(query.trim())
        .then((result) => { if (!cancelled) setSuggestions(result?.suggestions || []); })
        .catch(() => { if (!cancelled) setSuggestions([]); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);
  const submit = (value = query) => {
    const safe = String(value || "").trim();
    if (safe) onSearch(safe);
  };
  return (
    <section id="home" className="music-planet-section music-planet-section-intro" data-scene-state="idle-space">
      <h1 className="music-planet-title">Music Planet</h1>
      <p className="music-planet-subtitle">A universe made to be felt.</p>
      
      <div className="planet-search-box music-hero-search">
        <input 
          type="text" 
          value={query}
          placeholder="Search galaxies for artists, albums, or tracks..."
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        {focused && suggestions.length > 0 && <div className="music-hero-search-suggestions" role="listbox">
          {suggestions.slice(0, 6).map((item) => <button key={item} type="button" role="option"
            onMouseDown={(event) => event.preventDefault()} onClick={() => submit(item)}>{item}</button>)}
        </div>}
      </div>
    </section>
  );
}
