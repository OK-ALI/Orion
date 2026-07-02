import MovieDetails from "./components/MovieDetails";
import MoviePlayer from "./components/MoviePlayer";
import MovieOverlays from "./components/MovieOverlays";
import CreditsSection from "../../components/media/CreditsSection";
import { useMovieController } from "./hooks/useMovieController";

export default function MoviePage(props) {
  const viewModel = useMovieController(props);
  const { loading, onBack } = viewModel;
  return (
    <div className="fade-in">
      {loading && (
        <div className="loader">
          <div className="spinner" />
        </div>
      )}
      {!loading && (
        <>
          <MovieDetails model={viewModel} />

      <MoviePlayer model={viewModel} />

      <CreditsSection
        cast={viewModel.cast}
        keyCrew={viewModel.keyCrew}
        loading={viewModel.creditsLoading}
        onPersonSelect={(person) => viewModel.onSelect?.({ ...person, media_type: "person" })}
      />

      <MovieOverlays model={viewModel} />
        </>
      )}
    </div>
  );
}
