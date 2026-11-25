import { useRouter } from 'expo-router';
import { useWavenConnectivity } from '../src/infrastructure/connectivity/connectivityHooks';
import { offlineMetadata } from '../src/infrastructure/connectivity/offlineMetadata';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WavenMusicLibraryActions, WavenTrackPlayTarget } from '../src/components/library/WavenLibraryControls';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  TextInput,
  View,
} from 'react-native';
import { WavenText as Text } from '../src/components/typography/WavenText';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { wavenArtworkLeaseKey } from '../src/features/artwork/wavenArtworkLifecycle';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenEntityRevealAnchor } from '../src/components/navigation/WavenEntityRevealAnchor';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenAccentTitle } from '../src/components/typography/WavenAccentTitle';
import { WavenSectionTitle, splitWavenSectionAccent } from '../src/components/typography/WavenSectionTitle';
import type {
  MusicAlbum,
  MusicArtist,
  MusicDashboardSection,
  MusicPlaylist,
  MusicSearchResult,
  MusicTrack,
} from '../src/domain/music';
import {
  albumDetailRoute,
  artistDetailRoute,
} from '../src/features/discovery/detailNavigation';
import {
  readWavenPresentation,
  seedWavenPresentation,
  wavenEntityArtworkUrl,
} from '../src/features/discovery/wavenCanonicalPresentation';
import {
  wavenDiscoveryRuntime,
  type WavenSearchDiscoveryCategory,
} from '../src/features/discovery/wavenDiscoveryRuntime';
import { primeWavenAlbumDetail, primeWavenArtistDetail } from '../src/features/discovery/wavenDetailPrefetch';
import {
  beginWavenEntityReveal,
  wavenEntityRevealKey,
  wavenReleaseRevealKind,
} from '../src/features/navigation/wavenEntityReveal';
import {
  popWavenSearchNavigationCheckpoint,
  pushWavenSearchNavigationCheckpoint,
  readWavenSearchNavigationSession,
  updateWavenSearchNavigationScroll,
  updateWavenSearchArtistsToExploreScroll,
  writeWavenSearchNavigationSession,
  type WavenSearchNavigationSnapshot,
} from '../src/features/navigation/wavenSearchNavigationSession';
import { useWavenArtworkLease } from '../src/hooks/useWavenArtworkLease';
import { useWavenLayout } from '../src/hooks/useWavenLayout';
import { useWavenReducedMotion } from '../src/hooks/useWavenReducedMotion';
import {
  wavenColors,
  wavenFonts,
  wavenLayout,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

const SEARCH_SCOPES = ['Songs', 'Artists', 'Albums', 'Playlists'] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number];
type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';
type SearchDiscoveryStatus = 'loading' | 'ready' | 'error';
type SearchEntity = MusicTrack | MusicArtist | MusicAlbum | MusicPlaylist;
type SearchDiscoverySelection = {
  kind: 'category';
  title: string;
  category: WavenSearchDiscoveryCategory;
};
type SearchDiscoveryFocusStatus = 'idle' | 'loading' | 'ready' | 'error';

function categoryDiscoveryStatus(
  snapshot: ReturnType<typeof wavenDiscoveryRuntime.getSearchDiscoveryCategoriesSessionSnapshot>,
): SearchDiscoveryStatus {
  if (!snapshot) return 'loading';
  return snapshot.errors.length > 0 && snapshot.categories.length === 0
    ? 'error'
    : 'ready';
}


function artistDiscoveryStatus(
  snapshot: ReturnType<typeof wavenDiscoveryRuntime.getArtistsToExploreSessionSnapshot>,
): SearchDiscoveryStatus {
  if (!snapshot) return 'loading';
  return snapshot.errors.length > 0 && snapshot.artists.length === 0
    ? 'error'
    : 'ready';
}

const SEARCH_DEBOUNCE_MS = 360;
const SEARCH_SUGGESTION_DEBOUNCE_MS = 170;
const SEARCH_RESULT_LIMIT = 12;
const SEARCH_DISCOVERY_LIMIT = 12;
const SEARCH_SUGGESTION_LIMIT = 6;
const SEARCH_DISCOVERY_GENRE_LIMIT = 8;
const SEARCH_DISCOVERY_MOOD_LIMIT = 6;

type CuratedDiscoveryDefinition = {
  aliases: readonly string[];
  artworkSource: ImageSourcePropType;
  title: string;
};

type CuratedDiscoveryCategory = CuratedDiscoveryDefinition & {
  category: WavenSearchDiscoveryCategory;
};


const SEARCH_DISCOVERY_GENRE_DEFINITIONS: readonly CuratedDiscoveryDefinition[] = [
  { title: 'Pop', aliases: ['pop'], artworkSource: require('../assets/discovery/pop.png') },
  { title: 'Hip-Hop', aliases: ['hip hop'], artworkSource: require('../assets/discovery/hip-hop.png') },
  {
    title: 'R&B & Soul',
    aliases: ['r&b & soul', 'r&b soul', 'r&b'],
    artworkSource: require('../assets/discovery/rnb-soul.png'),
  },
  { title: 'Rock', aliases: ['rock'], artworkSource: require('../assets/discovery/rock.png') },
  {
    title: 'Electronic',
    aliases: ['electronic', 'dance & electronic', 'electronic & dance'],
    artworkSource: require('../assets/discovery/electronic.png'),
  },
  {
    title: 'Indie / Alternative',
    aliases: ['indie & alternative', 'indie alternative', 'alternative', 'indie'],
    artworkSource: require('../assets/discovery/indie-alternative.png'),
  },
  { title: 'Jazz', aliases: ['jazz'], artworkSource: require('../assets/discovery/jazz.png') },
  {
    title: 'Classical',
    aliases: ['classical', 'classical music'],
    artworkSource: require('../assets/discovery/classical.png'),
  },
];

const SEARCH_DISCOVERY_MOOD_DEFINITIONS: readonly CuratedDiscoveryDefinition[] = [
  { title: 'Chill', aliases: ['chill'], artworkSource: require('../assets/discovery/chill.png') },
  { title: 'Focus', aliases: ['focus'], artworkSource: require('../assets/discovery/focus.png') },
  { title: 'Workout', aliases: ['workout'], artworkSource: require('../assets/discovery/workout.png') },
  {
    title: 'Feel Good',
    aliases: ['feel good', 'feel-good'],
    artworkSource: require('../assets/discovery/feel-good.png'),
  },
  { title: 'Party', aliases: ['party'], artworkSource: require('../assets/discovery/party.png') },
  { title: 'Sleep', aliases: ['sleep'], artworkSource: require('../assets/discovery/sleep.png') },
];

function normalizeDiscoveryLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9&+]+/g, ' ')
    .trim();
}

