import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import {
  EPISODE_GROUP_IDS,
  applyEpisodeMapping,
  buildEpisodeGroupMap,
} from "../../../shared/utils/episodeMappings";
import {
  tmdbFetch,
  imgUrl,
  PLAYER_SOURCES,
  getSourceUrl,
  sourceSupportsProgress,
  sourceProgressViaFrames,
  sourceIsAsync,
  fetchAnilistData,
  fetchEpisodeGroup,
  buildAnilistSeasons,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
  getNextNonAsyncSource,
} from "../../../services/tmdb";
import {
  BookmarkIcon,
  BookmarkFillIcon,
  BackIcon,
  StarIcon,
  PlayIcon,
  TVIcon,
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
import { setupAmbientGlow } from "../../../shared/utils/playerAmbient";
import { getReadyWebContentsId } from "../../player/services/webviewLifecycle";
import { describeCinemaSourceHealth, useCinemaSourceHealth } from "../../player/hooks/useCinemaSourceHealth";
import DownloadModal from "../../../components/DownloadModal";
import TrailerModal from "../../../components/TrailerModal";
import BlockedStatsModal from "../../../components/BlockedStatsModal";
import { formatDate } from "../../../shared/utils/date";
import { useBlockedStats } from "../../../shared/utils/useBlockedStats";
import {
  storage,
  STORAGE_KEYS,
  getFailoverSource,
  setFailoverSource,
  clearFailoverSource,
} from "../../../services/settingsStore";
import { useAutoplay } from "../../../shared/utils/useAutoplay";
import { fetchAniSkipTimings } from "../../../shared/utils/aniSkip";
import {
  fetchTVRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../../../shared/utils/ageRating";
import { ContextMenu, EpisodeDesc, PartialCircleIcon, VoiceBoostIcon } from "./EpisodeUi";

export default function TVPlayerCore({ model }) {
  const { autoplayCountdown, autoplayNextLayout, blockedSession, cancelAutoplay, currentEpDownload, currentEpWatched, currentProgressKey, dubMode, handleFailoverNextSource, handleManualSkip, isAnime, isAsync, item, m3u8Url, menuPos, nextEp, onBack, onGoToDownloads, onMarkUnwatched, onMarkWatched, onOpenMiniPlayer, pipOpen, pipUrlRef, playEpisode, playNow, playerAccentColor, playerControlsVisible, playerEp, playerFullscreen, playerSource, playerSubLang, playerWrapRef, prevEp, resolveError, resolvedPlayerUrl, resolvedPlayerUrlRef, resolvingUrl, resolvingUrlRef, revealPlayerControls, selectedEp, selectedSeason, setDubMode, setInterceptedSubs, setM3u8Url, setMenuPos, setPlayerSource, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setShowBlockedModal, setShowDownload, setShowSourceMenu, setVoiceBoost, showFailoverPrompt, showSourceMenu, skipPrompt, sourceHealth, sourceRef, supportsProgress, switchingToMiniPlayerRef, voiceBoost, webviewLoading, webviewRef } = model;
  const sourceHealthRecords = useCinemaSourceHealth("tv", showSourceMenu || Boolean(selectedEp));
  return (
<>
<div
                style={{
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span className="tag tag-red">
                  Season {selectedSeason} · E{selectedEp.episode_number}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {selectedEp.name}
                </span>
                <span
                  className={`tag ${sourceHealth === "Playing" ? "tag-green" : sourceHealth === "Failed" ? "tag-red" : ""}`}
                  style={{ fontSize: 11 }}
                  title="Current source health"
                >
                  {sourceHealth}
                </span>
                {prevEp && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => playEpisode(prevEp)}
                  >
                    Previous Episode
                  </button>
                )}
                {nextEp && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => playEpisode(nextEp)}
                  >
                    Next Episode
                  </button>
                )}
                {currentEpWatched ? (
                  <button
                    className="btn btn-ghost watched-btn"
                    style={{ marginLeft: "auto" }}
                    onClick={() => onMarkUnwatched?.(currentProgressKey)}
                  >
                    <WatchedIcon size={14} /> Watched
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost"
                    style={{ marginLeft: "auto" }}
                    onClick={() => onMarkWatched?.(currentProgressKey)}
                  >
                    ✓ Mark Watched
                  </button>
                )}
              </div>
<div
                className={`player-wrap${playerFullscreen ? " player-wrap--fullscreen" : ""}${!playerControlsVisible ? " player-wrap--idle" : ""}`}
                ref={playerWrapRef}
                onMouseMove={revealPlayerControls}
                onMouseEnter={revealPlayerControls}
                onKeyDown={revealPlayerControls}
                tabIndex={-1}
              >
                {/* Universal source-loading overlay, shown instantly on every source/episode switch */}
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
                        ? "Looking up episode on AllManga…"
                        : `Loading ${PLAYER_SOURCES.find((s) => s.id === playerSource)?.label ?? "source"}…`}
                    </span>
                  </div>
                )}
                {/* Auto-failover HUD */}
                {showFailoverPrompt && (
                  <div
                    style={{
                      position: "absolute",
                      top: "72px",
                      right: "20px",
                      zIndex: 35,
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 16px",
                      background: "rgba(0, 0, 0, 0.85)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      animation: "fadeIn 0.3s ease",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "var(--text2)" }}>Source taking too long to load.</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleFailoverNextSource}
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                    >
                      Try Another Source
                    </button>
                  </div>
                )}
                {/* error if lookup failed */}
                {isAsync && resolveError && !resolvingUrl && (
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
                      Episode not found on AllManga
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>
                      {resolveError}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>
                      Try a different source, or switch sub/dub.
                    </span>
                  </div>
                )}
                {/* Pop-out active: main stream paused, pop-out has real player */}
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
                {autoplayCountdown !== null && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 30,
                      display: "flex",
                      justifyContent:
                        autoplayNextLayout === "left"
                          ? "flex-start"
                          : "flex-end",
                      background: "rgba(0,0,0,0.88)",
                      borderRadius: "inherit",
                      backdropFilter: "blur(76px) saturate(1.35)",
                      animation: "fadeIn 0.4s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "40%",
                        minWidth: "320px",
                        maxWidth: "480px",
                        height: "100%",
                        background:
                          autoplayNextLayout === "left"
                            ? "linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0) 100%)"
                            : "linear-gradient(270deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0) 100%)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "40px",
                        boxSizing: "border-box",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          letterSpacing: "1.5px",
                          textTransform: "uppercase",
                          color: "var(--red)",
                          marginBottom: "8px",
                        }}
                      >
                        Up Next
                      </div>

                      {/* Cover Still */}
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          borderRadius: "8px",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.1)",
                          marginBottom: "18px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                          background: "var(--surface3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {nextEp?.still_path ? (
                          <img
                            src={imgUrl(nextEp.still_path, "w300")}
                            alt={nextEp?.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              width: 32,
                              height: 32,
                              color: "var(--text3)",
                            }}
                          >
                            <PlayIcon />
                          </span>
                        )}
                      </div>

                      {/* Episode Meta */}
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "var(--text2)",
                          marginBottom: "4px",
                        }}
                      >
                        Season {selectedSeason} · Episode{" "}
                        {nextEp?.episode_number}
                      </div>
                      <div
                        style={{
                          fontSize: "20px",
                          fontWeight: "700",
                          color: "white",
                          marginBottom: "8px",
                          lineHeight: "1.3",
                          wordBreak: "break-word",
                        }}
                      >
                        {nextEp?.name}
                      </div>

                      {/* Countdown */}
                      {autoplayCountdown > 0 ? (
                        <div
                          style={{
                            fontSize: "14px",
                            color: "var(--text3)",
                            marginBottom: "20px",
                          }}
                        >
                          Starting in{" "}
                          <span style={{ color: "white", fontWeight: "600" }}>
                            {autoplayCountdown}
                          </span>
                          s...
                        </div>
                      ) : (
                        <div style={{ height: "20px", marginBottom: "20px" }} />
                      )}

                      {/* Buttons */}
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          marginTop: "4px",
                        }}
                      >
                        <button
                          className="btn btn-primary"
                          style={{
                            padding: "10px 22px",
                            fontSize: "14px",
                            fontWeight: "600",
                            background: "var(--red)",
                            borderColor: "var(--red)",
                            boxShadow: "var(--red-glow)",
                          }}
                          onClick={playNow}
                        >
                          Play Now
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{
                            padding: "10px 22px",
                            fontSize: "14px",
                            fontWeight: "600",
                            background: "rgba(255,255,255,0.05)",
                          }}
                          onClick={cancelAutoplay}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <webview
                  ref={webviewRef}
                  src={
                    pipOpen
                      ? "about:blank"
                      : isAsync
                        ? resolvedPlayerUrl || "about:blank"
                        : getSourceUrl(
                            playerSource,
                            "tv",
                            { tmdbId: item.id, imdbId: item.external_ids?.imdb_id || item.imdb_id },
                            playerEp.season,
                            playerEp.episode,
                            {},
                            playerAccentColor,
                            playerSubLang,
                          )
                  }
                  partition="persist:player"
                  allowpopups="false"
                  preload={window.electron?.playerWebviewPreloadPath || undefined}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    background: "black",
                    visibility:
                      webviewLoading || (isAsync && !resolvedPlayerUrl)
                        ? "hidden"
                        : "visible",
                    zIndex: 2,
                  }}
                  tabIndex={-1}
                />

                {/* Unified HUD player header bar */}
                <div className="player-overlay-group">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Media Title (premium look) */}
                    <div className="player-overlay-title">
                      {playerEp ? `S${playerEp.season}E${playerEp.episode} — ` : ""}{item.name ?? item.title}
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
                    {/* Sub/Dub toggle, only for AllManga */}
                    {isAsync && (
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
                        webviewLoading || !!(isAsync && !resolvedPlayerUrl)
                      }
                      onClick={() => {
                        const url = isAsync
                          ? resolvedPlayerUrl
                          : getSourceUrl(
                              playerSource,
                              "tv",
                              { tmdbId: item.id, imdbId: item.external_ids?.imdb_id || item.imdb_id },
                              playerEp.season,
                              playerEp.episode,
                              {},
                              playerAccentColor,
                              playerSubLang,
                            );
                        if (!url) return;
                        switchingToMiniPlayerRef.current = true;
                        onOpenMiniPlayer?.({
                          url,
                          title: `${item.name ?? item.title ?? "Show"} — S${playerEp?.season}E${playerEp?.episode}`,
                          mediaType: "tv",
                          mediaId: item.id,
                          season: playerEp?.season,
                          episode: playerEp?.episode,
                          posterPath: item.poster_path,
                          backdropPath: item.backdrop_path,
                          item, sourceRect: playerWrapRef.current?.getBoundingClientRect?.() || null,
                        });
                        onBack();
                      }}
                    >
                      <MiniPlayerIcon />
                    </button>
                    {/* Pop-out button */}
                    <button
                      className="player-overlay-btn"
                      onClick={async () => {
                        if (pipOpen) {
                          await window.electron?.closePipWindow?.();
                          return;
                        }
                        const url = isAsync
                          ? resolvedPlayerUrl
                          : getSourceUrl(
                              playerSource,
                              "tv",
                              { tmdbId: item.id, imdbId: item.external_ids?.imdb_id || item.imdb_id },
                              playerEp.season,
                              playerEp.episode,
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
                          item.name ?? item.title,
                          { ...playbackState, orionContext: { mediaType: "tv", mediaId: item.id, item, title: item.name ?? item.title, url, season: playerEp.season, episode: playerEp.episode } },
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
                        (webviewLoading || !!(isAsync && !resolvedPlayerUrl))
                      }
                      style={pipOpen ? { color: "var(--red)" } : undefined}
                    >
                      <PopOutIcon />
                    </button>

                    {/* Download button */}
                    <button
                      className="player-overlay-btn"
                      onClick={() =>
                        currentEpDownload
                          ? onGoToDownloads?.(currentEpDownload.id)
                          : (setShowSourceMenu(false), setShowDownload(true))
                      }
                      title={
                        currentEpDownload
                          ? currentEpDownload.status === "downloading"
                            ? "Downloading… - view in Downloads"
                            : "Already downloaded - view in Downloads"
                          : "Download"
                      }
                    >
                      {currentEpDownload ? (
                        <span
                          className="player-downloaded-icon"
                          style={{
                            color:
                              currentEpDownload.status === "downloading"
                                ? "var(--red)"
                                : "var(--success)",
                          }}
                        >
                          {currentEpDownload.status === "downloading" ? "↓" : "✓"}
                        </span>
                      ) : (
                        <DownloadIcon />
                      )}
                      {!currentEpDownload && m3u8Url && (
                        <span className="player-overlay-dot" />
                      )}
                      {!supportsProgress && (
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
                    {PLAYER_SOURCES.filter((src) => src.media?.tv && (!src.animeOnly || isAnime)).map((src) => {
                      const runtime = describeCinemaSourceHealth(sourceHealthRecords.get(src.id));
                      return (
                      <button
                        key={src.id}
                        className={
                          "source-dropdown__item" +
                          (playerSource === src.id
                            ? " source-dropdown__item--active"
                            : "")
                        }
                        title={runtime.detail}
                        onClick={() => {
                          setShowSourceMenu(false);
                          if (src.id === playerSource) return;
                          // Manual selection wins over auto-failover
                          if (selectedEp) {
                            clearFailoverSource(
                              `tv_${item.id}_s${selectedSeason}_e${selectedEp.episode_number}_${dubMode}`,
                            );
                          }
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
                        <span className="source-dropdown__identity">
                          <strong>{src.label}</strong>
                          <small>{src.releaseStatus === "primary" ? "Standard" : src.releaseStatus === "candidate" ? "Candidate" : src.releaseStatus}</small>
                        </span>
                        <span className={`source-dropdown__health source-dropdown__health--${runtime.tone}`}>{runtime.label}</span>
                      </button>
                    );})}
                  </div>
                )}

                {/* Skip controls are injected directly into the webview DOM*/}

                {/* AniSkip manual prompt, rendered in player UI, outside webview */}
                {skipPrompt && (
                  <button
                    onClick={handleManualSkip}
                    style={{
                      position: "absolute",
                      bottom: 24,
                      right: 24,
                      zIndex: 50,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                      background: "rgba(0,0,0,0.72)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: 8,
                      color: "white",
                      cursor: "pointer",
                      padding: "9px 18px",
                      backdropFilter: "blur(76px) saturate(1.35)",
                      WebkitBackdropFilter: "blur(76px) saturate(1.35)",
                      transition: "background 0.15s, border-color 0.15s",
                      fontFamily: "var(--font-body)",
                      animation: "slideDown 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(229,9,20,0.85)";
                      e.currentTarget.style.borderColor = "rgba(229,9,20,0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(0,0,0,0.72)";
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.18)";
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}
                    >
                      SKIP
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.7)",
                        letterSpacing: 1,
                      }}
                    >
                      {skipPrompt === "intro" ? "INTRO" : "OUTRO"}
                    </span>
                  </button>
                )}
              </div>
</>
  );
}
