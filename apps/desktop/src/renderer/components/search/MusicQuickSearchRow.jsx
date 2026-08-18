import MusicArtwork from "../../features/music/components/MusicArtwork";

const TYPE_LABEL = { track: "Track", artist: "Artist", album: "Album", playlist: "Playlist" };

export default function MusicQuickSearchRow({ entry, active, onHover, onActivate }) {
  const artworkTrack = { ...entry.item, artworkUrl: entry.artworkUrl };
  return (
    <button
      type="button"
      id={`quick-search-music-${entry.id}`}
      className={`search-result music-quick-search-result${active ? " active" : ""}`}
      onMouseEnter={onHover}
      onClick={onActivate}
    >
      <span className={`search-result-image music-quick-search-art ${entry.kind === "artist" ? "is-artist" : ""}`}>
        <MusicArtwork
          variant={entry.kind === "artist" ? "artist" : "album"}
          track={artworkTrack}
          label=""
        />
      </span>
      <span className="search-result-info">
        <strong className="search-result-title">{entry.title}</strong>
        <span className="search-result-supporting">{entry.secondary}</span>
      </span>
      <span className={`search-result-type type-music type-music-${entry.kind}`}>{TYPE_LABEL[entry.kind]}</span>
    </button>
  );
}