function curateDiscoveryCategories(
  categories: readonly WavenSearchDiscoveryCategory[],
  definitions: readonly CuratedDiscoveryDefinition[],
): CuratedDiscoveryCategory[] {
  const usedCategoryIds = new Set<string>();
  const curated: CuratedDiscoveryCategory[] = [];

  for (const definition of definitions) {
    const aliases = definition.aliases.map(normalizeDiscoveryLabel);
    const category = categories.find((candidate) => {
      if (usedCategoryIds.has(candidate.id)) return false;
      const normalizedTitle = normalizeDiscoveryLabel(candidate.title);
      return aliases.includes(normalizedTitle);
    });

    if (!category) continue;
    usedCategoryIds.add(category.id);
    curated.push({ ...definition, category });
  }

  return curated;
}

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

function searchScopeForDashboardType(
  type: MusicDashboardSection['type'],
): SearchScope {
  switch (type) {
    case 'artists':
      return 'Artists';
    case 'albums':
      return 'Albums';
    case 'playlists':
      return 'Playlists';
    case 'tracks':
    default:
      return 'Songs';
  }
}

function entityTitle(item: SearchEntity): string {
  return 'name' in item ? item.name : item.title;
}

function presentationKindForSearchScope(scope: SearchScope) {
  return scope === 'Songs' ? 'track' : scope === 'Artists' ? 'artist' : scope === 'Albums' ? 'album' : 'playlist';
}

function entityArtworkUrl(item: SearchEntity, scope: SearchScope): string | null {
  return wavenEntityArtworkUrl(readWavenPresentation(item, presentationKindForSearchScope(scope)));
}

function artistDisplayIdentity(value: unknown): string {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase();
}

function artistDisambiguationLabel(
  item: MusicArtist,
  siblings: readonly SearchEntity[],
): string {
  const nameKey = artistDisplayIdentity(item.name);
  const sameNameCount = siblings.filter(
    (candidate) => 'name' in candidate && artistDisplayIdentity(candidate.name) === nameKey,
  ).length;
  if (sameNameCount < 2) return '';

  // Provider identity remains authoritative internally, but opaque browse/profile
  // identifiers are not meaningful user-facing disambiguation. The shared
  // Artist contract currently exposes no trustworthy human-readable qualifier,
  // so show less rather than leaking an internal-looking ID fragment.
  return 'Artist';
}

