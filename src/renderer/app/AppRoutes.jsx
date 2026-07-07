import { lazy, Suspense } from "react";
import ErrorBoundary from "../components/common/ErrorBoundary";
import MusicPlanet from "../features/music/MusicPlanet";

const HomePage = lazy(() => import("../features/home/HomePage"));
const DiscoverPage = lazy(() => import("../features/discover/DiscoverPage"));
const MoviePage = lazy(() => import("../features/movies/MoviePage"));
const TVPage = lazy(() => import("../features/tv/TVPage"));
const LibraryPage = lazy(() => import("../features/library/LibraryPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const DownloadsPage = lazy(() => import("../features/downloads/DownloadsPage"));
const SearchResultsPage = lazy(() => import("../features/discover/SearchResultsPage"));
const PersonPage = lazy(() => import("../features/people/PersonPage"));
const ConstellationPage = lazy(() => import("../features/people/constellation/ConstellationPage"));

export default function AppRoutes({ model }) {
  const {
    addHistory, apiKey, apiKeySource, changeApiKey, clearHistory, dlSearchOpen,
    downloads, handleDeleteDownload, handleDownloadStarted, handleGoToDownloads,
    handleReorderSaved, handleSelectResult, highlightDownload, history, inProgress,
    isSaved, librarySort, loadingHome, markUnwatched, markWatched, navigate,
    navigateBack, offline, page, playerSettings, progress, removeHistory, retryHome,
    savedList, saveProgress, selected, setDlSearchOpen, setDownloads,
    setHighlightDownload, setLibrarySort, setMiniPlayer, toggleSave, trending,
    trendingTV, watched, onPlaybackSession, googleProfile,
  } = model;
  return (
    <ErrorBoundary resetKey={`${page}:${selected?.id || selected || ""}`} context={`route:${page}`}>
    <Suspense fallback={<div style={{ padding: 60, color: "var(--text3)", textAlign: "center", fontSize: 15 }}>Loading…</div>}>
      {page === "home" && (
        <HomePage
          trending={trending} trendingTV={trendingTV} loading={loadingHome}
          onSelect={handleSelectResult} progress={progress} inProgress={inProgress}
          offline={offline} onRetry={retryHome} watched={watched}
          onMarkWatched={markWatched} onMarkUnwatched={markUnwatched}
          history={history} saved={savedList} apiKey={apiKey} onNavigate={navigate}
          onSave={toggleSave} isSaved={isSaved}
        />
      )}
      {page === "discover" && (
        <DiscoverPage apiKey={apiKey} onNavigate={navigate} offline={offline} />
      )}
      {page === "search" && (
        <SearchResultsPage
          apiKey={apiKey}
          item={page === "search" && typeof selected === "string" ? selected : ""}
          onNavigate={navigate}
          isActive={page === "search"}
        />
      )}
      {page === "person" && selected && (
        <PersonPage
          item={selected}
          apiKey={apiKey}
          onNavigate={navigate}
          onBack={navigateBack}
        />
      )}
      {page === "constellation" && (
        <ConstellationPage apiKey={apiKey} history={history} saved={savedList} offline={offline} onNavigate={navigate} />
      )}
      {page.startsWith("music-") && (
        <MusicPlanet page={page} selected={selected} onNavigate={navigate} />
      )}
      {page === "movie" && selected && (
        <MoviePage
          item={selected} apiKey={apiKey} playerSettings={playerSettings}
          onSave={toggleSave} isSaved={isSaved(selected)}
          onHistory={addHistory} progress={progress} saveProgress={saveProgress}
          onBack={navigateBack} onSettings={(section) => navigate("settings", { section: section || null })}
          onDownloadStarted={handleDownloadStarted} watched={watched}
          onMarkWatched={markWatched} onMarkUnwatched={markUnwatched}
          downloads={downloads} onGoToDownloads={handleGoToDownloads}
          onSelect={handleSelectResult} onOpenMiniPlayer={setMiniPlayer}
          onPlay={() => setMiniPlayer(null)}
          onPlaybackSession={onPlaybackSession}
        />
      )}
      {page === "tv" && selected && (
        <TVPage
          item={selected} apiKey={apiKey} playerSettings={playerSettings}
          onSave={toggleSave} isSaved={isSaved(selected)}
          onHistory={addHistory} progress={progress} saveProgress={saveProgress}
          onBack={navigateBack} onSettings={(section) => navigate("settings", { section: section || null })}
          onDownloadStarted={handleDownloadStarted} watched={watched}
          onMarkWatched={markWatched} onMarkUnwatched={markUnwatched}
          downloads={downloads} onGoToDownloads={handleGoToDownloads}
          onOpenMiniPlayer={setMiniPlayer} onPlay={() => setMiniPlayer(null)}
          onSelect={handleSelectResult}
          onPlaybackSession={onPlaybackSession}
        />
      )}
      {page === "library" && (
        <LibraryPage
          history={history} inProgress={inProgress} saved={savedList} progress={progress}
          onSelect={handleSelectResult} watched={watched} onMarkWatched={markWatched}
          onMarkUnwatched={markUnwatched} onRemoveHistory={removeHistory}
          onClearHistory={clearHistory} onReorderSaved={handleReorderSaved}
          downloads={downloads}
          onHistory={addHistory} onSaveProgress={saveProgress} onOpenMiniPlayer={setMiniPlayer} onDeleteDownload={handleDeleteDownload}
        />
      )}
      {page === "settings" && (
        <SettingsPage
          apiKey={apiKey} apiKeySource={apiKeySource} onChangeApiKey={changeApiKey}
          initialSection={page === "settings" ? selected?.section : null}
        />
      )}
      {page === "downloads" && (
        <DownloadsPage
          downloads={downloads} onDeleteDownload={handleDeleteDownload}
          onHistory={addHistory} onSaveProgress={saveProgress} progress={progress}
          watched={watched} onMarkWatched={markWatched} onMarkUnwatched={markUnwatched}
          highlightId={highlightDownload} onClearHighlight={() => setHighlightDownload(null)}
          onSelect={handleSelectResult} searchOpen={dlSearchOpen}
          onSearchClose={() => setDlSearchOpen(false)}
          onSettings={(section) => navigate("settings", { section: section || null })}
          onOpenMiniPlayer={setMiniPlayer}
          onUpdateDownload={(id, updates) => setDownloads((previous) => previous.map((download) => download.id === id ? { ...download, ...updates } : download))}
          googleProfile={googleProfile}
        />
      )}
    </Suspense>
    </ErrorBoundary>
  );
}
