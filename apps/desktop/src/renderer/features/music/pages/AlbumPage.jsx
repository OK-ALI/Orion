import { useEffect, useState } from "react";
import MusicArtwork from "../components/MusicArtwork";
import MusicTrackList from "../components/MusicTrackList";
import { useMusic } from "../context/MusicProvider";

export default function AlbumPage({ selected, onNavigate }) {
  const music = useMusic();
  const [saved, setSaved] = useState(false);
  const [details, setDetails] = useState({ status: "idle", album: selected });
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    if (!selected) return;
    setDetails({ status: "loading", album: selected });
    window.electron?.musicGetDetails?.("album", selected).then((res) => {
      if (res && res.ok) {
        const value = res.value || {};
        setDetails({ status: "idle", album: value.album || selected });
        setTracks(value.tracks || []);
      } else {
        setDetails({ status: "error", error: res?.error || "Failed to catalog album details.", album: selected });
      }
    }).catch((error) => setDetails({ status: "error", error: error?.message || "Failed to catalog album.", album: selected }));
  }, [selected?.id, selected?.provider]);
  useEffect(() => { if (!selected?.id) return; const identity = `${selected.source?.provider || selected.provider || "unknown"}:${selected.id}`;
    window.electron?.musicListFavorites?.().then((items) => setSaved((items || []).some((item) => item.kind === "album" && item.identity === identity))).catch(() => {}); }, [selected?.id]);

  if (!details.album) return <div className="music-page"><div className="music-empty"><h2>Signal lost</h2><p>The album data is unavailable.</p></div></div>;
  return <div className="music-page music-album-page"><header className="music-page-header"><div><span className="music-eyebrow">{details.album.provider || "Library"}</span><h1>{details.album.title || details.album.name}</h1><p>{details.album.artistName}</p><p className="music-muted">{details.album.year || ""}</p><div className="music-actions"><button className="primary" disabled={!tracks.length} onClick={() => music.playTrack(tracks[0], tracks)}>Play</button><button disabled={!tracks.length} onClick={() => { const values = tracks.slice().sort(() => Math.random() - .5); music.playTrack(values[0], values); }}>Shuffle</button><button onClick={() => music.startRadio(details.album)}>Radio</button><button className={saved ? "active" : ""} onClick={async () => { const identity = `${details.album.source?.provider || details.album.provider || "unknown"}:${details.album.id}`; const result = await window.electron?.musicToggleFavorite?.("album", identity, details.album); setSaved(result?.favorite === true); }}>{saved ? "Saved" : "Save"}</button></div></div><MusicArtwork variant="album" className="music-album-art" track={details.album} label={`Artwork for ${details.album.title}`} /></header>
    {details.status === "error" && <div className="music-provider-warning">{details.error}</div>}
    <section className="music-section"><div className="music-section-heading"><div><span>{tracks.length || 0} tracks</span><h2>Tracklist</h2></div></div><MusicTrackList tracks={tracks} layout="list" empty={details.status === "loading" ? "Mapping this release…" : "This source has not returned an album tracklist yet."} /></section></div>;
}
