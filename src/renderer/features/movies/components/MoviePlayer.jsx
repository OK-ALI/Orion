import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
import {
  tmdbFetch,
  imgUrl,
  PLAYER_SOURCES,
  getSourceUrl,
  sourceSupportsProgress,
  sourceProgressViaFrames,
  sourceIsAsync,
  fetchAnilistData,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
  getNextNonAsyncSource,
} from "../../../services/tmdb";
import {
  PlayIcon,
  BookmarkIcon,
  BookmarkFillIcon,
  BackIcon,
  StarIcon,
  FilmIcon,
  DownloadIcon,
  WatchedIcon,
  TrailerIcon,
  RatingShieldIcon,
  RatingLockIcon,
  SourceIcon,
  ShieldBlockIcon,
  PopOutIcon,
  MiniPlayerIcon,
} from "../../../components/common/Icons";
import DownloadModal from "../../../components/DownloadModal";
import TrailerModal from "../../../components/TrailerModal";
import BlockedStatsModal from "../../../components/BlockedStatsModal";
import { formatDate } from "../../../shared/utils/date";
import { useBlockedStats } from "../../../shared/utils/useBlockedStats";
import MediaCard from "../../../components/media/MediaCard";
import VoiceBoostIcon from "../../../components/media/VoiceBoostIcon";
import { setupAmbientGlow } from "../../../shared/utils/playerAmbient";
import { getReadyWebContentsId } from "../../player/services/webviewLifecycle";
import {
  storage,
  STORAGE_KEYS,
  getFailoverSource,
  setFailoverSource,
  clearFailoverSource,
} from "../../../services/settingsStore";
import {
  fetchMovieRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../../../shared/utils/ageRating";

export default function MoviePlayer({ model }) {
  const { ambientColor, blockedSession, displayPct, dubMode, handleFailoverNextSource, isUnreleased, item, m3u8Url, menuPos, movieDownload, onBack, onGoToDownloads, onOpenMiniPlayer, pipOpen, pipUrlRef, playerAccentColor, playerControlsVisible, playerFullscreen, playerSource, playerSubLang, playerWrapRef, playing, progressKey, progressLabel, resolveError, resolvedPlayerUrl, resolvedPlayerUrlRef, resolvingUrl, resolvingUrlRef, restricted, revealPlayerControls, saveProgress, setDubMode, setInterceptedSubs, setM3u8Url, setMenuPos, setPlayerSource, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setShowBlockedModal, setShowDownload, setShowSourceMenu, setVoiceBoost, showFailoverPrompt, showSourceMenu, sourceRef, switchingToMiniPlayerRef, voiceBoost, webviewLoading, webviewRef } = model;
  return (
<>
{playing && !restricted && !isUnreleased && (
        <div className="section" style={{ position: "relative" }}>
          {ambientColor && (
            <div
              className="player-ambient-glow"
              style={{
                backgroundImage: `url(${ambientColor})`,
                transition: "background-image 900ms ease, opacity 900ms ease, filter 900ms ease, transform 900ms ease",
                willChange: "background-image, opacity, filter, transform",
                transform: "translateZ(0) scale(1.05)",
              }}
            />
          )}
          <div
            className={`player-wrap${playerFullscreen ? " player-wrap--fullscreen" : ""}${!playerControlsVisible ? " player-wrap--idle" : ""}`}
            ref={playerWrapRef}
            onMouseMove={revealPlayerControls}
            onMouseEnter={revealPlayerControls}
            onKeyDown={revealPlayerControls}
            tabIndex={-1}
          >
            {/* Universal source-loading overlay, shown instantly on every source/item switch */}
            {webviewLoading && !resolveError && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.92)",
                  gap: 14,
                  borderRadius: "inherit",
                }}
              >
                <div className="spinner" />
                <span style={{ fontSize: 14, color: "var(--text2)" }}>
                  {resolvingUrl
                    ? "Looking up movie on AllManga…"
                    : `Loading ${PLAYER_SOURCES.find((s) => s.id === playerSource)?.label ?? "source"}…`}
                </span>
              </div>
            )}
            {showFailoverPrompt && (
              <div
                style={{
                  position: "absolute",
                  top: 72,
                  right: 20,
                  zIndex: 35,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: "rgba(0, 0, 0, 0.85)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  animation: "fadeIn 0.3s ease",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text2)" }}>
                  Source taking too long to load.
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleFailoverNextSource}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  Try Another Source
                </button>
              </div>
            )}
            {/* AllManga: error if lookup failed */}
            {sourceIsAsync(playerSource) && resolveError && !resolvingUrl && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.85)",
                  gap: 10,
                  borderRadius: "inherit",
                }}
              >
                <span style={{ fontSize: 28 }}>⚠️</span>
                <span style={{ fontSize: 14, color: "var(--text2)" }}>
                  Movie not found on AllManga
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {resolveError}
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  Try a different source, or switch sub/dub.
                </span>
              </div>
            )}
            {/* Pop-out active: main stream is paused, pop-out has the real player */}
            {pipOpen && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.92)",
                  gap: 16,
                  borderRadius: "inherit",
                }}
              >
                <PopOutIcon size={36} />
                <span
                  style={{
                    fontSize: 15,
                    color: "var(--text1)",
                    fontWeight: 600,
                  }}
                >
                  Playing in pop-out window
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text2)",
                    textAlign: "center",
                    maxWidth: 260,
                  }}
                >
                  Closing the pop-out will reload the player here.
                </span>
                <button
                  className="player-overlay-btn"
                  onClick={() => window.electron?.closePipWindow?.()}
                  style={{ marginTop: 4 }}
                >
                  Close pop-out &amp; return
                </button>
              </div>
            )}

            <webview
              ref={webviewRef}
              src={
                pipOpen
                  ? "about:blank"
                  : sourceIsAsync(playerSource)
                    ? resolvedPlayerUrl || "about:blank"
                    : getSourceUrl(
                        playerSource,
                        "movie",
                        item.id,
                        null,
                        null,
                        {},
                        playerAccentColor,
                        playerSubLang,
                      )
              }
              partition="persist:player"
              allowpopups="false"
              sandbox="allow-scripts allow-same-origin allow-forms"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
                visibility:
                  webviewLoading ||
                  (sourceIsAsync(playerSource) && !resolvedPlayerUrl)
                    ? "hidden"
                    : "visible",
                zIndex: 2,
              }}
            />

            {/* Unified HUD player header bar */}
            <div className="player-overlay-group">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Media Title (premium look) */}
                <div className="player-overlay-title">
                  {item.title || item.name}
                </div>
                
                {/* Source Selection Button */}
                <button
                  ref={sourceRef}
                  className="player-overlay-btn"
                  onClick={() => {
                    const rect = sourceRef.current?.getBoundingClientRect();
                    if (rect)
                      setMenuPos({ top: rect.bottom + 6, left: rect.left });
                    setShowSourceMenu((v) => !v);
                  }}
                  title="Change source"
                >
                  <SourceIcon />
                  {PLAYER_SOURCES.find((s) => s.id === playerSource)?.label ??
                    "Source"}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Sub/Dub toggle, only for async (AllManga) sources */}
                {sourceIsAsync(playerSource) && (
                  <button
                    className="player-overlay-btn"
                    onClick={() => {
                      const next = dubMode === "sub" ? "dub" : "sub";
                      setDubMode(next);
                      storage.set(STORAGE_KEYS.ALLMANGA_DUB_MODE, next);
                      setM3u8Url(null);
                      setInterceptedSubs([]);
                      resolvedPlayerUrlRef.current = null;
                      setResolvedPlayerUrl(null);
                      resolvingUrlRef.current = false;
                      setResolvingUrl(false);
                      setResolveError(null);
                    }}
                    title="Toggle Sub/Dub"
                  >
                    {dubMode === "sub" ? "SUB" : "DUB"}
                  </button>
                )}
                
                {/* Blocked ads & trackers button */}
                <button
                  className="player-overlay-btn"
                  onClick={() => {
                    setShowSourceMenu(false);
                    setShowBlockedModal(true);
                  }}
                  title="Blocked ads & trackers"
                >
                  <ShieldBlockIcon />
                  {blockedSession > 0 && (
                    <span className="player-blocked-badge">{blockedSession}</span>
                  )}
                </button>
                
                {/* Voice Boost toggle button */}
                <button
                  className={`player-overlay-btn${voiceBoost ? " active" : ""}`}
                  onClick={() => {
                    const next = !voiceBoost;
                    setVoiceBoost(next);
                    storage.set("voiceBoostEnabled", next ? 1 : 0);
                  }}
                  title="Voice Boost (Dialogue Enhancer)"
                >
                  <VoiceBoostIcon size={14} />
                  Voice Boost
                </button>
                
                {/* Mini-player button */}
                <button
                  className="player-overlay-btn"
                  title="Mini player"
                  disabled={
                    webviewLoading ||
                    !!(sourceIsAsync(playerSource) && !resolvedPlayerUrl)
                  }
                  onClick={() => {
                    const url = sourceIsAsync(playerSource)
                      ? resolvedPlayerUrl
                      : getSourceUrl(
                          playerSource,
                          "movie",
                          item.id,
                          null,
                          null,
                          {},
                          playerAccentColor,
                          playerSubLang,
                        );
                    if (!url) return;
                    switchingToMiniPlayerRef.current = true;
                    onOpenMiniPlayer?.({
                      url,
                      title: item.title,
                      mediaType: "movie",
                      mediaId: item.id,
                      posterPath: item.poster_path,
                      backdropPath: item.backdrop_path,
                      item,
                      sourceRect: playerWrapRef.current?.getBoundingClientRect?.() || null,
                    });
                    onBack();
                  }}
                >
                  <MiniPlayerIcon />
                </button>
                
                {/* Pop-out button*/}
                <button
                  className="player-overlay-btn"
                  onClick={async () => {
                    if (pipOpen) {
                      await window.electron?.closePipWindow?.();
                      return;
                    }
                    const url = sourceIsAsync(playerSource)
                      ? resolvedPlayerUrl
                      : getSourceUrl(
                          playerSource,
                          "movie",
                          item.id,
                          null,
                          null,
                          {},
                          playerAccentColor,
                          playerSubLang,
                        );
                    if (!url) return;
                    pipUrlRef.current = url;
                    const sourceId = getReadyWebContentsId(webviewRef.current);
                    const playbackState = sourceId
                      ? await window.electron?.queryVideoProgress?.(sourceId)
                      : null;
                    const result = await window.electron?.openPipWindow?.(
                      url,
                      item.title,
                      { ...playbackState, orionContext: { mediaType: "movie", mediaId: item.id, item, title: item.title, url } },
                    );
                    if (!result?.ok) {
                      setResolveError(
                        result?.error || "The pop-out player could not be opened.",
                      );
                    }
                  }}
                  title={pipOpen ? "Close pop-out" : "Pop out player"}
                  disabled={
                    !pipOpen &&
                    (webviewLoading ||
                      !!(sourceIsAsync(playerSource) && !resolvedPlayerUrl))
                  }
                  style={pipOpen ? { color: "var(--red)" } : undefined}
                >
                  <PopOutIcon />
                </button>

                {/* Download button */}
                <button
                  className="player-overlay-btn"
                  onClick={() =>
                    movieDownload
                      ? onGoToDownloads?.(movieDownload.id)
                      : (setShowSourceMenu(false), setShowDownload(true))
                  }
                  title={
                    movieDownload
                      ? movieDownload.status === "downloading"
                        ? "Downloading… - view in Downloads"
                        : "Already downloaded - view in Downloads"
                      : "Download"
                  }
                >
                  {movieDownload ? (
                    <span
                      className="player-downloaded-icon"
                      style={{
                        color:
                          movieDownload.status === "downloading"
                            ? "var(--red)"
                            : "#4caf50",
                      }}
                    >
                      {movieDownload.status === "downloading" ? "↓" : "✓"}
                    </span>
                  ) : (
                    <DownloadIcon />
                  )}
                  {!movieDownload && m3u8Url && (
                    <span className="player-overlay-dot" />
                  )}
                  {!sourceSupportsProgress(playerSource) && (
                    <span
                      className="player-no-progress-hint"
                      title="No automatic progress tracking for this source"
                    >
                      ⚠ no tracking
                    </span>
                  )}
                </button>
              </div>
            </div>
            {showSourceMenu && menuPos && (
              <div
                className="source-dropdown source-dropdown--fixed"
                style={{ top: menuPos.top, left: menuPos.left }}
                onClick={(e) => e.stopPropagation()}
              >
                {PLAYER_SOURCES.map((src) => (
                  <button
                    key={src.id}
                    className={
                      "source-dropdown__item" +
                      (playerSource === src.id
                        ? " source-dropdown__item--active"
                        : "")
                    }
                    onClick={() => {
                      setShowSourceMenu(false);
                      if (src.id === playerSource) return;
                      // Manual selection wins over auto-failover
                      clearFailoverSource(`movie_${item.id}_${dubMode}`);
                      setPlayerSource(src.id);
                      storage.set(STORAGE_KEYS.PLAYER_SOURCE, src.id);
                      setM3u8Url(null);
                      setInterceptedSubs([]);
                      resolvedPlayerUrlRef.current = null;
                      setResolvedPlayerUrl(null);
                      resolvingUrlRef.current = false;
                      setResolvingUrl(false);
                      setResolveError(null);
                    }}
                  >
                    <span>{src.label}</span>
                    {src.tag && (
                      <span className="source-dropdown__tag">{src.tag}</span>
                    )}
                    {src.note && (
                      <span className="source-dropdown__note">{src.note}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {displayPct > 0 && (
            <div className="progress-bar-row">
              <div className="progress-bar-outer">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(displayPct, 100)}%` }}
                />
              </div>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                {progressLabel}
              </span>
            </div>
          )}
          <div className="progress-mark-row">
            <span
              style={{ fontSize: 12, color: "var(--text3)", marginRight: 4 }}
            >
              Mark progress:
            </span>
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                className="btn btn-ghost"
                style={{ padding: "5px 14px", fontSize: 12 }}
                onClick={() => saveProgress(progressKey, p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}
</>
  );
}
