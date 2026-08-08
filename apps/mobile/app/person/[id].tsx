import { View, Text, StyleSheet, ScrollView, Animated, Pressable, Platform, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { imgUrl, fetchPersonDetails } from '@orion/shared/api';
import { radii, spacing, fontSizes, fontFamilies } from '@orion/shared/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MediaCard } from '../../src/components/MediaCard';
import { useOrionTheme } from '../../src/context/ThemeContext';

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useOrionTheme();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  
  // Sort credits by popularity and remove duplicates
  const credits = data.combined_credits?.cast || [];
  const uniqueCredits = credits.reduce((acc: any[], current: any) => {
    const x = acc.find(item => item.id === current.id);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []).sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

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
      <Pressable style={styles.backButton} onPress={() => router.back()}>
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
        <View style={styles.headerContainer}>
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
        <View style={styles.contentContainer}>
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
              <Text style={[styles.bioText, { color: theme.textSecondary }]}>{data.biography}</Text>
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
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
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
  },
  backdrop: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    paddingHorizontal: spacing[4],
    marginTop: -100,
  },
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
});
