import { useEffect, useState } from "react";
import MusicEntityHero from "../components/MusicEntityHero";
import MusicTrackList from "../components/MusicTrackList";
import PlanetGrid from "../components/PlanetGrid";
import { useMusic } from "../context/MusicProvider";

export default function ArtistPage({ selected, onNavigate }) {
  const music = useMusic();
  const [followed, setFollowed] = useState(false);
  const [details, setDetails] = useState({ status: "idle", artist: selected });
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  useEffect(() => {
    if (!selected) return;
    setDetails({ status: "loading", artist: selected });
    window.electron?.musicGetDetails?.("artist", selected).then((res) => {
      if (res && res.ok) {
        const value = res.value || {};
        setDetails({ status: "idle", artist: value.artist || selected });
        setTracks(value.tracks || []);
        setAlbums(value.albums || []);
      } else {
        setDetails({ status: "error", error: res?.error || "Failed to retrieve artist details.", artist: selected });
      }
    }).catch((error) => setDetails({ status: "error", error: error?.message || "Failed to profile artist.", artist: selected }));
  }, [selected?.id, selected?.provider]);
  useEffect(() => { if (!selected?.id) return; const identity = `${selected.source?.provider || selected.provider || "unknown"}:${selected.id}`;
    window.electron?.musicListFavorites?.().then((items) => setFollowed((items || []).some((item) => item.kind === "artist" && item.identity === identity))).catch(() => {}); }, [selected?.id]);

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
      <div className="music-actions"><button className="primary" disabled={!tracks.length} onClick={() => music.playTrack(tracks[0], tracks)}>Play</button><button disabled={!tracks.length} onClick={() => { const values = tracks.slice().sort(() => Math.random() - .5); music.playTrack(values[0], values); }}>Shuffle</button><button disabled={music.connectionState === "offline"} onClick={() => music.startRadio(artist)}>{music.connectionState === "offline" ? "Radio requires a connection" : "Radio"}</button><button className={followed ? "active" : ""} onClick={async () => { const identity = `${artist.source?.provider || artist.provider || "unknown"}:${artist.id}`; const result = await window.electron?.musicToggleFavorite?.("artist", identity, artist); setFollowed(result?.favorite === true); }}>{followed ? "Following" : "Follow"}</button></div>
    </MusicEntityHero>
    {details.status === "error" && <div className="music-provider-warning" role="status">{details.error}</div>}
    <section className="music-section"><h2>Top matching tracks</h2><MusicTrackList tracks={tracks.slice(0, 30)} layout="list" empty={details.status === "loading" ? "Mapping this artist's catalog…" : details.status === "error" ? "Track list unavailable." : "No playable tracks are available from the active sources."} /></section>
    {albums.length > 0 && <section className="music-section"><h2>Releases</h2><PlanetGrid items={albums} onNavigate={onNavigate} /></section>}
  </div>;
}
