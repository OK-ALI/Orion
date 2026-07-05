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
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef(null);
  useEffect(() => {
    if (panel === "lyrics" && music.lyrics.status === "idle") music.loadLyrics();
    if (panel === "source" && music.candidates.status === "idle") music.loadCandidates();
  }, [music, panel]);
  useEffect(() => {
    const key = (event) => { if (event.key === "Escape" && music.immersive) music.setImmersive(false); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [music.immersive]);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  if (!music.current) return <div className="music-page"><div className="music-empty"><h2>Nothing is playing</h2><p>Choose a track to bring the Observatory to life.</p><button onClick={() => onNavigate("music-home")}>Music Home</button></div></div>;
  const remaining = Math.max(0, music.progress.duration - music.progress.currentTime);
  const wakeControls = () => {
    setControlsVisible(true); clearTimeout(hideTimer.current);
    if (music.immersive && music.playing) hideTimer.current = setTimeout(() => setControlsVisible(false), 2600);
  };
  const palette = music.artwork.palette;
  const style = { "--music-reactive-base": palette.base, "--music-reactive-primary": palette.primary, "--music-reactive-spectral": palette.spectral };
  return <div className={`music-page music-observatory${music.immersive ? " is-immersive" : ""}${controlsVisible ? " controls-visible" : ""}`} style={style} onPointerMove={wakeControls} onFocus={wakeControls}>
    <section className="music-observatory-stage">
      <div className="music-observatory-backdrop" />
      <MusicVisualizer variant={music.visualPreferences.visualizer} className="music-observatory-visual" />
      <div className={`music-celestial-art${music.playing ? " is-playing" : ""}`}>
        <MusicArtwork track={music.current} currentArtwork={music.artwork} label={`Artwork for ${music.current.title}`} />
        <i className="orbit orbit-a" /><i className="orbit orbit-b" /><i className="orbit orbit-c" />
      </div>
      <div className="music-observatory-meta"><span className="music-eyebrow">Now Playing</span><h1>{music.current.title}</h1><p>{music.current.artistName || "Unknown artist"}{music.current.albumTitle ? ` · ${music.current.albumTitle}` : ""}</p></div>
      <div className="music-observatory-controls">
        <button onClick={() => music.setShuffle(!music.shuffle)} className={music.shuffle ? "active" : ""}>Shuffle</button><button onClick={music.playPrevious} aria-label="Previous track">Previous</button>
        <button className="primary" onClick={music.togglePlaying}>{music.playbackStatus === "buffering" ? "Buffering" : music.playing ? "Pause" : "Play"}</button>
        <button onClick={music.playNext} aria-label="Next track">Next</button><button onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")} className={music.repeat !== "off" ? "active" : ""}>Repeat {music.repeat}</button>
      </div>
      <div className="music-observatory-timeline"><span>{time(music.progress.currentTime)}</span><div><span style={{ width: `${music.buffered * 100}%` }} /><MusicVisualizer variant="timeline" /><input aria-label="Seek music" type="range" min="0" max={music.progress.duration || 1} step="0.1" value={Math.min(music.progress.currentTime, music.progress.duration || 1)} onChange={(event) => music.seekTo(Number(event.target.value))} /></div><span>-{time(remaining)}</span></div>
      <button className="music-immersive-toggle" onClick={() => { music.setImmersive(!music.immersive); wakeControls(); }}>{music.immersive ? "Exit immersive" : "Immersive"}</button>
      {music.immersive && panel === "lyrics" && <LyricsView state={music.lyrics} currentTime={music.progress.currentTime} floating />}
    </section>
    {!music.immersive && <aside className={`music-observatory-panel ${panel ? "is-open" : ""}`}><nav role="tablist">{[["queue", "Queue"], ["lyrics", "Lyrics"], ["details", "Details"], ["source", "Sources"]].map(([id, label]) => <button key={id} role="tab" aria-selected={panel === id} className={panel === id ? "active" : ""} onClick={() => setPanel(panel === id ? "" : id)}>{label}</button>)}</nav>
      {panel === "queue" && <QueueView music={music} />}{panel === "lyrics" && <LyricsView state={music.lyrics} currentTime={music.progress.currentTime} motion={music.visualPreferences.lyricsMotion} />}
      {panel === "details" && <dl><dt>Title</dt><dd>{music.current.title}</dd><dt>Artist</dt><dd>{music.current.artistName || "Unknown"}</dd><dt>Album</dt><dd>{music.current.albumTitle || "Single"}</dd><dt>Source</dt><dd>{music.stream?.candidate?.providerId || music.current.provider || "Automatic"}</dd><dt>Status</dt><dd>{music.playbackStatus}</dd></dl>}
      {panel === "source" && <SourceView state={music.candidates} select={music.selectCandidate} retry={music.loadCandidates} />}</aside>}
  </div>;
}

function QueueView({ music }) {
  const drag = useRef(-1);
  return <div className="music-observatory-list">{music.queue.map((track, index) => <div key={`${track.id}-${index}`} draggable onDragStart={() => { drag.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={() => music.moveQueueItem(drag.current, index)} className={index === music.index ? "active" : ""}>
    <button onClick={() => music.selectQueueItem(index)}><span>{index + 1}</span><strong>{track.title}</strong><small>{track.artistName}</small></button><button onClick={() => music.removeFromQueue(index)} aria-label={`Remove ${track.title}`}>×</button></div>)}</div>;
}

function LyricsView({ state, currentTime, floating = false, motion = true }) {
  const ref = useRef(null);
  const active = state.value?.type === "synced" ? state.value.lines.findIndex((line, index) => currentTime >= line.time && currentTime < (state.value.lines[index + 1]?.time ?? Infinity)) : -1;
  const manualUntil = useRef(0);
  useEffect(() => { if (motion && active >= 0 && Date.now() > manualUntil.current) ref.current?.children[active]?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [active, motion]);
  if (state.status === "loading") return <div className="music-panel-state">Finding lyrics…</div>;
  if (state.status === "error") return <div className="music-panel-state">{state.error}</div>;
  const lines = state.value?.type === "synced" ? state.value.lines : [{ text: state.value?.text || "Lyrics are unavailable." }];
  return <div ref={ref} className={`music-observatory-lyrics${floating ? " floating" : ""}`} onWheel={() => { manualUntil.current = Date.now() + 5000; }}>{lines.map((line, index) => <p key={`${line.time || 0}-${index}`} className={index === active || lines.length === 1 ? "active" : ""}>{line.text}</p>)}</div>;
}

function SourceView({ state, select, retry }) {
  if (state.status === "loading") return <div className="music-panel-state">Finding available sources…</div>;
  if (state.status === "error") return <div className="music-panel-state">{state.error}<button onClick={retry}>Retry</button></div>;
  return <div className="music-observatory-list">{state.items.map((candidate) => <div key={candidate.id}><button onClick={() => select(candidate.id)}><strong>{candidate.title}</strong><small>{candidate.artistName || candidate.providerId}</small></button></div>)}</div>;
}
