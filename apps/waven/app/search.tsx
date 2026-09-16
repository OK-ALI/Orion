import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenAccentTitle } from '../src/components/typography/WavenAccentTitle';
import type {
  MusicAlbum,
  MusicArtist,
  MusicPlaylist,
  MusicSearchResult,
  MusicTrack,
} from '../src/domain/music';
import { wavenDiscoveryRuntime } from '../src/features/discovery/wavenDiscoveryRuntime';
import {
  wavenColors,
  wavenLayout,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

const SEARCH_SCOPES = ['Songs', 'Artists', 'Albums', 'Playlists'] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];
type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';
type SearchEntity = MusicTrack | MusicArtist | MusicAlbum | MusicPlaylist;

const SEARCH_DEBOUNCE_MS = 360;
const SEARCH_RESULT_LIMIT = 12;

function emptySearchResult(): MusicSearchResult {
  return {
    tracks: [],
    artists: [],
    albums: [],
    playlists: [],
    continuation: null,
  };
}

function itemsForScope(
  result: MusicSearchResult,
  scope: SearchScope,
): SearchEntity[] {
  switch (scope) {
    case 'Artists':
      return result.artists;
    case 'Albums':
      return result.albums;
    case 'Playlists':
      return result.playlists;
    case 'Songs':
    default:
      return result.tracks;
  }
}

function entityTitle(item: SearchEntity): string {
  return 'name' in item ? item.name : item.title;
}

function entitySubtitle(item: SearchEntity, scope: SearchScope): string {
  switch (scope) {
    case 'Songs': {
      const track = item as MusicTrack;
      return [track.artistName, track.albumTitle].filter(Boolean).join(' · ');
    }
    case 'Artists':
      return 'Artist';
    case 'Albums': {
      const album = item as MusicAlbum;
      return album.artistName || 'Album';
    }
    case 'Playlists': {
      const playlist = item as MusicPlaylist;
      return playlist.description || 'Playlist';
    }
  }
}

function WavenSearchArtwork({
  item,
  size,
}: {
  item: SearchEntity;
  size: number;
}) {
  const artworkUrl =
    item.artworkUrl ||
    ('profileImageUrl' in item ? item.profileImageUrl : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [artworkUrl]);

  if (!artworkUrl || failed) {
    return (
      <WavenArtworkFallback
        accessibilityLabel={`${entityTitle(item)} artwork`}
        seed={`search-result-${item.source.provider}-${item.source.id}`}
        size={size}
      />
    );
  }

  return (
    <Image
      accessibilityLabel={`${entityTitle(item)} artwork`}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: artworkUrl }}
      style={[
        styles.resultArtwork,
        {
          height: size,
          width: size,
        },
      ]}
    />
  );
}

