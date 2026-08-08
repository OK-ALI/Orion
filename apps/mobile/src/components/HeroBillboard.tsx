import { View, Text, StyleSheet, ImageBackground, Pressable, Platform, FlatList, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, fontFamilies, semantic } from '@orion/shared/tokens';
import { imgUrl } from '@orion/shared/api';
import { TmdbMediaItem } from '@orion/shared/types';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { useOrionTheme } from '../context/ThemeContext';

interface HeroBillboardProps {
  items: TmdbMediaItem[];
  onPlay?: (item: TmdbMediaItem) => void;
  onInfo?: (item: TmdbMediaItem) => void;
  onPress?: (item: TmdbMediaItem) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTO_ROTATE_INTERVAL = 6000;

function HeroSlide({ item, onPlay, onInfo, onPress, width }: {
  item: TmdbMediaItem;
  onPlay?: () => void;
  onInfo?: () => void;
  onPress?: () => void;
  width: number;
}) {
  const { isSaved, toggleSave } = useLibrary();
  const { theme } = useOrionTheme();
  const isMovie = item.media_type === 'movie' || !item.name;
  const title = isMovie ? item.title : item.name;
  const backdrop = imgUrl(item.backdrop_path, 'original');
  const saved = isSaved(item);

  return (
    <View style={[styles.slideContainer, { width }]}>
      <Pressable style={{ flex: 1 }} onPress={onPress}>
        <ImageBackground
          source={{ uri: backdrop || undefined }}
          style={styles.image}
          imageStyle={{ resizeMode: 'cover' }}
        >
          {/* A restrained readability veil keeps the artwork visible in every theme. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.20)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Left-to-Right vignette */}
          <LinearGradient
            colors={['rgba(0,0,0,0.52)', 'rgba(0,0,0,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Bottom Blur Strip */}
          <BlurView intensity={18} tint="dark" style={styles.bottomBlurEdge} />

          {/* Bottom-to-Top heavy fade */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.48)', theme.background]}
            locations={[0, 0.42, 0.78, 1]}
            style={styles.bottomGradient}
          />

          <View style={styles.content}>
            <Text style={[styles.tag, { color: theme.accent }]}>
              SPOTLIGHT · {isMovie ? 'MOVIE' : 'SERIES'}
            </Text>
            
            <Text style={[styles.title, { color: theme.onAccent }]} numberOfLines={1}>
              {title}
            </Text>
            
            <View style={styles.metaRow}>
              {!!item.vote_average && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color={semantic.warning} />
                  <Text style={[styles.metaText, { color: theme.onAccent }]}>{item.vote_average.toFixed(1)}</Text>
                </View>
              )}
              <Text style={[styles.metaText, { color: theme.onAccent }]}>
                {item.release_date ? item.release_date.slice(0, 4) : item.first_air_date?.slice(0, 4)}
              </Text>
            </View>

            <Text style={[styles.overview, { color: theme.onAccent }]} numberOfLines={2}>
              {item.overview}
            </Text>

            <View style={styles.buttonRow}>
              <Pressable onPress={onPlay} style={({ pressed }) => [styles.playWrapper, pressed && styles.pressed]}>
                <View style={[styles.playButtonGlow, { backgroundColor: theme.accent }]} />
                <View style={[styles.playButton, { backgroundColor: theme.accent }]}>
                  <Ionicons name="play" size={15} color={theme.onAccent} />
                  <Text style={[styles.playText, { color: theme.onAccent }]}>Play</Text>
                </View>
              </Pressable>
              
              <Pressable style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]} onPress={(e) => { e.stopPropagation(); toggleSave(item); }}>
                <BlurView intensity={80} tint="dark" style={[styles.blurButton, { backgroundColor: theme.mediaScrim }]}>
                  <Ionicons name={saved ? "checkmark" : "add"} size={18} color={theme.onAccent} />
                  <Text style={[styles.infoText, { color: theme.onAccent }]}>{saved ? "In My List" : "My List"}</Text>
                </BlurView>
              </Pressable>
              
              <Pressable style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]} onPress={(e) => { e.stopPropagation(); onInfo?.(); }}>
                <BlurView intensity={80} tint="dark" style={[styles.blurButton, { backgroundColor: theme.mediaScrim }]}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.onAccent} />
                  <Text style={[styles.infoText, { color: theme.onAccent }]}>More Info</Text>
                </BlurView>
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      </Pressable>
    </View>
  );
}

