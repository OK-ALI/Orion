import React, { useRef, useEffect } from 'react';
import MusicArtwork from '../components/MusicArtwork';

function time(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function NowPlayingSection({ music, onNavigate }) {
  const remaining = Math.max(0, music.progress.duration - music.progress.currentTime);

  return (
    <section className="music-planet-section" id="now-playing" data-scene-state="now-playing">
      <h2 className="music-section-header">Now Playing Core</h2>
      
      <div className="music-glass-panel music-now-playing-panel">
        {!music.current ? (
          <div className="music-empty-state">
            <p>The core is quiet. Choose a signal to begin.</p>
          </div>
        ) : (
          <div className="music-now-playing-content">
            <div className={`music-celestial-art${music.playing ? " is-playing" : ""}`}>
              <MusicArtwork track={music.current} currentArtwork={music.artwork} label={`Artwork for ${music.current.title}`} />
              {/* Orbital rings */}
              <i className="orbit orbit-a" /><i className="orbit orbit-b" /><i className="orbit orbit-c" />
            </div>
            
            <div className="music-core-meta">
              <h1>{music.current.title}</h1>
              <p>{music.current.artistName || "Unknown artist"}{music.current.albumTitle ? ` · ${music.current.albumTitle}` : ""}</p>
            </div>
            
            <div className="music-core-controls">
              <button onClick={() => music.setShuffle(!music.shuffle)} className={music.shuffle ? "active" : ""}>Shuffle</button>
              <button onClick={music.playPrevious} aria-label="Previous track">Previous</button>
              <button className="primary" onClick={music.togglePlaying}>{music.playbackStatus === "buffering" ? "Buffering" : music.playing ? "Pause" : "Play"}</button>
              <button onClick={music.playNext} aria-label="Next track">Next</button>
              <button onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")} className={music.repeat !== "off" ? "active" : ""}>Repeat {music.repeat}</button>
            </div>
            
            <div className="music-core-timeline">
              <span>{time(music.progress.currentTime)}</span>
              <div>
                <span style={{ width: `${music.buffered * 100}%` }} />
                <input aria-label="Seek music" type="range" min="0" max={music.progress.duration || 1} step="0.1" value={Math.min(music.progress.currentTime, music.progress.duration || 1)} onChange={(event) => music.seekTo(Number(event.target.value))} />
              </div>
              <span>-{time(remaining)}</span>
            </div>
            
            {/* Embedded Lyrics Preview if available */}
            {music.lyrics?.status === "ready" && music.lyrics.value?.lines && (
              <div className="music-embedded-lyrics-preview">
                <button onClick={() => music.setPanel('lyrics')} className="btn btn-ghost">View Full Lyrics</button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
