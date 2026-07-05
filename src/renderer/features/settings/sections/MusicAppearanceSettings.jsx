import { useEffect, useState } from "react";
import { formatBytes, storage, STORAGE_KEYS } from "../../../services/settingsStore";
import { SettingsSelect, Toggle } from "../components/SettingsControls";
import { SectionGroupHeader } from "./SystemSettings";

const DEFAULTS = { atmosphere: "pulse", visualizer: "orbit", intensity: 65, artworkColor: true,
  portalSound: true, portalVolume: 20, lyricsMotion: true, adaptPerformance: true,
  replayGain: true, crossfadeDuration: 0, lowGpu: false, disableAudioReactiveBg: false,
  staticBg: false, particleDensity: "medium", batterySaver: false };

function read() {
  return {
    atmosphere: storage.get(STORAGE_KEYS.MUSIC_ATMOSPHERE) || DEFAULTS.atmosphere,
    visualizer: storage.get(STORAGE_KEYS.MUSIC_VISUALIZER) || DEFAULTS.visualizer,
    intensity: storage.get(STORAGE_KEYS.MUSIC_VISUAL_INTENSITY) ?? DEFAULTS.intensity,
    artworkColor: storage.get(STORAGE_KEYS.MUSIC_ARTWORK_COLOR) !== false,
    portalSound: storage.get(STORAGE_KEYS.MUSIC_PORTAL_SOUND) !== false,
    portalVolume: storage.get(STORAGE_KEYS.MUSIC_PORTAL_VOLUME) ?? DEFAULTS.portalVolume,
    lyricsMotion: storage.get(STORAGE_KEYS.MUSIC_LYRICS_MOTION) !== false,
    adaptPerformance: storage.get(STORAGE_KEYS.MUSIC_PERFORMANCE_ADAPT) !== false,
    replayGain: storage.get(STORAGE_KEYS.MUSIC_REPLAY_GAIN) !== false,
    crossfadeDuration: storage.get(STORAGE_KEYS.MUSIC_CROSSFADE_DURATION) ?? 0,
    lowGpu: storage.get(STORAGE_KEYS.MUSIC_LOW_GPU) === true,
    disableAudioReactiveBg: storage.get(STORAGE_KEYS.MUSIC_DISABLE_AUDIO_REACTIVE_BG) === true,
    staticBg: storage.get(STORAGE_KEYS.MUSIC_STATIC_BG) === true,
    particleDensity: storage.get(STORAGE_KEYS.MUSIC_PARTICLE_DENSITY) || DEFAULTS.particleDensity,
    batterySaver: storage.get(STORAGE_KEYS.MUSIC_BATTERY_SAVER) === true,
  };
}

