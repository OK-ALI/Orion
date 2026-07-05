import { useState } from "react";
import { SearchIcon, SettingsIcon } from "../../../components/common/Icons";
import { useMusic } from "../context/MusicProvider";

export default function MusicHeader({ onNavigate, onTogglePanel, activePanel }) {
  const [query, setQuery] = useState("");
  const { current, lyrics, loadLyrics } = useMusic();

  const handleSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (value) onNavigate("music-search", { query: value });
  };
  const toggleLyrics = () => {
    const opening = activePanel !== "lyrics";
    onTogglePanel("lyrics");
    if (opening && current && lyrics.status === "idle") loadLyrics();
  };

  return <header className="music-header">
    <button className="music-header-title" onClick={() => onNavigate("music-home")} aria-label="Music Planet Home">
      <span className="music-header-planet" aria-hidden="true"><i /></span><span>Music Planet</span>
    </button>
    <form className="music-header-search-form" onSubmit={handleSearch} role="search">
      <label className="music-header-search-input-wrapper"><SearchIcon size={18} /><span className="sr-only">Search Music Planet</span><input type="search" placeholder="Search songs, artists, albums and playlists" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </form>
    <div className="music-header-controls">
      <button className={`music-header-btn ${activePanel === "queue" ? "active" : ""}`} onClick={() => onTogglePanel("queue")} aria-pressed={activePanel === "queue"}>Queue</button>
      <button className={`music-header-btn ${activePanel === "lyrics" ? "active" : ""}`} onClick={toggleLyrics} aria-pressed={activePanel === "lyrics"}>Lyrics</button>
      <button className="music-header-icon-btn" onClick={() => onNavigate("settings", { section: "musicAppearance" })} title="Music appearance settings" aria-label="Open Music appearance settings"><SettingsIcon size={20} /></button>
    </div>
  </header>;
}
