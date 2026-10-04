import { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { useOrionTheme } from '../../context/ThemeContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';

/** Decorative presentation only; never owns pairing, discovery or remote commands. */
export function useConnectPresentationMotion({ isConnected, showPairingModal, pairingMethod }: {
  isConnected: boolean; showPairingModal: boolean; pairingMethod: 'pin' | 'qr' | 'ip';
}) {
  const { preferences, systemReducedMotion } = useOrionTheme();
  const motion = resolveMotionPolicy(preferences.reducedMotion, systemReducedMotion);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (!motion.allowDecorativeMotion || isConnected) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 1200, useNativeDriver }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver }),
    ]));
    loop.start();
    return () => { loop.stop(); pulseAnim.stopAnimation(); pulseAnim.setValue(1); };
  }, [motion.allowDecorativeMotion, isConnected, pulseAnim, useNativeDriver]);

  useEffect(() => {
    if (!motion.allowDecorativeMotion || !showPairingModal || pairingMethod !== 'qr') { scanLineAnim.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scanLineAnim, { toValue: 140, duration: 1400, useNativeDriver }),
      Animated.timing(scanLineAnim, { toValue: 0, duration: 1400, useNativeDriver }),
    ]));
    loop.start();
    return () => { loop.stop(); scanLineAnim.stopAnimation(); scanLineAnim.setValue(0); };
  }, [motion.allowDecorativeMotion, showPairingModal, pairingMethod, scanLineAnim, useNativeDriver]);

  return { pulseAnim, scanLineAnim };
}
