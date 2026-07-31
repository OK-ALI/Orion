import MusicArtwork from "../components/MusicArtwork";
import MusicOrbitalStage from "../components/MusicOrbitalStage";

export default function ArtistsSection({ dashboard, onNavigate }) {
  const section = dashboard.value?.sections?.find((item) => item.type === "artists");
  const items = section?.items?.filter((item) => item?.id && (item.name || item.title)).slice(0, 8) || [];
  const state = dashboard.status === "loading" || dashboard.status === "idle" ? "loading"
    : dashboard.status === "error" ? "error" : items.length ? "ready" : "empty";
  return <MusicOrbitalStage id="artists" sceneState="artists" anchor="left" eyebrow="Explore"
    title="Artists" description="Follow the voices and creators shaping your sound universe."
    state={state} stateTitle={state === "error" ? "Artist signals are unavailable" : "No artist worlds yet"}
    stateMessage={dashboard.error || "Search Music Planet to find an artist."} onRetry={dashboard.retry} skeleton="portraits"
    stateActions={<button onClick={() => onNavigate("music-search")}>Search Artists</button>}>
    <div className="music-stage-artist-rail">
      {items.map((item, index) => <button key={`${item.id}-${index}`} onClick={() => onNavigate("music-artist", item)} className="music-stage-artist">
        <MusicArtwork variant="artist" track={{ ...item, artworkUrl: item.profileImageUrl || item.artworkUrl }}
          label={`Portrait for ${item.name || item.title}`} />
        <strong>{item.name || item.title}</strong><small>{item.subtitle || item.description || "Artist"}</small>
      </button>)}
    </div>
  </MusicOrbitalStage>;
}
