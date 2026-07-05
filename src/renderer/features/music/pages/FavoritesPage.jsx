import { useEffect, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";

export default function FavoritesPage() {
  const [items, setItems] = useState([]);
  useEffect(() => { window.electron?.musicListFavorites?.().then(setItems).catch(() => {}); }, []);
  const tracks = items.filter((item) => item.kind === "track").map((item) => item.payload);
  return <div className="music-page"><header className="music-page-header compact"><span className="music-eyebrow">Kept close</span><h1>Favorites</h1><p>Tracks, albums and artists you have saved.</p></header>
    <MusicTrackList tracks={tracks} empty="Favorite tracks will gather here." /></div>;
}
