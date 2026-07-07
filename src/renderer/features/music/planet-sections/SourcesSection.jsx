import React from 'react';
import { useMusic } from '../context/MusicProvider';

const KIND_LABELS = {
  metadata: "Metadata Catalogs",
  lyrics: "Lyrics Streamers",
  stream: "Audio Transmitters"
};

export default function SourcesSection() {
  const { providers: providersStore } = useMusic();
  const { providers = [], loaded = false, setActive } = providersStore || {};

  // Group providers by kind
  const grouped = providers.reduce((acc, p) => {
    const kind = p.kind || 'stream';
    if (!acc[kind]) acc[kind] = [];
    acc[kind].push(p);
    return acc;
  }, {});

  const handleSetActive = async (kind, id) => {
    try {
      await setActive(kind, id);
    } catch (e) {
      console.error(`Failed to set active provider ${id} for ${kind}:`, e);
    }
  };

  return (
    <section className="music-planet-section" id="sources" data-scene-state="idle-space">
      <div className="music-section-heading">
        <div>
          <span>Provider routing</span>
          <h2>Sources</h2>
        </div>
      </div>
      {!loaded && <p className="music-muted">Configuring audio pipelines...</p>}
      {loaded && providers.length === 0 && <p className="music-muted">No external sources loaded.</p>}
      
      {loaded && Object.entries(grouped).map(([kind, list]) => (
        <div key={kind} style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ margin: '0 0 1.2rem', opacity: 0.9, letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: '0.9rem', color: 'var(--mp-primary)' }}>
            {KIND_LABELS[kind] || kind}
          </h3>
          <div className="planet-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {list.map(source => (
              <div 
                key={source.id} 
                className="planet-card" 
                style={{ 
                  padding: '1.5rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  gap: '1rem', 
                  background: 'rgba(255,255,255,0.02)',
                  borderColor: source.active ? 'var(--mp-primary)' : 'transparent',
                  boxShadow: source.active ? '0 0 15px var(--mp-glow)' : 'none'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <strong>{source.name || source.id}</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--mp-muted)', margin: '0.3rem 0' }}>{source.id}</p>
                  <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0 0', opacity: 0.8 }}>{source.description || "Active provider catalog."}</p>
                </div>
                
                <button 
                  onClick={() => !source.active && handleSetActive(kind, source.id)}
                  disabled={source.active}
                  style={{
                    background: source.active ? 'rgba(125, 95, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid',
                    borderColor: source.active ? 'rgba(125, 95, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    color: source.active ? 'var(--mp-primary)' : 'var(--mp-text)',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: source.active ? 'default' : 'none', /* Hide default cursor */
                    opacity: source.active ? 1 : 0.8,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {source.active ? 'Routing' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
