import { useEffect, useRef, useState } from "react";
import MusicArtwork from "../components/MusicArtwork";
import { useMusic } from "../context/MusicProvider";
import MusicVisualizer from "../visual/MusicVisualizer";

function time(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function NowPlayingPage({ onNavigate }) {
  const music = useMusic();
  const [panel, setPanel] = useState("queue");
  const [showStuckWarning, setShowStuckWarning] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef(null);

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
    if (panel === "lyrics" && music.lyrics.status === "idle") music.loadLyrics();
    if (panel === "source" && music.candidates.status === "idle") music.loadCandidates();
  }, [music, panel]);
  useEffect(() => {
    const key = (event) => { if (event.key === "Escape" && music.immersive) music.setImmersive(false); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [music.immersive]);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  if (!music.current) return <div className="music-page"><div className="music-empty"><h2>Nothing is playing</h2><p>Choose a track to bring the Core to life.</p><button onClick={() => onNavigate("music-home")}>Music Home</button></div></div>;
  
  const remaining = Math.max(0, music.progress.duration - music.progress.currentTime);
  const wakeControls = () => {
    setControlsVisible(true); clearTimeout(hideTimer.current);
    if (music.immersive && music.playing) hideTimer.current = setTimeout(() => setControlsVisible(false), 2600);
  };
  const palette = music.artwork.palette;
  const style = { "--music-reactive-base": palette.base, "--music-reactive-primary": palette.primary, "--music-reactive-spectral": palette.spectral };
  
  const lyrics = music.lyrics.value?.lines || [];
  const lyricsActive = lyrics.findIndex((line, i) => line.time <= music.progress.currentTime && (i === lyrics.length - 1 || lyrics[i + 1].time > music.progress.currentTime));

  return <div className={`music-page music-core-page${music.immersive ? " is-immersive" : ""}${controlsVisible ? " controls-visible" : ""}`} style={style} onPointerMove={wakeControls} onFocus={wakeControls}>
    <section className="music-core-stage">
      <div className="music-core-backdrop" />
      <MusicVisualizer variant={music.visualPreferences.visualizer} className="music-core-visual" />
      
      {music.immersive ? <LyricsDisplay lines={lyrics} active={lyricsActive} /> : <div className="music-core-art"><MusicArtwork track={music.current} label="Now Playing Album Art" /></div>}
      
      <div className="music-core-meta"><span className="music-eyebrow">Now Playing</span><h1>{music.current.title}</h1><p>{music.current.artistName || "Unknown artist"}{music.current.albumTitle ? ` · ${music.current.albumTitle}` : ""}</p></div>
      <div className="music-core-controls">
        <button onClick={() => music.setShuffle(!music.shuffle)} className={music.shuffle ? "active" : ""} aria-label="Toggle shuffle">Shuffle</button>
        <button onClick={music.playPrevious} aria-label="Previous track">Prev</button>
        <button className="primary" onClick={music.togglePlaying} aria-label={music.playing ? "Pause" : "Play"}>{music.playbackStatus === "buffering" ? "Buffering..." : music.playing ? "Pause" : "Play"}</button>
        <button onClick={music.playNext} aria-label="Next track">Next</button>
        <button onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")} className={music.repeat !== "off" ? "active" : ""} aria-label="Toggle repeat">Repeat {music.repeat}</button>
      </div>
      <div className="music-core-timeline"><span>{time(music.progress.currentTime)}</span><div><span style={{ width: `${music.buffered * 100}%` }} /><MusicVisualizer variant="timeline" /><input aria-label="Seek music" type="range" min="0" max={music.progress.duration || 1} step="0.1" value={Math.min(music.progress.currentTime, music.progress.duration || 1)} onChange={(event) => music.seekTo(Number(event.target.value))} /></div><span>-{time(remaining)}</span></div>
      
      {(showStuckWarning || music.playbackStatus === "error" || music.stream?.error) && (
        <div style={{ display: "flex", justifyContent: "center", width: "100%", marginTop: "1rem" }}>
          <div
            className="player-error-banner"
            style={{
              background: "rgba" + "(229, 9, 20, 0.15)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid " + "rgba" + "(229, 9, 20, 0.3)",
              borderRadius: "20px",
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              color: "var(--mp-text)",
              fontSize: "0.85rem",
              boxShadow: "0 10px 30px " + "rgba" + "(0, 0, 0, 0.5)",
              animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--music-danger-red)", display: "inline-block" }} />
              {music.playbackStatus === "error" || music.stream?.error
                ? (music.stream?.error || "Signal stream failed to load.")
                : "Resolve stream is taking time..."}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={music.retryStream} style={{ background: "rgba" + "(255, 255, 255, 0.08)", border: "1px solid " + "rgba" + "(255, 255, 255, 0.1)", borderRadius: "12px", padding: "2px 10px", color: "white", fontSize: "0.75rem", fontWeight: "600", cursor: "none" }}>Retry</button>
              <button onClick={() => setPanel("source")} style={{ background: "var(--music-reactive-primary, " + "#" + "7d5fff)", border: "none", borderRadius: "12px", padding: "2px 10px", color: "white", fontSize: "0.75rem", fontWeight: "600", cursor: "none" }}>Change Source</button>
            </div>
          </div>
        </div>
      )}

      <button className="music-immersive-toggle" onClick={() => { music.setImmersive(!music.immersive); wakeControls(); }}>{music.immersive ? "Exit immersive" : "Immersive"}</button>
    </section>

    {!music.immersive && <aside className={`music-core-panel ${panel ? "is-open" : ""}`}><nav role="tablist">{[["queue", "Queue"], ["lyrics", "Lyrics"], ["details", "Details"], ["source", "Sources"]].map(([id, label]) => <button key={id} role="tab" aria-selected={panel === id} className={panel === id ? "active" : ""} onClick={() => setPanel(panel === id ? "" : id)}>{label}</button>)}</nav>
      {panel === "queue" && <QueueView music={music} />}
      {panel === "lyrics" && (lyrics.length > 0 ? <LyricsDisplay lines={lyrics} active={lyricsActive} /> : <div className="music-empty">Lyrics are drifting in space...</div>)}
      {panel === "details" && <div className="music-core-details"><h3>{music.current.albumTitle}</h3><p>Released: {music.current.year || "Unknown"}</p><p>Genre: {music.current.genre || "Unknown"}</p></div>}
      {panel === "source" && <ProviderSelectView music={music} />}
    </aside>}
  </div>;
}

function QueueView({ music }) {
  const drag = useRef(null);
  return <div className="music-core-list">{music.queue.map((track, index) => <div key={`${track.id}-${index}`} draggable onDragStart={() => { drag.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={() => music.moveQueueItem(drag.current, index)} className={index === music.index ? "active" : ""}>
    <button onClick={() => music.selectQueueItem(index)} aria-label={`Play ${track.title}`}><MusicArtwork track={track} className="queue-art" /><strong>{track.title}</strong><small>{track.artistName}</small></button>
    <button className="remove-btn" onClick={() => music.removeFromQueue(index)} aria-label="Remove">×</button>
  </div>)}</div>;
}

function LyricsDisplay({ lines, active }) {
  const ref = useRef(null);
  const floating = ref.current?.closest('.is-immersive') != null;
  const manualUntil = useRef(0);
  useEffect(() => {
    if (Date.now() < manualUntil.current || !ref.current) return;
    const activeEl = ref.current.querySelector(".active");
    if (activeEl) activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);
  return <div ref={ref} className={`music-core-lyrics${floating ? " floating" : ""}`} onWheel={() => { manualUntil.current = Date.now() + 5000; }}>{lines.map((line, index) => <p key={`${line.time || 0}-${index}`} className={index === active || lines.length === 1 ? "active" : ""}>{line.text}</p>)}</div>;
}

function ProviderSelectView({ music }) {
  const state = music.candidates;
  const select = (id) => music.selectCandidate(id);
  const retry = () => music.loadCandidates();
  if (state.status === "loading") return <div className="music-empty">Scanning frequencies...</div>;
  if (state.status === "error") return <div className="music-empty">Signal interference detected.<button onClick={retry}>Retry</button></div>;
  if (!state.items.length) return <div className="music-empty">No alternative sources found.</div>;
  return <div className="music-core-list">{state.items.map((candidate) => <div key={candidate.id}><button onClick={() => select(candidate.id)}><strong>{candidate.title}</strong><small>{candidate.artistName || candidate.providerId}</small></button></div>)}</div>;
}
