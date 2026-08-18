import { useEffect, useMemo, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";
import PlanetGrid from "../components/PlanetGrid";
import StarGrid from "../components/StarGrid";
import { useMusic } from "../context/MusicProvider";
import { groupFavoritePayloads } from "../utils/favorites";
import "../../../styles/features/music/collection-detail-polish.css";

export default function FavoritesPage({ onNavigate }) {
  const music = useMusic();
  const [view, setView] = useState("tracks");

  useEffect(() => {
    music.favorites?.loadFromDisk?.();
  }, [music.favorites?.loadFromDisk]);

  const items = useMemo(() => [
    ...(music.favorites?.tracks || []),
    ...(music.favorites?.albums || []),
    ...(music.favorites?.artists || []),
  ], [music.favorites?.tracks, music.favorites?.albums, music.favorites?.artists]);

  const groups = useMemo(() => groupFavoritePayloads(items), [items]);

  return <div className="music-page music-favorites-page">
    <header className="music-page-header compact"><span className="music-eyebrow">Kept close</span><h1>Favorites</h1><p>Liked tracks, saved albums and followed artists in one library.</p></header>
    <nav className="music-filter-pills" aria-label="Favorite type">{[["tracks", "Tracks"], ["albums", "Albums"], ["artists", "Artists"]].map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} aria-pressed={view === id}><span>{label}</span><small aria-label={`${groups[id].length} ${label.toLowerCase()}`}>{groups[id].length}</small></button>)}</nav>
    <section className="music-section">{view === "tracks" && <MusicTrackList tracks={groups.tracks} empty="Favorite tracks will gather here." />}
      {view === "albums" && <PlanetGrid items={groups.albums} empty="Saved albums will gather here." onNavigate={onNavigate} />}
      {view === "artists" && <StarGrid items={groups.artists} empty="Followed artists will gather here." onNavigate={onNavigate} />}</section>
  </div>;
}
