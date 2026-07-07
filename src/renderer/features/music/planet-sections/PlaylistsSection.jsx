import React from 'react';

export default function PlaylistsSection({ playlists, onNavigate }) {
  return (
    <section className="music-planet-section" id="playlists" data-scene-state="playlists">
      <h2 className="music-section-header">Playlists</h2>
      <div className="music-glass-panel" style={{ width: '100%', maxWidth: '1000px' }}>
        <p className="music-muted" style={{ marginBottom: '2rem' }}>Constellations of curated sounds.</p>
        
        {playlists && playlists.length > 0 ? (
          <div className="planet-grid">
            {playlists.slice(0, 6).map((playlist) => (
              <button key={playlist.id} onClick={() => onNavigate("music-playlist", playlist)} className="constellation-card">
                <div className="constellation-nodes">
                  <i className="constellation-node" /><i className="constellation-node" /><i className="constellation-node" />
                </div>
                <strong>{playlist.name}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--music-muted)', marginTop: '0.5rem' }}>
                  {playlist.items?.length || 0} tracks
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="music-muted">Create playlists to see your constellations.</p>
        )}
      </div>
    </section>
  );
}
