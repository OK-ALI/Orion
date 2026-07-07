import { useEffect, useState } from "react";
import MusicArtwork from "../components/MusicArtwork";
import MoonTrackList from "../components/MoonTrackList";
import PlanetGrid from "../components/PlanetGrid";

export default function ArtistPage({ selected, onNavigate }) {
  const [details, setDetails] = useState({ status: "idle", artist: selected });
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  useEffect(() => {
    if (!selected) return;
    setDetails({ status: "loading", artist: selected });
    window.electron?.musicGetDetails?.("artist", selected).then((res) => {
      if (res && res.ok) {
        setDetails({ status: "idle", artist: res.value || selected });
        setTracks(res.value?.tracks || []);
        setAlbums(res.value?.albums || []);
      } else {
        setDetails({ status: "error", error: res?.error || "Failed to retrieve artist details.", artist: selected });
      }
    }).catch((error) => setDetails({ status: "error", error: error?.message || "Failed to profile artist.", artist: selected }));
  }, [selected?.id, selected?.provider]);

  if (!details.artist) return <div className="music-page"><div className="music-empty"><h2>Signal lost</h2><p>The artist profile is unavailable.</p></div></div>;
  return <div className="music-page music-artist-page"><header className="music-page-header"><div><span className="music-eyebrow">{details.artist.provider || "Library"}</span><h1>{details.artist.name}</h1><p>{details.artist.genre || "Artist"}</p></div><MusicArtwork className="music-round-art" track={{ ...details.artist, artworkUrl: details.artist.profileImageUrl || details.artist.artworkUrl }} label={`Portrait for ${details.artist.name}`} /></header>
    {details.status === "error" && <div className="music-provider-warning">{details.error}</div>}
    <section className="music-section"><h2>Top matching tracks</h2><MoonTrackList tracks={tracks.slice(0, 30)} empty={details.status === "loading" ? "Mapping this artist's catalog…" : "No playable tracks are available from the active sources."} /></section>
    {albums.length > 0 && <section className="music-section"><h2>Releases</h2><PlanetGrid items={albums} onNavigate={onNavigate} /></section>}</div>;
}
