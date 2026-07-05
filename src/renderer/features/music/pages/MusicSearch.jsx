import { useEffect, useMemo, useState } from "react";
import MusicArtwork from "../components/MusicArtwork";
import MusicTrackList from "../components/MusicTrackList";

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
    <div className="music-search-deck"><div className="music-search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input autoFocus aria-label="Search artists, albums and tracks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Artists, albums and tracks" />{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}{loading && <i />}</div>
      <div className="music-filter-pills" aria-label="Search result type">{[["all", "All"], ["tracks", "Tracks"], ["albums", "Albums"], ["artists", "Artists"]].map(([id, label]) => <button key={id} className={scope === id ? "active" : ""} onClick={() => setScope(id)} aria-pressed={scope === id}>{label}</button>)}</div></div>
    {!!response.errors?.length && <div className="music-provider-warning">Some sources did not respond. Available results are shown.</div>}
    {query.length >= 2 && !loading && resultCount > 0 && <div className="music-result-summary"><strong>{resultCount}</strong><span>matches assembled from your active sources</span></div>}
    {scope === "all" && topResult && <section className="music-search-feature"><div><span className="music-eyebrow">Top result</span><MusicArtwork className={artists[0] ? "music-round-art" : "music-album-art"} track={topResult} label={`Artwork for ${topResult.name || topResult.title}`} /><h2>{topResult.name || topResult.title}</h2><p>{artists[0] ? "Artist" : topResult.artistName || "Album"}</p><button onClick={() => onNavigate(artists[0] ? "music-artist" : "music-album", topResult)}>Open {artists[0] ? "artist" : "album"}</button></div>{tracks.length > 0 && <div><span className="music-eyebrow">Quick play</span><MusicTrackList tracks={tracks.slice(0, 5)} compact /></div>}</section>}
    {(scope === "all" || scope === "artists") && artists.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Profiles</span><h2>Artists</h2></div></div><div className="music-square-grid music-artist-grid">{artists.slice(0, 10).map((artist) => <button key={artist.id} onClick={() => onNavigate("music-artist", artist)}><MusicArtwork className="music-round-art" track={{ ...artist, artworkUrl: artist.profileImageUrl || artist.artworkUrl }} label={`Portrait for ${artist.name}`} /><strong>{artist.name}</strong><small>Artist</small></button>)}</div></section>}
    {(scope === "all" || scope === "albums") && albums.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Releases</span><h2>Albums</h2></div></div><div className="music-square-grid">{albums.slice(0, 10).map((album) => <button key={album.id} onClick={() => onNavigate("music-album", album)}><MusicArtwork className="music-album-art" track={album} label={`Artwork for ${album.title}`} /><strong>{album.title}</strong><small>{album.artistName}</small></button>)}</div></section>}
    {(scope === "all" || scope === "tracks") && tracks.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Playable now</span><h2>Tracks</h2></div></div><MusicTrackList tracks={tracks} /></section>}
    {query.length >= 2 && !loading && !resultCount && <div className="music-empty">No music matched “{query}”. Try a title and artist together.</div>}
  </div>;
}
