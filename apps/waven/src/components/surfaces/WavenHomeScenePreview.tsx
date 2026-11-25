import { resolvePreviewChromeBacking } from '../../theme/previewChromeMaterials';
import { useRequiredPreviewCelestial } from '../../theme/previewCelestialController';
import { WavenHomeMaterialContext, resolveHomePageMaterial } from '../../theme/homeMaterialPreview';
import { WavenMaterialFade } from './WavenAdaptiveSurface';

import type { ReactNode } from 'react';
import { Image as EnvironmentImage } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import { resolveCelestialPolicy } from '../../theme/celestialShift';
import {
  celestialDuration,
  celestialFrame,
} from '../../theme/celestialTimeline';

function starNoise(index: number, salt: number): number {
  const n = Math.sin(
    (index + 1) * 127.1 + salt * 311.7
  ) * 43758.5453;

  return n - Math.floor(n);
}

const SKY_STARS = Array.from({ length: 48 }, (_, index) => {
  const bright = index % 8 === 0;
  const size = bright ? 2.2 : index % 3 === 0 ? 1.6 : 1;

  return {
    left: `${3 + starNoise(index, 1) * 94}%` as `${number}%`,
    top: `${4 + starNoise(index, 2) * 86}%` as `${number}%`,
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: bright
      ? 0.85
      : 0.25 + starNoise(index, 3) * 0.40,
  };
});

