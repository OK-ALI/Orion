import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { spacing, radii } from '@orion/shared/tokens';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { getRailRenderBudget } from '../../services/listPerformance';
import { MediaCard } from '../../components/MediaCard';

/** Existing saved records and destinations only; no remote or storage mutation. */
export function HomeLocalLibrary({ showContinueWatching, showActions = true }: {
  showContinueWatching: boolean;
  showActions?: boolean;
}) {
  const { saved, savedOrder, getContinueWatching } = useLibrary();
  const { theme } = useOrionTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { resolvedProfile } = usePerformanceProfile();
  const items = (savedOrder?.length ? savedOrder : Object.keys(saved || {}))
    .map((key) => saved?.[key]).filter(Boolean).slice(0, 10);
  const hasContinueWatching = showContinueWatching && getContinueWatching().length > 0;
  const budget = getRailRenderBudget(width, 140 + spacing[4], resolvedProfile);
  const openLibrary = () => router.push('/(tabs)/library');

  return <View style={styles.section}>
    {items.length > 0 ? <>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>My List</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View all My List" onPress={openLibrary}
          style={[styles.action, { borderColor: theme.border }]}>
          <Text style={{ color: theme.accent }}>View all</Text>
        </Pressable>
      </View>
      <FlatList horizontal data={items} showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `${item.media_type || 'movie'}_${item.id}`}
        initialNumToRender={budget.initialNumToRender} maxToRenderPerBatch={budget.maxToRenderPerBatch}
        windowSize={budget.windowSize} contentContainerStyle={styles.row}
        renderItem={({ item }) => <MediaCard item={item} onPress={() => router.push({
          pathname: '/media/[id]', params: { id: String(item.id), type: item.media_type || 'movie' },
        })} />}
      />
    </> : !hasContinueWatching && <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name="library-outline" size={32} color={theme.accent} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Your local Orion</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Open your Library or Downloads to find saved titles and available offline videos.
      </Text>
    </View>}
    {showActions && <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Library" onPress={openLibrary}
        style={({ pressed }) => [styles.action, { borderColor: theme.border, backgroundColor: theme.surface }, pressed && styles.pressed]}>
        <Ionicons name="library-outline" size={18} color={theme.accent} />
        <Text style={{ color: theme.text }}>Library</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Downloads" onPress={() => router.push('/(tabs)/downloads')}
        style={({ pressed }) => [styles.action, { borderColor: theme.border, backgroundColor: theme.surface }, pressed && styles.pressed]}>
        <Ionicons name="download-outline" size={18} color={theme.accent} />
        <Text style={{ color: theme.text }}>Downloads</Text>
      </Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing[5] },
  heading: { paddingHorizontal: spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], paddingBottom: spacing[2] },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  row: { paddingHorizontal: spacing[5], gap: spacing[3] },
  empty: { minHeight: 180, marginHorizontal: spacing[5], padding: spacing[5], borderRadius: radii.xl, borderWidth: 1, justifyContent: 'center', gap: spacing[3] },
  body: { fontSize: 14, lineHeight: 21, maxWidth: 560 },
  actions: { paddingHorizontal: spacing[5], marginTop: spacing[3], flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  action: { minHeight: 44, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  pressed: { opacity: 0.76 },
});
