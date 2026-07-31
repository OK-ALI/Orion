import { View, Text, StyleSheet, Image, Pressable, StyleProp, ViewStyle } from 'react-native';
import { text, radii, spacing, fontSizes, backgrounds } from '@orion/shared/tokens';
import { imgUrl } from '@orion/shared/api';
import { TmdbMediaItem } from '@orion/shared/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const imageUrl = imgUrl(item.profile_path || null, 'w500');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width, height },
        style,
        pressed && styles.pressedCard
      ]}
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="person" size={40} color={text.muted} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(10, 15, 26, 0.9)']}
          locations={[0.5, 1]}
          style={styles.gradient}
        />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>Actor</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: backgrounds.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  name: {
    color: '#ffffff',
    fontSize: fontSizes.sm,
    fontWeight: 'bold',
  },
  subtitle: {
    color: text.secondary,
    fontSize: 10,
    marginTop: 2,
  },
});
