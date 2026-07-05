import { useMusic } from "../context/MusicProvider";
import MusicArtwork from "./MusicArtwork";

export default function MusicTrackList({ tracks = [], empty = "No tracks found.", compact = false }) {
  const { current, playing, playTrack } = useMusic();
  if (!tracks.length) return <div className="music-empty">{empty}</div>;
  return <div className={`music-track-list${compact ? " is-compact" : ""}`}>{tracks.map((track, index) => (
    <button key={`${track.provider || "music"}:${track.id}`} className={current?.id === track.id ? "active" : ""}
      onClick={() => playTrack(track, tracks)} aria-label={`Play ${track.title} by ${track.artistName || "Unknown artist"}`}>
      <span className="music-track-number">{current?.id === track.id && playing ? <i className="music-playing-bars" aria-hidden="true"><b /><b /><b /></i> : index + 1}</span>
      <MusicArtwork className="music-track-art" track={track} />
      <span className="music-track-copy"><strong>{track.title}</strong><small>{track.artistName || "Unknown artist"}</small></span>
      <span className="music-track-album">{track.albumTitle || "Single"}</span>
      <span className="music-track-duration">{track.durationMs ? `${Math.floor(track.durationMs / 60000)}:${String(Math.floor(track.durationMs / 1000) % 60).padStart(2, "0")}` : "—"}</span>
    </button>
  ))}</div>;
}
