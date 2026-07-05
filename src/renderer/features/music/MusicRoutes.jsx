import { lazy, Suspense } from "react";
import MusicHome from "./pages/MusicHome";
const MusicSearch = lazy(() => import("./pages/MusicSearch"));
const MusicLibrary = lazy(() => import("./pages/MusicLibrary"));
const PlaylistsPage = lazy(() => import("./pages/PlaylistsPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const SourcesPage = lazy(() => import("./pages/SourcesPage"));
const PluginsPage = lazy(() => import("./pages/PluginsPage"));
const ArtistPage = lazy(() => import("./pages/ArtistPage"));
const AlbumPage = lazy(() => import("./pages/AlbumPage"));
const NowPlayingPage = lazy(() => import("./pages/NowPlayingPage"));

export default function MusicRoutes({ page, selected, onNavigate }) {
  const props = { selected, onNavigate };
  return <Suspense fallback={<div className="music-loading">Tuning Music Planet…</div>}>
    {page === "music-home" && <MusicHome {...props} />}
    {page === "music-search" && <MusicSearch {...props} />}
    {page === "music-library" && <MusicLibrary {...props} />}
    {page === "music-playlists" && <PlaylistsPage {...props} />}
    {page === "music-favorites" && <FavoritesPage {...props} />}
    {page === "music-sources" && <SourcesPage {...props} />}
    {page === "music-plugins" && <PluginsPage {...props} />}
    {page === "music-artist" && <ArtistPage {...props} />}
    {page === "music-album" && <AlbumPage {...props} />}
    {page === "music-now-playing" && <NowPlayingPage {...props} />}
  </Suspense>;
}
