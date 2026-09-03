import { useState } from "react";
import { useMusic } from "../context/MusicProvider";
import { isMusicRemoteEligible } from "../context/MusicConnectionContext";
import MusicArtwork from "./MusicArtwork";
import AddToPlaylistDialog from "./AddToPlaylistDialog";
import MusicTrackMenuPortal from "./MusicTrackMenuPortal";
import "../../../styles/features/music/music-track-menu-portal.css";

function duration(value) {
  if (!value) return "—";
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}`;
}

function PlaylistAddIcon() {
  return <svg className="music-track-add-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3.5 5.5h8.5M3.5 9.5h7M3.5 13.5h5.5" />
    <path d="M15 9v6M12 12h6" />
  </svg>;
}

function MoreActionsIcon() {
  return <svg className="music-track-more-icon" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="4" cy="10" r="1.6" />
    <circle cx="10" cy="10" r="1.6" />
    <circle cx="16" cy="10" r="1.6" />
  </svg>;
}

export default function MusicTrackList({ tracks = [], empty = "No tracks found.", layout = "list", compact = false }) {
  const music = useMusic();
  const offline = !isMusicRemoteEligible(music.connectionState);
  const unavailable = (track) => track.missing ? "Local file is missing" : offline && track.provider !== "local" ? "Connection required" : "";
  const play = (track) => { if (!unavailable(track)) music.playTrack(track, tracks); };
  const [menuState, setMenuState] = useState(null);
  const [playlistTrack, setPlaylistTrack] = useState(null);

  if (!tracks?.length) return layout === "grid" ? <p className="music-muted">{empty}</p> : <div className="music-empty">{empty}</div>;

  if (layout === "grid") {
    return <div className="moon-track-list">{tracks.map((track, index) => <div
      key={`${track.provider || "music"}:${track.id}:${index}`}
      className={`moon-track-item ${music.current?.id === track.id ? "active" : ""}`}>
      <button className="moon-track-play" aria-disabled={!!unavailable(track)} onClick={() => play(track)} aria-label={`Play ${track.title} by ${track.artistName || "Unknown artist"}`}>
        <MusicArtwork className="art-container" track={{ ...track, artworkUrl: track.artworkUrl || track.album?.artworkUrl }} label={`Artwork for ${track.title || track.name || "track"}`} />
        <span className="track-info"><strong>{track.title || track.name}</strong><small>{track.artistName || "Unknown artist"}</small>{unavailable(track) && <small>{unavailable(track)}</small>}</span>
      </button>
      <button className="moon-track-playlist" onClick={() => setPlaylistTrack(track)} aria-label={`Add ${track.title} to playlist`}><PlaylistAddIcon /><span>Playlist</span></button>
    </div>)}{playlistTrack && <AddToPlaylistDialog track={playlistTrack} close={() => setPlaylistTrack(null)} />}</div>;
  }

  return <div className={`music-track-list${compact ? " is-compact" : ""}`}>
    {tracks.map((track, index) => <div key={`${track.provider || "music"}:${track.id}`} className={`music-track-row${music.current?.id === track.id ? " active" : ""}`}>
      <button className="music-track-main" aria-disabled={!!unavailable(track)} onClick={() => play(track)} aria-label={`Play ${track.title} by ${track.artistName || "Unknown artist"}`}>
        <span className="music-track-number">{music.current?.id === track.id && music.playing
          ? <i className="music-playing-bars" aria-hidden="true"><b /><b /><b /></i> : index + 1}</span>
        <MusicArtwork className="music-track-art" track={track} />
        <span className="music-track-copy"><strong>{track.title}</strong><small>{track.artistName || "Unknown artist"}</small>{unavailable(track) && <small>{unavailable(track)}</small>}</span>
        <span className="music-track-album">{track.albumTitle || "Single"}</span>
        <span className="music-track-duration">{duration(track.durationMs)}</span>
      </button>
      <div className="music-track-actions">
        <button className="music-track-add-playlist" onClick={() => setPlaylistTrack(track)} aria-label={`Add ${track.title} to playlist`}><PlaylistAddIcon /><span>Playlist</span></button>
        <button className="music-track-more" onClick={(event) => setMenuState(menuState?.track?.id === track.id ? null : { track, anchor: event.currentTarget })} aria-label={`More actions for ${track.title}`} aria-expanded={menuState?.track?.id === track.id}><MoreActionsIcon /></button>
      </div>
    </div>)}
    {menuState && <MusicTrackMenuPortal anchor={menuState.anchor} close={() => setMenuState(null)}>
      <TrackMenuItems music={music} track={menuState.track} close={() => setMenuState(null)}
        addToPlaylist={() => { setPlaylistTrack(menuState.track); setMenuState(null); }} />
    </MusicTrackMenuPortal>}
    {playlistTrack && <AddToPlaylistDialog track={playlistTrack} close={() => setPlaylistTrack(null)} />}
  </div>;
}

function TrackMenuItems({ music, track, close, addToPlaylist }) {
  const act = (callback) => { callback(); close(); };
  return <>
    <button role="menuitem" onClick={() => act(() => music.playNextTrack(track))}>Play next</button>
    <button role="menuitem" onClick={() => act(() => music.addToQueue(track))}>Add to queue</button>
    <button role="menuitem" disabled={music.connectionState === "offline"} onClick={() => act(() => music.startRadio(track))}>{music.connectionState === "offline" ? "Radio requires a connection" : "Start radio"}</button>
    <button role="menuitem" onClick={addToPlaylist}>Add to playlist</button>
    <button role="menuitem" onClick={() => act(() => {
      music.favorites?.toggleFavorite?.("track", track, track);
    })}>{music.favorites?.isTrackFavorite?.(track) ? "Remove from favorites" : "Add to favorites"}</button>
  </>;
}
