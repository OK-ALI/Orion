import React from 'react';
import '../../styles/features/music/planet-v2.css';
import '../../styles/features/music/layout.css';

export default function MusicPlanet({ page, selected, onNavigate }) {
  return (
    <div className="music-planet-locked">
      {/* Ambient aurora background */}
      <div className="music-locked-aurora" aria-hidden="true">
        <i /><i /><i />
      </div>

      {/* Planet glyph */}
      <div className="music-locked-planet" aria-hidden="true">
        <i className="music-locked-ring" />
        <i className="music-locked-ring ring-b" />
      </div>

      {/* Message */}
      <h1 className="music-locked-title">Music Planet</h1>
      <p className="music-locked-subtitle">A listening world shaped by the music itself.</p>
      <div className="music-locked-divider" />
      <p className="music-locked-body">
        Music Planet is undergoing structural renovations and backend tuning to provide a premium, dynamic listening environment.
        <br />
        We are crafting custom visualizers, visual theme bindings, and a zero-lag unified catalog search fallback interface. Exploration will resume shortly!
      </p>
      <span className="music-locked-tag">Under Renovation</span>

      {/* Back to Cinema */}
      <button className="music-locked-back" onClick={() => onNavigate("home")}>
        ← Back to Cinema
      </button>
    </div>
  );
}
