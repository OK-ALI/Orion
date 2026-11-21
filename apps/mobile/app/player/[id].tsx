import PlayerScreen from '../../src/features/playback/PlayerScreen';
import { PlayerPresentationTheme } from '../../src/context/ThemeContext';

export default function PlayerRoute() {
  return (
    <PlayerPresentationTheme>
      <PlayerScreen />
    </PlayerPresentationTheme>
  );
}
