import { lazy, Suspense } from "react";

const MusicSearch = lazy(() => import("./pages/MusicSearch"));
const MusicLibrary = lazy(() => import("./pages/MusicLibrary"));
const PlaylistsPage = lazy(() => import("./pages/PlaylistsPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const SourcesPage = lazy(() => import("./pages/SourcesPage"));
const MusicSettingsPage = lazy(() => import("./pages/MusicSettingsPage"));
const ArtistPage = lazy(() => import("./pages/ArtistPage"));
const AlbumPage = lazy(() => import("./pages/AlbumPage"));
const NowPlayingPage = lazy(() => import("./pages/NowPlayingPage"));

export default function MusicRoutes({ page, selected, onNavigate }) {
  const props = { selected, onNavigate };
  return <Suspense fallback={<div className="music-page-loading" role="status"><span className="music-button-loader"><i /></span><strong>Opening Music Planet</strong><small>Preparing this view…</small></div>}>
    {page === "music-search" && <MusicSearch {...props} />}
    {page === "music-library" && <MusicLibrary {...props} />}
    {page === "music-playlists" && <PlaylistsPage {...props} />}
    {page === "music-favorites" && <FavoritesPage {...props} />}
    {page === "music-sources" && <SourcesPage {...props} />}
    {page === "music-settings" && <MusicSettingsPage {...props} />}
    {page === "music-artist" && <ArtistPage {...props} />}
    {page === "music-album" && <AlbumPage {...props} />}
    {page === "music-now-playing" && <NowPlayingPage {...props} />}
  </Suspense>;
}
