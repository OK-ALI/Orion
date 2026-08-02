import { View, Text, StyleSheet, Image, Pressable, Platform, StyleProp, ViewStyle } from 'react-native';
import { semantic, radii, spacing, fontSizes } from '@orion/shared/tokens';
import { imgUrl } from '@orion/shared/api';
import { TmdbMediaItem } from '@orion/shared/types';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLibrary } from '../context/LibraryContext';
import { useOrionTheme } from '../context/ThemeContext';

interface MediaCardProps {
  item: TmdbMediaItem;
  onPress?: () => void;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function MediaCard({ item, onPress, width = 140, height = 210, style }: MediaCardProps) {
  const { isSaved, toggleSave } = useLibrary();
  const { theme } = useOrionTheme();
  const isMovie = item.media_type === 'movie' || !item.name;
  const title = isMovie ? item.title : item.name;
  const year = isMovie
    ? item.release_date?.slice(0, 4)
    : item.first_air_date?.slice(0, 4);

  const poster = imgUrl(item.poster_path, 'w500');
  const typeBadgeText = isMovie ? 'HD' : 'TV';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width, height },
        style,
        pressed && styles.pressedCard
      ]}
      onPress={onPress}
      onLongPress={() => toggleSave(item)}
      delayLongPress={300}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.imageContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {poster ? (
              <Image source={{ uri: poster }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.placeholder]}>
                <Ionicons name="film-outline" size={40} color={theme.textMuted} />
              </View>
            )}
            
            {/* Cinema gradient overlay */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <LinearGradient
                colors={['transparent', theme.mediaScrim]}
                locations={[0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
            </View>

            {/* Type Badge (HD / TV) */}
            <View pointerEvents="none" style={[styles.typeBadge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.typeBadgeText, { color: theme.onAccent }]}>{typeBadgeText}</Text>
            </View>

            {/* Saved Bookmark Badge */}
            {isSaved(item) && (
              <View pointerEvents="none" style={[styles.savedBadge, { backgroundColor: theme.elevated }]}>
                <Ionicons name="bookmark" size={14} color={theme.accent} />
              </View>
            )}
            
            {/* Play Button Overlay (shown on press for mobile) */}
            {pressed && (
              <View pointerEvents="none" style={[styles.playOverlay, { backgroundColor: theme.mediaScrim }]}>
                <View style={[styles.playButtonGlow, { backgroundColor: theme.accent, shadowColor: theme.accent }]} />
                <View style={[styles.playButton, { backgroundColor: theme.accent }]}>
                  <Ionicons name="play" size={20} color={theme.onAccent} style={{ marginLeft: 3 }} />
                </View>
              </View>
            )}

            {/* Rating Badge */}
            {!!item.vote_average && item.vote_average > 0 && (
              <View pointerEvents="none" style={styles.ratingBadgeWrapper}>
                <BlurView intensity={60} tint={theme.dark ? 'dark' : 'light'} style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color={semantic.warning} />
                  <Text style={[styles.ratingText, { color: theme.text }]}>{item.vote_average.toFixed(1)}</Text>
                </BlurView>
              </View>
            )}
          </View>
          <View pointerEvents="none" style={styles.info}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.year, { color: theme.textSecondary }]}>{year || 'Unknown'}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: spacing[4],
  },
  pressedCard: {
    transform: [{ scale: 0.97 }],
  },
  imageContainer: {
    flex: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing[2],
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  savedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    ...(Platform.OS === 'web' ? { filter: 'blur(10px)' } : {}),
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadgeWrapper: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  info: {
    paddingHorizontal: 2,
    marginTop: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  year: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});
