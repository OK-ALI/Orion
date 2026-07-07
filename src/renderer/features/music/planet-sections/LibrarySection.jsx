import React from 'react';
import MusicTrackList from '../components/MusicTrackList';

import { useMusic } from '../context/MusicProvider';

export default function LibrarySection({ tracks, history, onPlay }) {
  const { current } = useMusic();
  const recent = history.map((item) => item.track).filter(Boolean);
  
  const renderMoonList = (list) => (
    <div className="moon-track-list">
      {list.map((track, i) => (
        <button 
          key={`${track.id}-${i}`} 
          className={`moon-track-item${current && current.id === track.id ? ' active' : ''}`} 
          onClick={() => onPlay(track, list)}
        >
          <div className="art-container">
            <img src={track.artworkUrl || track.album?.artworkUrl || 'fallback-art.png'} alt="moon-art" />
          </div>
          <div className="track-info">
            <strong>{track.title}</strong>
            <small>{track.artistName}</small>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <section className="music-planet-section" id="library" data-scene-state="library">
      <h2 className="music-section-header">Library Galaxy</h2>
      <div className="music-glass-panel" style={{ width: '100%', maxWidth: '800px' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h3>Recently Heard</h3>
          {recent.length > 0 ? (
            renderMoonList(recent.slice(0, 4))
          ) : (
            <p className="music-muted">Your first listens will appear here.</p>
          )}
        </div>
        
        <div>
          <h3>Local Signals</h3>
          {tracks.length > 0 ? (
            renderMoonList(tracks.slice(0, 8))
          ) : (
            <p className="music-muted">Add a folder in Music Library to begin.</p>
          )}
        </div>
      </div>
    </section>
  );
}
