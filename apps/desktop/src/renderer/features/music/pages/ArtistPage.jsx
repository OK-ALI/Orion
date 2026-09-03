import { useEffect, useState } from "react";
import { useFavoritesStore } from "../stores/useFavoritesStore";
import MusicEntityHero from "../components/MusicEntityHero";
import MusicTrackList from "../components/MusicTrackList";
import PlanetGrid from "../components/PlanetGrid";
import { useMusic } from "../context/MusicProvider";
import { isMusicRemoteEligible } from "../context/MusicConnectionContext";

export default function ArtistPage({ selected, onNavigate }) {
  const music = useMusic();
  const favorites = useFavoritesStore();
  const [details, setDetails] = useState({ status: "idle", artist: selected });
  const followed = favorites.isArtistFavorite(details.artist);
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDetails({ status: "loading", artist: selected });
    window.electron?.musicGetDetails?.("artist", selected).then((res) => {
      if (!active) return;
      if (res && res.ok) {
        const value = res.value || {};
        setDetails({ status: "idle", artist: value.artist || selected });
        setTracks(value.tracks || []);
        setAlbums(value.albums || []);
      } else {
        setDetails({ status: "error", error: res?.error || "Failed to retrieve artist details.", artist: selected });
      }
    }).catch((error) => { if (active) setDetails({ status: "error", error: error?.message || "Failed to profile artist.", artist: selected }); });
    return () => { active = false; };
  }, [selected?.id, selected?.provider, music.recoveryEpoch]);

  if (!details.artist) return <div className="music-page"><div className="music-empty"><h2>Signal lost</h2><p>The artist profile is unavailable.</p></div></div>;
  const artist = details.artist;
  return <div className="music-page music-entity-page music-artist-page">
    <MusicEntityHero
      eyebrow={artist.provider || "Library"}
      title={artist.name}
      subtitle={artist.genre || "Artist"}
      facts={[
        tracks.length ? `${tracks.length} playable ${tracks.length === 1 ? "track" : "tracks"}` : "",
        albums.length ? `${albums.length} ${albums.length === 1 ? "release" : "releases"}` : "",
      ]}
      variant="artist"
      artworkTrack={{ ...artist, artworkUrl: artist.profileImageUrl || artist.artworkUrl }}
      artworkLabel={`Portrait for ${artist.name}`}
    >
      <div className="music-actions"><button className="primary" disabled={!tracks.length} onClick={() => music.playTrack(tracks[0], tracks)}>Play</button><button disabled={!tracks.length} onClick={() => { const values = tracks.slice().sort(() => Math.random() - .5); music.playTrack(values[0], values); }}>Shuffle</button><button disabled={!isMusicRemoteEligible(music.connectionState)} onClick={() => music.startRadio(artist)}>{!isMusicRemoteEligible(music.connectionState) ? "Radio requires a connection" : "Radio"}</button><button className={followed ? "active" : ""} aria-pressed={followed} onClick={() => favorites.toggleFavorite("artist", artist, artist)}>{followed ? "Following" : "Follow"}</button></div>
    </MusicEntityHero>
    {details.status === "error" && <div className="music-provider-warning" role="status">{details.error}</div>}
    <section className="music-section"><h2>Top matching tracks</h2><MusicTrackList tracks={tracks.slice(0, 30)} layout="list" empty={details.status === "loading" ? "Mapping this artist's catalog…" : details.status === "error" ? "Track list unavailable." : "No playable tracks are available from the active sources."} /></section>
    {albums.length > 0 && <section className="music-section"><h2>Releases</h2><PlanetGrid items={albums} onNavigate={onNavigate} /></section>}
  </div>;
}
