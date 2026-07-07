import React from 'react';
import MusicArtwork from '../components/MusicArtwork';

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
                  <img src={item.artworkUrl || 'fallback-art.png'} alt="planet-art" />
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
