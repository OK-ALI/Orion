import { View, Text, StyleSheet, Image, Pressable, StyleProp, ViewStyle } from 'react-native';
import { radii, spacing, fontSizes } from '@orion/shared/tokens';
import { imgUrl } from '@orion/shared/api';
import { TmdbMediaItem } from '@orion/shared/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useOrionTheme } from '../context/ThemeContext';

interface PersonCardProps {
  item: {
    name?: string;
    profile_path?: string | null;
    [key: string]: any;
  };
  onPress?: () => void;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function PersonCard({ item, onPress, width = 110, height = 165, style }: PersonCardProps) {
  const { theme } = useOrionTheme();
  const imageUrl = imgUrl(item.profile_path || null, 'w500');
  const compact = width < 100;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width, height, backgroundColor: theme.surface, borderColor: theme.border },
        style,
        pressed && styles.pressedCard
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name || 'person'} profile`}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: theme.surfaceHover }]}>
            <Ionicons name="person" size={40} color={theme.textMuted} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', theme.mediaScrim]}
          locations={[0.42, 1]}
          style={styles.gradient}
        />
      </View>

      <View style={[styles.infoContainer, compact && styles.infoContainerCompact]}>
        <Text style={[styles.name, compact && styles.nameCompact, { color: theme.onAccent }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.subtitle, { color: theme.onAccent }]} numberOfLines={1}>Person</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  pressedCard: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[2],
  },
  infoContainerCompact: { padding: spacing[1] },
  name: {
    fontSize: fontSizes.sm,
    fontWeight: 'bold',
  },
  nameCompact: { fontSize: fontSizes.xs },
  subtitle: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.78,
  },
});
