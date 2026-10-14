import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

export function useGlimpseForeground() {
  const windowFocused = useRef(true);
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const update = () => setForeground(AppState.currentState === 'active' && windowFocused.current);
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active' && windowFocused.current));
    // Android occlusion can lose window focus without changing AppState.
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => { windowFocused.current = false; update(); }) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => { windowFocused.current = true; update(); }) : null;
    const updateWeb = () => setForeground(document.visibilityState === 'visible' && AppState.currentState === 'active');
    if (Platform.OS === 'web') {
      updateWeb();
      document.addEventListener('visibilitychange', updateWeb);
    }
    return () => {
      subscription.remove(); blur?.remove(); focus?.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', updateWeb);
    };
  }, []);
  return foreground;
}
