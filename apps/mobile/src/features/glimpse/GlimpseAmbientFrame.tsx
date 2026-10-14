import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { imgUrl } from '@orion/shared/api';
import type { PerformanceProfileId } from '../../services/performanceProfiles';
import type { GlimpsePalette } from './GlimpseAmbientSampler';

export function GlimpseAmbientFrame({ artworkPath, enabled, playing, reducedMotion, palette, profile, children }: {
  artworkPath: string | null; enabled: boolean; playing: boolean; reducedMotion: boolean; palette: GlimpsePalette | null;
  profile: PerformanceProfileId; children: ReactNode;
}) {
  const visible = enabled && playing && profile !== 'efficiency';
  const artwork = visible && !palette ? imgUrl(artworkPath, profile === 'quality' ? 'w300' : 'w185') : null;
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const last = useRef(palette); const [previous, setPrevious] = useState(palette);
  useEffect(() => {
    setPrevious(last.current); last.current = palette; fade.stopAnimation(); fade.setValue(1);
    if (!visible || reducedMotion || !palette) return;
    fade.setValue(0); const animation = Animated.timing(fade, { toValue: 1, duration: 650, useNativeDriver: true, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [palette, visible, reducedMotion, fade]);
  useEffect(() => {
    pulse.setValue(0);
    if (!artwork || reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([1, 0].map(toValue => Animated.timing(pulse, { toValue, duration: 2800, useNativeDriver: true, isInteraction: false }))));
    animation.start(); return () => { animation.stop(); pulse.stopAnimation(); };
  }, [artwork, reducedMotion, pulse]);
  return <View style={styles.frame}>
    {visible && <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.glow}>
      {palette ? <>
        {!!previous && <LinearGradient colors={[previous[0], previous[1]]} style={StyleSheet.absoluteFill} />}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}><LinearGradient colors={[palette[0], palette[1]]} style={StyleSheet.absoluteFill} /></Animated.View>
      </> : !!artwork && <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
        <Image accessible={false} source={{ uri: artwork }} resizeMode="stretch" blurRadius={18} style={StyleSheet.absoluteFill} />
      </Animated.View>}
    </View>}
    {children}
  </View>;
}
const styles = StyleSheet.create({
  frame: { flex: 1, height: '100%', padding: 6 },
  glow: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.22, borderRadius: 30, overflow: 'hidden' },
});