export default function MusicAppearanceSettings({ sectionRef }) {
  const [value, setValue] = useState(read);
  const [cache, setCache] = useState({ bytes: 0, files: 0, limitMb: 256, status: "loading" });
  useEffect(() => {
    window.electron?.musicGetCacheStatus?.().then((result) => setCache({ ...result, status: "ready" }))
      .catch(() => setCache((current) => ({ ...current, status: "error" })));
  }, []);
  useEffect(() => {
    const map = {
      atmosphere: STORAGE_KEYS.MUSIC_ATMOSPHERE, visualizer: STORAGE_KEYS.MUSIC_VISUALIZER,
      intensity: STORAGE_KEYS.MUSIC_VISUAL_INTENSITY, artworkColor: STORAGE_KEYS.MUSIC_ARTWORK_COLOR,
      portalSound: STORAGE_KEYS.MUSIC_PORTAL_SOUND, portalVolume: STORAGE_KEYS.MUSIC_PORTAL_VOLUME,
      lyricsMotion: STORAGE_KEYS.MUSIC_LYRICS_MOTION, adaptPerformance: STORAGE_KEYS.MUSIC_PERFORMANCE_ADAPT,
      replayGain: STORAGE_KEYS.MUSIC_REPLAY_GAIN, crossfadeDuration: STORAGE_KEYS.MUSIC_CROSSFADE_DURATION,
      lowGpu: STORAGE_KEYS.MUSIC_LOW_GPU, disableAudioReactiveBg: STORAGE_KEYS.MUSIC_DISABLE_AUDIO_REACTIVE_BG,
      staticBg: STORAGE_KEYS.MUSIC_STATIC_BG, particleDensity: STORAGE_KEYS.MUSIC_PARTICLE_DENSITY,
      batterySaver: STORAGE_KEYS.MUSIC_BATTERY_SAVER,
    };
    Object.entries(map).forEach(([name, key]) => storage.set(key, value[name]));
    window.dispatchEvent(new CustomEvent("orion:music-appearance-changed", { detail: value }));
  }, [value]);
  const change = (name, next) => setValue((current) => ({ ...current, [name]: next }));
  return <section ref={sectionRef} className="music-settings-section" style={{ scrollMarginTop: 80 }}>
    <SectionGroupHeader title="Music appearance" subtitle="Shape the Resonance Observatory and its performance profile" />
    <div className="music-settings-preview"><span className="planet"><i /><i /></span><div><strong>Live Pulse preview</strong><small>Artwork color, orbital glow and motion update immediately.</small></div><span className="preview-wave">▂▅▇▄▆▃█▅</span></div>
    <SettingRow label="Atmosphere" detail="Pulse is adaptive and responds to the real audio signal."><SettingsSelect value={value.atmosphere} onChange={(next) => change("atmosphere", next)} options={[{ value: "off", label: "Off" }, { value: "calm", label: "Calm" }, { value: "pulse", label: "Pulse" }, { value: "immersive", label: "Immersive" }]} /></SettingRow>
    <SettingRow label="Visualizer" detail="Choose the Observatory's primary audio geometry."><SettingsSelect value={value.visualizer} onChange={(next) => change("visualizer", next)} options={[{ value: "orbit", label: "Orbit" }, { value: "wave", label: "Wave" }, { value: "bars", label: "Bars" }, { value: "off", label: "Off" }]} /></SettingRow>
    <SettingRow label="Visual intensity" detail="Controls glow, motion depth and spectral highlights."><input aria-label="Music visual intensity" type="range" min="0" max="100" value={value.intensity} onChange={(event) => change("intensity", Number(event.target.value))} /><output>{value.intensity}%</output></SettingRow>
    <SettingRow label="Artwork color influence" detail="Blend cover colors into Music surfaces while preserving theme contrast."><Toggle value={value.artworkColor} onChange={(next) => change("artworkColor", next)} /></SettingRow>
    <SettingRow label="World portal sound" detail="Play Orion's short spatial chime only during explicit world changes."><Toggle value={value.portalSound} onChange={(next) => change("portalSound", next)} /></SettingRow>
    {value.portalSound && <SettingRow label="Portal sound volume" detail="Independent from music playback volume."><input aria-label="Portal sound volume" type="range" min="0" max="100" value={value.portalVolume} onChange={(event) => change("portalVolume", Number(event.target.value))} /><output>{value.portalVolume}%</output></SettingRow>}
    <SettingRow label="Synchronized lyric motion" detail="Automatically follow the active lyric until you scroll manually."><Toggle value={value.lyricsMotion} onChange={(next) => change("lyricsMotion", next)} /></SettingRow>
    <SettingRow label="Automatic performance adaptation" detail="Reduce visual work during buffering, battery use and system pressure."><Toggle value={value.adaptPerformance} onChange={(next) => change("adaptPerformance", next)} /></SettingRow>
    <SettingRow label="Low GPU Mode" detail="Disable high-fidelity visual effects for budget graphics processing units."><Toggle value={value.lowGpu} onChange={(next) => change("lowGpu", next)} /></SettingRow>
    <SettingRow label="Static Background" detail="Render background colors statically without any moving particles."><Toggle value={value.staticBg} onChange={(next) => change("staticBg", next)} /></SettingRow>
    <SettingRow label="Disable Audio Reactive Background" detail="Prevent background particles from scaling or pulsing to music playback."><Toggle value={value.disableAudioReactiveBg} onChange={(next) => change("disableAudioReactiveBg", next)} /></SettingRow>
    <SettingRow label="Particle Density" detail="Control total number of active visual particles in the background."><SettingsSelect value={value.particleDensity} onChange={(next) => change("particleDensity", next)} options={[{ value: "low", label: "Low (50 particles)" }, { value: "medium", label: "Medium (200 particles)" }, { value: "high", label: "High (400 particles)" }]} /></SettingRow>
    <SettingRow label="Battery Saver Visuals" detail="Cap background frame rate to 30 FPS to extend battery life when running unplugged."><Toggle value={value.batterySaver} onChange={(next) => change("batterySaver", next)} /></SettingRow>
    <SettingRow label="ReplayGain" detail="Apply embedded track gain metadata while preserving your master volume."><Toggle value={value.replayGain} onChange={(next) => change("replayGain", next)} /></SettingRow>
    <SettingRow label="Track transition" detail="Fade between queue items using Orion's single protected audio pipeline."><input aria-label="Music transition duration" type="range" min="0" max="8" step="1" value={value.crossfadeDuration} onChange={(event) => change("crossfadeDuration", Number(event.target.value))} /><output>{value.crossfadeDuration ? `${value.crossfadeDuration}s` : "Off"}</output></SettingRow>
    <SettingRow label="Artwork cache limit" detail={`${cache.status === "ready" ? `${formatBytes(cache.bytes)} in ${cache.files} files` : "Reading cache…"}. Old artwork is removed first when the limit is reached.`}><SettingsSelect value={String(cache.limitMb)} onChange={async (next) => { const result = await window.electron?.musicSetCacheLimit?.(Number(next)); if (result?.ok) setCache({ ...result, status: "ready" }); }} options={[{ value: "128", label: "128 MB" }, { value: "256", label: "256 MB" }, { value: "512", label: "512 MB" }, { value: "1024", label: "1 GB" }, { value: "2048", label: "2 GB" }]} /></SettingRow>
    <SettingRow label="Clear artwork cache" detail="Removes generated and downloaded covers. Local artwork is restored during the next library scan."><button className="btn btn-ghost" onClick={async () => { const result = await window.electron?.musicClearCache?.(); if (result?.ok) setCache({ ...result, status: "ready" }); }}>Clear cache</button></SettingRow>
    <button className="btn btn-ghost" onClick={() => setValue(DEFAULTS)}>Reset Music appearance</button>
  </section>;
}

function SettingRow({ label, detail, children }) {
  return <div className="music-setting-row"><div><strong>{label}</strong><small>{detail}</small></div><div>{children}</div></div>;
}
