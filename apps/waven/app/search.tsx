import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenAccentTitle } from '../src/components/typography/WavenAccentTitle';
import {
  wavenColors,
  wavenLayout,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

const SEARCH_SCOPES = ['Songs', 'Artists', 'Albums', 'Playlists'] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];

export default function WavenSearchScreen() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('Songs');

  return (
    <WavenAppShell>
      <View style={styles.page}>
        <View style={styles.heading}>
          <WavenAccentTitle before="Find Your " accent="Sound" />
        </View>

        <View style={styles.searchField}>
          <View accessible={false} style={styles.searchIcon}>
            <View style={styles.searchRing} />
            <View style={styles.searchHandle} />
          </View>
          <TextInput
            accessibilityLabel={`Search ${scope.toLowerCase()}`}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder={`Search ${scope.toLowerCase()}`}
            placeholderTextColor={wavenColors.textMuted}
            returnKeyType="search"
            selectionColor={wavenColors.interactionBlue}
            style={styles.input}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setQuery('')}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.scopeSection}>
          <Text style={styles.sectionLabel}>SEARCH ACROSS</Text>
          <View accessibilityLabel="Search categories" style={styles.scopeRow}>
            {SEARCH_SCOPES.map((item) => {
              const active = item === scope;
              return (
                <WavenPressable
                  accessibilityLabel={`Search ${item.toLowerCase()}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item}
                  onPress={() => setScope(item)}
                  style={styles.scopeTouchTarget}
                >
                  <View style={[styles.scopeChip, active ? styles.scopeChipActive : null]}>
                    <Text style={[styles.scopeText, active ? styles.scopeTextActive : null]}>{item}</Text>
                  </View>
                </WavenPressable>
              );
            })}
          </View>
        </View>

        {!query ? (
          <View style={styles.emptyStage}>
            <WavenArtworkFallback
              accessibilityLabel="Search artwork"
              seed={`search-${scope}`}
              size={88}
            />
            <Text style={styles.emptyHint}>Start typing to bring the music into focus.</Text>
          </View>
        ) : (
          <View style={styles.queryState}>
            <Text style={styles.queryLabel}>SEARCHING {scope.toUpperCase()}</Text>
            <Text numberOfLines={2} style={styles.queryText}>“{query}”</Text>
          </View>
        )}
      </View>
    </WavenAppShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  heading: {
    marginBottom: wavenSpacing.lg,
    marginTop: wavenSpacing.md,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: wavenColors.glassSoft,
    borderColor: wavenColors.borderStrong,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  searchIcon: {
    height: 24,
    marginRight: 10,
    position: 'relative',
    width: 24,
  },
  searchRing: {
    borderColor: wavenColors.textSecondary,
    borderRadius: 8,
    borderWidth: 1.7,
    height: 15,
    left: 2,
    position: 'absolute',
    top: 2,
    width: 15,
  },
  searchHandle: {
    backgroundColor: wavenColors.textSecondary,
    borderRadius: 999,
    bottom: 4,
    height: 2,
    position: 'absolute',
    right: 2,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  input: {
    color: wavenColors.textPrimary,
    flex: 1,
    fontSize: 16,
    minHeight: wavenLayout.minimumTouchTarget,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  clearText: {
    color: wavenColors.textSecondary,
    fontSize: 24,
    lineHeight: 24,
  },
  scopeSection: {
    marginTop: wavenSpacing.xl,
  },
  sectionLabel: {
    color: wavenColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  scopeTouchTarget: {
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
  },
  scopeChip: {
    backgroundColor: wavenColors.surfaceSoft,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  scopeChipActive: {
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
  },
  scopeText: {
    color: wavenColors.textMuted,
    fontSize: wavenTypography.caption.fontSize,
    fontWeight: wavenTypography.caption.fontWeight,
  },
  scopeTextActive: {
    color: wavenColors.textPrimary,
  },
  emptyStage: {
    alignItems: 'center',
    flex: 1,
    gap: wavenSpacing.md,
    justifyContent: 'center',
    minHeight: 220,
    paddingBottom: wavenSpacing.xl,
    paddingTop: wavenSpacing.lg,
  },
  emptyHint: {
    color: wavenColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 300,
    textAlign: 'center',
  },
  queryState: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 220,
    paddingBottom: wavenSpacing.xl,
  },
  queryLabel: {
    color: wavenColors.interactionBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  queryText: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.title.fontSize,
    fontWeight: wavenTypography.title.fontWeight,
    lineHeight: wavenTypography.title.lineHeight,
    marginTop: 7,
  },
});