function entitySubtitle(
  item: SearchEntity,
  scope: SearchScope,
  siblings: readonly SearchEntity[] = [],
): string {
  switch (scope) {
    case 'Songs': {
      const track = item as MusicTrack;
      return [track.artistName, track.albumTitle].filter(Boolean).join(' · ');
    }
    case 'Artists':
      return artistDisambiguationLabel(item as MusicArtist, siblings);
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

function detailRouteForSearchItem(
  item: SearchEntity,
  scope: SearchScope,
  returnToSearch = false,
) {
  const options = returnToSearch ? { returnTo: 'search' as const } : undefined;
  if (scope === 'Artists') return artistDetailRoute(item as MusicArtist, options);
  if (scope === 'Albums') return albumDetailRoute(item as MusicAlbum, options);
  return null;
}

function WavenSearchArtwork({
  circular = false,
  item,
  scope,
  size,
}: {
  circular?: boolean;
  item: SearchEntity;
  scope: SearchScope;
  size: number;
}) {
  const artworkUrl = entityArtworkUrl(item, scope);
  const radius = circular ? size / 2 : wavenRadii.sm;
  const artworkLease = useWavenArtworkLease({
    leaseKey: wavenArtworkLeaseKey(
      presentationKindForSearchScope(scope),
      item.source.provider,
      item.source.id,
    ),
    sourceKey: artworkUrl,
  });

  return (
    <View
      style={[
        styles.artworkClip,
        {
          borderRadius: radius,
          height: size,
          width: size,
        },
      ]}
    >
      {artworkLease.showFallback ? (
        <WavenArtworkFallback
          accessibilityLabel={`${entityTitle(item)} artwork`}
          seed={`search-result-${item.source.provider}-${item.source.id}`}
          size={size}
        />
      ) : null}
      {artworkLease.backupSourceKey ? (
        <Image
          accessible={false}
          resizeMethod="resize"
          resizeMode="cover"
          source={{ uri: artworkLease.backupSourceKey }}
          style={[
            styles.resultArtwork,
            {
              borderRadius: radius,
              height: size,
              left: 0,
              position: 'absolute',
              top: 0,
              width: size,
            },
          ]}
        />
      ) : null}
      {artworkUrl ? (
        <Image
          accessibilityLabel={`${entityTitle(item)} artwork`}
          key={artworkLease.imageKey}
          onError={artworkLease.onError}
          onLoad={artworkLease.onLoad}
          resizeMethod="resize"
          resizeMode="cover"
          source={{ uri: artworkUrl }}
          style={[
            styles.resultArtwork,
            {
              borderRadius: radius,
              height: size,
              left: 0,
              position: 'absolute',
              top: 0,
              width: size,
            },
          ]}
        />
      ) : null}
    </View>
  );
}


function WavenSearchDiscoveryDestinationCard({
  accessibilityLabel,
  accentColor,
  active = false,
  artworkSource,
  onPress,
  seed,
  title,
  width,
}: {
  accessibilityLabel: string;
  accentColor?: string | null;
  active?: boolean;
  artworkSource?: ImageSourcePropType | null;
  onPress: () => void;
  seed: string;
  title: string;
  width: number;
}) {
  const height = Math.round((width * 2) / 3);
  const sourceKey = artworkSource
    ? Image.resolveAssetSource(artworkSource)?.uri || String(artworkSource)
    : null;
  const artworkLease = useWavenArtworkLease({
    leaseKey: `bundled-discovery:${seed}`,
    sourceKey,
  });

  return (
    <WavenPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      containerStyle={{ width }}
      onPress={onPress}
      style={styles.discoveryDestinationTouchTarget}
    >
      <View
        style={[
          styles.discoveryDestinationCard,
          {
            backgroundColor: accentColor || wavenColors.surfaceRaised,
            height,
            width,
          },
          active ? styles.discoveryDestinationCardActive : null,
        ]}
      >
        {artworkLease.showFallback ? (
          <View
            accessible={false}
            style={[styles.discoveryDestinationFallback, { height, width }]}
          >
            <WavenArtworkFallback
              accessibilityLabel={`${title} WAVEN discovery artwork`}
              seed={seed}
              size={width}
            />
          </View>
        ) : null}
        {artworkSource ? (
          <Image
            accessibilityLabel={`${title} discovery artwork`}
            key={artworkLease.imageKey}
            onError={artworkLease.onError}
            onLoad={artworkLease.onLoad}
            resizeMethod="resize"
            resizeMode="cover"
            source={artworkSource}
            style={[styles.discoveryDestinationArtwork, { height, width }]}
          />
        ) : null}
        <View
          accessible={false}
          style={[styles.discoveryDestinationScrim, { height, width }]}
        />
        <Text numberOfLines={2} style={styles.discoveryDestinationTitle}>
          {title}
        </Text>
      </View>
    </WavenPressable>
  );
}


function WavenSearchDiscoveryRail({
  artworkSize,
  initialScrollX = 0,
  items,
  onHorizontalScroll,
  onOpenDetail,
  primaryHeading = false,
  scope,
  title,
}: {
  artworkSize: number;
  initialScrollX?: number;
  items: readonly SearchEntity[];
  onHorizontalScroll?: (scrollX: number) => void;
  onOpenDetail: (item: SearchEntity, scope: SearchScope) => void;
  primaryHeading?: boolean;
  scope: SearchScope;
  title: string;
}) {
  const railRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!items.length || initialScrollX <= 0) return;
    const frame = requestAnimationFrame(() => {
      railRef.current?.scrollTo({ x: initialScrollX, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialScrollX, items.length]);

  if (!items.length) return null;

  return (
    <View style={styles.discoverySection}>
      <View style={styles.discoverySectionHeader}>
        {primaryHeading ? (
          <WavenSectionTitle {...splitWavenSectionAccent(title)} />
        ) : (
          <Text style={styles.discoverySectionTitle}>{title}</Text>
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.discoveryRail}
        horizontal
        keyboardShouldPersistTaps="handled"
        onScroll={
          onHorizontalScroll
            ? (event) =>
                onHorizontalScroll(
                  Math.max(0, event.nativeEvent.contentOffset.x),
                )
            : undefined
        }
        ref={railRef}
        scrollEventThrottle={32}
        showsHorizontalScrollIndicator={false}
      >
        {items.map((item) => {
          const circular = scope === 'Artists';
          const detailRoute = detailRouteForSearchItem(item, scope);
          const subtitle = entitySubtitle(item, scope, items);
          const artworkVisual = (
            <WavenSearchArtwork
              circular={circular}
              item={item}
              scope={scope}
              size={artworkSize}
            />
          );
          const artwork = detailRoute ? (
            <WavenEntityRevealAnchor
              borderRadius={circular ? artworkSize / 2 : wavenRadii.sm}
              entityKey={wavenEntityRevealKey(
                scope === 'Artists' ? 'artist' : 'album',
                item.source.provider,
                item.source.id,
              )}
              role="origin"
              style={{ height: artworkSize, width: artworkSize }}
            >
              {artworkVisual}
            </WavenEntityRevealAnchor>
          ) : (
            artworkVisual
          );

          const tile = (
            <View style={[styles.discoveryTile, { width: artworkSize }]}>
              {artwork}
              <Text
                numberOfLines={2}
                style={[
                  styles.discoveryItemTitle,
                  circular ? styles.discoveryArtistTitle : null,
                ]}
              >
                {entityTitle(item)}
              </Text>
              {subtitle ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.discoveryItemSubtitle,
                    circular ? styles.discoveryArtistTitle : null,
                  ]}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          );

          if (!detailRoute) {
            return (
              <View
                accessibilityLabel={`${entityTitle(item)}${subtitle ? `. ${subtitle}` : ''}`}
                accessible
                key={`${scope}:${item.source.provider}:${item.source.id}`}
              >
                {tile}
              </View>
            );
          }

          return (
            <WavenPressable
              accessibilityLabel={`Open ${entityTitle(item)} ${scope === 'Artists' ? 'artist' : 'album'} details`}
              accessibilityRole="button"
              containerStyle={{ width: artworkSize }}
              key={`${scope}:${item.source.provider}:${item.source.id}`}
              onPress={() => onOpenDetail(item, scope)}
            >
              {tile}
            </WavenPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function WavenSearchScreen() {
  const connection = useWavenConnectivity();
  const router = useRouter();
  const layout = useWavenLayout();
  const reducedMotion = useWavenReducedMotion();
  const initialNavigationSnapshot = useRef(
    readWavenSearchNavigationSession(),
  ).current;
  const [query, setQuery] = useState(
    () => initialNavigationSnapshot?.query ?? '',
  );
  const [scope, setScope] = useState<SearchScope>(
    () => (initialNavigationSnapshot?.scope as SearchScope | undefined) ?? 'Songs',
  );
  const [status, setStatus] = useState<SearchStatus>(
    () => (initialNavigationSnapshot?.status as SearchStatus | undefined) ?? 'idle',
  );
  const [result, setResult] = useState<MusicSearchResult>(
    () => initialNavigationSnapshot?.result ?? emptySearchResult(),
  );
  const [providerErrors, setProviderErrors] = useState<readonly string[]>(
    () => initialNavigationSnapshot?.providerErrors ?? [],
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSequence = useRef(0);
  const completedQueryRef = useRef(initialNavigationSnapshot?.query.trim() ?? '');
  const scrollYRef = useRef(initialNavigationSnapshot?.scrollY ?? 0);
  const artistsToExploreXRef = useRef(initialNavigationSnapshot?.artistsToExploreX ?? 0);
  const navigationSnapshotRef = useRef<WavenSearchNavigationSnapshot | null>(
    initialNavigationSnapshot,
  );
  const skipNextSearchRequestRef = useRef(
    Boolean(initialNavigationSnapshot?.query.trim() && initialNavigationSnapshot.status !== 'loading'),
  );
  const skipNextSuggestionRequestRef = useRef(
    Boolean(initialNavigationSnapshot?.query.trim()),
  );
  const [scrollRestoreRequest, setScrollRestoreRequest] = useState(() => ({
    y: initialNavigationSnapshot?.scrollY ?? 0,
    token: 0,
  }));

  const initialCategorySnapshot = useRef(
    wavenDiscoveryRuntime.getSearchDiscoveryCategoriesSessionSnapshot(),
  ).current;
  const [discoveryRetryNonce, setDiscoveryRetryNonce] = useState(0);
  const [discoveryCategories, setDiscoveryCategories] = useState<
    readonly WavenSearchDiscoveryCategory[]
  >(() => initialCategorySnapshot?.categories ?? []);
  const [discoveryCategoryStatus, setDiscoveryCategoryStatus] =
    useState<SearchDiscoveryStatus>(() => categoryDiscoveryStatus(initialCategorySnapshot));
  const initialArtistsSnapshot = useRef(
    wavenDiscoveryRuntime.getArtistsToExploreSessionSnapshot(),
  ).current;
  const [artistsToExplore, setArtistsToExplore] = useState<readonly MusicArtist[]>(
    () => initialArtistsSnapshot?.artists ?? [],
  );
  const [artistDiscoveryStatusValue, setArtistDiscoveryStatusValue] =
    useState<SearchDiscoveryStatus>(() => artistDiscoveryStatus(initialArtistsSnapshot));
  const [selectedDiscovery, setSelectedDiscovery] =
    useState<SearchDiscoverySelection | null>(
      () => initialNavigationSnapshot?.selectedDiscovery ?? null,
    );
  const [focusedDiscoveryStatus, setFocusedDiscoveryStatus] =
    useState<SearchDiscoveryFocusStatus>(
      () =>
        (initialNavigationSnapshot?.focusedDiscoveryStatus as
          | SearchDiscoveryFocusStatus
          | undefined) ?? 'idle',
    );
  const [focusedDiscoverySections, setFocusedDiscoverySections] = useState<
    readonly MusicDashboardSection[]
  >(() => initialNavigationSnapshot?.focusedDiscoverySections ?? []);
  const [focusedDiscoveryErrors, setFocusedDiscoveryErrors] = useState<
    readonly string[]
  >(() => initialNavigationSnapshot?.focusedDiscoveryErrors ?? []);
  const [focusedDiscoveryRetryNonce, setFocusedDiscoveryRetryNonce] = useState(0);
  const lastCategoryRefresh = useRef(0);
  const lastArtistsRefresh = useRef(0);
  const lastFocusedRefresh = useRef(0);

  const [suggestions, setSuggestions] = useState<readonly string[]>(
    () => initialNavigationSnapshot?.suggestions ?? [],
  );
  const suggestionSequence = useRef(0);

  navigationSnapshotRef.current = {
    query,
    scope,
    status,
    result,
    providerErrors,
    suggestions,
    selectedDiscovery,
    focusedDiscoveryStatus,
    focusedDiscoverySections,
    focusedDiscoveryErrors,
    scrollY: scrollYRef.current,
    artistsToExploreX: artistsToExploreXRef.current,
  };

  const applySearchNavigationSnapshot = (
    snapshot: WavenSearchNavigationSnapshot,
  ) => {
    skipNextSearchRequestRef.current = Boolean(
      snapshot.query.trim() && snapshot.status !== 'loading',
    );
    skipNextSuggestionRequestRef.current = Boolean(snapshot.query.trim());
    scrollYRef.current = snapshot.scrollY;
    artistsToExploreXRef.current = snapshot.artistsToExploreX;
    setScrollRestoreRequest((current) => ({
      y: snapshot.scrollY,
      token: current.token + 1,
    }));
    setQuery(snapshot.query);
    setScope(snapshot.scope as SearchScope);
    setStatus(snapshot.status as SearchStatus);
    setResult(snapshot.result);
    setProviderErrors(snapshot.providerErrors);
    setSuggestions(snapshot.suggestions);
    setSelectedDiscovery(snapshot.selectedDiscovery as SearchDiscoverySelection | null);
    setFocusedDiscoveryStatus(
      snapshot.focusedDiscoveryStatus as SearchDiscoveryFocusStatus,
    );
    setFocusedDiscoverySections(snapshot.focusedDiscoverySections);
    setFocusedDiscoveryErrors(snapshot.focusedDiscoveryErrors);
    writeWavenSearchNavigationSession(snapshot);
  };

  const checkpointCurrentSearchState = (
    kind: 'semantic' | 'scope' = 'semantic',
  ) => {
    const snapshot = navigationSnapshotRef.current;
    if (!snapshot) return;
    pushWavenSearchNavigationCheckpoint(
      {
        ...snapshot,
        scrollY: scrollYRef.current,
        artistsToExploreX: artistsToExploreXRef.current,
      },
      kind,
    );
  };

  const handleQueryChange = (nextQuery: string) => {
    if (!query.trim() && nextQuery.trim()) checkpointCurrentSearchState();
    setQuery(nextQuery);
  };

  const handleScopeChange = (nextScope: SearchScope) => {
    if (nextScope === scope) return;
    checkpointCurrentSearchState('scope');
    setScope(nextScope);
  };

  const handleDiscoverySelection = (
    selection: SearchDiscoverySelection,
  ) => {
    checkpointCurrentSearchState();
    setSelectedDiscovery(selection);
  };

  const restorePreviousSearchState = (): boolean => {
    const previous = popWavenSearchNavigationCheckpoint();
    if (!previous) return false;
    applySearchNavigationSnapshot(previous);
    return true;
  };

  const handleSearchScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const scrollY = Math.max(0, event.nativeEvent.contentOffset.y);
    scrollYRef.current = scrollY;
    updateWavenSearchNavigationScroll(scrollY);
  };

  useEffect(() => {
    const snapshot = navigationSnapshotRef.current;
    if (snapshot) {
      writeWavenSearchNavigationSession({
        ...snapshot,
        scrollY: scrollYRef.current,
        artistsToExploreX: artistsToExploreXRef.current,
      });
    }
  }, [
    focusedDiscoveryErrors,
    focusedDiscoverySections,
    focusedDiscoveryStatus,
    providerErrors,
    query,
    result,
    scope,
    selectedDiscovery,
    suggestions,
    status,
  ]);

  useEffect(
    () => () => {
      const snapshot = navigationSnapshotRef.current;
      if (!snapshot) return;
      writeWavenSearchNavigationSession({
        ...snapshot,
        scrollY: scrollYRef.current,
        artistsToExploreX: artistsToExploreXRef.current,
      });
    },
    [],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (restorePreviousSearchState()) return true;

      const current = navigationSnapshotRef.current;
      if (!current) return false;
      if (!current.query.trim() && !current.selectedDiscovery) return false;

      const rootSnapshot: WavenSearchNavigationSnapshot = {
        ...current,
        query: '',
        scope: 'Songs',
        status: 'idle',
        result: emptySearchResult(),
        providerErrors: [],
        suggestions: [],
        selectedDiscovery: null,
        focusedDiscoveryStatus: 'idle',
        focusedDiscoverySections: [],
        focusedDiscoveryErrors: [],
        scrollY: 0,
        artistsToExploreX: 0,
      };
      applySearchNavigationSnapshot(rootSnapshot);
      return true;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const cached = wavenDiscoveryRuntime.getSearchDiscoveryCategoriesSessionSnapshot();
    const refresh = discoveryRetryNonce > lastCategoryRefresh.current;
    lastCategoryRefresh.current = discoveryRetryNonce;

    if (!connection.remoteReady) {
      offlineMetadata.enqueue('categories');
      setDiscoveryCategories(cached?.categories ?? []);
      setDiscoveryCategoryStatus(cached?.categories.length ? 'ready' : 'error');
      return () => controller.abort();
    }

    if (!refresh && cached) {
      setDiscoveryCategories(cached.categories);
      setDiscoveryCategoryStatus(categoryDiscoveryStatus(cached));
      return () => controller.abort();
    }

    setDiscoveryCategoryStatus('loading');

    wavenDiscoveryRuntime
      .getSearchDiscoveryCategories({ signal: controller.signal, refresh })
      .then((response) => {
        if (controller.signal.aborted || response.cancelled) return;
        setDiscoveryCategories(response.categories);
        setDiscoveryCategoryStatus(
          response.errors.length > 0 && response.categories.length === 0
            ? 'error'
            : 'ready',
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDiscoveryCategories([]);
        setDiscoveryCategoryStatus('error');
      });

    return () => controller.abort();
  }, [discoveryRetryNonce, connection.remoteReady, connection.recoveryEpoch]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = wavenDiscoveryRuntime.getArtistsToExploreSessionSnapshot();
    const refresh = discoveryRetryNonce > lastArtistsRefresh.current || wavenDiscoveryRuntime.getDiscoveryFreshnessHints().artistsRefreshRecommended;
    lastArtistsRefresh.current = discoveryRetryNonce;

    if (!connection.remoteReady) {
      offlineMetadata.enqueue('artists');
      setArtistsToExplore(cached?.artists ?? []);
      setArtistDiscoveryStatusValue(cached?.artists.length ? 'ready' : 'error');
      return () => controller.abort();
    }

    if (!refresh && cached) {
      setArtistsToExplore(cached.artists);
      setArtistDiscoveryStatusValue(artistDiscoveryStatus(cached));
      return () => controller.abort();
    }

    setArtistDiscoveryStatusValue('loading');

    wavenDiscoveryRuntime
      .getArtistsToExplore({ signal: controller.signal, refresh })
      .then((response) => {
        if (controller.signal.aborted || response.cancelled) return;
        setArtistsToExplore(response.artists);
        setArtistDiscoveryStatusValue(
          response.errors.length > 0 && response.artists.length === 0
            ? 'error'
            : 'ready',
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setArtistsToExplore([]);
        setArtistDiscoveryStatusValue('error');
      });

    return () => controller.abort();
  }, [discoveryRetryNonce, connection.remoteReady, connection.recoveryEpoch]);

  // Accepted recovery is observable before the entire global recovery pass ends.
  // Changing destination removes this listener; a prior path cannot replace it.
  useEffect(() => {
    if (!connection.active) return;
    return wavenDiscoveryRuntime.subscribeDiscovery(key => {
      if (key === 'categories') {
        const snapshot = wavenDiscoveryRuntime.getSearchDiscoveryCategoriesSessionSnapshot();
        if (snapshot) { setDiscoveryCategories(snapshot.categories); setDiscoveryCategoryStatus(categoryDiscoveryStatus(snapshot)); }
      }
      if (!selectedDiscovery || key !== `category:${selectedDiscovery.category.browseId}\0${selectedDiscovery.category.params}`) return;
      const snapshot = wavenDiscoveryRuntime.getSearchDiscoveryCategorySessionSnapshot(selectedDiscovery.category);
      if (!snapshot) return;
      setFocusedDiscoverySections(snapshot.result.sections);
      setFocusedDiscoveryErrors(snapshot.errors);
      setFocusedDiscoveryStatus(snapshot.errors.length && !snapshot.result.sections.length ? 'error' : 'ready');
    });
  }, [selectedDiscovery, connection.active]);

  useEffect(() => {
    if (!selectedDiscovery) {
      setFocusedDiscoveryStatus('idle');
      setFocusedDiscoverySections([]);
      setFocusedDiscoveryErrors([]);
      return;
    }

    const controller = new AbortController();
    const refresh = focusedDiscoveryRetryNonce > lastFocusedRefresh.current;
    lastFocusedRefresh.current = focusedDiscoveryRetryNonce;
    const cached =
      wavenDiscoveryRuntime.getSearchDiscoveryCategorySessionSnapshot(
        selectedDiscovery.category,
      );

    if (!connection.remoteReady) {
      offlineMetadata.enqueue(`category:${selectedDiscovery.category.browseId}\0${selectedDiscovery.category.params}`);
      setFocusedDiscoverySections(cached?.result.sections ?? []);
      setFocusedDiscoveryErrors(cached ? [] : ['Connect to load this collection. Your saved music is available in Library.']);
      setFocusedDiscoveryStatus(cached?.result.sections.length ? 'ready' : 'error');
      return () => controller.abort();
    }

    if (!refresh && cached) {
      setFocusedDiscoverySections(cached.result.sections);
      setFocusedDiscoveryErrors(cached.errors);
      setFocusedDiscoveryStatus(
        cached.errors.length > 0 && cached.result.sections.length === 0
          ? 'error'
          : 'ready',
      );
      return () => controller.abort();
    }

    setFocusedDiscoveryStatus(cached?.result.sections.length ? 'ready' : 'loading');
    setFocusedDiscoverySections(cached?.result.sections ?? []);
    setFocusedDiscoveryErrors([]);

    const request = wavenDiscoveryRuntime.getSearchDiscoveryCategory(
      selectedDiscovery.category,
      { signal: controller.signal, refresh },
    );

    request
      .then((response) => {
        if (controller.signal.aborted || response.cancelled) return;
        setFocusedDiscoverySections(response.result.sections);
        setFocusedDiscoveryErrors(response.errors);
        setFocusedDiscoveryStatus(
          response.errors.length > 0 && response.result.sections.length === 0
            ? 'error'
            : 'ready',
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFocusedDiscoverySections(cached?.result.sections ?? []);
        setFocusedDiscoveryErrors(['Discovery is unavailable right now.']);
        setFocusedDiscoveryStatus(cached?.result.sections.length ? 'ready' : 'error');
      });

    return () => controller.abort();
  }, [selectedDiscovery, focusedDiscoveryRetryNonce, connection.remoteReady, connection.recoveryEpoch]);

  useEffect(() => {
    if (query.trim().length > 0 && selectedDiscovery) {
      setSelectedDiscovery(null);
    }
  }, [query, selectedDiscovery]);

  useEffect(() => {
    const safeQuery = query.trim().slice(0, 120);
    const sequence = ++suggestionSequence.current;

    if (!connection.remoteReady) {
      if (safeQuery !== completedQueryRef.current) setSuggestions([]);
      skipNextSuggestionRequestRef.current = false;
      return;
    }

    if (skipNextSuggestionRequestRef.current) {
      skipNextSuggestionRequestRef.current = false;
      return;
    }

    if (safeQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setSuggestions([]);

    const debounceHandle = setTimeout(() => {
      wavenDiscoveryRuntime
        .getSuggestions(safeQuery, { signal: controller.signal })
        .then((response) => {
          if (
            controller.signal.aborted ||
            response.cancelled ||
            sequence !== suggestionSequence.current
          ) {
            return;
          }

          setSuggestions(response.suggestions.slice(0, SEARCH_SUGGESTION_LIMIT));
        })
        .catch(() => {
          if (
            controller.signal.aborted ||
            sequence !== suggestionSequence.current
          ) {
            return;
          }
          setSuggestions([]);
        });
    }, SEARCH_SUGGESTION_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceHandle);
      controller.abort();
    };
  }, [query, connection.remoteReady, connection.recoveryEpoch]);

  useEffect(() => {
    const safeQuery = query.trim().slice(0, 200);
    const sequence = ++requestSequence.current;

    if (!connection.remoteReady) {
      skipNextSearchRequestRef.current = false;
      if (safeQuery.length < 2) {
        setStatus('idle'); setResult(emptySearchResult()); setProviderErrors([]);
      } else if (safeQuery !== completedQueryRef.current) {
        setResult(emptySearchResult()); setStatus('error');
        setProviderErrors(['Search needs a connection. Your saved music is available in Library.']);
      } else {
        setStatus(current => current === 'loading' ? 'error' : current);
        setProviderErrors(['Showing your previous search. Connect to search again.']);
      }
      return;
    }

    if (skipNextSearchRequestRef.current) {
      skipNextSearchRequestRef.current = false;
      return;
    }

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
          completedQueryRef.current = safeQuery;
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
  }, [query, retryNonce, connection.remoteReady, connection.recoveryEpoch]);

  const scopedItems = useMemo(
    () => itemsForScope(result, scope).slice(0, SEARCH_RESULT_LIMIT),
    [result, scope],
  );

  const genreDiscoveryCategories = useMemo(
    () =>
      curateDiscoveryCategories(
        discoveryCategories.filter((category) =>
          category.group.toLowerCase().includes('genre'),
        ),
        SEARCH_DISCOVERY_GENRE_DEFINITIONS,
      ).slice(0, SEARCH_DISCOVERY_GENRE_LIMIT),
    [discoveryCategories],
  );

  const moodDiscoveryCategories = useMemo(
    () =>
      curateDiscoveryCategories(
        discoveryCategories.filter((category) => {
          const group = category.group.toLowerCase();
          return group.includes('mood') || group.includes('moment');
        }),
        SEARCH_DISCOVERY_MOOD_DEFINITIONS,
      ).slice(0, SEARCH_DISCOVERY_MOOD_LIMIT),
    [discoveryCategories],
  );

  const discoveryCardWidth = useMemo(() => {
    const contentWidth = Math.min(
      layout.width - layout.gutter * 2,
      layout.contentMaxWidth,
    );
    return Math.max(136, Math.floor((contentWidth - 12) / 2));
  }, [layout.contentMaxWidth, layout.gutter, layout.width]);

  const moodDiscoveryCardWidth = useMemo(
    () => Math.max(128, Math.min(156, Math.round(discoveryCardWidth * 0.9))),
    [discoveryCardWidth],
  );
  const artistDiscoveryArtworkSize = layout.isCompact ? 88 : 100;

  const focusedDiscoveryGroups = useMemo(
    () =>
      focusedDiscoverySections
        .map((section) => {
          const sectionScope = searchScopeForDashboardType(section.type);
          const rawTitle = String(section.title || '').trim();
          const safeTitle =
            !rawTitle || /youtube\s*music/i.test(rawTitle)
              ? sectionScope
              : rawTitle;
          return {
            items: section.items.slice(0, SEARCH_DISCOVERY_LIMIT) as SearchEntity[],
            scope: sectionScope,
            title: safeTitle,
          };
        })
        .filter((group) => group.items.length > 0),
    [focusedDiscoverySections],
  );

  const trimmedQuery = query.trim();
  const isDiscoveryMode = trimmedQuery.length === 0;
  const hasSearchableQuery = trimmedQuery.length >= 2;
  const discoveryArtworkSize = layout.isTabletLike
    ? 150
    : layout.isCompact
      ? 112
      : 126;

  const openDetail = async (item: SearchEntity, itemScope: SearchScope) => {
    const detailRoute = detailRouteForSearchItem(item, itemScope, true);
    if (!detailRoute) return;

    const snapshot = navigationSnapshotRef.current;
    if (snapshot) {
      writeWavenSearchNavigationSession({
        ...snapshot,
        scrollY: scrollYRef.current,
        artistsToExploreX: artistsToExploreXRef.current,
      });
    }

    if (itemScope === 'Artists') {
      void primeWavenArtistDetail(item as MusicArtist);
    } else if (itemScope === 'Albums') {
      void primeWavenAlbumDetail(item as MusicAlbum);
    }

    const presented = seedWavenPresentation(item, presentationKindForSearchScope(itemScope));
    const started = await beginWavenEntityReveal(
      {
        artworkUrl: entityArtworkUrl(presented, itemScope),
        entityKey: wavenEntityRevealKey(
          itemScope === 'Artists' ? 'artist' : 'album',
          presented.source.provider,
          presented.source.id,
        ),
        kind: itemScope === 'Artists'
          ? 'artist'
          : wavenReleaseRevealKind((presented as MusicAlbum).primaryType),
        title: entityTitle(presented),
      },
      () => router.push(detailRoute),
      { animate: !reducedMotion },
    );
    if (started) return;

    router.push(detailRoute);
  };

  return (
    <WavenAppShell
      initialScrollY={initialNavigationSnapshot?.scrollY ?? 0}
      scrollRestoreRequest={scrollRestoreRequest}
      onScroll={handleSearchScroll}
      scrollEventThrottle={32}
    >
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
            accessibilityLabel="Search songs, artists, albums, and playlists"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={handleQueryChange}
            placeholder="Search music"
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
              onPress={() => handleQueryChange('')}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          ) : null}
        </View>

        {isDiscoveryMode ? (
          <View style={styles.discoveryStage}>
            {!selectedDiscovery ? (
              <View style={styles.discoveryIntentSection}>
                {discoveryCategoryStatus === 'loading' ? (
                  <Text accessibilityLiveRegion="polite" style={styles.discoveryCategoryNote}>
                    Finding genres and moods…
                  </Text>
                ) : null}

                {discoveryCategoryStatus === 'error' ? (
                  <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                    <Text style={styles.stateTitle}>Discovery is taking a break</Text>
                    <Text style={styles.stateBody}>
                      Genre and mood paths are unavailable right now.
                    </Text>
                    <WavenPressable
                      accessibilityLabel="Retry Search discovery"
                      accessibilityRole="button"
                      onPress={() => setDiscoveryRetryNonce((value) => value + 1)}
                      style={styles.retryTouchTarget}
                    >
                      <View style={styles.retryAction}>
                        <Text style={styles.retryText}>Try Again</Text>
                      </View>
                    </WavenPressable>
                  </View>
                ) : null}

                {genreDiscoveryCategories.length > 0 ? (
                  <View style={styles.discoveryCategorySection}>
                    <WavenSectionTitle leading="Browse By" accent="Genre" />
                    <View style={styles.discoveryDestinationGrid}>
                      {genreDiscoveryCategories.map((entry) => (
                        <WavenSearchDiscoveryDestinationCard
                          accessibilityLabel={`Explore ${entry.title}`}
                          accentColor={entry.category.accentColor}
                          artworkSource={entry.artworkSource}
                          key={entry.category.id}
                          onPress={() =>
                            handleDiscoverySelection({
                              kind: 'category',
                              title: entry.title,
                              category: entry.category,
                            })
                          }
                          seed={`search-discovery-genre-${entry.title}`}
                          title={entry.title}
                          width={discoveryCardWidth}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {artistDiscoveryStatusValue === 'loading' ? (
                  <Text accessibilityLiveRegion="polite" style={styles.discoveryCategoryNote}>
                    Finding artists to explore…
                  </Text>
                ) : null}

                {artistsToExplore.length > 0 ? (
                  <WavenSearchDiscoveryRail
                    artworkSize={artistDiscoveryArtworkSize}
                    initialScrollX={artistsToExploreXRef.current}
                    items={artistsToExplore}
                    onHorizontalScroll={(scrollX) => {
                      artistsToExploreXRef.current = scrollX;
                      updateWavenSearchArtistsToExploreScroll(scrollX);
                    }}
                    onOpenDetail={(item, itemScope) => {
                      void openDetail(item, itemScope);
                    }}
                    primaryHeading
                    scope="Artists"
                    title="Artists to Explore"
                  />
                ) : null}

                {moodDiscoveryCategories.length > 0 ? (
                  <View style={styles.discoveryCategorySection}>
                    <WavenSectionTitle leading="Moods &" accent="Moments" />
                    <ScrollView
                      contentContainerStyle={styles.moodDiscoveryRail}
                      decelerationRate="fast"
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      snapToAlignment="start"
                      snapToInterval={moodDiscoveryCardWidth + 10}
                    >
                      {moodDiscoveryCategories.map((entry) => (
                        <WavenSearchDiscoveryDestinationCard
                          accessibilityLabel={`Explore ${entry.title}`}
                          accentColor={entry.category.accentColor}
                          artworkSource={entry.artworkSource}
                          key={entry.category.id}
                          onPress={() =>
                            handleDiscoverySelection({
                              kind: 'category',
                              title: entry.title,
                              category: entry.category,
                            })
                          }
                          seed={`search-discovery-mood-${entry.title}`}
                          title={entry.title}
                          width={moodDiscoveryCardWidth}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {discoveryCategoryStatus === 'ready' &&
                genreDiscoveryCategories.length === 0 &&
                artistsToExplore.length === 0 &&
                moodDiscoveryCategories.length === 0 ? (
                  <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                    <Text style={styles.stateTitle}>No browse paths right now</Text>
                    <Text style={styles.stateBody}>
                      Search is still ready whenever you are.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.focusedDiscoveryStage}>
                <View style={styles.focusedDiscoveryHeader}>
                  <View style={styles.focusedDiscoveryCopy}>
                    <Text style={styles.sectionLabel}>DISCOVERY</Text>
                    <WavenSectionTitle
                      {...splitWavenSectionAccent(selectedDiscovery.title)}
                      style={styles.discoveryTitle}
                    />
                  </View>
                  <WavenPressable
                    accessibilityLabel="Back to Search discovery"
                    accessibilityRole="button"
                    onPress={() => {
                      if (!restorePreviousSearchState()) setSelectedDiscovery(null);
                    }}
                    style={styles.discoveryBackTouchTarget}
                  >
                    <View style={styles.discoveryBackAction}>
                      <Text style={styles.discoveryBackText}>Back</Text>
                    </View>
                  </WavenPressable>
                </View>

                {focusedDiscoveryStatus === 'loading' ? (
                  <View
                    accessibilityLabel={`Opening ${selectedDiscovery.title}`}
                    accessibilityLiveRegion="polite"
                    style={styles.loadingState}
                  >
                    <ActivityIndicator
                      color={wavenColors.interactionBlue}
                      size="small"
                    />
                    <Text style={styles.loadingText}>Opening discovery</Text>
                  </View>
                ) : null}

                {focusedDiscoveryStatus === 'error' ? (
                  <View accessibilityLiveRegion="polite" style={styles.discoveryRecoveryNote}>
                    <Text style={styles.partialNote}>{selectedDiscovery.title} is temporarily unavailable.</Text>
                    <Text style={styles.stateBody}>
                      {connection.state === 'OFFLINE' ? 'Connect to load this collection. Saved music is available in Library.' : 'WAVEN will retry automatically. You can keep listening.'}
                    </Text>
                    <WavenPressable
                      accessibilityLabel={`Retry ${selectedDiscovery.title}`}
                      accessibilityRole="button"
                      onPress={() =>
                        setFocusedDiscoveryRetryNonce((value) => value + 1)
                      }
                      style={styles.retryTouchTarget}
                    >
                      <View style={styles.retryAction}>
                        <Text style={styles.retryText}>Try Again</Text>
                      </View>
                    </WavenPressable>
                  </View>
                ) : null}

                {focusedDiscoveryStatus === 'ready' &&
                focusedDiscoveryGroups.length === 0 ? (
                  <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                    <Text style={styles.stateTitle}>Nothing surfaced here yet</Text>
                    <Text style={styles.stateBody}>
                      Choose another discovery path or search directly.
                    </Text>
                  </View>
                ) : null}

                {focusedDiscoveryStatus === 'ready' &&
                focusedDiscoveryGroups.length > 0 ? (
                  <View style={styles.discoveryGroups}>
                    {focusedDiscoveryErrors.length > 0 ? (
                      <Text accessibilityLiveRegion="polite" style={styles.partialNote}>
                        Some discovery may be unavailable.
                      </Text>
                    ) : null}
                    {focusedDiscoveryGroups.map((group, index) => (
                      <WavenSearchDiscoveryRail
                        artworkSize={discoveryArtworkSize}
                        items={group.items}
                        key={`${selectedDiscovery.kind}:${group.title}:${index}`}
                        onOpenDetail={(item, itemScope) => {
                          void openDetail(item, itemScope);
                        }}
                        scope={group.scope}
                        title={group.title}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <>
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
                      onPress={() => handleScopeChange(item)}
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

            <View style={styles.queryState}>
              <Text style={styles.queryLabel}>YOUR SEARCH · {scope.toUpperCase()}</Text>
              <Text numberOfLines={2} style={styles.queryText}>“{query}”</Text>

              {hasSearchableQuery && suggestions.length > 0 ? (
                <View
                  accessibilityLabel="Search suggestions"
                  style={styles.suggestionsSection}
                >
                  <Text style={styles.suggestionsLabel}>SUGGESTIONS</Text>
                  <View style={styles.suggestionsList}>
                    {suggestions.map((suggestion) => (
                      <WavenPressable
                        accessibilityLabel={`Search for ${suggestion}`}
                        accessibilityRole="button"
                        key={suggestion}
                        onPress={() => handleQueryChange(suggestion)}
                        style={styles.suggestionTouchTarget}
                      >
                        <View style={styles.suggestionRow}>
                          <Text numberOfLines={1} style={styles.suggestionText}>
                            {suggestion}
                          </Text>
                          <Text accessible={false} style={styles.suggestionChevron}>
                            ›
                          </Text>
                        </View>
                      </WavenPressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {!hasSearchableQuery ? (
                <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                  <Text style={styles.stateTitle}>Keep typing</Text>
                  <Text style={styles.stateBody}>
                    Enter at least two characters to search.
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
                  <Text style={styles.loadingText}>Searching music</Text>
                </View>
              ) : null}

              {status === 'error' ? (
                <View accessibilityLiveRegion="polite" style={styles.stateCard}>
                  <Text style={styles.stateTitle}>Search is taking a break</Text>
                  <Text style={styles.stateBody}>
                    WAVEN could not complete this search right now.
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
                  </View>

                  {providerErrors.length > 0 ? (
                    <Text accessibilityLiveRegion="polite" style={styles.partialNote}>
                      Some results may be unavailable.
                    </Text>
                  ) : null}

                  <View style={styles.resultsList}>
                    {scopedItems.map((item) => {
                      const detailRoute = detailRouteForSearchItem(item, scope);
                      const circular = scope === 'Artists';
                      const subtitle = entitySubtitle(item, scope, scopedItems);
                      const song = scope === 'Songs';
                      const media = <>
                        {detailRoute ? (
                          <WavenEntityRevealAnchor
                            borderRadius={circular ? 29 : 10}
                            entityKey={wavenEntityRevealKey(
                              scope === 'Artists' ? 'artist' : 'album',
                              item.source.provider,
                              item.source.id,
                            )}
                            role="origin"
                            style={{ height: 58, width: 58 }}
                          >
                            <WavenSearchArtwork circular={circular} item={item} scope={scope} size={58} />
                          </WavenEntityRevealAnchor>
                        ) : <WavenSearchArtwork circular={circular} item={item} scope={scope} size={58} />}
                        <View style={styles.resultCopy}>
                          <Text numberOfLines={1} style={styles.resultTitle}>{entityTitle(item)}</Text>
                          {subtitle ? <Text numberOfLines={1} style={styles.resultSubtitle}>{subtitle}</Text> : null}
                        </View>
                      </>;
                      const row = (
                        <View style={styles.resultRow}>
                          {song ? (
                            <WavenTrackPlayTarget track={item as MusicTrack} containerStyle={styles.songResultMain} style={styles.songResultContent}>
                              {media}
                            </WavenTrackPlayTarget>
                          ) : media}
                          {detailRoute ? (
                            <Text accessible={false} style={styles.resultChevron}>
                              ›
                            </Text>
                          ) : null}
                          {scope === 'Songs' ? <WavenMusicLibraryActions kind="track" entity={item as MusicTrack} /> : null}
                        </View>
                      );

                      if (!detailRoute) {
                        return (
                          <View
                            accessibilityLabel={`${entityTitle(item)}${subtitle ? `. ${subtitle}` : ''}`}
                            accessible={scope !== 'Songs'}
                            key={`${item.source.provider}:${item.source.id}`}
                          >
                            {row}
                          </View>
                        );
                      }

                      return (
                        <WavenPressable
                          accessibilityLabel={`Open ${entityTitle(item)} ${scope === 'Artists' ? 'artist' : 'album'} details`}
                          accessibilityRole="button"
                          containerStyle={styles.resultPressable}
                          key={`${item.source.provider}:${item.source.id}`}
                          onPress={() => {
                            void openDetail(item, scope);
                          }}
                        >
                          {row}
                        </WavenPressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          </>
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
    fontFamily: wavenFonts.medium,
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
    justifyContent: 'center',
    minHeight: 38,
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
  discoveryStage: {
    paddingBottom: wavenSpacing.xl,
    paddingTop: wavenSpacing.lg,
  },
  discoveryHeading: {
    gap: 6,
  },
  discoveryTitle: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.title.fontSize,
    fontWeight: wavenTypography.title.fontWeight,
    lineHeight: wavenTypography.title.lineHeight,
  },
  discoveryIntentSection: {
    gap: wavenSpacing.lg,
  },
  discoveryCategorySection: {
    gap: 14,
  },
  discoveryRecoveryNote: {
    gap: wavenSpacing.xs,
    paddingVertical: wavenSpacing.sm,
  },
  discoveryCategoryTitle: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
  },
  discoveryDestinationGrid: {
    columnGap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  moodDiscoveryRail: {
    gap: 10,
    paddingRight: wavenSpacing.lg,
  },
  discoveryDestinationTouchTarget: {
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
  },
  discoveryDestinationCard: {
    borderColor: 'rgba(214, 224, 232, 0.12)',
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  discoveryDestinationCardActive: {
    borderColor: wavenColors.blueEdge,
  },
  discoveryDestinationArtwork: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  discoveryDestinationFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    opacity: 0.78,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  discoveryDestinationScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
    left: 0,
    position: 'absolute',
    top: 0,
  },
  discoveryDestinationTitle: {
    color: wavenColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    paddingBottom: 13,
    paddingHorizontal: 13,
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  discoveryCategoryNote: {
    color: wavenColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  focusedDiscoveryStage: {
    marginTop: wavenSpacing.lg,
  },
  focusedDiscoveryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  focusedDiscoveryCopy: {
    flex: 1,
    gap: 6,
  },
  discoveryBackTouchTarget: {
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
  },
  discoveryBackAction: {
    alignItems: 'center',
    backgroundColor: wavenColors.surfaceSoft,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 13,
  },
  discoveryBackText: {
    color: wavenColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  discoveryGroups: {
    marginTop: wavenSpacing.xl,
  },
  discoverySection: {
    marginTop: wavenSpacing.xl,
  },
  discoverySectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  discoverySectionTitle: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
  },
  discoveryRail: {
    gap: 14,
    paddingRight: wavenSpacing.md,
  },
  discoveryTile: {
    gap: 7,
  },
  discoveryItemTitle: {
    color: wavenColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 1,
  },
  discoveryItemSubtitle: {
    color: wavenColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  discoveryArtistTitle: {
    textAlign: 'center',
  },
  artworkClip: {
    backgroundColor: wavenColors.surfaceRaised,
    overflow: 'hidden',
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
  suggestionsSection: {
    marginTop: wavenSpacing.lg,
  },
  suggestionsLabel: {
    color: wavenColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  suggestionsList: {
    marginTop: 8,
  },
  suggestionTouchTarget: {
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
  },
  suggestionRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(214, 224, 232, 0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  suggestionText: {
    color: wavenColors.textSecondary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  suggestionChevron: {
    color: wavenColors.interactionBlue,
    fontSize: 22,
    marginLeft: 10,
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
  partialNote: {
    color: wavenColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  resultsList: {
    marginTop: 12,
  },
  resultRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(214, 224, 232, 0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  songResultMain: { flex: 1, minWidth: 0 },
  songResultContent: { flexDirection: 'row', alignItems: 'center', minHeight: 58 },
  resultArtwork: {
    backgroundColor: wavenColors.surfaceRaised,
  },
  resultPressable: {
    width: '100%',
  },
  resultChevron: {
    color: wavenColors.interactionBlue,
    fontSize: 28,
    fontWeight: '500',
    marginLeft: 10,
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
