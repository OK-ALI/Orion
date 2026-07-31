import MusicArtwork from "./MusicArtwork";

export default function StarGrid({ items = [], empty = "No stars found.", onNavigate }) {
  if (!items || items.length === 0) {
    return <p className="music-muted">{empty}</p>;
  }

  return (
    <div className="planet-grid">
      {items.map((item, index) => (
        <button key={`${item.id}-${index}`} onClick={() => onNavigate && onNavigate("music-artist", item)} className="star-card">
          <MusicArtwork variant="artist" className="art-container" track={{ ...item, artworkUrl: item.profileImageUrl || item.artworkUrl }} label={`Portrait for ${item.name || item.title || "artist"}`} />
          <strong>{item.title || item.name}</strong>
        </button>
      ))}
    </div>
  );
}
