import React from 'react';

export default function StarGrid({ items = [], empty = "No stars found.", onNavigate }) {
  if (!items || items.length === 0) {
    return <p className="music-muted">{empty}</p>;
  }

  return (
    <div className="planet-grid">
      {items.map((item, index) => (
        <button key={`${item.id}-${index}`} onClick={() => onNavigate && onNavigate("music-artist", item)} className="star-card">
          <div className="art-container">
            <img src={item.profileImageUrl || item.artworkUrl || 'fallback-art.png'} alt="star-art" />
          </div>
          <strong>{item.title || item.name}</strong>
        </button>
      ))}
    </div>
  );
}
