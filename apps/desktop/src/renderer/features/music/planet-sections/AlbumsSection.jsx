import MusicArtwork from "../components/MusicArtwork";
import MusicOrbitalStage from "../components/MusicOrbitalStage";

export default function AlbumsSection({ dashboard, onNavigate }) {
  const section = dashboard.value?.sections?.find((item) => item.type === "albums");
  const items = section?.items?.filter((item) => item?.id && (item.title || item.name)).slice(0, 8) || [];
  const state = dashboard.status === "loading" || dashboard.status === "idle" ? "loading"
    : dashboard.status === "error" ? "error" : items.length ? "ready" : "empty";
  return <MusicOrbitalStage id="albums" sceneState="albums" anchor="right" eyebrow="Explore"
    title="Albums" description="Complete worlds built to be heard from beginning to end."
    state={state} stateTitle={state === "error" ? "Album signals are unavailable" : "No album worlds yet"}
    stateMessage={dashboard.error || "Search Music Planet to discover an album."} onRetry={dashboard.retry} skeleton="artwork"
    stateActions={<button onClick={() => onNavigate("music-search")}>Search Albums</button>}>
    <div className="music-stage-artwork-rail">
      {items.map((item, index) => <button key={`${item.id}-${index}`} onClick={() => onNavigate("music-album", item)} className="music-stage-album">
        <MusicArtwork variant="album" track={item} label={`Artwork for ${item.title || item.name}`} />
        <strong>{item.title || item.name}</strong><small>{item.artistName || `${item.trackCount || ""} tracks`}</small>
      </button>)}
    </div>
  </MusicOrbitalStage>;
}
