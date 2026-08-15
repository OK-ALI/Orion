import { View, Text, StyleSheet, Animated, Pressable, ActivityIndicator, FlatList, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { imgUrl, fetchPersonDetails } from '@orion/shared/api';
import { radii, spacing, fontSizes, fontFamilies } from '@orion/shared/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MediaCard } from '../../src/components/MediaCard';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { useResponsiveLayout } from '../../src/services/responsive';
import { getRailRenderBudget } from '../../src/services/listPerformance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePerformanceProfile } from '../../src/context/PerformanceContext';

const BIO_PREVIEW_LINES = 6;

if (Platform.OS === 'android') {
  (UIManager as any).setLayoutAnimationEnabledExperimental?.(true);
}

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme, preferences } = useOrionTheme();
  const { width, isLandscape, isTablet } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { resolvedProfile } = usePerformanceProfile();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioCanExpand, setBioCanExpand] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setBioExpanded(false);
    setBioCanExpand(false);

    async function loadDetails() {
      try {
        const result = await fetchPersonDetails(id);
        setData(result);
      } catch (error) {
        console.error('Failed to load person details', error);
      } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [id]);

  const filmographyRenderBudget = useMemo(
    () => getRailRenderBudget(width, 140 + spacing[4] + spacing[4], resolvedProfile),
    [resolvedProfile, width],
  );

  // Preserve first occurrence semantics while avoiding repeated scans/allocations.
  const uniqueCredits = useMemo(() => {
    const credits = data?.combined_credits?.cast || [];
    const seenIds = new Set<string>();
    const unique: any[] = [];
    for (const credit of credits) {
      const key = String(credit.id);
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      unique.push(credit);
    }
    return unique.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
  }, [data?.combined_credits?.cast]);

  const measureBiography = useCallback((lineCount: number) => {
    const canExpand = lineCount > BIO_PREVIEW_LINES;
    setBioCanExpand((current) => current === canExpand ? current : canExpand);
  }, []);

  const toggleBiography = useCallback(() => {
    if (!preferences.reducedMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setBioExpanded((expanded) => !expanded);
  }, [preferences.reducedMotion]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Failed to load profile.</Text>
      </View>
    );
  }

  const profileImage = imgUrl(data.profile_path, 'h632');

  const headerTranslateY = scrollY.interpolate({
    inputRange: [-100, 0, 300],
    outputRange: [-50, 0, 150],
    extrapolate: 'clamp',
  });
  
  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolateRight: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.accentSoft, theme.background, theme.background, theme.background]}
        locations={[0, 0.4, 0.7, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating Back Button */}
      <Pressable style={[styles.backButton, { top: insets.top + 10, left: insets.left + 16 }]} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
        <BlurView intensity={80} tint="dark" style={styles.backButtonInner}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </BlurView>
      </Pressable>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Parallax Header */}
        <View style={[styles.headerContainer, isLandscape && styles.headerContainerLandscape, isTablet && styles.headerContainerTablet]}>
          <Animated.Image
            source={{ uri: profileImage || undefined }}
            style={[
              styles.backdrop,
              { transform: [{ translateY: headerTranslateY }, { scale: headerScale }] }
            ]}
          />
          <LinearGradient
            colors={['transparent', theme.background]}
            locations={[0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Content Body */}
        <View style={[styles.contentContainer, isLandscape && styles.contentContainerLandscape, isTablet && styles.contentContainerTablet]}>
          {/* Floating Info HUD */}
          <BlurView
            intensity={70}
            tint={theme.dark ? 'dark' : 'light'}
            style={[styles.infoHud, { backgroundColor: theme.elevated, borderColor: theme.border }]}
          >
            <Text style={[styles.title, { color: theme.text }]}>{data.name}</Text>
            
            <View style={styles.metaRow}>
              {!!data.birthday && (
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>Born: {data.birthday}</Text>
              )}
              {!!data.place_of_birth && (
                <>
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>•</Text>
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>{data.place_of_birth}</Text>
                </>
              )}
            </View>

            <Text style={[styles.knownForText, { color: theme.accent }]}>Known for {data.known_for_department}</Text>
          </BlurView>

          {data.biography ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Biography</Text>
              <Text
                style={[styles.bioText, styles.bioMeasure]}
                onTextLayout={(event) => measureBiography(event.nativeEvent.lines.length)}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
              >
                {data.biography}
              </Text>
              <Text
                style={[styles.bioText, { color: theme.textSecondary }]}
                numberOfLines={bioExpanded ? undefined : BIO_PREVIEW_LINES}
                ellipsizeMode="tail"
              >
                {data.biography}
              </Text>
              {(bioCanExpand || bioExpanded) ? (
                <Pressable
                  style={styles.bioToggle}
                  onPress={toggleBiography}
                  accessibilityRole="button"
                  accessibilityLabel={bioExpanded ? 'Show less biography' : 'Show more biography'}
                  accessibilityHint={bioExpanded ? 'Collapses the biography preview' : 'Expands the full biography'}
                  accessibilityState={{ expanded: bioExpanded }}
                  hitSlop={4}
                >
                  <Text style={[styles.bioToggleText, { color: theme.accent }]}>
                    {bioExpanded ? 'Show less' : 'Show more'}
                  </Text>
                  <Ionicons
                    name={bioExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.accent}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Filmography */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Filmography</Text>
            <FlatList
              data={uniqueCredits}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[6] }}
              keyExtractor={(item, idx) => `${item.id}-${idx}`}
              initialNumToRender={filmographyRenderBudget.initialNumToRender}
              maxToRenderPerBatch={filmographyRenderBudget.maxToRenderPerBatch}
              windowSize={filmographyRenderBudget.windowSize}
              renderItem={({ item }) => (
                <MediaCard 
                  item={item} 
                  onPress={() => {
                    const type = item.media_type || (item.name ? 'tv' : 'movie');
                    router.push(`/media/${item.id}?type=${type}`);
                  }} 
                />
              )}
            />
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    zIndex: 100,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonInner: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerContainer: {
    width: '100%',
    height: 500,
    // Keep the transformed parallax portrait inside the hero so it cannot
    // bleed behind Biography/Filmography as the user scrolls.
    overflow: 'hidden',
  },
  headerContainerLandscape: { height: 300 },
  headerContainerTablet: { height: 440 },
  backdrop: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    paddingHorizontal: spacing[4],
    marginTop: -100,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  contentContainerLandscape: { marginTop: -64, paddingHorizontal: spacing[6] },
  contentContainerTablet: { paddingHorizontal: spacing[8] },
  infoHud: {
    borderRadius: radii.lg,
    padding: spacing[5],
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing[6],
  },
  title: {
    fontSize: fontSizes['3xl'],
    fontFamily: fontFamilies.display,
    fontWeight: 'bold',
    marginBottom: spacing[2],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
    marginBottom: spacing[2],
  },
  metaText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.body,
    fontWeight: '600',
  },
  knownForText: {
    fontSize: fontSizes.xs,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    marginBottom: spacing[3],
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bioMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  bioToggle: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  bioToggleText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.body,
    fontWeight: '700',
  },
});
