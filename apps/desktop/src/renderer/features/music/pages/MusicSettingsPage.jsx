import MusicAppearanceSettings from "../../settings/sections/MusicAppearanceSettings";

export default function MusicSettingsPage() {
  return (
    <div className="music-page music-settings-page">
      <header className="music-page-header compact">
        <span className="music-eyebrow">Music Planet controls</span>
        <h1>Settings</h1>
        <p>Shape the living orb, visualizer, lyric motion, portal sound, cache and performance behavior without leaving Music Planet.</p>
      </header>
      <MusicAppearanceSettings />
    </div>
  );
}
