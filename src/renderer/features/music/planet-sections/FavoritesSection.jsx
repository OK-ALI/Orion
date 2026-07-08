import React from "react";
import MusicTrackList from "../components/MusicTrackList";

export default function FavoritesSection({ tracks = [] }) {
  return (
    <section className="music-planet-section" id="favorites" data-scene-state="playlists">
      <div className="music-section-heading">
        <div>
          <span>Your constellation</span>
          <h2>Favorites</h2>
        </div>
      </div>
      <MusicTrackList tracks={tracks} layout="grid" empty="Favorite tracks will gather here." />
    </section>
  );
}
