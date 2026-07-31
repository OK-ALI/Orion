import MusicArtwork from "../components/MusicArtwork";
import MusicOrbitalStage from "../components/MusicOrbitalStage";
import MusicVisualizer from "../visual/MusicVisualizer";

function time(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function CoreIcon({ name }) {
  const paths = {
    previous: <><path d="M6 5v14"/><path d="m18 6-9 6 9 6Z"/></>,
    next: <><path d="M18 5v14"/><path d="m6 6 9 6-9 6Z"/></>,
    play: <path d="m8 5 11 7-11 7Z"/>,
    pause: <><path d="M9 5v14"/><path d="M15 5v14"/></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function NowPlayingSection({ music, onNavigate }) {
  const duration = Math.max(0, music.progress.duration || 0);
  const currentTime = Math.min(duration || 0, Math.max(0, music.progress.currentTime || 0));
  const played = duration ? currentTime / duration : 0;
  const remaining = Math.max(0, duration - currentTime);
  const favorite = music.current ? music.favorites?.isTrackFavorite?.(music.current) : false;
  const toggleFavorite = () => favorite
    ? music.favorites?.removeTrack?.(music.current)
    : music.favorites?.addTrack?.(music.current);
  const activeLyric = music.lyrics?.value?.lines?.filter((line) => Number(line.time) <= currentTime).at(-1)?.text;

  return <MusicOrbitalStage id="now-playing" sceneState="now-playing" anchor="right" eyebrow="Listening Core"
    title="Now Playing" description="Your active signal, carried through every part of Orion."
    state={music.current ? "ready" : "empty"} stateTitle="The core is quiet"
    stateMessage="Choose a signal to wake the observatory."
    stateActions={<><button onClick={() => onNavigate("music-search")}>Search Music</button>
      <button onClick={() => onNavigate("music-library")}>Open Library</button></>}>
    {music.current && <div className="music-listening-core">
      <div className={`music-listening-art${music.playing ? " is-playing" : ""}`}>
        <MusicArtwork variant="album" track={music.current} currentArtwork={music.artwork}
          label={`Artwork for ${music.current.title}`} />
        <i className="music-listening-art-orbit" aria-hidden="true" />
      </div>
      <div className="music-listening-copy">
        <span className={`music-playback-state is-${music.playbackStatus}`}>{music.playbackStatus}</span>
        <h3>{music.current.title}</h3>
        <p>{music.current.artistName || "Unknown artist"}{music.current.albumTitle ? ` · ${music.current.albumTitle}` : ""}</p>
        <div className="music-listening-controls" aria-label="Listening Core controls">
          <button onClick={() => music.setShuffle(!music.shuffle)} className={music.shuffle ? "active" : ""} aria-pressed={music.shuffle}>Shuffle</button>
          <button className="icon" onClick={music.playPrevious} aria-label="Previous track"><CoreIcon name="previous" /></button>
          <button className="icon primary" onClick={music.togglePlaying} aria-label={music.playing ? "Pause" : "Play"}>
            {(music.playbackStatus === "loading" || music.playbackStatus === "buffering")
              ? <span className="music-button-loader"><i /></span> : <CoreIcon name={music.playing ? "pause" : "play"} />}
          </button>
          <button className="icon" onClick={music.playNext} aria-label="Next track"><CoreIcon name="next" /></button>
          <button onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")}
            className={music.repeat !== "off" ? "active" : ""}>Repeat {music.repeat === "one" ? "1" : music.repeat === "all" ? "all" : "off"}</button>
          <button onClick={toggleFavorite} className={favorite ? "active" : ""} aria-pressed={favorite}>{favorite ? "Liked" : "Like"}</button>
        </div>
        <div className={`music-listening-timeline${duration ? "" : " is-indeterminate"}`}>
          <span>{time(currentTime)}</span>
          <div className="music-progress-track" style={{ "--music-played": `${played * 100}%`, "--music-buffered": `${music.buffered * 100}%` }}>
            <i className="music-progress-buffered" /><i className="music-progress-played" />
            <MusicVisualizer variant="timeline" className="music-progress-wave" />
            <input aria-label="Seek music" type="range" min="0" max={duration || 1} step="0.1" value={currentTime}
              disabled={!duration} onChange={(event) => music.seekTo(Number(event.target.value))} />
          </div>
          <span>{duration ? `-${time(remaining)}` : "Live"}</span>
        </div>
        <div className="music-listening-footer">
          <p>{activeLyric || "The waveform will carry lyrics here when they are available."}</p>
          <div><button onClick={() => { music.setPanel("queue"); }}>Queue</button>
            <button onClick={() => { music.setPanel("lyrics"); music.loadLyrics(); }}>Lyrics</button>
            <button onClick={() => onNavigate("music-now-playing", music.current)}>Open Observatory</button></div>
        </div>
      </div>
    </div>}
  </MusicOrbitalStage>;
}
