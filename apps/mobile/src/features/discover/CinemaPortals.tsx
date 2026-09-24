import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fontFamilies, fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileThemeTokens } from '../../context/ThemeContext';
import { PROVIDER_HUBS, WORLD_HUBS, type SelectedHub } from './discoveryHubs';

export function CinemaPortals({ theme, width, onSelect }: {
  theme: MobileThemeTokens;
  width: number;
  onSelect: (hub: NonNullable<SelectedHub>) => void;
}) {
  const cardWidth = Math.max(126, Math.min(172, width > 0 ? (width - spacing[4] * 2 - spacing[3] * 2) / 2.35 : 136));
  const rail = (kind: 'provider' | 'world', items: typeof PROVIDER_HUBS | typeof WORLD_HUBS) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {items.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Explore ${item.name}`}
          onPress={() => onSelect({ kind, id: item.id })} style={({ pressed }) => [styles.card, { width: cardWidth, borderColor: theme.border }, pressed && styles.pressed]}>
          <LinearGradient colors={item.colors as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
            <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          </LinearGradient>
        </Pressable>
      ))}
    </ScrollView>
  );
  return (
    <View style={styles.container} accessibilityLabel="Cinema Portals">
      <Text style={[styles.eyebrow, { color: theme.accent }]}>CINEMA PORTALS</Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>Choose your orbit</Text>
      <Text style={[styles.category, { color: theme.textSecondary }]}>Streaming Realms</Text>
      {rail('provider', PROVIDER_HUBS)}
      <Text style={[styles.category, { color: theme.textSecondary }]}>Story Universes</Text>
      {rail('world', WORLD_HUBS)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing[1], marginBottom: spacing[4] },
  eyebrow: { marginHorizontal: spacing[4], fontFamily: fontFamilies.heading, fontSize: fontSizes.xs, fontWeight: '800', letterSpacing: 1.3 },
  subtitle: { marginHorizontal: spacing[4], marginTop: spacing[1], marginBottom: spacing[2], fontFamily: fontFamilies.heading, fontSize: fontSizes.lg, fontWeight: '700' },
  category: { marginHorizontal: spacing[4], marginTop: spacing[2], marginBottom: spacing[2], fontFamily: fontFamilies.body, fontSize: fontSizes.sm, fontWeight: '700' },
  rail: { paddingHorizontal: spacing[4], gap: spacing[3] },
  card: { minHeight: 58, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  gradient: { minHeight: 58, justifyContent: 'center', paddingHorizontal: spacing[3] },
  cardName: { color: '#fff', fontFamily: fontFamilies.heading, fontSize: fontSizes.sm, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
