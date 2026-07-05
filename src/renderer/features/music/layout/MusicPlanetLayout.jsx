import { useMusic } from "../context/MusicProvider";
import MusicBackground from "../components/MusicBackground";
import MusicHeader from "../components/MusicHeader";
import QueuePanel from "../components/QueuePanel";
import LyricsPanel from "../components/LyricsPanel";

export default function MusicPlanetLayout({ children, page, onNavigate }) {
  const { panel, setPanel } = useMusic();

  return (
    <div className="music-planet-layout">
      <MusicBackground page={page} />
      <div className="music-planet-main">
        <MusicHeader 
          onNavigate={onNavigate} 
          onTogglePanel={(p) => setPanel(panel === p ? null : p)} 
          activePanel={panel} 
        />
        <div className="music-planet-scrollable-content">
          {children}
        </div>
      </div>
      {panel === "queue" && <QueuePanel onClose={() => setPanel(null)} />}
      {panel === "lyrics" && <LyricsPanel onClose={() => setPanel(null)} />}
    </div>
  );
}
