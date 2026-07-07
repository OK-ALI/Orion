import React from 'react';

export default function PlanetGrid({ items = [], empty = "No planets found.", onNavigate }) {
  if (!items || items.length === 0) {
    return <p className="music-muted">{empty}</p>;
  }

  return (
    <div className="planet-grid">
      {items.map((item, index) => (
        <button key={`${item.id}-${index}`} onClick={() => onNavigate && onNavigate("music-album", item)} className="planet-card">
          <div className="art-container">
            <img src={item.artworkUrl || 'fallback-art.png'} alt="planet-art" />
          </div>
          <strong>{item.title || item.name}</strong>
          <div style={{ fontSize: '0.8rem', color: 'var(--music-muted)', marginTop: '0.5rem' }}>
            {item.artistName || `${item.trackCount || ""} tracks`}
          </div>
        </button>
      ))}
    </div>
  );
}
