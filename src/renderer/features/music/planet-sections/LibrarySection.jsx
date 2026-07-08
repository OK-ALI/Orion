import React from "react";
import MusicTrackList from "../components/MusicTrackList";

export default function LibrarySection({ tracks = [], history = [] }) {
  const recent = history.map((item) => item.track).filter(Boolean);

  return (
    <section className="music-planet-section" id="library" data-scene-state="library">
      <h2 className="music-section-header">Library Galaxy</h2>
      <div className="music-glass-panel" style={{ width: "100%", maxWidth: "800px" }}>
        <div style={{ marginBottom: "3rem" }}>
          <h3>Recently Heard</h3>
          <MusicTrackList
            tracks={recent.slice(0, 4)}
            layout="grid"
            empty="Your first listens will appear here."
          />
        </div>

        <div>
          <h3>Local Signals</h3>
          <MusicTrackList
            tracks={tracks.slice(0, 8)}
            layout="grid"
            empty="Add a folder in Music Library to begin."
          />
        </div>
      </div>
    </section>
  );
}
