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
        Music Planet is being carefully crafted and is not yet ready for exploration.
        <br />
        When it opens, every surface will respond to the music — visuals, colors, and motion
        will be driven by real-time audio analysis, creating an experience unlike anything else.
      </p>
      <span className="music-locked-tag">Coming soon</span>

      {/* Back to Cinema */}
      <button className="music-locked-back" onClick={() => onNavigate("home")}>
        ← Back to Cinema
      </button>
    </div>
  );
}
