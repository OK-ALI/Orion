import React from "react";
import { useMusic } from "../context/MusicProvider";
import "../../../styles/features/music/plugins-coherence.css";

export default function PluginsSection() {
  const { plugins: pluginStore } = useMusic();
  const {
    plugins = [],
    loaded = false,
    isLoading = false,
    enablePlugin,
    disablePlugin,
  } = pluginStore || {};

  const handleToggle = async (plugin) => {
    try {
      if (plugin.enabled) await disablePlugin(plugin.id);
      else await enablePlugin(plugin.id);
    } catch (error) {
      console.error("Failed to toggle plugin status:", error);
    }
  };

  return (
    <section className="music-planet-section music-plugin-stage" id="plugins" data-scene-state="idle-space">
      <div className="music-section-heading">
        <div>
          <span>Capability extensions</span>
          <h2>Plugins</h2>
        </div>
      </div>

      {isLoading && <p className="music-muted">Configuring extensions...</p>}
      {!loaded && !isLoading && <p className="music-muted">Discovering extension system...</p>}
      {loaded && plugins.length === 0 && <p className="music-muted">No external plugins detected.</p>}

      <div className="planet-grid music-plugin-stage-grid">
        {plugins.map((plugin) => (
          <article key={plugin.id} className="planet-card music-plugin-stage-card">
            <div className="music-plugin-stage-copy">
              <strong>{plugin.name}</strong>
              <p className="music-plugin-stage-meta">v{plugin.version} • by {plugin.author || "Orion"}</p>
              <p className="music-plugin-stage-description">{plugin.description || "Extension plugin."}</p>
            </div>

            <button
              className={`music-plugin-stage-toggle${plugin.enabled ? " is-enabled" : ""}`}
              onClick={() => handleToggle(plugin)}
              aria-pressed={Boolean(plugin.enabled)}
            >
              {plugin.enabled ? "Active" : "Disabled"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
