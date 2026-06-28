import MovieDetails from "./components/MovieDetails";
import MoviePlayer from "./components/MoviePlayer";
import MovieOverlays from "./components/MovieOverlays";
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

      <MovieOverlays model={viewModel} />
        </>
      )}
    </div>
  );
}
