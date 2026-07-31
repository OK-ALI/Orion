import { useEffect, useState } from "react";
import { useMusic } from "../context/MusicProvider";
import MusicArtwork from "./MusicArtwork";

function duration(value) {
  if (!value) return "—";
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}`;
}

export default function MusicTrackList({ tracks = [], empty = "No tracks found.", layout = "list", compact = false }) {
  const music = useMusic();
  const [menuTrack, setMenuTrack] = useState(null);
  const [playlistTrack, setPlaylistTrack] = useState(null);

  if (!tracks?.length) return layout === "grid" ? <p className="music-muted">{empty}</p> : <div className="music-empty">{empty}</div>;

  if (layout === "grid") {
    return <div className="moon-track-list">{tracks.map((track, index) => <div
      key={`${track.provider || "music"}:${track.id}:${index}`}
      className={`moon-track-item ${music.current?.id === track.id ? "active" : ""}`}>
      <button className="moon-track-play" onClick={() => music.playTrack(track, tracks)} aria-label={`Play ${track.title} by ${track.artistName || "Unknown artist"}`}>
        <MusicArtwork className="art-container" track={{ ...track, artworkUrl: track.artworkUrl || track.album?.artworkUrl }} label={`Artwork for ${track.title || track.name || "track"}`} />
        <span className="track-info"><strong>{track.title || track.name}</strong><small>{track.artistName || "Unknown artist"}</small></span>
      </button>
      <button className="moon-track-playlist" onClick={() => setPlaylistTrack(track)} aria-label={`Add ${track.title} to playlist`}>+ Playlist</button>
    </div>)}{playlistTrack && <AddToPlaylistDialog track={playlistTrack} close={() => setPlaylistTrack(null)} />}</div>;
  }

  return <div className={`music-track-list${compact ? " is-compact" : ""}`}>
    {tracks.map((track, index) => <div key={`${track.provider || "music"}:${track.id}`} className={`music-track-row${music.current?.id === track.id ? " active" : ""}`}>
      <button className="music-track-main" onClick={() => music.playTrack(track, tracks)} aria-label={`Play ${track.title} by ${track.artistName || "Unknown artist"}`}>
        <span className="music-track-number">{music.current?.id === track.id && music.playing
          ? <i className="music-playing-bars" aria-hidden="true"><b /><b /><b /></i> : index + 1}</span>
        <MusicArtwork className="music-track-art" track={track} />
        <span className="music-track-copy"><strong>{track.title}</strong><small>{track.artistName || "Unknown artist"}</small></span>
        <span className="music-track-album">{track.albumTitle || "Single"}</span>
        <span className="music-track-duration">{duration(track.durationMs)}</span>
      </button>
      <button className="music-track-more" onClick={() => setMenuTrack(menuTrack?.id === track.id ? null : track)} aria-label={`More actions for ${track.title}`}>•••</button>
      <button className="music-track-add-playlist" onClick={() => setPlaylistTrack(track)} aria-label={`Add ${track.title} to playlist`}>+ Playlist</button>
      {menuTrack?.id === track.id && <TrackMenu music={music} track={track} close={() => setMenuTrack(null)} addToPlaylist={() => { setPlaylistTrack(track); setMenuTrack(null); }} />}
    </div>)}
    {playlistTrack && <AddToPlaylistDialog track={playlistTrack} close={() => setPlaylistTrack(null)} />}
  </div>;
}

function TrackMenu({ music, track, close, addToPlaylist }) {
  const act = (callback) => { callback(); close(); };
  return <div className="music-track-menu" role="menu">
    <button role="menuitem" onClick={() => act(() => music.playNextTrack(track))}>Play next</button>
    <button role="menuitem" onClick={() => act(() => music.addToQueue(track))}>Add to queue</button>
    <button role="menuitem" onClick={() => act(() => music.startRadio(track))}>Start radio</button>
    <button role="menuitem" onClick={addToPlaylist}>Add to playlist</button>
    <button role="menuitem" onClick={() => act(() => {
      const identity = `${track.provider || track.source?.provider || "unknown"}:${track.id}`;
      window.electron?.musicToggleFavorite?.("track", identity, track);
    })}>Toggle favorite</button>
  </div>;
}

export function AddToPlaylistDialog({ track, close }) {
  const [playlists, setPlaylists] = useState([]);
  const [status, setStatus] = useState("loading");
  const [newName, setNewName] = useState("");
  useEffect(() => {
    window.electron?.musicListPlaylists?.().then((items) => { setPlaylists(items || []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);
  const add = async (playlist) => {
    if (!playlist.items?.some((item) => item.id === track.id && item.provider === track.provider)) {
      await window.electron?.musicSavePlaylist?.({ ...playlist, items: [...(playlist.items || []), track] });
    }
    close();
  };
  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    await window.electron?.musicSavePlaylist?.({ name, description: "", items: [track] });
    close();
  };
  return <div className="music-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className="music-dialog" role="dialog" aria-modal="true" aria-label="Add track to playlist">
      <header><div><span className="music-eyebrow">Keep this track</span><h2>Add to playlist</h2></div><button onClick={close} aria-label="Close">×</button></header>
      {status === "loading" && <div className="music-loading-status"><span className="music-button-loader"><i /></span>Loading playlists…</div>}
      {status === "error" && <p className="music-muted">Playlists could not be loaded.</p>}
      {status === "ready" && !playlists.length && <p className="music-muted">Create a playlist first.</p>}
      <div className="music-dialog-list">{playlists.map((playlist) => <button key={playlist.id} onClick={() => add(playlist)}><strong>{playlist.name}</strong><small>{playlist.items?.length || 0} tracks</small></button>)}</div>
      <footer className="music-playlist-quick-create"><label><span>New playlist</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Playlist name" onKeyDown={(event) => event.key === "Enter" && create()} /></label><button className="primary" disabled={!newName.trim()} onClick={create}>Create and add</button></footer>
    </section>
  </div>;
}
