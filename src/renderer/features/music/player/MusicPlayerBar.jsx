import { useEffect, useState } from "react";
import { useMusic } from "../context/MusicProvider";
import MusicArtwork from "../components/MusicArtwork";
import MusicVisualizer from "../visual/MusicVisualizer";
import { computeThemeTokens } from "../visual/musicThemeTokens";

function time(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
    sources: <><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 0 0 20M2 12h20"/></>,
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function MusicPlayerBar({ page, onNavigate }) {
  const music = useMusic();
  const [favorite, setFavorite] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showStuckWarning, setShowStuckWarning] = useState(false);
  const musicWorld = String(page || "").startsWith("music-");
  const compact = !musicWorld;

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

  if (!music.current) return null;
  const remaining = Math.max(0, music.progress.duration - music.progress.currentTime);
  const openNowPlaying = () => onNavigate?.("music-now-playing", music.current);
  const toggleFavorite = async () => {
    const identity = `${music.current.provider || music.current.source?.provider || "unknown"}:${music.current.id}`;
    const result = await window.electron?.musicToggleFavorite?.("track", identity, music.current);
    if (typeof result?.favorite === "boolean") setFavorite(result.favorite);
  };
  const openPanel = (name) => {
    const next = music.panel === name ? null : name;
    music.setPanel(next);
    if (next === "lyrics" && music.lyrics.status === "idle") music.loadLyrics();
    if (next === "sources" && music.candidates.status === "idle") music.loadCandidates();
  };

  const themeStyles = computeThemeTokens(music.artwork.palette, music.panel || 'idle-space');
  return (
    <section 
      className={`glass-music-player${compact ? " is-compact" : ""}`} 
      aria-label="Music player" 
      style={themeStyles}
    >
      <div className="player-glow-backdrop" />
      
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
                <span className="player-spinner" />
              ) : (
                <Icon name={music.playing ? "pause" : "play"} />
              )}
            </button>
            
            <button className="player-btn" onClick={music.playNext} aria-label="Next track"><Icon name="next" /></button>
            {!compact && <button className={`player-btn${music.repeat !== "off" ? " active" : ""}`} onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")} aria-label={`Repeat ${music.repeat}`}><Icon name="repeat" />{music.repeat === "one" && <b>1</b>}</button>}
          </div>
          
          {!compact && (
            <div className="player-timeline-wrap">
              <span className="time-text">{time(music.progress.currentTime)}</span>
              <div className="timeline-track">
                <div className="timeline-buffered" style={{ width: `${music.buffered * 100}%` }} />
                <MusicVisualizer variant="timeline" className="timeline-visualizer" />
                <input 
                  type="range" 
                  className="timeline-scrub" 
                  min="0" 
                  max={music.progress.duration || 1} 
                  step="0.1" 
                  value={Math.min(music.progress.currentTime, music.progress.duration || 1)} 
                  onChange={(event) => music.seekTo(Number(event.target.value))} 
                />
              </div>
              <span className="time-text">-{time(remaining)}</span>
            </div>
          )}
        </div>

        <div className="player-utilities">
          {!compact && (
            <>
              <button className={`player-btn${favorite ? " active" : ""}`} onClick={toggleFavorite} aria-label="Favorite"><Icon name="heart" /></button>
              <button className="player-btn" onClick={music.toggleMute} aria-label={music.muted ? "Unmute" : "Mute"}><Icon name={music.muted ? "muted" : "volume"} /></button>
              <input className="player-volume-slider" type="range" min="0" max="1" step="0.01" value={music.volume} onChange={(event) => music.setVolume(Number(event.target.value))} />
              <button className={`player-btn${music.panel === "sources" ? " active" : ""}`} onClick={() => openPanel("sources")} aria-label="Change Source"><Icon name="sources" /></button>
              <button className={`player-btn${music.panel === "lyrics" ? " active" : ""}`} onClick={() => openPanel("lyrics")} aria-label="Lyrics"><Icon name="lyrics" /></button>
              <button className={`player-btn${music.panel === "queue" ? " active" : ""}`} onClick={() => openPanel("queue")} aria-label="Queue"><Icon name="queue" /></button>
            </>
          )}
          <button className="player-btn" onClick={openNowPlaying} aria-label="Expand"><Icon name="expand" /></button>
          <button className="player-btn" onClick={() => music.stop(true)} aria-label="Close Player"><Icon name="close" /></button>
        </div>
      </div>
      
      {music.panel && !compact && <PlayerPanel music={music} close={() => music.setPanel(null)} />}

      {(showStuckWarning || music.playbackStatus === "error" || music.stream?.error) && !compact && (
        <div
          style={{
            position: "absolute",
            bottom: "90px",
            left: 0,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            zIndex: 999,
            pointerEvents: "none"
          }}
        >
          <div
            className="player-error-banner"
            style={{
              pointerEvents: "auto",
              background: "rgba" + "(229, 9, 20, 0.15)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid " + "rgba" + "(229, 9, 20, 0.3)",
              borderRadius: "20px",
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              color: "var(--mp-text)",
              fontSize: "0.9rem",
              boxShadow: "0 10px 30px " + "rgba" + "(0, 0, 0, 0.5)",
              animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--music-danger-red)", display: "inline-block" }} />
              {music.playbackStatus === "error" || music.stream?.error
                ? (music.stream?.error || "Signal stream failed to load.")
                : "Core is taking time to resolve stream..."}
            </span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={music.retryStream}
                style={{
                  background: "rgba" + "(255, 255, 255, 0.08)",
                  border: "1px solid " + "rgba" + "(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  padding: "4px 12px",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: "none"
                }}
              >
                Retry
              </button>
              <button 
                onClick={() => openPanel("sources")}
                style={{
                  background: "var(--mp-primary, " + "#" + "7d5fff)",
                  border: "none",
                  borderRadius: "12px",
                  padding: "4px 12px",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: "none"
                }}
              >
                Change Source
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PlayerPanel({ music, close }) {
  return (
    <aside className="glass-player-panel" aria-label={`${music.panel} panel`}>
      <header>
        <strong>
          {({
            details: "Track details",
            sources: "Playback source",
            queue: "Play Queue",
            lyrics: "Song Lyrics"
          })[music.panel]}
        </strong>
        <button onClick={close} aria-label="Close panel">×</button>
      </header>
      <div className="panel-scroll-content">
        {music.panel === "details" && (
          <dl>
            <dt>Title</dt><dd>{music.current.title}</dd>
            <dt>Artist</dt><dd>{music.current.artistName || "Unknown"}</dd>
            <dt>Album</dt><dd>{music.current.albumTitle || "Single"}</dd>
            <dt>Provider</dt><dd>{music.stream?.candidate?.providerId || music.current.provider || "Automatic"}</dd>
            <dt>Duration</dt><dd>{time(music.progress.duration)}</dd>
          </dl>
        )}
        {music.panel === "sources" && <SourceContent candidates={music.candidates} select={music.selectCandidate} retry={music.loadCandidates} />}
        {music.panel === "queue" && <QueuePanel music={music} />}
        {music.panel === "lyrics" && <LyricsContent lyrics={music.lyrics} />}
      </div>
    </aside>
  );
}

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

function SourceContent({ candidates, select, retry }) {
  if (candidates.status === "loading") return <div className="music-panel-state">Finding alternate sources…</div>;
  if (candidates.status === "error") return <div className="music-panel-state">{candidates.error}<button onClick={retry}>Retry</button></div>;
  return <div className="music-panel-list">{candidates.items.map((candidate) => <div key={candidate.id}><button onClick={() => select(candidate.id)}><strong>{candidate.title}</strong><small>{candidate.artistName || candidate.providerId}</small></button></div>)}</div>;
}
