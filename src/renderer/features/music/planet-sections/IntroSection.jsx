import React from 'react';

export default function IntroSection({ onSearch }) {
  return (
    <section className="music-planet-section music-planet-section-intro" data-scene-state="idle-space">
      <h1 className="music-planet-title">Music Planet</h1>
      <p className="music-planet-subtitle">Your sound universe inside Orion.</p>
      
      <div className="planet-search-box">
        <input 
          type="text" 
          placeholder="Search galaxies for artists, albums, or tracks..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.value) {
              onSearch(e.target.value);
            }
          }}
        />
      </div>
    </section>
  );
}