export function HeroBillboard({ items, onPlay, onInfo, onPress }: HeroBillboardProps) {
  const { theme, preferences } = useOrionTheme();
  const spotlightItems = useMemo(() => items.slice(0, 5), [items]);
  const baseCount = spotlightItems.length;

  // Duplicate items 20 times for infinite forward looping
  const loopItems = useMemo(() => {
    if (baseCount === 0) return [];
    return Array.from({ length: 20 }).flatMap((_, loopIdx) =>
      spotlightItems.map((item, itemIdx) => ({
        ...item,
        uniqueKey: `loop_${loopIdx}_${item.id}_${itemIdx}`,
      }))
    );
  }, [spotlightItems, baseCount]);

  const initialIndex = baseCount * 5; // Start in middle set
  const flatIndexRef = useRef(initialIndex);
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth continuous forward auto-rotation
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (baseCount <= 1 || loopItems.length === 0 || preferences.reducedMotion) return;

    timerRef.current = setInterval(() => {
      let nextIndex = flatIndexRef.current + 1;
      const maxIndex = loopItems.length - 1;

      if (nextIndex > maxIndex - baseCount) {
        // Reset to middle set boundary seamlessly
        const realIndex = nextIndex % baseCount;
        nextIndex = baseCount * 5 + realIndex;
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: false });
      } else {
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      }

      flatIndexRef.current = nextIndex;
      setActiveDotIndex(nextIndex % baseCount);
    }, AUTO_ROTATE_INTERVAL);
  }, [baseCount, loopItems.length, preferences.reducedMotion]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const handleMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const width = containerWidth || SCREEN_WIDTH;
    const rawIndex = Math.round(offsetX / width);

    flatIndexRef.current = rawIndex;
    const realIndex = rawIndex % baseCount;
    setActiveDotIndex(realIndex);

    // If near the dataset boundaries, silently reset to middle set without animation
    if (rawIndex < baseCount * 2 || rawIndex > baseCount * 15) {
      const resetIndex = baseCount * 5 + realIndex;
      flatIndexRef.current = resetIndex;
      flatListRef.current?.scrollToIndex({ index: resetIndex, animated: false });
    }

    startTimer();
  };

  const handleScrollBeginDrag = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  if (spotlightItems.length === 0) return null;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <FlatList
        ref={flatListRef}
        data={loopItems}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        keyExtractor={(item) => item.uniqueKey}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollBeginDrag={handleScrollBeginDrag}
        getItemLayout={(_, index) => ({
          length: containerWidth,
          offset: containerWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <HeroSlide
            item={item}
            width={containerWidth}
            onPlay={() => onPlay?.(item)}
            onInfo={() => onInfo?.(item)}
            onPress={() => onPress?.(item)}
          />
        )}
      />

      {/* Pagination Dots */}
      {baseCount > 1 && (
        <View style={styles.pagination}>
          {spotlightItems.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.border },
                i === activeDotIndex && [styles.dotActive, { backgroundColor: theme.accent, shadowColor: theme.accent }],
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 380,
    width: '100%',
    marginBottom: spacing[2],
  },
  slideContainer: {
    height: 380,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bottomGradient: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  content: {
    position: 'absolute',
    bottom: 24,
    left: 18,
    right: 18,
    zIndex: 10,
  },
  tag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: fontFamilies.display,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: fontFamilies.heading,
    fontWeight: '700',
  },
  overview: {
    opacity: 0.78,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
    maxHeight: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playWrapper: {
    position: 'relative',
  },
  playButtonGlow: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 8,
    opacity: 0.6,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  playText: {
    fontSize: 12,
    fontFamily: fontFamilies.heading,
    fontWeight: '800',
  },
  infoButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  blurButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  infoText: {
    fontSize: 12,
    fontFamily: fontFamilies.heading,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  bottomBlurEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
