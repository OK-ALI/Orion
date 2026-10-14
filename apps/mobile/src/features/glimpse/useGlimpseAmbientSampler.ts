import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { PerformanceProfileId } from '../../services/performanceProfiles';
import { GlimpseAmbientSampler, type GlimpseAmbientNative, type GlimpsePalette } from './GlimpseAmbientSampler';
import { GLIMPSE_INTERNAL_PREVIEW, GLIMPSE_PRODUCTION_ENABLED } from './glimpseBuild';
let native: GlimpseAmbientNative | null | undefined;
function ambientNative() {
  if (native !== undefined) return native;
  try { native = require('expo-modules-core').requireOptionalNativeModule('OrionGlimpseAmbient') as GlimpseAmbientNative | null; }
  catch { native = null; }
  return native;
}
export function useGlimpseAmbientSampler(nativeId: string, session: string, enabled: boolean, profile: PerformanceProfileId,
  reducedMotion: boolean, onPalette: (palette: GlimpsePalette, durationMs?: number) => void) {
  const callback = useRef(onPalette); callback.current = onPalette;
  useEffect(() => {
    if (!(GLIMPSE_PRODUCTION_ENABLED || GLIMPSE_INTERNAL_PREVIEW) || Platform.OS !== 'android' || !enabled || profile === 'efficiency') return;
    const bridge = ambientNative(); if (!bridge) return;
    const sampler = new GlimpseAmbientSampler(bridge, (colors, duration) => callback.current(colors, duration));
    sampler.start(nativeId, session, profile, reducedMotion); return () => sampler.stop();
  }, [nativeId, session, enabled, profile, reducedMotion]);
}
