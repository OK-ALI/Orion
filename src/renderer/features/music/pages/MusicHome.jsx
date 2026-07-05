import { useEffect, useMemo, useState } from "react";
import MusicArtwork from "../components/MusicArtwork";
import MusicTrackList from "../components/MusicTrackList";
import { useMusic } from "../context/MusicProvider";
import MusicVisualizer from "../visual/MusicVisualizer";

export default function MusicHome({ onNavigate }) {
  const [data, setData] = useState({ tracks: [], history: [], favorites: [], playlists: [], providers: [], dashboard: { sections: [], errors: [] } });
  const music = useMusic();
  useEffect(() => {
    Promise.all([
      window.electron?.musicListTracks?.({ limit: 18 }) || [], window.electron?.musicListHistory?.(12) || [],
      window.electron?.musicListFavorites?.() || [], window.electron?.musicListPlaylists?.() || [],
      window.electron?.musicListProviders?.() || [],
    ]).then(([tracks, history, favorites, playlists, providers]) => setData((current) => ({ ...current, tracks, history, favorites, playlists, providers }))).catch(() => {});
    window.electron?.musicGetDashboard?.().then((dashboard) => setData((current) => ({ ...current, dashboard }))).catch(() => {});
  }, []);
  const recent = useMemo(() => data.history.map((item) => item.track).filter(Boolean), [data.history]);
  const quickTracks = useMemo(() => (recent.length ? recent : data.tracks).slice(0, 4), [data.tracks, recent]);
  const healthyProviders = useMemo(() => data.providers.filter((provider) => !["unavailable", "error"].includes(provider.status)).length, [data.providers]);
  const style = { "--music-reactive-base": music.artwork.palette.base, "--music-reactive-primary": music.artwork.palette.primary,
    "--music-reactive-spectral": music.artwork.palette.spectral };
  return <div className="music-page music-home-page" style={style}>
    <header className="music-page-header music-home-heading" data-scene-section="intro"><div><span className="music-eyebrow">Music Planet</span><h1>Resonance Observatory</h1>
      <p>A listening world shaped by the music itself.</p></div><div className="music-home-vitals" aria-label="Music library summary"><span><strong>{data.tracks.length}</strong> local signals</span><span><strong>{healthyProviders}</strong> sources ready</span><button onClick={() => onNavigate("music-search")}>Search all music</button></div></header>
    <div className="music-home-stage" data-scene-section="intro"><section className={`music-listening-orbit ${music.playing ? "is-playing" : "is-still"}`}>
      <div className="music-orbit-field" aria-hidden="true"><i /><i /><i /></div>
      <button className="music-orbit-art" onClick={() => music.current ? onNavigate("music-now-playing", music.current) : onNavigate("music-library")}>
        <MusicArtwork track={music.current} currentArtwork={music.artwork} label={music.current ? `Artwork for ${music.current.title}` : "Quiet observatory"} />
        
        {/* Dynamic circular progress ring */}
        {music.current && music.progress.duration > 0 && (
          <svg className="music-orbit-progress-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" className="ring-bg" />
            <circle cx="50" cy="50" r="48" className="ring-progress" style={{ 
              strokeDasharray: `${2 * Math.PI * 48}`,
              strokeDashoffset: `${2 * Math.PI * 48 * (1 - (music.progress.currentTime / music.progress.duration))}` 
            }} />
          </svg>
        )}
      </button>
      <div className="music-orbit-copy"><span>{music.current ? "In your orbit" : "The chamber is quiet"}</span>
        <h2>{music.current?.title || "Choose a signal"}</h2><p>{music.current?.artistName || "Open your library or search across your connected sources."}</p>
        <div className="music-actions">{music.current && <button className="primary" onClick={music.togglePlaying}>{music.playing ? "Pause" : "Continue"}</button>}
          <button onClick={() => onNavigate(music.current ? "music-now-playing" : "music-search", music.current)}> {music.current ? "Enter Observatory" : "Search Music"}</button></div>
        {music.queue.length > 1 && <small>{music.queue.length - music.index - 1} tracks remain in this orbit</small>}
      </div>
      <MusicVisualizer variant="horizon" className="music-orbit-wave" />
    </section><aside className="music-quick-deck"><header><div><span className="music-eyebrow">Within reach</span><h2>{recent.length ? "Recently heard" : "Ready to play"}</h2></div><button onClick={() => onNavigate("music-library")}>Library</button></header>
      <MusicTrackList tracks={quickTracks} compact empty="Your first listens will appear here." />
      <div className="music-quick-actions"><button onClick={() => onNavigate("music-favorites")}><span>♡</span><strong>Favorites</strong><small>Music kept close</small></button><button onClick={() => onNavigate("music-playlists")}><span>✦</span><strong>Playlists</strong><small>Your constellations</small></button></div></aside></div>
    {recent.length > 0 && <EditorialRail data-scene-section="history" title="Recently heard" subtitle="Return to a familiar signal" tracks={recent} onPlay={music.playTrack} />}
    {data.favorites.length > 0 && <EditorialRail data-scene-section="favorites" title="Favorites" subtitle="The sounds you kept close" tracks={data.favorites.filter((item) => item.kind === "track").map((item) => item.payload)} onPlay={music.playTrack} />}
    {data.playlists.length > 0 && <section className="music-section" data-scene-section="playlists"><SectionHeading eyebrow="Constellations" title="Your playlists" action="View all" onAction={() => onNavigate("music-playlists")} />
      <div className="music-constellation-grid">{data.playlists.slice(0, 6).map((playlist) => <button key={playlist.id} onClick={() => onNavigate("music-playlist", playlist)}><span className="music-cluster"><i /><i /><i /><i /></span><strong>{playlist.name}</strong><small>{playlist.items?.length || 0} tracks</small></button>)}</div></section>}
    {data.dashboard.sections.slice(0, 4).map((section, idx) => <ProviderSection key={`${section.providerId}:${section.id}`} data-scene-section={`dashboard-${idx}`} section={section} music={music} onNavigate={onNavigate} />)}
    <section className="music-section" data-scene-section="library"><SectionHeading eyebrow="On this device" title="Recently added" action="View library" onAction={() => onNavigate("music-library")} />
      <MusicTrackList tracks={data.tracks.slice(0, 12)} empty="Add a folder in Music Library to begin." /></section>
    <section className="music-section" data-scene-section="sources"><SectionHeading eyebrow="Signal array" title="Connected sources" action="Manage" onAction={() => onNavigate("music-sources")} />
      <div className="music-provider-rail">{data.providers.slice(0, 8).map((provider) => <button key={`${provider.kind}:${provider.id}`} onClick={() => onNavigate("music-sources")}><span className={`status ${provider.status || "ready"}`} /><strong>{provider.name}</strong><small>{provider.kind}</small></button>)}</div></section>
  </div>;
}

