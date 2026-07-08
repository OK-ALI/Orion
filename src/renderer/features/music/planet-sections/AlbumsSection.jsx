import React from 'react';
import MusicArtwork from '../components/MusicArtwork';

const FALLBACK_ART = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><defs><radialGradient id='g' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='%237d5fff' stop-opacity='0.6'/><stop offset='100%' stop-color='%2307070b' stop-opacity='0.95'/></radialGradient></defs><circle cx='100' cy='100' r='100' fill='url(%23g)'/></svg>";

export default function AlbumsSection({ dashboard, onNavigate }) {
  // Find albums section from dashboard
  const albumsSection = dashboard?.sections?.find(s => s.type === 'albums');

  return (
    <section className="music-planet-section" id="albums" data-scene-state="albums">
      <h2 className="music-section-header">Albums</h2>
      <div className="music-glass-panel" style={{ width: '100%', maxWidth: '1200px' }}>
        <p className="music-muted" style={{ marginBottom: '3rem' }}>Planetary systems waiting to be explored.</p>
        
        {albumsSection?.items?.length > 0 ? (
          <div className="planet-grid">
            {albumsSection.items.slice(0, 10).map((item, index) => (
              <button key={`${item.id}-${index}`} onClick={() => onNavigate("music-album", item)} className="planet-card">
                <div className="art-container">
                  <img src={item.artworkUrl || FALLBACK_ART} onError={(e) => { e.target.src = FALLBACK_ART; }} alt="planet-art" />
                </div>
                <strong>{item.title || item.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--music-muted)', marginTop: '0.5rem' }}>
                  {item.artistName || `${item.trackCount || ""} tracks`}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="music-muted">Connect sources to discover albums.</p>
        )}
      </div>
    </section>
  );
}
