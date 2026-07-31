import MusicTrackList from "../components/MusicTrackList";
import MusicOrbitalStage from "../components/MusicOrbitalStage";

export default function FavoritesSection({ tracks = [], onNavigate }) {
  const items = tracks.filter((track) => track?.id && track?.title).slice(0, 6);
  return <MusicOrbitalStage id="favorites" sceneState="favorites" anchor="left" eyebrow="Yours"
    title="Favorites" description="The signals you chose to keep close."
    action={<button onClick={() => onNavigate?.("music-favorites")}>View all favorites</button>}
    state={items.length ? "ready" : "empty"} stateTitle="Your constellation is empty"
    stateMessage="Like a track, album or artist to place it here."
    stateActions={<button onClick={() => onNavigate?.("music-search")}>Find Music</button>}>
    <div className="music-stage-track-rail"><MusicTrackList tracks={items} compact /></div>
  </MusicOrbitalStage>;
}
