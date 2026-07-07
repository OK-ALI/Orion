import React from 'react';
import { useMusic } from '../context/MusicProvider';

export default function PluginsSection() {
  const { plugins: pluginStore } = useMusic();
  const { plugins = [], loaded = false, isLoading = false, enablePlugin, disablePlugin } = pluginStore || {};

  const handleToggle = async (plugin) => {
    try {
      if (plugin.enabled) {
        await disablePlugin(plugin.id);
      } else {
        await enablePlugin(plugin.id);
      }
    } catch (e) {
      console.error("Failed to toggle plugin status:", e);
    }
  };

  return (
    <section className="music-planet-section" id="plugins" data-scene-state="idle-space">
      <div className="music-section-heading">
        <div>
          <span>Capability extensions</span>
          <h2>Plugins</h2>
        </div>
      </div>
      {isLoading && <p className="music-muted">Configuring extensions...</p>}
      {!loaded && !isLoading && <p className="music-muted">Discovering extension system...</p>}
      {loaded && plugins.length === 0 && <p className="music-muted">No external plugins detected.</p>}
      
      <div className="planet-grid">
        {plugins.map(plugin => (
          <div key={plugin.id} className="planet-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ textAlign: 'center' }}>
              <strong>{plugin.name}</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--mp-muted)', margin: '0.5rem 0' }}>v{plugin.version} • by {plugin.author || 'Orion'}</p>
              <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0 0', opacity: 0.85 }}>{plugin.description || "Extension plugin."}</p>
            </div>
            
            <button 
              onClick={() => handleToggle(plugin)}
              style={{
                background: plugin.enabled ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid',
                borderColor: plugin.enabled ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                color: plugin.enabled ? '#2ed573' : 'var(--mp-text)',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'none', /* Custom cursor */
                transition: 'all 0.2s ease'
              }}
            >
              {plugin.enabled ? 'Active' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