const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: '#071320',
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 34,
    letterSpacing: 7,
  },
  tagline: {
    color: '#EDF7FF',
    fontSize: 10,
    letterSpacing: 3,
  },
  sky: {
    height: 170,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  celestialTarget: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunHalo: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255,224,145,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,230,158,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF5D1',
  },
  moonHalo: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(125,205,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(140,210,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E5F5FF',
  },
  starField: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '36%',
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#E3F2FF',
  },
  readability: {
    position: 'absolute',
    top: '23%',
    bottom: 0,
    left: 0,
    right: 0,
  },
  hero: {
    paddingVertical: 12,
  },
  eyebrow: {
    color: '#DCEBFA',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 18,
  },
  artworkPlaceholder: {
    width: 136,
    height: 136,
    borderRadius: 16,
    backgroundColor: '#193B56',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  note: {
    fontSize: 52,
    color: '#9AD7FA',
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metadata: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '700',
  },
  secondary: {
    color: '#C8DCEC',
    fontSize: 13,
    lineHeight: 20,
  },
  samplePlay: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playSymbol: {
    color: '#FFFFFF',
    fontSize: 21,
  },
  section: {
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 21,
    marginTop: 20,
    marginBottom: 10,
  },
  notice: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#63849E',
    gap: 6,
  },
  noticeTitle: {
    color: '#89D4FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

interface HomeSceneProps {
  gutter: number;
  tabletLike: boolean;
  render: (
    environment: ReactNode,
    headerControl: ReactNode,
    pageMaterial: ReactNode,
  ) => ReactNode;
}

/**
 * Development-only actual Home environment.
 * Rendering and transition extracted from the accepted laboratory.
 */
export function WavenHomeScenePreview({ render, gutter, tabletLike }: HomeSceneProps) {
  const insets = useSafeAreaInsets();
  const {
    progress,
    night,
    materialStep,
    toggleTheme,
  } = useRequiredPreviewCelestial();

  const nightStyle = useAnimatedStyle(() => ({
    opacity: celestialFrame(progress.value).nightOpacity,
  }));
  const twilightStyle = useAnimatedStyle(() => ({
    opacity:
      celestialFrame(progress.value).twilightOpacity * 0.6,
  }));
  const sunStyle = useAnimatedStyle(() => {
    const f = celestialFrame(progress.value);

    return {
      opacity: f.sunOpacity,
      transform: [
        { translateX: f.sunX },
        { translateY: f.sunY },
      ],
    };
  });
  const moonStyle = useAnimatedStyle(() => {
    const f = celestialFrame(progress.value);

    return {
      opacity: f.moonOpacity,
      transform: [
        { translateX: f.moonX },
        { translateY: f.moonY },
      ],
    };
  });
  const starsStyle = useAnimatedStyle(() => ({
    opacity: celestialFrame(progress.value).starsOpacity,
  }));
  const accentStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#176B9F', '#177EAD'],
    ),
  }));




  const materialProgress = materialStep / 48;
  const materialTheme = materialProgress >= 0.5
    ? 'hikari-night' : 'hikari';
  const pageColors = resolveHomePageMaterial(materialProgress);
  const chromeBacking = resolvePreviewChromeBacking(materialProgress);

  // Full-width fade: not a Hero card or an enclosing outline.
  const fadeHeight = tabletLike ? 64 : 120;

  const pageMaterial = (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -gutter,
        right: -gutter,
        top: tabletLike ? -64 : 0,
        bottom: -24,
      }}
    >
      <WavenMaterialFade
        theme={materialTheme}
        role="panel"
        rendering="translucent"
        height={fadeHeight}
        colorsOverride={[pageColors.transparent, pageColors.background]}
      />
      <View style={{ flex: 1, backgroundColor: pageColors.background }} />
    </View>
  );

  const environment = (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      
      {/* Prototype lighting only: final anime assets pending. */}
      <View
        accessible={false}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <LinearGradient
          colors={['#2879B3', '#A9DDF2', '#E4F4FA']}
          locations={[0, 0.53, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <EnvironmentImage
            accessible={false}
            source={require('../../../assets/celestial/hikari-environment-day.jpg')}
            resizeMode="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>

        <Animated.View
          style={[StyleSheet.absoluteFill, twilightStyle]}
        >
          <LinearGradient
            colors={['#223F77', '#E5B575', '#456B91']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[StyleSheet.absoluteFill, nightStyle]}
        >
          <LinearGradient
            colors={['#050E24', '#132E51', '#071B32']}
            style={StyleSheet.absoluteFill}
          />
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <EnvironmentImage
            accessible={false}
            source={require('../../../assets/celestial/hikari-environment-night.jpg')}
            resizeMode="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
        </Animated.View>



        <Animated.View
          style={[styles.starField, starsStyle]}
        >
          {SKY_STARS.map((star, index) => (
            <View
              key={index}
              style={[styles.star, star]}
            />
          ))}
        </Animated.View>

        {/* Soft branding contrast; the landscape remains visible. */}
        <LinearGradient
          colors={[
            'rgba(3,13,26,0.62)',
            'rgba(3,13,26,0.28)',
            'rgba(3,13,26,0)',
          ]}
          locations={[0, 0.48, 1]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 124,
          }}
        />

        {/* Seamless lower atmosphere, shared with root chrome. */}
        {chromeBacking ? (
          <LinearGradient
            colors={chromeBacking.fade}
            locations={[0, 1]}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '18%',
            }}
          />
        ) : null}
      </View>

      
    </View>
  );

  const headerControl = (
    <View style={{ alignItems: 'flex-end' }}>
      <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              night
                ? 'Switch to HIKARI daylight'
                : 'Switch to HIKARI NIGHT'
            }
            accessibilityHint="Changes the preview atmosphere"
            onPress={toggleTheme}
            style={({ pressed }) => [
              styles.celestialTarget,
              tabletLike ? null : { height: 124 },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Animated.View style={[styles.sunHalo, sunStyle]}>
              <View style={styles.sunOuter}>
                <View style={styles.sunCore} />
              </View>
            </Animated.View>

            <Animated.View style={[styles.moonHalo, moonStyle]}>
              <View style={styles.moonOuter}>
                <View style={styles.moonCore} />
              </View>
            </Animated.View>
          </Pressable>
    </View>
  );

  return (
    <WavenHomeMaterialContext.Provider value={materialProgress}>
      {render(environment, headerControl, pageMaterial)}
    </WavenHomeMaterialContext.Provider>
  );
}
