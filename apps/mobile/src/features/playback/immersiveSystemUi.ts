import { AppState, NativeModules, Platform } from 'react-native';
import { useEffect, useRef } from 'react';

const module = NativeModules.OrionPlayerSystemUi as undefined | {
  enter(): void;
  hide(): void;
  show(): void;
  exit(): void;
};

export function usePlayerImmersiveSystemUi(active: boolean, playing: boolean, hudHidden: boolean) {
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !module || !active) return undefined;
    module.enter();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (playingRef.current) module.enter();
        else module.show();
      } else module.exit();
    });
    return () => {
      subscription.remove();
      module.exit();
    };
  }, [active]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !module || !active) return;
    if (playing || hudHidden) module.hide();
    else module.show();
  }, [active, hudHidden, playing]);
}
