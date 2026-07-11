import { useEffect, useMemo, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";
import PlanetGrid from "../components/PlanetGrid";
import StarGrid from "../components/StarGrid";

export default function FavoritesPage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [view, setView] = useState("tracks");
  useEffect(() => { window.electron?.musicListFavorites?.().then(setItems).catch(() => {}); }, []);
  const groups = useMemo(() => ({
    tracks: items.filter((item) => item.kind === "track").map((item) => item.payload),
    albums: items.filter((item) => item.kind === "album").map((item) => item.payload),
    artists: items.filter((item) => item.kind === "artist").map((item) => item.payload),
  }), [items]);
  return <div className="music-page music-favorites-page">
    <header className="music-page-header compact"><span className="music-eyebrow">Kept close</span><h1>Favorites</h1><p>Liked tracks, saved albums and followed artists in one library.</p></header>
    <nav className="music-filter-pills" aria-label="Favorite type">{[["tracks", "Tracks"], ["albums", "Albums"], ["artists", "Artists"]].map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} aria-pressed={view === id}><span>{label}</span><small aria-label={`${groups[id].length} ${label.toLowerCase()}`}>{groups[id].length}</small></button>)}</nav>
    <section className="music-section">{view === "tracks" && <MusicTrackList tracks={groups.tracks} empty="Favorite tracks will gather here." />}
      {view === "albums" && <PlanetGrid items={groups.albums} empty="Saved albums will gather here." onNavigate={onNavigate} />}
      {view === "artists" && <StarGrid items={groups.artists} empty="Followed artists will gather here." onNavigate={onNavigate} />}</section>
  </div>;
}
