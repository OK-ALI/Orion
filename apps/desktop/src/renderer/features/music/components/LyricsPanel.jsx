import { useEffect, useMemo } from "react";
import { useMusic } from "../context/MusicProvider";

export default function LyricsPanel({ onClose }) {
  const { lyrics, current, progress, loadLyrics } = useMusic();
  const { status, value, error } = lyrics;
  useEffect(() => { if (current && status === "idle") loadLyrics(); }, [current, loadLyrics, status]);
  const activeLine = useMemo(() => {
    if (value?.type !== "synced") return -1;
    const time = Number(progress.currentTime) || 0;
    let result = -1;
    value.lines.forEach((line, index) => { if (line.time <= time) result = index; });
    return result;
  }, [progress.currentTime, value]);
  return <aside className="music-right-panel lyrics-panel" aria-label="Lyrics"><header><div><span>{current?.artistName || "Music Planet"}</span><h2>Lyrics</h2></div><button onClick={onClose} className="music-header-icon-btn" aria-label="Close lyrics">×</button></header>
    <div className="lyrics-content">{!current ? <div className="music-empty">Play a track to see lyrics.</div>
      : status === "loading" ? <div className="music-empty">Searching the cosmos for words…</div>
      : status === "error" || error ? <div className="music-empty">{error || "No lyrics found."}<button onClick={loadLyrics}>Retry</button></div>
      : !value ? <div className="music-empty">No lyrics found.<br />The track is still speaking through sound.</div>
      : value.type === "synced" ? <div className="music-lyrics-display">{value.lines.map((line, index) => <p key={`${line.time}-${index}`} className={index === activeLine ? "active" : ""}>{line.text}</p>)}</div>
      : <div className="music-lyrics-display plain"><p>{value.text || "Lyrics are unavailable."}</p></div>}</div>
  </aside>;
}
