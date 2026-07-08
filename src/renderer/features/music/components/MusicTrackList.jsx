import { useMusic } from "../context/MusicProvider";
import MusicArtwork from "./MusicArtwork";

const FALLBACK_ART = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><defs><radialGradient id='g' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='%237d5fff' stop-opacity='0.6'/><stop offset='100%' stop-color='%2307070b' stop-opacity='0.95'/></radialGradient></defs><circle cx='100' cy='100' r='100' fill='url(%23g)'/></svg>";

export default function MusicTrackList({ tracks = [], empty = "No tracks found.", layout = "list", compact = false }) {
  const { current, playing, playTrack } = useMusic();

  if (!tracks || tracks.length === 0) {
    if (layout === "grid") {
      return <p className="music-muted">{empty}</p>;
    }
    return <div className="music-empty">{empty}</div>;
  }

  if (layout === "grid") {
    return (
      <div className="moon-track-list">
        {tracks.map((track, i) => (
          <button
            key={`${track.id}-${i}`}
            className={`moon-track-item ${current?.id === track.id ? "active" : ""}`}
            onClick={() => playTrack(track, tracks)}
            aria-label={`Play ${track.title} by ${track.artistName || "Unknown artist"}`}
          >
            <div className="art-container">
              <img src={track.artworkUrl || track.album?.artworkUrl || FALLBACK_ART} onError={(e) => { e.target.src = FALLBACK_ART; }} alt="moon-art" />
            </div>
            <div className="track-info">
              <strong>{track.title || track.name}</strong>
              <small>{track.artistName || "Unknown artist"}</small>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`music-track-list${compact ? " is-compact" : ""}`}>
      {tracks.map((track, index) => (
        <button
          key={`${track.provider || "music"}:${track.id}`}
          className={current?.id === track.id ? "active" : ""}
          onClick={() => playTrack(track, tracks)}
          aria-label={`Play ${track.title} by ${track.artistName || "Unknown artist"}`}
        >
          <span className="music-track-number">
            {current?.id === track.id && playing ? (
              <i className="music-playing-bars" aria-hidden="true">
                <b />
                <b />
                <b />
              </i>
            ) : (
              index + 1
            )}
          </span>
          <MusicArtwork className="music-track-art" track={track} />
          <span className="music-track-copy">
            <strong>{track.title}</strong>
            <small>{track.artistName || "Unknown artist"}</small>
          </span>
          <span className="music-track-album">{track.albumTitle || "Single"}</span>
          <span className="music-track-duration">
            {track.durationMs
              ? `${Math.floor(track.durationMs / 60000)}:${String(Math.floor(track.durationMs / 1000) % 60).padStart(2, "0")}`
              : "—"}
          </span>
        </button>
      ))}
    </div>
  );
}
