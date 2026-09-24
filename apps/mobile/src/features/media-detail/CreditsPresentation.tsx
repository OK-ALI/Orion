import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imgUrl } from '@orion/shared/api';
import { fontFamilies, fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileThemeTokens } from '../../context/ThemeContext';
import type { TitleCastPerson, TitleCrewPerson } from './titleCredits';

export function CreditPersonCard({ person, theme, width, onOpen }: {
  person: TitleCastPerson;
  theme: MobileThemeTokens;
  width: number;
  onOpen: (id: number) => void;
}) {
  const portrait = imgUrl(person.profile_path, 'w200');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.name}`}
      style={({ pressed }) => [styles.personCard, { width, backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
      onPress={() => onOpen(person.id)}>
      {portrait ? <Image source={{ uri: portrait }} style={[styles.portrait, { borderColor: theme.border }]} />
        : <View style={[styles.portrait, styles.fallback, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
            <Ionicons name="person-outline" size={26} color={theme.textMuted} />
          </View>}
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{person.name}</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={2}>{person.character || 'Cast'}</Text>
    </Pressable>
  );
}

export function KeyCrewList({ people, theme, onOpen, compact = false }: {
  people: TitleCrewPerson[];
  theme: MobileThemeTokens;
  onOpen: (id: number) => void;
  compact?: boolean;
}) {
  if (!people.length) return null;
  return (
    <View style={[styles.crewSection, !compact && { paddingHorizontal: spacing[4] }]}>
      <Text style={[styles.heading, { color: theme.textMuted }]}>KEY CREW</Text>
      {people.map((person) => (
        <Pressable key={`${person.id}_${person.job}`} accessibilityRole="button"
          accessibilityLabel={`View ${person.name}, ${person.job}`}
          onPress={() => onOpen(person.id)}
          style={({ pressed }) => [styles.crewRow, { borderColor: theme.border }, pressed && styles.pressed]}>
          <Text style={[styles.crewJob, { color: theme.accent }]} numberOfLines={1}>{person.job}</Text>
          <Text style={[styles.crewName, { color: theme.text }]} numberOfLines={1}>{person.name}</Text>
          <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

export function TitleCreditsPreview({ cast, crew, theme, onOpen, budget }: {
  cast: TitleCastPerson[];
  crew: TitleCrewPerson[];
  theme: MobileThemeTokens;
  onOpen: (id: number) => void;
  budget: { initialNumToRender: number; maxToRenderPerBatch: number; windowSize: number };
}) {
  if (!cast.length && !crew.length) return null;
  return (
    <View style={styles.preview}>
      {cast.length > 0 && <Text style={[styles.heading, { color: theme.textMuted }]}>TOP CAST</Text>}
      {cast.length > 0 && <FlatList data={cast} horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.previewRail}
        keyExtractor={(person, index) => person.credit_id || `${person.id}_${index}`}
        initialNumToRender={budget.initialNumToRender} maxToRenderPerBatch={budget.maxToRenderPerBatch} windowSize={budget.windowSize}
        renderItem={({ item }) => <CreditPersonCard person={item} theme={theme} width={106} onOpen={onOpen} />} />}
      <KeyCrewList people={crew} theme={theme} onOpen={onOpen} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { gap: spacing[2], marginTop: spacing[2] },
  heading: { fontSize: 10, fontFamily: fontFamilies.heading, fontWeight: '800', letterSpacing: 1 },
  previewRail: { gap: spacing[3], paddingBottom: spacing[2] },
  personCard: { minHeight: 158, alignItems: 'center', padding: spacing[2], borderRadius: radii.lg, borderWidth: 1 },
  portrait: { width: 78, height: 78, borderRadius: 39, borderWidth: 1, marginBottom: spacing[2] },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fontFamilies.body, fontSize: fontSizes.xs, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontFamily: fontFamilies.body, fontSize: 10, textAlign: 'center', marginTop: 2 },
  crewSection: { marginTop: spacing[4] },
  crewRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderBottomWidth: 1 },
  crewJob: { width: 112, fontFamily: fontFamilies.body, fontSize: fontSizes.xs, fontWeight: '700' },
  crewName: { flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.sm, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
