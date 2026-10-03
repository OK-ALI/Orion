import { AppState, NativeModules, Platform, useWindowDimensions } from 'react-native';
import { useEffect } from 'react';

const module = NativeModules.OrionPlayerSystemUi as undefined | {
  enter(): void;
  hide(): void;
  show(): void;
  exit(): void;
};

export function usePlayerImmersiveSystemUi(active: boolean, _playing: boolean, _hudHidden: boolean) {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS !== 'android' || !module || !active) return undefined;
    module.enter();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        module.enter();
      } else module.exit();
    });
    return () => {
      subscription.remove();
      module.exit();
    };
  }, [active]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !module || !active) return;
    // Pausing or opening Orion chrome does not leave the Player's immersive scope.
    module.hide();
  }, [active, width, height]);
}
