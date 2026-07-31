import { useMusic } from "../context/MusicProvider";
import NowPlayingSection from "../planet-sections/NowPlayingSection";

/**
 * The dedicated Now Playing route reuses the polished Listening Core. It is a
 * second control surface over MusicProvider's one audio element, never a
 * second browser player or playback owner.
 */
export default function NowPlayingPage({ onNavigate }) {
  const music = useMusic();
  return <div className="music-page music-listening-core-page">
    <NowPlayingSection music={music} onNavigate={onNavigate} />
  </div>;
}
