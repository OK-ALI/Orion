import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useMusic } from "../context/MusicProvider";
import MusicArtwork from "../components/MusicArtwork";
import { AddToPlaylistDialog } from "../components/MusicTrackList";
import { computeThemeTokens } from "../visual/musicThemeTokens";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import { chooseMusicOverlayPlacement, constrainMusicPlayerGeometry, snapMusicPlayerGeometry } from "../utils/playerGeometry";
// The player is rendered by App in both Cinema and Music. Keep its visual
// contract with the player component rather than the lazy Music Planet route,
// otherwise a restored Music session can briefly render as raw controls.
import "../../../styles/features/music/planet-v2.css";
import "../../../styles/features/music/orbital-stage.css";
import "../../../styles/features/music/planet-polish.css";

function time(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const PROGRESS_WAVE_PATH = "M0 14 C18 14 20 7 38 7 S58 21 76 21 S96 10 114 10 S134 17 152 17 S172 5 190 5 S210 20 228 20 S248 12 266 12 S286 18 304 18 S324 8 342 8 S362 21 380 21 S400 10 418 10 S438 16 456 16 S476 6 494 6 S514 20 532 20 S552 11 570 11 S590 18 608 18 S628 7 646 7 S666 21 684 21 S704 9 722 9 S742 17 760 17 S780 5 798 5 S818 20 836 20 S856 11 874 11 S894 18 912 18 S932 7 950 7 S970 14 1000 14";

function ProgressWaveform() {
  return <span className="music-progress-waveform" aria-hidden="true">
    <svg viewBox="0 0 1000 28" preserveAspectRatio="none">
      <path className="music-progress-wave-base" d={PROGRESS_WAVE_PATH} pathLength="100" />
      <path className="music-progress-wave-fill" d={PROGRESS_WAVE_PATH} pathLength="100" />
    </svg>
    <i className="music-progress-wave-head" />
  </span>;
}

function defaultFloatingGeometry() {
  const sidebar = document.querySelector(".sidebar");
  const minimumX = Math.ceil(sidebar?.getBoundingClientRect().right || 0) + 16;
  const width = Math.min(920, Math.max(720, window.innerWidth - minimumX - 48));
  return { ...constrainMusicPlayerGeometry({ x: Math.max(minimumX, window.innerWidth - width - 28), y: Math.max(72, window.innerHeight - 176), width, height: 148 }, {
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, sidebarRight: sidebar?.getBoundingClientRect().right || 0,
  }), locked: false, snap: true };
}

function readFloatingGeometry() {
  const saved = storage.get(STORAGE_KEYS.MUSIC_PLAYER_DOCK_GEOMETRY);
  if (!saved || typeof saved !== "object") return defaultFloatingGeometry();
  if (Number(saved.width) < 720 || Number(saved.height) < 128) return defaultFloatingGeometry();
  return { ...defaultFloatingGeometry(), ...saved };
}

function Icon({ name }) {
  const paths = {
    previous: <><path d="M6 5v14"/><path d="m18 6-9 6 9 6Z"/></>,
    next: <><path d="M18 5v14"/><path d="m6 6 9 6-9 6Z"/></>,
    play: <path d="m8 5 11 7-11 7Z"/>, pause: <><path d="M8 5v14"/><path d="M16 5v14"/></>,
    shuffle: <><path d="M3 7h3c4 0 5 10 9 10h6"/><path d="m18 14 3 3-3 3"/><path d="M3 17h3c1.5 0 2.5-1.4 3.5-3"/><path d="M14 7h7"/><path d="m18 4 3 3-3 3"/></>,
    repeat: <><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/></>,
    muted: <><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/></>,
    queue: <><path d="M4 6h11M4 12h11M4 18h7"/><path d="m16 15 5 3-5 3Z"/></>,
    lyrics: <><path d="M4 6h12M4 10h9M4 14h7"/><path d="M18 9v8a2 2 0 1 1-2-2h2"/></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    unlock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M16 10V7a4 4 0 0 0-7.5-2.5"/></>,
    snap: <><path d="M4 4v5h2V6h3V4H4Zm11 0v2h3v3h2V4h-5ZM4 15v5h5v-2H6v-3H4Zm14 0v3h-3v2h5v-5h-2Z"/><circle cx="12" cy="12" r="2.25"/></>,
    sources: <><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 0 0 20M2 12h20"/></>,
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function MusicPlayerBar({ page, onNavigate }) {
  const music = useMusic();
  const playerRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayTriggerRef = useRef(null);
  const dragRef = useRef(null);
  const [favorite, setFavorite] = useState(false);
  const [showRemaining, setShowRemaining] = useState(true);
  const [overlayPlacement, setOverlayPlacement] = useState("above");
  const [showStuckWarning, setShowStuckWarning] = useState(false);
  const [playlistTrack, setPlaylistTrack] = useState(null);
  const [floatingGeometry, setFloatingGeometry] = useState(readFloatingGeometry);
  const musicWorld = String(page || "").startsWith("music-");
  const dockMode = music.visualPreferences.playerDockMode || "dock";
  const floating = musicWorld && dockMode === "float";
  const compact = !musicWorld;

  const persistGeometry = useCallback((next) => {
    setFloatingGeometry(next);
    storage.set(STORAGE_KEYS.MUSIC_PLAYER_DOCK_GEOMETRY, next);
  }, []);

  const constrainGeometry = useCallback((value) => {
    const sidebar = document.querySelector(".sidebar");
    return { ...constrainMusicPlayerGeometry(value, {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      sidebarRight: sidebar?.getBoundingClientRect().right || 0,
    }), locked: value?.locked === true, snap: value?.snap !== false };
  }, []);

  useEffect(() => {
    const refresh = () => setFloatingGeometry(constrainGeometry(readFloatingGeometry()));
    window.addEventListener("orion:music-appearance-changed", refresh);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("orion:music-appearance-changed", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [constrainGeometry]);

  useEffect(() => {
    if (!floating || !playerRef.current || !window.ResizeObserver) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (!box || dragRef.current) return;
      setFloatingGeometry((current) => {
        const next = constrainGeometry({ ...current, width: box.width, height: box.height });
        storage.set(STORAGE_KEYS.MUSIC_PLAYER_DOCK_GEOMETRY, next);
        return next;
      });
    });
    observer.observe(playerRef.current);
    return () => observer.disconnect();
  }, [constrainGeometry, floating]);

  const startDrag = useCallback((event) => {
    if (!floating || floatingGeometry.locked || event.button !== 0) return;
    event.preventDefault();
    const origin = floatingGeometry;
    dragRef.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, geometry: origin };
    const move = (moveEvent) => {
      const state = dragRef.current;
      if (!state || moveEvent.pointerId !== state.pointerId) return;
      const next = constrainGeometry({ ...state.geometry, x: state.geometry.x + moveEvent.clientX - state.originX,
        y: state.geometry.y + moveEvent.clientY - state.originY });
      setFloatingGeometry(next);
    };
    const end = (endEvent) => {
      const state = dragRef.current;
      if (!state || endEvent.pointerId !== state.pointerId) return;
      dragRef.current = null;
      setFloatingGeometry((current) => {
        const sidebar = document.querySelector(".sidebar");
        const constrained = constrainGeometry(current);
        const next = constrained.snap
          ? { ...snapMusicPlayerGeometry(constrained, {
            viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
            sidebarRight: sidebar?.getBoundingClientRect().right || 0,
          }), locked: constrained.locked, snap: constrained.snap }
          : constrained;
        storage.set(STORAGE_KEYS.MUSIC_PLAYER_DOCK_GEOMETRY, next);
        return next;
      });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }, [constrainGeometry, floating, floatingGeometry]);

  useEffect(() => {
    if (music.playbackStatus === "loading" || music.playbackStatus === "buffering") {
      const timer = setTimeout(() => {
        setShowStuckWarning(true);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setShowStuckWarning(false);
    }
  }, [music.playbackStatus, music.current?.id]);

  useEffect(() => {
    if (!music.current) return;
    window.electron?.musicListFavorites?.().then((items) => {
      const identity = `${music.current.provider || music.current.source?.provider || "unknown"}:${music.current.id}`;
      setFavorite((items || []).some((item) => item.kind === "track" && item.identity === identity));
    }).catch(() => {});
  }, [music.current?.id, music.current?.provider]);

  const remaining = Math.max(0, music.progress.duration - music.progress.currentTime);
  const duration = Math.max(0, Number(music.progress.duration) || 0);
  const playedRatio = duration ? Math.min(1, Math.max(0, music.progress.currentTime / duration)) : 0;
  const openNowPlaying = () => onNavigate?.("music-now-playing", music.current);
  const toggleFavorite = async () => {
    const identity = `${music.current.provider || music.current.source?.provider || "unknown"}:${music.current.id}`;
    const result = await window.electron?.musicToggleFavorite?.("track", identity, music.current);
    if (typeof result?.favorite === "boolean") setFavorite(result.favorite);
  };
  const openPanel = (name, trigger = document.activeElement) => {
    overlayTriggerRef.current = trigger;
    const next = music.panel === name ? null : name;
    music.setPanel(next);
    if (next === "lyrics" && music.lyrics.status === "idle") music.loadLyrics();
    if (next === "sources" && music.candidates.status === "idle") music.loadCandidates();
  };
  const errorMessage = music.playbackStatus === "error" || music.stream?.error
    ? (music.stream?.error || "Signal stream failed to load.")
    : showStuckWarning ? "Audio signal is taking time to resolve." : "";
  const overlayType = errorMessage ? "error" : music.panel;

  useEffect(() => {
    if (!overlayType) return undefined;
    const player = playerRef.current;
    if (floating && player) {
      const rect = player.getBoundingClientRect();
      setOverlayPlacement(chooseMusicOverlayPlacement(rect, {
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      }, { panelWidth: Math.min(400, window.innerWidth - 32), panelHeight: Math.min(420, window.innerHeight * .52) }));
    } else setOverlayPlacement("above");
    const timer = window.setTimeout(() => overlayRef.current?.querySelector("button")?.focus(), 0);
    const close = () => {
      music.setPanel(null);
      setShowStuckWarning(false);
      window.setTimeout(() => overlayTriggerRef.current?.focus?.(), 0);
    };
    const onKeyDown = (event) => { if (event.key === "Escape") close(); };
    const onPointerDown = (event) => {
      if (overlayRef.current?.contains(event.target) || event.target.closest?.("[data-music-overlay-trigger]")) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [floating, music.setPanel, overlayType]);

  if (!music.current) return null;

  const themeStyles = computeThemeTokens(music.artwork.palette, music.panel || 'idle-space');
  const floatingStyle = floating ? {
    left: floatingGeometry.x, top: floatingGeometry.y, width: floatingGeometry.width, height: floatingGeometry.height,
  } : undefined;
  return (
    <section 
      ref={playerRef}
      className={`glass-music-player${compact ? " is-compact" : ""}${floating ? " is-floating" : ""}${floatingGeometry.locked ? " is-locked" : ""}${music.playing ? " is-playing" : ""}`}
      aria-label="Music player" 
      style={{ ...themeStyles, ...floatingStyle }}
    >
      <div className="player-glow-backdrop" />
      {floating && <>
        <button className="music-player-drag-handle" onPointerDown={startDrag} disabled={floatingGeometry.locked} aria-label={floatingGeometry.locked ? "Music player position is locked" : "Drag Music player"} title={floatingGeometry.locked ? "Position locked" : "Drag Music player"} />
        <div className="music-player-float-controls" aria-label="Floating player layout">
          <button className={`music-player-float-control${floatingGeometry.snap ? " active" : ""}`} onClick={() => persistGeometry({ ...floatingGeometry, snap: !floatingGeometry.snap })} aria-pressed={floatingGeometry.snap} aria-label={floatingGeometry.snap ? "Disable edge snapping" : "Enable edge snapping"} title={floatingGeometry.snap ? "Edge snapping on" : "Edge snapping off"}><Icon name="snap" /></button>
          <button className={`music-player-float-control${floatingGeometry.locked ? " active" : ""}`} onClick={() => persistGeometry({ ...floatingGeometry, locked: !floatingGeometry.locked })} aria-pressed={floatingGeometry.locked} aria-label={floatingGeometry.locked ? "Unlock Music player position" : "Lock Music player position"} title={floatingGeometry.locked ? "Unlock position and size" : "Lock position and size"}><Icon name={floatingGeometry.locked ? "lock" : "unlock"} /></button>
        </div>
      </>}
      
      <div className="player-inner">
        <button className="player-identity" onClick={openNowPlaying}>
          <div className="player-art-wrap">
            <MusicArtwork track={music.current} currentArtwork={music.artwork} />
            <div className={`player-art-ring ${music.playing ? 'is-spinning' : ''}`} />
          </div>
          <div className="player-meta">
            <strong>{music.current.title}</strong>
            <small>{music.current.artistName || "Unknown artist"}</small>
          </div>
        </button>

        <div className="player-center">
          <div className="player-transport">
            {!compact && <button className={`player-btn${music.shuffle ? " active" : ""}`} onClick={() => music.setShuffle(!music.shuffle)} aria-label="Shuffle"><Icon name="shuffle" /></button>}
            <button className="player-btn" onClick={music.playPrevious} aria-label="Previous track"><Icon name="previous" /></button>
            
            <button className="player-play-btn" onClick={music.togglePlaying} aria-label={music.playing ? "Pause" : "Play"}>
              {music.playbackStatus === "loading" || music.playbackStatus === "buffering" ? (
                <span className="music-button-loader" role="status" aria-label={music.playbackStatus === "buffering" ? "Buffering audio" : "Preparing audio"}><i aria-hidden="true" /></span>
              ) : (
                <Icon name={music.playing ? "pause" : "play"} />
              )}
            </button>
            
            <button className="player-btn" onClick={music.playNext} aria-label="Next track"><Icon name="next" /></button>
            {!compact && <button className={`player-btn${music.repeat !== "off" ? " active" : ""}`} onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")} aria-label={`Repeat ${music.repeat}`}><Icon name="repeat" />{music.repeat === "one" && <b>1</b>}</button>}
          </div>
          
          {!compact && (
            <div className={`player-timeline-wrap${duration ? "" : " is-indeterminate"}`}>
              <span className="time-text">{time(music.progress.currentTime)}</span>
              <div className="timeline-track music-progress-track" style={{ "--music-played": `${playedRatio * 100}%`, "--music-buffered": `${music.buffered * 100}%` }}>
                <i className="music-progress-buffered" />
                <ProgressWaveform />
                <input 
                  type="range" 
                  className="timeline-scrub" 
                  min="0" 
                  max={music.progress.duration || 1} 
                  step="0.1" 
                  value={Math.min(music.progress.currentTime, duration || 1)}
                  disabled={!duration}
                  onChange={(event) => music.seekTo(Number(event.target.value))} 
                />
              </div>
              <button className="time-text time-toggle" onClick={() => setShowRemaining((value) => !value)}
                aria-label={showRemaining ? "Show total duration" : "Show remaining time"}>
                {duration ? (showRemaining ? `-${time(remaining)}` : time(duration)) : "Live"}
              </button>
            </div>
          )}
        </div>

        <div className="player-utilities">
          {!compact && (
            <>
              <button className={`player-btn${favorite ? " active" : ""}`} onClick={toggleFavorite} aria-label="Favorite"><Icon name="heart" /></button>
              <button className="player-btn" onClick={music.toggleMute} aria-label={music.muted ? "Unmute" : "Mute"}><Icon name={music.muted ? "muted" : "volume"} /></button>
              <input className="player-volume-slider" type="range" min="0" max="1" step="0.01" value={music.volume} onChange={(event) => music.setVolume(Number(event.target.value))} />
              <button data-music-overlay-trigger className={`player-btn${music.panel === "sources" ? " active" : ""}`} onClick={(event) => openPanel("sources", event.currentTarget)} aria-label="Change Source"><Icon name="sources" /></button>
              <button data-music-overlay-trigger className={`player-btn${music.panel === "lyrics" ? " active" : ""}`} onClick={(event) => openPanel("lyrics", event.currentTarget)} aria-label="Lyrics"><Icon name="lyrics" /></button>
              <button data-music-overlay-trigger className={`player-btn${music.panel === "queue" ? " active" : ""}`} onClick={(event) => openPanel("queue", event.currentTarget)} aria-label="Queue"><Icon name="queue" /></button>
            </>
          )}
          {!compact && <button data-music-overlay-trigger className={`player-btn${music.panel === "more" ? " active" : ""}`} onClick={(event) => openPanel("more", event.currentTarget)} aria-label="More playback actions"><Icon name="more" /></button>}
          <button className="player-btn" onClick={openNowPlaying} aria-label="Expand"><Icon name="expand" /></button>
          <button className="player-btn" onClick={() => music.stop(true)} aria-label="Close Player"><Icon name="close" /></button>
        </div>
      </div>
      
      {overlayType && !compact && <PlayerPanel ref={overlayRef} type={overlayType} placement={overlayPlacement}
        music={music} errorMessage={errorMessage} close={() => { music.setPanel(null); setShowStuckWarning(false); }}
        openPanel={openPanel} addToPlaylist={() => setPlaylistTrack(music.current)} />}
      {playlistTrack && <AddToPlaylistDialog track={playlistTrack} close={() => setPlaylistTrack(null)} />}
    </section>
  );
}

const PlayerPanel = forwardRef(function PlayerPanel({ music, close, type, placement, errorMessage, openPanel, addToPlaylist }, ref) {
  return (
    <aside ref={ref} className={`glass-player-panel placement-${placement}`} aria-label={`${type} panel`}>
      <header>
        <strong>
          {({
            details: "Track details",
            sources: "Playback source",
            queue: "Play Queue",
            lyrics: "Song Lyrics",
            more: "More actions",
            error: "Playback needs attention",
          })[type]}
        </strong>
        <button onClick={close} aria-label="Close panel">×</button>
      </header>
      <div className="panel-scroll-content">
        {type === "details" && (
          <dl>
            <dt>Title</dt><dd>{music.current.title}</dd>
            <dt>Artist</dt><dd>{music.current.artistName || "Unknown"}</dd>
            <dt>Album</dt><dd>{music.current.albumTitle || "Single"}</dd>
            <dt>Provider</dt><dd>{music.stream?.candidate?.providerId || music.current.provider || "Automatic"}</dd>
            <dt>Duration</dt><dd>{time(music.progress.duration)}</dd>
          </dl>
        )}
        {type === "sources" && <SourceContent candidates={music.candidates} selected={music.stream?.candidate}
          select={music.selectCandidate} retry={music.loadCandidates} />}
        {type === "queue" && <QueuePanel music={music} />}
        {type === "lyrics" && <LyricsContent lyrics={music.lyrics} />}
        {type === "more" && <div className="music-panel-actions" role="menu">
          <button role="menuitem" onClick={() => { music.startRadio(); close(); }}>Start track radio</button>
          <button role="menuitem" onClick={() => { close(); addToPlaylist(); }}>Add to playlist</button>
          <button role="menuitem" onClick={(event) => openPanel("queue", event.currentTarget)}>Open queue</button>
          <button role="menuitem" onClick={(event) => { music.loadLyrics(); openPanel("lyrics", event.currentTarget); }}>Open lyrics</button>
          <button role="menuitem" onClick={(event) => openPanel("details", event.currentTarget)}>Track details</button>
          <button role="menuitem" onClick={(event) => openPanel("sources", event.currentTarget)}>Playback source</button>
          <button role="menuitem" className="danger" onClick={() => { music.stop(true); close(); }}>Stop and clear queue</button>
        </div>}
        {type === "error" && <div className="music-panel-error" role="alert"><p>{errorMessage}</p><div>
          <button onClick={() => { music.retryStream(); close(); }}>Retry</button>
          <button className="primary" onClick={(event) => openPanel("sources", event.currentTarget)}>Change Source</button>
        </div></div>}
      </div>
    </aside>
  );
});

function QueuePanel({ music }) {
  const [dragIndex, setDragIndex] = useState(-1);
  return <div className="music-panel-list">{music.queue.map((track, index) => <div key={`${track.id}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => music.moveQueueItem(dragIndex, index)} className={index === music.index ? "active" : ""}><button onClick={() => music.selectQueueItem(index)}><strong>{track.title}</strong><small>{track.artistName}</small></button><button onClick={() => music.removeFromQueue(index)} aria-label={`Remove ${track.title}`}>×</button></div>)}</div>;
}

function LyricsContent({ lyrics }) {
  if (lyrics.status === "loading") return <div className="music-panel-state">Finding lyrics…</div>;
  if (lyrics.status === "error") return <div className="music-panel-state">{lyrics.error}</div>;
  if (lyrics.value?.type === "synced") return <div className="music-lyrics-lines">{lyrics.value.lines.map((line, index) => <p key={`${line.time}-${index}`}>{line.text}</p>)}</div>;
  return <div className="music-lyrics-lines"><p>{lyrics.value?.text || "Lyrics are unavailable."}</p></div>;
}

function SourceContent({ candidates, selected, select, retry }) {
  if (candidates.status === "loading") return <div className="music-source-skeleton" role="status" aria-label="Finding alternate playback sources"><i /><i /><i /></div>;
  if (candidates.status === "error") return <div className="music-panel-state">{candidates.error}<button onClick={retry}>Retry</button></div>;
  if (!candidates.items.length) return <div className="music-panel-state">No alternate playback sources are available.<button onClick={retry}>Refresh</button></div>;
  return <div className="music-panel-list music-source-options">{candidates.items.map((candidate) => {
    const active = selected?.id === candidate.id;
    const detail = [candidate.providerLabel || candidate.providerId, candidate.format || candidate.ext,
      candidate.quality || candidate.audioQuality].filter(Boolean).join(" · ");
    return <div key={candidate.id} className={active ? "active" : ""}><button onClick={() => select(candidate.id)}>
      <strong>{candidate.title || "Automatic audio source"}</strong><small>{candidate.artistName || detail || "Playable audio"}</small>
      {detail && candidate.artistName && <em>{detail}</em>}</button><b>{active ? "Selected" : candidate.health || "Ready"}</b></div>;
  })}</div>;
}
