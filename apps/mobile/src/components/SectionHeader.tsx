import { View, Text, StyleSheet, Pressable } from 'react-native';
import { text, accent, spacing, fontSizes, fontFamilies } from '@orion/shared/tokens';
import { Ionicons } from '@expo/vector-icons';

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

export function SectionHeader({ title, onSeeAll }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} style={styles.seeAllButton}>
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={accent.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
    paddingHorizontal: spacing[6],
  },
  title: {
    color: text.primary,
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.heading,
    fontWeight: 'bold',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    color: accent.primary,
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
});
