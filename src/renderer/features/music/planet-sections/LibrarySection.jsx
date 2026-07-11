import MusicTrackList from "../components/MusicTrackList";
import MusicOrbitalStage from "../components/MusicOrbitalStage";

export default function LibrarySection({ tracks = [], history = [], onNavigate }) {
  const recent = [...new Map(history.map((item) => {
    const track = item.track || item;
    return [`${track?.provider || ""}:${track?.id || ""}`, track];
  })).values()].filter((track) => track?.id && track?.title).slice(0, 4);
  const local = tracks.filter((track) => track?.id && track?.title).slice(0, 5);
  const empty = !recent.length && !local.length;
  return <MusicOrbitalStage id="library" sceneState="library" anchor="left" eyebrow="Your Music"
    title="Library Galaxy" description="Recent listening and music kept on this device."
    action={<button onClick={() => onNavigate?.("music-library")}>Open full library</button>}
    state={empty ? "empty" : "ready"} stateTitle="Your library is waiting"
    stateMessage="Add a local folder or begin listening to form this galaxy."
    stateActions={<button onClick={() => onNavigate?.("music-library")}>Add Music</button>}>
    <div className="music-stage-split">
      <section><header><span>Return to</span><h3>Recently Heard</h3></header>
        <MusicTrackList tracks={recent} compact empty="Your first listens will appear here." /></section>
      <section><header><span>On this device</span><h3>Local Signals</h3></header>
        <MusicTrackList tracks={local} compact empty="Add a folder in Music Library to begin." /></section>
    </div>
  </MusicOrbitalStage>;
}
