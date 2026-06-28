import { lazy, Suspense } from "react";

const HomePage = lazy(() => import("../features/home/HomePage"));
const DiscoverPage = lazy(() => import("../features/discover/DiscoverPage"));
const MoviePage = lazy(() => import("../features/movies/MoviePage"));
const TVPage = lazy(() => import("../features/tv/TVPage"));
const LibraryPage = lazy(() => import("../features/library/LibraryPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const DownloadsPage = lazy(() => import("../features/downloads/DownloadsPage"));
const SearchResultsPage = lazy(() => import("../features/discover/SearchResultsPage"));

export default function AppRoutes({ model }) {
  const {
    addHistory, apiKey, apiKeySource, changeApiKey, clearHistory, dlSearchOpen,
    downloads, handleDeleteDownload, handleDownloadStarted, handleGoToDownloads,
    handleReorderSaved, handleSelectResult, highlightDownload, history, inProgress,
    isSaved, librarySort, loadingHome, markUnwatched, markWatched, navigate,
    navigateBack, offline, page, playerSettings, progress, removeHistory, retryHome,
    savedList, saveProgress, selected, setDlSearchOpen, setDownloads,
    setHighlightDownload, setLibrarySort, setMiniPlayer, toggleSave, trending,
    trendingTV, watched, onPlaybackSession,
  } = model;
  return (
    <Suspense fallback={<div style={{ padding: 60, color: "var(--text3)", textAlign: "center", fontSize: 15 }}>Loading…</div>}>
      <div style={{ display: page === "home" ? "contents" : "none" }}>
        <HomePage
          trending={trending} trendingTV={trendingTV} loading={loadingHome}
          onSelect={handleSelectResult} progress={progress} inProgress={inProgress}
          offline={offline} onRetry={retryHome} watched={watched}
          onMarkWatched={markWatched} onMarkUnwatched={markUnwatched}
          history={history} saved={savedList} apiKey={apiKey} onNavigate={navigate}
          onSave={toggleSave} isSaved={isSaved}
        />
      </div>
      <div style={{ display: page === "discover" ? "contents" : "none" }}>
        <DiscoverPage apiKey={apiKey} onNavigate={navigate} />
      </div>
      <div style={{ display: page === "search" ? "contents" : "none" }}>
        <SearchResultsPage
          apiKey={apiKey}
          item={page === "search" && typeof selected === "string" ? selected : ""}
          onNavigate={navigate}
          isActive={page === "search"}
        />
      </div>
      {page === "movie" && selected && (
        <MoviePage
          item={selected} apiKey={apiKey} playerSettings={playerSettings}
          onSave={() => toggleSave(selected)} isSaved={isSaved(selected)}
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
          onSave={() => toggleSave(selected)} isSaved={isSaved(selected)}
          onHistory={addHistory} progress={progress} saveProgress={saveProgress}
          onBack={navigateBack} onSettings={(section) => navigate("settings", { section: section || null })}
          onDownloadStarted={handleDownloadStarted} watched={watched}
          onMarkWatched={markWatched} onMarkUnwatched={markUnwatched}
          downloads={downloads} onGoToDownloads={handleGoToDownloads}
          onOpenMiniPlayer={setMiniPlayer} onPlay={() => setMiniPlayer(null)}
          onPlaybackSession={onPlaybackSession}
        />
      )}
      <div style={{ display: page === "library" ? "contents" : "none" }}>
        <LibraryPage
          history={history} inProgress={inProgress} saved={savedList} progress={progress}
          onSelect={handleSelectResult} watched={watched} onMarkWatched={markWatched}
          onMarkUnwatched={markUnwatched} onRemoveHistory={removeHistory}
          onClearHistory={clearHistory} onReorderSaved={handleReorderSaved}
          downloads={downloads}
          onHistory={addHistory} onSaveProgress={saveProgress} onOpenMiniPlayer={setMiniPlayer} onDeleteDownload={handleDeleteDownload}
        />
      </div>
      <div style={{ display: page === "settings" ? "contents" : "none" }}>
        <SettingsPage
          apiKey={apiKey} apiKeySource={apiKeySource} onChangeApiKey={changeApiKey}
          initialSection={page === "settings" ? selected?.section : null}
        />
      </div>
      <div style={{ display: page === "downloads" ? "contents" : "none" }}>
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
        />
      </div>
    </Suspense>
  );
}
