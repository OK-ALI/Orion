import React from 'react';

const FALLBACK_ART = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><defs><radialGradient id='g' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='%237d5fff' stop-opacity='0.6'/><stop offset='100%' stop-color='%2307070b' stop-opacity='0.95'/></radialGradient></defs><circle cx='100' cy='100' r='100' fill='url(%23g)'/></svg>";

export default function StarGrid({ items = [], empty = "No stars found.", onNavigate }) {
  if (!items || items.length === 0) {
    return <p className="music-muted">{empty}</p>;
  }

  return (
    <div className="planet-grid">
      {items.map((item, index) => (
        <button key={`${item.id}-${index}`} onClick={() => onNavigate && onNavigate("music-artist", item)} className="star-card">
          <div className="art-container">
            <img src={item.profileImageUrl || item.artworkUrl || FALLBACK_ART} onError={(e) => { e.target.src = FALLBACK_ART; }} alt="star-art" />
          </div>
          <strong>{item.title || item.name}</strong>
        </button>
      ))}
    </div>
  );
}
