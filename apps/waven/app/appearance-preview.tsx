import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWavenReducedMotion } from '../src/hooks/useWavenReducedMotion';
import {
  WAVEN_THEME_IDS,
  WAVEN_THEME_IDENTITIES,
  type WavenThemeId,
} from '../src/theme/appearance';
import { getWavenThemeDesign } from '../src/theme/themeDesign';
import { getPreviewArtwork } from '../src/theme/previewArtwork';
import { WavenThemeScene } from '../src/components/surfaces/WavenThemeScene';
import { wavenFonts } from '../src/theme/tokens';

const SAMPLE_TRACKS = [
  { title: 'Beyond the Horizon', artist: 'WAVEN Preview', duration: '3:42' },
  { title: 'Blue Hour', artist: 'WAVEN Preview', duration: '4:18' },
  { title: 'Somewhere Tomorrow', artist: 'WAVEN Preview', duration: '3:56' },
] as const;

const EDITORIAL = {
  noir: {
    heading: 'Sound after silence.',
    subtitle: 'Discover a world within every note.',
    collection: 'Midnight Signals',
    secondary: 'Quiet Frequencies',
  },
  hikari: {
    heading: 'Follow the light.',
    subtitle: 'A soundtrack for the world beyond.',
    collection: 'Coastal Reveries',
    secondary: 'Open Skies',
  },
  'hikari-night': {
    heading: 'The city never sleeps.',
    subtitle: 'Find your frequency beneath the stars.',
    collection: 'Neon Horizons',
    secondary: 'After Hours',
  },
} as const;

