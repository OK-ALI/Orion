import TVDetails from "./components/TVDetails";
import TVEpisodes from "./components/TVEpisodes";
import TVFailover from "./components/TVFailover";
import TVPlayerCore from "./components/TVPlayerCore";
import TVPlayerChrome from "./components/TVPlayerChrome";
import TVOverlays from "./components/TVOverlays";
import { useTVController } from "./hooks/useTVController";

export default function TVPage(props) {
  const viewModel = useTVController(props);
  const { loading, onBack, playing, selectedEp } = viewModel;
  return (
    <div className="fade-in">
      {loading && (
        <div className="loader">
          <div className="spinner" />
        </div>
      )}
      {!loading && (
        <>
          <TVDetails model={viewModel} />

          {playing && selectedEp && (
            <div className="section" style={{ position: "relative" }}>
              <TVFailover model={viewModel} />
              <TVPlayerCore model={viewModel} />

              <TVPlayerChrome model={viewModel} />
            </div>
          )}

          <TVEpisodes model={viewModel} />
        </>
      )}

      <TVOverlays model={viewModel} />
    </div>
  );
}
