import MusicArtwork from "./MusicArtwork";

export default function PlanetGrid({ items = [], empty = "No planets found.", onNavigate }) {
  if (!items || items.length === 0) {
    return <p className="music-muted">{empty}</p>;
  }

  return (
    <div className="planet-grid">
      {items.map((item, index) => (
        <button key={`${item.id}-${index}`} onClick={() => onNavigate && onNavigate("music-album", item)} className="planet-card">
          <MusicArtwork variant="album" className="art-container" track={item} label={`Artwork for ${item.title || item.name || "album"}`} />
          <strong>{item.title || item.name}</strong>
          <div className="planet-card-meta">{item.artistName || `${item.trackCount || ""} tracks`}</div>
        </button>
      ))}
    </div>
  );
}
