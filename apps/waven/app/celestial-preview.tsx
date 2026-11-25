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
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useWavenReducedMotion } from '../src/hooks/useWavenReducedMotion';
import { resolveCelestialPolicy } from '../src/theme/celestialShift';
import {
  celestialDuration,
  celestialFrame,
} from '../src/theme/celestialTimeline';

/**
 * Stable stylized stars.
 * Fixed circular dimensions; responsive positions.
 * No image stretching or individual animation loops.
 */
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

function CelestialLaboratory() {
  const insets = useSafeAreaInsets();
  const reducedMotion = useWavenReducedMotion(true);

  const progress = useSharedValue(0);
  const destination = useRef<0 | 1>(0);
  const [night, setNight] = useState(false);

  const policy = resolveCelestialPolicy({
    preference: 'enhanced',
    motion: 'expressive',
    systemReducedMotion: reducedMotion,
  });

  function toggleTheme() {
    const next: 0 | 1 =
      destination.current === 0 ? 1 : 0;

    destination.current = next;
    setNight(next === 1);

    cancelAnimation(progress);

    const duration = celestialDuration(
      policy.transition,
      next - progress.value,
    );

    if (duration === 0) {
      progress.value = next;
      return;
    }

    progress.value = withTiming(next, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });
  }

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(progress);
      progress.value = destination.current;
    }
  }, [reducedMotion, progress]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      state => {
        if (state !== 'active') {
          cancelAnimation(progress);
          progress.value = destination.current;
        }
      },
    );

    return () => {
      subscription.remove();
      cancelAnimation(progress);
    };
  }, [progress]);

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

  return (
    <View style={styles.root}>
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
            source={require('../assets/celestial/hikari-environment-day.jpg')}
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
            source={require('../assets/celestial/hikari-environment-night.jpg')}
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

        {/* Stable contrast zone, not a Hero card. */}
        <LinearGradient
          colors={[
            'rgba(3,13,26,0)',
            'rgba(3,13,26,0.84)',
            '#071320',
          ]}
          locations={[0, 0.48, 1]}
          style={styles.readability}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>WAVEN</Text>
          <Text style={styles.tagline}>WHERE MUSIC LIVES</Text>
        </View>

        <View style={styles.sky}>
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

        {/* Borderless music content, no enclosing card. */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CONTINUE LISTENING</Text>

          <View style={styles.artworkPlaceholder}>
            <Text style={styles.note}>{'\u266B'}</Text>
          </View>

          <View style={styles.musicRow}>
            <View style={styles.metadata}>
              <Text style={styles.title}>Your last track</Text>
              <Text style={styles.secondary}>Sample artist</Text>
            </View>

            <Animated.View
              accessible={false}
              style={[styles.samplePlay, accentStyle]}
            >
              <Text style={styles.playSymbol}>{'\u25B6'}</Text>
            </Animated.View>
          </View>

          <Text style={styles.secondary}>
            Your music stays in place as the atmosphere changes.
          </Text>
        </View>

        <Text style={styles.section}>Recently played</Text>
        <Text style={styles.secondary}>
          Preview content only. No playback or library changes.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            CELESTIAL SHIFT LABORATORY
          </Text>
          <Text style={styles.secondary}>
            Tap the glowing sun or moon. Tap again during the
            transition to reverse it.
          </Text>
          <Text style={styles.secondary}>
            {reducedMotion
              ? 'System Reduced Motion active'
              : 'Expressive preview: 2.4 seconds'}
          </Text>
          <Text style={styles.secondary}>
            Original celestial style. Stylized night sky.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default function CelestialPreviewRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <CelestialLaboratory />;
}

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