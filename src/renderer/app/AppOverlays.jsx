import KeyboardShortcutsModal from "../components/KeyboardShortcutsModal";
import SearchModal from "../components/modals/SearchModal";
import UpdateModal from "../components/UpdateModal";
import MiniPlayer from "../components/MiniPlayer";
import LocalPlayer from "../features/downloads/components/LocalPlayer";
import { storage, STORAGE_KEYS } from "../services/settingsStore";

export default function AppOverlays({ model }) {
  const {
    activeDownloadCount, apiKey, episodeCheckStatus, episodeDismissTimerRef,
    handleExpandMiniPlayer, handleSelectResult, hasCustomTitlebar, miniPlayer,
    navigate, offline, setEpisodeCheckStatus, setMiniPlayer, setShowSearch,
    setShowShortcuts, setShowUpdateModal, setUpdateBanner, showSearch,
    showShortcuts, showUpdateModal, toast, updateBanner, saveProgress, markWatched,
    expandedLocalDownload, setExpandedLocalDownload, addHistory, handleDeleteDownload,
  } = model;
  return (
    <>
        <SearchModal
          isOpen={showSearch}
          apiKey={apiKey}
          onSelect={handleSelectResult}
          onClose={() => setShowSearch(false)}
          offline={offline}
        />
        {updateBanner && (
          <div
            style={{
              position: "fixed",
              top: hasCustomTitlebar ? 32 : 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: "rgba(229,9,20,0.92)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "10px 24px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
            }}
          >
            <span>🎉 Orion v{updateBanner.latest} is available!</span>
            <button
              onClick={() => setShowUpdateModal(true)}
              style={{
                color: "#fff",
                fontWeight: 700,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Install Update
            </button>
            <button
              onClick={() => setUpdateBanner(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: "0 4px",
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {showUpdateModal && updateBanner && (
          <UpdateModal
            updateInfo={updateBanner}
            activeDownloads={activeDownloadCount}
            onClose={() => setShowUpdateModal(false)}
          />
        )}
        {toast && <div className="toast">{toast}</div>}

        {/* ── Episode check status pill / result card ── */}
        {episodeCheckStatus && (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              left: "calc(var(--sidebar) + 24px)",
              zIndex: 500,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              animation: "slideUp 0.3s ease",
              minWidth: 260,
              maxWidth: 400,
            }}
          >
            {episodeCheckStatus === "checking" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 18px",
                  fontSize: 14,
                  color: "var(--text2)",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid var(--text3)",
                    borderTopColor: "var(--red)",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                    flexShrink: 0,
                  }}
                />
                Checking for new episodes…
              </div>
            )}

            {episodeCheckStatus === "none" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 18px",
                  fontSize: 14,
                  color: "var(--text3)",
                }}
              >
                <span style={{ fontSize: 16 }}>✓</span>
                No new episodes found
              </div>
            )}

            {episodeCheckStatus?.entries && (
              <div style={{ padding: "14px 18px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text)",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <span style={{ color: "var(--red)", fontSize: 15 }}>
                      🎬
                    </span>
                    New episode
                    {episodeCheckStatus.entries.length > 1 ? "s" : ""} available
                  </div>
                  <button
                    onClick={() => {
                      clearTimeout(episodeDismissTimerRef.current);
                      setEpisodeCheckStatus(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text3)",
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                      padding: "0 2px",
                    }}
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {episodeCheckStatus.entries.slice(0, 5).map((entry) => (
                    <li
                      key={entry.id}
                      className="episode-check-item"
                      onClick={() => {
                        clearTimeout(episodeDismissTimerRef.current);
                        navigate("tv", {
                          ...entry.seriesItem,
                          season: entry.season ?? 1,
                        });
                        setEpisodeCheckStatus(null);
                      }}
                      style={{
                        fontSize: 13,
                        color: "var(--text2)",
                        padding: "5px 0",
                        paddingBottom: 7,
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 4,
                        transition: "color 0.15s",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.title}
                      </span>
                      {entry.season != null && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text3)",
                            background: "var(--surface3)",
                            borderRadius: 4,
                            padding: "1px 6px",
                            flexShrink: 0,
                          }}
                        >
                          Season {entry.season}
                        </span>
                      )}
                    </li>
                  ))}
                  {episodeCheckStatus.entries.length > 5 && (
                    <li
                      style={{
                        fontSize: 12,
                        color: "var(--text3)",
                        paddingTop: 2,
                      }}
                    >
                      +{episodeCheckStatus.entries.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
        {miniPlayer && (
          <MiniPlayer
            url={miniPlayer.url}
            title={miniPlayer.title}
            context={miniPlayer.context || (miniPlayer.mediaType === "tv" ? `Season ${miniPlayer.season}, episode ${miniPlayer.episode}` : "Movie")}
            initialState={miniPlayer.playbackState || miniPlayer}
            subtitles={miniPlayer.subtitles || []}
            onProgress={(state) => {
              const key = miniPlayer.mediaType === "tv"
                ? `tv_${miniPlayer.mediaId}_s${miniPlayer.season}e${miniPlayer.episode}`
                : `movie_${miniPlayer.mediaId}`;
              const percent = state.duration > 0 ? Math.max(0, Math.min(100, state.currentTime / state.duration * 100)) : 0;
              storage.set("dlTime_" + key, state.currentTime);
              const details = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
              details[key] = { currentTime: state.currentTime, duration: state.duration, percent, updatedAt: Date.now() };
              storage.set(STORAGE_KEYS.PROGRESS_DETAILS, details);
              saveProgress?.(key, percent);
              if (state.duration - state.currentTime <= 20 && state.currentTime > 0) markWatched?.(key);
            }}
            onClose={() => setMiniPlayer(null)}
            onExpand={handleExpandMiniPlayer}
            onPopOut={async (playbackState) => {
              if (!window.electron?.openPipWindow) {
                return {
                  ok: false,
                  error: "Orion's desktop bridge is unavailable. Restart the app.",
                };
              }
              const result = await window.electron.openPipWindow(
                miniPlayer.url,
                miniPlayer.title,
                { ...playbackState, orionContext: miniPlayer },
              );
              if (result?.ok) setMiniPlayer(null);
              return result;
            }}
          />
        )}
        {expandedLocalDownload && (
          <LocalPlayer
            download={expandedLocalDownload}
            onClose={() => setExpandedLocalDownload(null)}
            onHistory={addHistory}
            onSaveProgress={saveProgress}
            onMarkWatched={markWatched}
            onOpenMiniPlayer={(session) => { setMiniPlayer(session); setExpandedLocalDownload(null); }}
            onForget={async (item) => {
              const result = await window.electron.deleteDownload({ id: item.id, filePath: null });
              if (result?.ok) handleDeleteDownload?.(item.id);
              setExpandedLocalDownload(null);
            }}
          />
        )}
        {showShortcuts && (
          <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
        )}
    </>
  );
}