function ProviderSection({ section, music, onNavigate, "data-scene-section": sceneSection }) {
  if (!section.items?.length) return null;
  if (section.type === "tracks") return <EditorialRail data-scene-section={sceneSection} title={section.title} subtitle={`From ${section.attribution}`} tracks={section.items} onPlay={music.playTrack} />;
  return <section className="music-section" data-scene-section={sceneSection}><SectionHeading eyebrow={`From ${section.attribution}`} title={section.title} />
    <div className="music-editorial-rail">{section.items.slice(0, 10).map((item, index) => <button key={`${item.id}-${index}`} onClick={() => section.type === "albums" ? onNavigate("music-album", item) : section.type === "artists" ? onNavigate("music-artist", item) : undefined}>
      <MusicArtwork track={item} label={`Artwork for ${item.title || item.name}`} /><strong>{item.title || item.name}</strong><small>{item.artistName || `${item.trackCount || ""} ${section.type}`}</small></button>)}</div></section>;
}

function SectionHeading({ eyebrow, title, action, onAction }) {
  return <div className="music-section-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}</button>}</div>;
}

function EditorialRail({ title, subtitle, tracks, onPlay, "data-scene-section": sceneSection }) {
  return <section className="music-section" data-scene-section={sceneSection}><SectionHeading eyebrow={subtitle} title={title} />
    <div className="music-editorial-rail">{tracks.slice(0, 8).map((track, index) => <button key={`${track.id}-${index}`} onClick={() => onPlay(track, tracks)}>
      <MusicArtwork track={track} label={`Artwork for ${track.title}`} /><strong>{track.title}</strong><small>{track.artistName || "Unknown artist"}</small></button>)}</div></section>;
}
