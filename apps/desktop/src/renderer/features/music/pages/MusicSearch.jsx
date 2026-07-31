import { useEffect, useMemo, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";
import PlanetGrid from "../components/PlanetGrid";
import StarGrid from "../components/StarGrid";
import MusicArtwork from "../components/MusicArtwork";
import { useMusic } from "../context/MusicProvider";

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
  const music = useMusic();
  const [query, setQuery] = useState(() => String(selected?.query || ""));
  const [scope, setScope] = useState("all");
  const [response, setResponse] = useState({ results: [], errors: [] });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (selected?.query != null) setQuery(String(selected.query));
  }, [selected?.query]);

  useEffect(() => {
    if (query.trim().length < 2) {
      let cancelled = false;
      setLoading(true);
      window.electron?.musicGetDashboard?.().then((result) => {
        if (cancelled) return;
        if (!result?.ok) {
          setResponse({ results: [], errors: result?.errors || [result?.error || "Music discovery is unavailable."] });
          return;
        }
        const value = { tracks: [], albums: [], artists: [], playlists: [] };
        for (const section of result.dashboard?.sections || []) {
          if (value[section.type]) value[section.type].push(...(section.items || []));
        }
        setResponse({ results: [{ providerId: "music-dashboard", value }], errors: result.errors || [] });
      }).catch((error) => {
        if (!cancelled) setResponse({ results: [], errors: [error?.message || "Music discovery is unavailable."] });
      }).finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
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
  const playlists = useMemo(() => mergeResults(response.results, "playlists"), [response]);
  const resultCount = tracks.length + artists.length + albums.length + playlists.length;
  const topResult = artists[0] || albums[0];
  const continuation = response.results?.[0]?.continuation || null;
  const loadMore = async () => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);
    const result = await window.electron?.musicContinueSearch?.(query.trim(), continuation);
    if (result?.ok && result.result) setResponse((current) => {
      const next = result.result;
      return { errors: [...(current.errors || [])], results: [{ ...next, value: {
        artists: [...mergeResults(current.results, "artists"), ...(next.value?.artists || [])],
        albums: [...mergeResults(current.results, "albums"), ...(next.value?.albums || [])],
        tracks: [...mergeResults(current.results, "tracks"), ...(next.value?.tracks || [])],
        playlists: [...mergeResults(current.results, "playlists"), ...(next.value?.playlists || [])],
      } }] };
    });
    setLoadingMore(false);
  };

  return (
    <div className="music-page music-search-page">
      <header className="music-page-header compact">
        <span className="music-eyebrow">Search Music Planet</span>
        <h1>Find your next favorite</h1>
        <p>Explore songs, albums, artists and playlists from one place.</p>
      </header>
      <div className="music-search-deck">
        <div className="planet-search-box music-orbital-search">
          <svg className="music-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
          <input autoFocus aria-label="Search artists, albums and tracks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Artists, albums and tracks" />
          {query && <button className="music-search-clear" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
          {loading && <span className="music-control-loader" role="status" aria-label="Searching Music Planet"><i aria-hidden="true" /></span>}
        </div>
        <div className="music-filter-pills" aria-label="Search result type">
          {[["all", "All"], ["tracks", "Tracks"], ["albums", "Albums"], ["artists", "Artists"], ["playlists", "Playlists"]].map(([id, label]) => (
            <button key={id} className={scope === id ? "active" : ""} onClick={() => setScope(id)} aria-pressed={scope === id}>{label}</button>
          ))}
        </div>
      </div>
      {loading && <div className="music-loading-status" role="status"><span className="music-button-loader"><i aria-hidden="true" /></span><span>{query.trim().length >= 2 ? `Searching for “${query}”…` : "Mapping music to explore…"}</span></div>}
      {!!response.errors?.length && <div className="music-provider-warning">Some sources did not respond. Available results are shown.</div>}
      {!loading && resultCount > 0 && <div className="music-result-summary"><strong>{resultCount}</strong><span>{query.trim().length >= 2 ? "matches from active signals" : "signals ready to explore"}</span></div>}
      {scope === "all" && topResult && (
        <section className="music-search-feature">
          <button className={artists[0] ? "star-card top-result" : "planet-card top-result"} onClick={() => onNavigate(artists[0] ? "music-artist" : "music-album", topResult)}>
            <MusicArtwork variant={artists[0] ? "artist" : "album"} className="art-container" track={{ ...topResult, artworkUrl: topResult.profileImageUrl || topResult.artworkUrl }} label={`Artwork for ${topResult.name || topResult.title || "top result"}`} />
            <span className="music-eyebrow">Top result</span>
            <h2>{topResult.name || topResult.title}</h2>
            <p className="music-muted">{artists[0] ? "Artist" : topResult.artistName || "Album"}</p>
          </button>
          {tracks.length > 0 && <div className="music-search-quick-play"><span className="music-eyebrow">Quick play</span><MusicTrackList tracks={tracks.slice(0, 5)} layout="list" /></div>}
        </section>
      )}
      {(scope === "all" || scope === "artists") && artists.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Profiles</span><h2>Artists</h2></div></div><StarGrid items={artists.slice(0, 10)} onNavigate={onNavigate} /></section>}
      {(scope === "all" || scope === "albums") && albums.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Releases</span><h2>Albums</h2></div></div><PlanetGrid items={albums.slice(0, 10)} onNavigate={onNavigate} /></section>}
      {(scope === "all" || scope === "playlists") && playlists.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Collections</span><h2>Playlists</h2></div></div><div className="music-open-list">{playlists.map((playlist) => <button key={playlist.id} onClick={async () => { const result = await window.electron?.musicGetDetails?.("playlist", playlist); const values = result?.value?.tracks || []; if (values.length) music.playTrack(values[0], values); }}><strong>{playlist.title}</strong><small>Open and play</small></button>)}</div></section>}
      {(scope === "all" || scope === "tracks") && tracks.length > 0 && <section className="music-section"><div className="music-section-heading"><div><span>Playable now</span><h2>Tracks</h2></div></div><MusicTrackList tracks={tracks} layout="list" /></section>}
      {continuation && <div className="music-load-more"><button onClick={loadMore} disabled={loadingMore}>{loadingMore ? <><span className="music-button-loader"><i /></span>Loading more…</> : "Load more"}</button></div>}
      {query.length >= 2 && !loading && !resultCount && <div className="music-empty">No music matched “{query}”. Try a title and artist together.</div>}
      {query.trim().length < 2 && !loading && !resultCount && <div className="music-empty"><h2>Discovery is quiet</h2><p>Search for an artist, album or track from the Music Planet header, or retry when you are online.</p><button onClick={() => setQuery("Top songs")}>Explore top songs</button></div>}
    </div>
  );
}