export default function WavenSearchScreen() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('Songs');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [result, setResult] = useState<MusicSearchResult>(() =>
    emptySearchResult(),
  );
  const [providerErrors, setProviderErrors] = useState<readonly string[]>([]);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSequence = useRef(0);

  const providerName =
    wavenDiscoveryRuntime
      .getProviderDescriptors()
      .find((provider) => provider.kind === 'metadata')?.name || 'Music provider';

  useEffect(() => {
    const safeQuery = query.trim().slice(0, 200);
    const sequence = ++requestSequence.current;

    if (safeQuery.length < 2) {
      setStatus('idle');
      setResult(emptySearchResult());
      setProviderErrors([]);
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setResult(emptySearchResult());
    setProviderErrors([]);

    const debounceHandle = setTimeout(() => {
      wavenDiscoveryRuntime
        .search(safeQuery, { signal: controller.signal })
        .then((response) => {
          if (
            controller.signal.aborted ||
            response.cancelled ||
            sequence !== requestSequence.current
          ) {
            return;
          }

          const totalResults =
            response.result.tracks.length +
            response.result.artists.length +
            response.result.albums.length +
            response.result.playlists.length;

          setResult(response.result);
          setProviderErrors(response.errors);
          setStatus(
            response.errors.length > 0 && totalResults === 0
              ? 'error'
              : 'ready',
          );
        })
        .catch(() => {
          if (
            controller.signal.aborted ||
            sequence !== requestSequence.current
          ) {
            return;
          }

          setResult(emptySearchResult());
          setProviderErrors(['Search is unavailable right now.']);
          setStatus('error');
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceHandle);
      controller.abort();
    };
  }, [query, retryNonce]);

  const scopedItems = useMemo(
    () => itemsForScope(result, scope).slice(0, SEARCH_RESULT_LIMIT),
    [result, scope],
  );

  const trimmedQuery = query.trim();
  const hasSearchableQuery = trimmedQuery.length >= 2;

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
                  <View
                    style={[
                      styles.scopeChip,
                      active ? styles.scopeChipActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeText,
                        active ? styles.scopeTextActive : null,
                      ]}
                    >
                      {item}
                    </Text>
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
            <Text style={styles.emptyHint}>
              Start typing to bring the music into focus.
            </Text>
          </View>
        ) : (
          <View style={styles.queryState}>
            <Text style={styles.queryLabel}>YOUR SEARCH · {scope.toUpperCase()}</Text>
            <Text numberOfLines={2} style={styles.queryText}>“{query}”</Text>

            {!hasSearchableQuery ? (
              <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                <Text style={styles.stateTitle}>Keep typing</Text>
                <Text style={styles.stateBody}>
                  Enter at least two characters to search {providerName}.
                </Text>
              </View>
            ) : null}

            {status === 'loading' ? (
              <View
                accessibilityLabel={`Searching ${scope.toLowerCase()}`}
                accessibilityLiveRegion="polite"
                style={styles.loadingState}
              >
                <ActivityIndicator
                  color={wavenColors.interactionBlue}
                  size="small"
                />
                <Text style={styles.loadingText}>
                  Searching {providerName}
                </Text>
              </View>
            ) : null}

            {status === 'error' ? (
              <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                <Text style={styles.stateTitle}>Search is taking a break</Text>
                <Text style={styles.stateBody}>
                  {providerName} could not answer this search right now.
                </Text>
                <WavenPressable
                  accessibilityLabel="Retry search"
                  accessibilityRole="button"
                  onPress={() => setRetryNonce((value) => value + 1)}
                  style={styles.retryTouchTarget}
                >
                  <View style={styles.retryAction}>
                    <Text style={styles.retryText}>Try Again</Text>
                  </View>
                </WavenPressable>
              </View>
            ) : null}

            {status === 'ready' && scopedItems.length === 0 ? (
              <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                <Text style={styles.stateTitle}>Nothing here yet</Text>
                <Text style={styles.stateBody}>
                  No {scope.toLowerCase()} matched “{trimmedQuery}”.
                </Text>
              </View>
            ) : null}

            {status === 'ready' && scopedItems.length > 0 ? (
              <View
                accessibilityLabel={`${scope} search results`}
                style={styles.resultsSection}
              >
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsTitle}>{scope}</Text>
                  <Text style={styles.providerAttribution}>
                    {providerName.toUpperCase()}
                  </Text>
                </View>

                {providerErrors.length > 0 ? (
                  <Text accessibilityLiveRegion="polite" style={styles.partialNote}>
                    Some results may be unavailable.
                  </Text>
                ) : null}

                <View style={styles.resultsList}>
                  {scopedItems.map((item) => (
                    <View
                      accessibilityLabel={`${entityTitle(item)}. ${entitySubtitle(item, scope)}`}
                      accessible
                      key={`${item.source.provider}:${item.source.id}`}
                      style={styles.resultRow}
                    >
                      <WavenSearchArtwork item={item} size={58} />
                      <View style={styles.resultCopy}>
                        <Text numberOfLines={1} style={styles.resultTitle}>
                          {entityTitle(item)}
                        </Text>
                        <Text numberOfLines={1} style={styles.resultSubtitle}>
                          {entitySubtitle(item, scope)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
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
    height: wavenLayout.minimumTouchTarget,
    justifyContent: 'center',
    width: wavenLayout.minimumTouchTarget,
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
    paddingBottom: wavenSpacing.xl,
    paddingTop: wavenSpacing.xl,
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
  stateCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 15, 21, 0.46)',
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: wavenSpacing.xl,
    paddingHorizontal: wavenSpacing.lg,
    paddingVertical: wavenSpacing.xl,
  },
  stateTitle: {
    color: wavenColors.textSecondary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
    textAlign: 'center',
  },
  stateBody: {
    color: wavenColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 360,
    textAlign: 'center',
  },
  loadingState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: wavenSpacing.xl,
    minHeight: 96,
  },
  loadingText: {
    color: wavenColors.textSecondary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight,
  },
  retryTouchTarget: {
    justifyContent: 'center',
    marginTop: wavenSpacing.md,
    minHeight: wavenLayout.minimumTouchTarget,
  },
  retryAction: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 18,
  },
  retryText: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight,
  },
  resultsSection: {
    marginTop: wavenSpacing.xl,
  },
  resultsHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  resultsTitle: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
  },
  providerAttribution: {
    color: wavenColors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  partialNote: {
    color: wavenColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  resultsList: {
    gap: 8,
    marginTop: 12,
  },
  resultRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 15, 21, 0.44)',
    borderColor: 'rgba(214, 224, 232, 0.1)',
    borderRadius: wavenRadii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  resultArtwork: {
    backgroundColor: wavenColors.surfaceRaised,
    borderRadius: wavenRadii.sm,
  },
  resultCopy: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  resultTitle: {
    color: wavenColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  resultSubtitle: {
    color: wavenColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
});
