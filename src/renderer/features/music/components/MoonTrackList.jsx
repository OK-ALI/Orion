import React from 'react';
import { useMusic } from '../context/MusicProvider';

export default function MoonTrackList({ tracks = [], empty = "No tracks found." }) {
  const { playTrack, current } = useMusic();

  if (!tracks || tracks.length === 0) {
    return <p className="music-muted">{empty}</p>;
  }

  return (
    <div className="moon-track-list">
      {tracks.map((track, i) => (
        <button key={`${track.id}-${i}`} className={`moon-track-item ${current?.id === track.id ? 'active' : ''}`} onClick={() => playTrack(track, tracks)}>
          <div className="art-container">
            <img src={track.artworkUrl || track.album?.artworkUrl || 'fallback-art.png'} alt="moon-art" />
          </div>
          <div className="track-info">
            <strong>{track.title || track.name}</strong>
            <small>{track.artistName}</small>
          </div>
        </button>
      ))}
    </div>
  );
}
