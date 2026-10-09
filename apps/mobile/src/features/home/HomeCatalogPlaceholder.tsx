import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { spacing, radii } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { HOME_RAIL_LABELS, type HomeRailId } from './homeLayoutPreferences';
import { HomeLocalLibrary } from './HomeLocalLibrary';

// Presentation limit only: does not cancel, retry or reclassify any request.
export const HOME_PLACEHOLDER_LIMIT_MS = 20000;

export function HomeCatalogPlaceholder({ railIds, showContinueWatching }: {
  railIds: HomeRailId[];
  showContinueWatching: boolean;
}) {
  const { theme } = useOrionTheme();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), HOME_PLACEHOLDER_LIMIT_MS);
    return () => clearTimeout(timer);
  }, []);

  return <View>
    <HomeLocalLibrary showContinueWatching={showContinueWatching} />
    {expired ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: theme.textSecondary }]}>
      Cinema is taking longer to load. Your local Orion remains available.
    </Text> : <View accessibilityState={{ busy: true }} accessibilityLabel="Loading Cinema sections">
      {/* Static in both motion modes: never shimmer or animate each rail. */}
      {railIds.slice(0, 2).map((id) => <View key={id} style={styles.section}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{HOME_RAIL_LABELS[id]}</Text>
        <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[0, 1, 2, 3].map((index) => <View key={index} accessible={false}
            importantForAccessibility="no-hide-descendants" style={[styles.poster, { backgroundColor: theme.surface }]} />)}
        </ScrollView>
      </View>)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing[4] },
  heading: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2], fontSize: 20, lineHeight: 26, fontWeight: '900' },
  row: { paddingHorizontal: spacing[5], gap: spacing[3] },
  poster: { width: 140, height: 210, borderRadius: radii.md },
  notice: { marginHorizontal: spacing[5], marginBottom: spacing[5], fontSize: 14, lineHeight: 21 },
});
