import React from 'react';
import MusicArtwork from '../components/MusicArtwork';

const FALLBACK_ART = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><defs><radialGradient id='g' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='%237d5fff' stop-opacity='0.6'/><stop offset='100%' stop-color='%2307070b' stop-opacity='0.95'/></radialGradient></defs><circle cx='100' cy='100' r='100' fill='url(%23g)'/></svg>";

export default function ArtistsSection({ dashboard, onNavigate }) {
  // Find artists section from dashboard
  const artistsSection = dashboard?.sections?.find(s => s.type === 'artists');

  return (
    <section className="music-planet-section" id="artists" data-scene-state="artists">
      <h2 className="music-section-header">Artists</h2>
      <div className="music-glass-panel" style={{ width: '100%', maxWidth: '1200px' }}>
        <p className="music-muted" style={{ marginBottom: '3rem' }}>The stars of your universe.</p>
        
        {artistsSection?.items?.length > 0 ? (
          <div className="planet-grid">
            {artistsSection.items.slice(0, 10).map((item, index) => (
              <button key={`${item.id}-${index}`} onClick={() => onNavigate("music-artist", item)} className="star-card">
                <div className="art-container">
                  <img src={item.profileImageUrl || item.artworkUrl || FALLBACK_ART} onError={(e) => { e.target.src = FALLBACK_ART; }} alt="star-art" />
                </div>
                <strong>{item.title || item.name}</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="music-muted">Connect sources to discover artists.</p>
        )}
      </div>
    </section>
  );
}
