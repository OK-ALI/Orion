import MusicTrackList from "../components/MusicTrackList";
import MusicOrbitalStage from "../components/MusicOrbitalStage";
import "../../../styles/features/music/music-library-overview.css";

function historyTrack(item) {
  return item?.track || item?.payload || item;
}

function newestFirst(left, right) {
  return Number(right?.addedAt || 0) - Number(left?.addedAt || 0)
    || String(left?.title || "").localeCompare(String(right?.title || ""));
}

export default function LibrarySection({ tracks = [], history = [], onNavigate }) {
  const allRecent = [...new Map(history.map((item) => {
    const track = historyTrack(item);
    return [`${track?.provider || track?.source?.provider || ""}:${track?.id || ""}`, track];
  })).values()].filter((track) => track?.id && track?.title);
  const allLocal = tracks.filter((track) => track?.id && track?.title).slice().sort(newestFirst);

  const recent = allRecent.slice(0, 5);
  const local = allLocal.slice(0, 4);
  const empty = !recent.length && !local.length;
  const availability = recent.length && local.length ? "mixed" : recent.length ? "recent-only" : "local-only";

  return <MusicOrbitalStage id="library" sceneState="library" anchor="left" eyebrow="Your Music"
    title="Library Galaxy" description="Return to recent listening or continue through music kept on this device."
    action={<button onClick={() => onNavigate?.("music-library")}>Open full library</button>}
    state={empty ? "empty" : "ready"} stateTitle="Your library is waiting"
    stateMessage="Add a local folder or begin listening to form this galaxy."
    stateActions={<button onClick={() => onNavigate?.("music-library")}>Add Music</button>}>
    <div className={`music-library-galaxy is-${availability}`}>
      <section className="music-library-lane is-recent">
        <header><div><span>Return to</span><h3>Recently Heard</h3></div>
          <div className="music-library-lane-actions"><small>{recent.length ? `${recent.length} shown` : "Listening history"}</small>
            {allRecent.length > recent.length && <button onClick={() => onNavigate?.("music-library", { libraryView: "recent" })}>View all</button>}</div></header>
        <MusicTrackList tracks={recent} compact empty="Your first listens will appear here." />
      </section>

      <section className="music-library-lane is-local">
        <header><div><span>On this device</span><h3>Recently Added</h3></div>
          <div className="music-library-lane-actions"><small>{local.length ? `${local.length} shown` : "Local library"}</small>
            {allLocal.length > local.length && <button onClick={() => onNavigate?.("music-library", { libraryView: "local", librarySort: "newest" })}>View all</button>}</div></header>
        <MusicTrackList tracks={local} compact empty="Add a folder in Music Library to begin." />
      </section>
    </div>
  </MusicOrbitalStage>;
}
