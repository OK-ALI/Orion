import { useEffect, useMemo, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";
import PlanetGrid from "../components/PlanetGrid";
import StarGrid from "../components/StarGrid";

const FALLBACK_ART = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><defs><radialGradient id='g' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='%237d5fff' stop-opacity='0.6'/><stop offset='100%' stop-color='%2307070b' stop-opacity='0.95'/></radialGradient></defs><circle cx='100' cy='100' r='100' fill='url(%23g)'/></svg>";

function mergeResults(groups, key) {
  const map = new Map();
  for (const group of groups || []) for (const item of group.value?.[key] || []) {
    const identity = `${String(item.name || item.title).toLowerCase()}\0${String(item.artistName || "").toLowerCase()}`;
    const existing = map.get(identity);
    map.set(identity, existing ? { ...existing, providerRefs: [...(existing.providerRefs || [existing.source]), item.source].filter(Boolean) } : item);
  }
  return [...map.values()];
}

export default function MusicSearch({ selected, onNavigate }) {
  const [query, setQuery] = useState(() => String(selected?.query || ""));
  const [scope, setScope] = useState("all");
  const [response, setResponse] = useState({ results: [], errors: [] });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (selected?.query != null) setQuery(String(selected.query));
  }, [selected?.query]);
  
  useEffect(() => {
    if (query.trim().length < 2) { setResponse({ results: [], errors: [] }); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      window.electron?.musicSearch?.(query.trim()).then((value) => {
        if (!cancelled) setResponse(value || { results: [], errors: [] });
      }).catch((error) => {
        if (!cancelled) setResponse({ results: [], errors: [error?.message || "Music search failed."] });
      }).finally(() => { if (!cancelled) setLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);
  
  const tracks = useMemo(() => mergeResults(response.results, "tracks"), [response]);
  const artists = useMemo(() => mergeResults(response.results, "artists"), [response]);
  const albums = useMemo(() => mergeResults(response.results, "albums"), [response]);
  const resultCount = tracks.length + artists.length + albums.length;
  const topResult = artists[0] || albums[0];
  
  return <div className="music-page music-search-page"><header className="music-page-header compact"><span className="music-eyebrow">Across your sources</span><h1>Find your next signal</h1><p>Search every enabled catalog from one quiet, focused place.</p></header>
    <div className="music-search-deck"><div className="planet-search-box"><svg viewBox="0 0 24 24" aria-hidden="true" style={{position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)', width: '20px', fill: 'none', stroke: 'var(--music-muted)', strokeWidth: 2}}><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input style={{paddingLeft: '3.5rem'}} autoFocus aria-label="Search artists, albums and tracks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Artists, albums and tracks" />{query && <button onClick={() => setQuery("")} aria-label="Clear search" style={{position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--music-text)', fontSize: '1.5rem'}}>×</button>}{loading && <i className="music-control-spinner" style={{position: 'absolute', right: '4rem', top: '50%', transform: 'translateY(-50%)'}} />}</div>
      <div className="music-filter-pills" aria-label="Search result type">{[["all", "All"], ["tracks", "Tracks"], ["albums", "Albums"], ["artists", "Artists"]].map(([id, label]) => <button key={id} className={scope === id ? "active" : ""} onClick={() => setScope(id)} aria-pressed={scope === id}>{label}</button>)}</div></div>
    {!!response.errors?.length && <div className="music-provider-warning">Some sources did not respond. Available results are shown.</div>}
    {query.length >= 2 && !loading && resultCount > 0 && <div className="music-result-summary"><strong>{resultCount}</strong><span>matches assembled from your active sources</span></div>}
    {scope === "all" && topResult && <section className="music-search-feature"><div><span className="music-eyebrow">Top result</span>
      <div className={artists[0] ? "star-card" : "planet-card"} onClick={() => onNavigate(artists[0] ? "music-artist" : "music-album", topResult)} style={{cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start', border: '1px solid var(--music-line)', padding: '2rem', borderRadius: '24px', background: 'rgba(255,255,255,0.02)'}}>
        <div className="art-container" style={{width: '120px', height: '120px'}}>
          <img src={topResult.profileImageUrl || topResult.artworkUrl || FALLBACK_ART} onError={(e) => { e.target.src = FALLBACK_ART; }} alt="top-result" />
        </div>
        <h2 style={{margin: '1rem 0 0.5rem 0', fontSize: '2rem'}}>{topResult.name || topResult.title}</h2><p className="music-muted">{artists[0] ? "Artist" : topResult.artistName || "Album"}</p>
      </div>
    </div>{tracks.length > 0 && <div style={{flex: 1}}><span className="music-eyebrow" style={{display: 'block', marginBottom: '1rem'}}>Quick play</span><MusicTrackList tracks={tracks.slice(0, 5)} layout="list" /></div>}</section>}
    {(scope === "all" || scope === "artists") && artists.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Profiles</span><h2>Artists</h2></div></div><StarGrid items={artists.slice(0, 10)} onNavigate={onNavigate} /></section>}
    {(scope === "all" || scope === "albums") && albums.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Releases</span><h2>Albums</h2></div></div><PlanetGrid items={albums.slice(0, 10)} onNavigate={onNavigate} /></section>}
    {(scope === "all" || scope === "tracks") && tracks.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Playable now</span><h2>Tracks</h2></div></div><MusicTrackList tracks={tracks} layout="list" /></section>}
    {query.length >= 2 && !loading && !resultCount && <div className="music-empty">No music matched “{query}”. Try a title and artist together.</div>}
  </div>;
}
