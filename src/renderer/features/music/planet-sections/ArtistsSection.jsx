import React from 'react';
import MusicArtwork from '../components/MusicArtwork';

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
                  <img src={item.profileImageUrl || item.artworkUrl || 'fallback-art.png'} alt="star-art" />
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
