import { useEffect, useState } from "react";
import MusicEntityHero from "../components/MusicEntityHero";
import MusicTrackList from "../components/MusicTrackList";
import { useMusic } from "../context/MusicProvider";
import { isMusicRemoteEligible } from "../context/MusicConnectionContext";

export default function AlbumPage({ selected, onNavigate }) {
  const music = useMusic();
  const [saved, setSaved] = useState(false);
  const [details, setDetails] = useState({ status: "idle", album: selected });
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDetails({ status: "loading", album: selected });
    window.electron?.musicGetDetails?.("album", selected).then((res) => {
      if (!active) return;
      if (res && res.ok) {
        const value = res.value || {};
        setDetails({ status: "idle", album: value.album || selected });
        setTracks(value.tracks || []);
      } else {
        setDetails({ status: "error", error: res?.error || "Failed to catalog album details.", album: selected });
      }
    }).catch((error) => { if (active) setDetails({ status: "error", error: error?.message || "Failed to catalog album.", album: selected }); });
    return () => { active = false; };
  }, [selected?.id, selected?.provider, music.recoveryEpoch]);
  useEffect(() => { if (!selected?.id) return; const identity = `${selected.source?.provider || selected.provider || "unknown"}:${selected.id}`;
    window.electron?.musicListFavorites?.().then((items) => setSaved((items || []).some((item) => item.kind === "album" && item.identity === identity))).catch(() => {}); }, [selected?.id]);

  if (!details.album) return <div className="music-page"><div className="music-empty"><h2>Signal lost</h2><p>The album data is unavailable.</p></div></div>;
  const album = details.album;
  const title = album.title || album.name;
  return <div className="music-page music-entity-page music-album-page">
    <MusicEntityHero
      eyebrow={album.provider || "Library"}
      title={title}
      subtitle={album.artistName}
      facts={[album.year ? String(album.year) : "", tracks.length ? `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}` : ""]}
      variant="album"
      artworkTrack={album}
      artworkLabel={`Artwork for ${title}`}
    >
      <div className="music-actions"><button className="primary" disabled={!tracks.length} onClick={() => music.playTrack(tracks[0], tracks)}>Play</button><button disabled={!tracks.length} onClick={() => { const values = tracks.slice().sort(() => Math.random() - .5); music.playTrack(values[0], values); }}>Shuffle</button><button disabled={!isMusicRemoteEligible(music.connectionState)} onClick={() => music.startRadio(album)}>{!isMusicRemoteEligible(music.connectionState) ? "Radio requires a connection" : "Radio"}</button><button className={saved ? "active" : ""} onClick={async () => { const identity = `${album.source?.provider || album.provider || "unknown"}:${album.id}`; const result = await window.electron?.musicToggleFavorite?.("album", identity, album); setSaved(result?.favorite === true); }}>{saved ? "Saved" : "Save"}</button></div>
    </MusicEntityHero>
    {details.status === "error" && <div className="music-provider-warning" role="status">{details.error}</div>}
    <section className="music-section"><div className="music-section-heading"><div><span>{tracks.length || 0} tracks</span><h2>Tracklist</h2></div></div><MusicTrackList tracks={tracks} layout="list" empty={details.status === "loading" ? "Mapping this release…" : details.status === "error" ? "Track list unavailable." : "This source has not returned an album tracklist yet."} /></section>
  </div>;
}
