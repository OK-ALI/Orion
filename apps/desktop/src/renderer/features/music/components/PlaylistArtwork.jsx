import MusicArtwork from "./MusicArtwork";
import {
  playlistArtworkMode,
  playlistArtworkPreset,
} from "../utils/playlistArtwork";
import "../../../styles/features/music/playlist-artwork.css";

export default function PlaylistArtwork({ playlist, className = "", label }) {
  const mode = playlistArtworkMode(playlist);
  const preset = playlistArtworkPreset(playlist);
  const accessibleLabel = label || `Artwork for ${playlist?.name || "playlist"}`;

  if (mode === "custom") {
    return <span
      className={`music-playlist-artwork is-custom ${className}`}
      role="img"
      aria-label={accessibleLabel}
      style={{ backgroundImage: `url(${playlist.artwork.dataUrl})` }}
    />;
  }

  if (mode === "mosaic") {
    const tracks = (playlist?.items || []).slice(0, 4);
    return <span className={`music-playlist-artwork is-mosaic ${className}`} role="img" aria-label={accessibleLabel}>
      {Array.from({ length: 4 }, (_, index) => tracks[index]
        ? <MusicArtwork key={`${tracks[index].provider || "music"}:${tracks[index].id}:${index}`} track={tracks[index]} />
        : <i key={`fill-${index}`} className={`music-playlist-artwork-fill is-${preset}`} />)}
    </span>;
  }

  return <span
    className={`music-playlist-artwork is-preset is-${preset} ${className}`}
    role="img"
    aria-label={accessibleLabel}
  >
    <i /><b /><em />
  </span>;
}