function PreviewArtwork({ theme }: { theme: WavenThemeId }) {
  const uri = getPreviewArtwork(theme);

  // SVG artwork is a browser prototype.
  // Native asset integration remains a separate implementation gate.
  if (Platform.OS === 'web' && uri) {
    return (
      <Image
        accessible={false}
        source={{ uri }}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return <WavenThemeScene theme={theme} />;
}

function AppearanceLaboratory() {
  const router = useRouter();
  const [theme, setTheme] = useState<WavenThemeId>('noir');
  const reducedMotion = useWavenReducedMotion(true);
  const reveal = useRef(new Animated.Value(1)).current;

  const design = getWavenThemeDesign(theme);
  const colors = design.colors;
  const editorial = EDITORIAL[theme];
  const light = theme === 'hikari';

  useEffect(() => {
    reveal.stopAnimation();

    if (reducedMotion) {
      reveal.setValue(1);
      return;
    }

    reveal.setValue(0.82);

    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: light ? 280 : 220,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [theme, light, reducedMotion, reveal]);

  return (
    <SafeAreaView style={[
      styles.safe,
      { backgroundColor: colors.canvas },
    ]}>
      <StatusBar style={light ? 'dark' : 'light'} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.labHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to WAVEN Home"
            onPress={() => router.replace('/')}
            style={styles.touch}
          >
            <Text style={[styles.label, { color: colors.interactionBlue }]}>
              {'<  EXIT LAB'}
            </Text>
          </Pressable>

          <Text style={[styles.micro, { color: colors.textMuted }]}>
            CONCEPT / R1
          </Text>
        </View>

        <View style={styles.selector}>
          {WAVEN_THEME_IDS.map(id => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: theme === id }}
              onPress={() => setTheme(id)}
              style={[
                styles.selectorItem,
                {
                  backgroundColor: theme === id
                    ? colors.interactionBlue : colors.surfaceRaised,
                  borderColor: colors.borderStrong,
                },
              ]}
            >
              <Text style={[
                styles.label,
                {
                  color: theme === id
                    ? design.onAccent : colors.textPrimary,
                },
              ]}>
                {WAVEN_THEME_IDENTITIES[id].name.replace('WAVEN ', '')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.brandHeader}>
          <View>
            <Text style={[styles.wordmark, { color: colors.textPrimary }]}>
              WA<Text style={{ color: colors.brandBlue }}>V</Text>EN
            </Text>
            <Text style={[styles.micro, { color: colors.textSecondary }]}>
              WHERE MUSIC LIVES
            </Text>
          </View>

          <View style={[
            styles.chapterTag,
            { borderColor: colors.borderStrong },
          ]}>
            <Text style={[styles.micro, { color: colors.textMuted }]}>
              {design.chapter}
            </Text>
          </View>
        </View>

        <Text style={[styles.eyebrow, { color: colors.interactionBlue }]}>
          YOUR SOUND / YOUR WORLD
        </Text>

        <View style={[
          styles.hero,
          {
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceRaised,
          },
          light ? styles.dayHero : styles.darkHero,
        ]}>
          <Animated.View style={[
            light ? styles.dayArtwork : styles.darkArtwork,
            { opacity: reveal },
          ]}>
            <PreviewArtwork theme={theme} />
          </Animated.View>

          <View style={[
            styles.heroText,
            {
              backgroundColor: light
                ? colors.surfaceRaised
                : colors.surfaceSoft,
            },
          ]}>
            <View style={[
              styles.accentRule,
              { backgroundColor: colors.interactionBlue },
            ]}/>

            <Text style={[
              styles.heroHeading,
              { color: colors.textPrimary },
            ]}>
              {editorial.heading}
            </Text>

            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {editorial.subtitle}
            </Text>

            <Text style={[styles.micro, { color: colors.interactionBlue }]}>
              WAVEN EDITORIAL / PREVIEW
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Discover your <Text style={{ color: colors.brandBlue }}>world.</Text>
          </Text>
          <Text style={[styles.micro, { color: colors.textMuted }]}>01 / 02</Text>
        </View>

        <View style={styles.collections}>
          {[
            { name: editorial.collection, theme },
            {
              name: editorial.secondary,
              theme: light ? 'hikari-night' : 'hikari',
            },
          ].map((item, index) => (
            <View
              key={item.name}
              style={[
                styles.collection,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={styles.cover}>
                <PreviewArtwork theme={item.theme as WavenThemeId} />
              </View>

              <View style={styles.collectionCopy}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  {item.name}
                </Text>

                <Text style={[styles.micro, { color: colors.textMuted }]}>
                  SAMPLE MIX / 0{index + 1}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Today's <Text style={{ color: colors.brandBlue }}>frequency.</Text>
        </Text>

        {SAMPLE_TRACKS.map((track, index) => (
          <View key={track.title} style={[
            styles.track,
            { borderBottomColor: colors.borderSubtle },
          ]}>
            <Text style={[styles.micro, { color: colors.textMuted }]}>
              0{index + 1}
            </Text>

            <View style={[
              styles.trackCover,
              { backgroundColor: colors.surfaceRaised },
            ]}>
              <PreviewArtwork theme={theme} />
            </View>

            <View style={styles.trackCopy}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {track.title}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {track.artist}
              </Text>
            </View>

            <Text style={[styles.micro, { color: colors.textMuted }]}>
              {track.duration}
            </Text>
          </View>
        ))}

        <Text style={[styles.body, { color: colors.textMuted }]}>
          Design preview only. All music and player information is illustrative.
        </Text>
      </ScrollView>

      {/* Non-interactive, explicitly labelled presentation study. */}
      <View style={[
        styles.dock,
        { backgroundColor: colors.canvas },
      ]}>
        <View style={[
          styles.mini,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.borderStrong,
          },
        ]}>
          <View style={styles.miniCover}>
            <PreviewArtwork theme={theme} />
          </View>

          <View style={styles.trackCopy}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Beyond the Horizon
            </Text>
            <Text style={[styles.micro, { color: colors.textMuted }]}>
              SAMPLE PLAYER
            </Text>
          </View>

          <View style={[
            styles.play,
            { backgroundColor: colors.interactionBlue },
          ]}>
            <View style={[
              styles.triangle,
              { borderLeftColor: design.onAccent },
            ]}/>
          </View>
        </View>

        <View style={[
          styles.progress,
          { backgroundColor: colors.borderSubtle },
        ]}>
          <View style={[
            styles.progressFill,
            { backgroundColor: colors.interactionBlue },
          ]}/>
        </View>

        <View style={[
          styles.nav,
          {
            backgroundColor: colors.navGlass,
            borderColor: colors.borderStrong,
          },
        ]}>
          {['Home', 'Search', 'Library'].map((label, index) => (
            <View key={label} style={[
              styles.navItem,
              {
                backgroundColor: index === 0
                  ? colors.blueWash : 'transparent',
              },
            ]}>
              <Text style={[
                styles.label,
                {
                  color: index === 0
                    ? colors.interactionBlue : colors.textSecondary,
                },
              ]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function AppearancePreviewRoute() {
  if (!__DEV__) return <Redirect href="/" />;

  return <AppearanceLaboratory />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },

  labHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  touch: { minHeight: 48, justifyContent: 'center' },

  selector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectorItem: {
    flexGrow: 1,
    minHeight: 48,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },

  brandHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  wordmark: {
    fontFamily: wavenFonts.wordmarkDisplay,
    fontSize: 35,
    letterSpacing: 7,
  },
  chapterTag: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 8,
  },
  micro: {
    fontFamily: wavenFonts.semiBold,
    fontSize: 10,
    letterSpacing: 0.7,
    lineHeight: 15,
  },
  eyebrow: {
    fontFamily: wavenFonts.bold,
    fontSize: 11,
    letterSpacing: 1.7,
  },
  label: {
    fontFamily: wavenFonts.bold,
    fontSize: 12,
    lineHeight: 18,
  },
  title: {
    fontFamily: wavenFonts.headingBold,
    fontSize: 18,
    lineHeight: 26,
  },
  body: {
    fontFamily: wavenFonts.regular,
    fontSize: 13,
    lineHeight: 20,
  },

  hero: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayHero: { borderRadius: 12 },
  darkHero: { borderRadius: 20 },
  dayArtwork: { height: 176, overflow: 'hidden' },
  darkArtwork: { height: 202, overflow: 'hidden' },
  heroText: { padding: 16, gap: 8 },
  accentRule: { width: 38, height: 3, borderRadius: 2 },
  heroHeading: {
    fontFamily: wavenFonts.headingExtraBold,
    fontSize: 25,
    lineHeight: 31,
  },

  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  collections: { flexDirection: 'row', gap: 10 },
  collection: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: { height: 105, overflow: 'hidden' },
  collectionCopy: { padding: 10, gap: 5 },

  track: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 6,
    gap: 10,
  },
  trackCover: {
    width: 44,
    height: 44,
    borderRadius: 7,
    overflow: 'hidden',
  },
  trackCopy: { flex: 1, minWidth: 0, gap: 2 },

  dock: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 5,
  },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    minHeight: 60,
    gap: 10,
    borderWidth: 1,
    borderRadius: 15,
  },
  miniCover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  progress: { height: 2, marginHorizontal: 12 },
  progressFill: { width: '36%', height: 2 },
  nav: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 28,
    padding: 4,
  },
  navItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
});
