import type { MusicDashboardSection, MusicSearchResult } from '../../domain/music';
import type { WavenSearchDiscoveryCategory } from '../discovery/wavenDiscoveryRuntime';

export type WavenSearchScope = 'Songs' | 'Artists' | 'Albums' | 'Playlists';
export type WavenSearchStatus = 'idle' | 'loading' | 'ready' | 'error';
export type WavenSearchDiscoveryFocusStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WavenSearchDiscoverySelection {
  kind: 'category';
  title: string;
  category: WavenSearchDiscoveryCategory;
}

export interface WavenSearchNavigationSnapshot {
  query: string;
  scope: WavenSearchScope;
  status: WavenSearchStatus;
  result: MusicSearchResult;
  providerErrors: readonly string[];
  suggestions: readonly string[];
  selectedDiscovery: WavenSearchDiscoverySelection | null;
  focusedDiscoveryStatus: WavenSearchDiscoveryFocusStatus;
  focusedDiscoverySections: readonly MusicDashboardSection[];
  focusedDiscoveryErrors: readonly string[];
  scrollY: number;
  artistsToExploreX: number;
}

const SEARCH_NAVIGATION_HISTORY_LIMIT = 16;
type SearchCheckpointKind = 'semantic' | 'scope';
interface SearchNavigationCheckpoint {
  kind: SearchCheckpointKind;
  snapshot: WavenSearchNavigationSnapshot;
}

let sessionSnapshot: WavenSearchNavigationSnapshot | null = null;
const backStack: SearchNavigationCheckpoint[] = [];

function boundedScrollY(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function cloneSnapshot(
  snapshot: WavenSearchNavigationSnapshot,
): WavenSearchNavigationSnapshot {
  return {
    ...snapshot,
    providerErrors: [...snapshot.providerErrors],
    suggestions: [...snapshot.suggestions],
    focusedDiscoverySections: [...snapshot.focusedDiscoverySections],
    focusedDiscoveryErrors: [...snapshot.focusedDiscoveryErrors],
    scrollY: boundedScrollY(snapshot.scrollY),
    artistsToExploreX: boundedScrollY(snapshot.artistsToExploreX),
  };
}

function semanticKey(snapshot: WavenSearchNavigationSnapshot): string {
  return [
    snapshot.query,
    snapshot.scope,
    snapshot.selectedDiscovery?.category.id || '',
    snapshot.selectedDiscovery?.category.params || '',
  ].join('\0');
}

function scopeContextKey(snapshot: WavenSearchNavigationSnapshot): string {
  return [
    snapshot.query,
    snapshot.selectedDiscovery?.category.id || '',
    snapshot.selectedDiscovery?.category.params || '',
  ].join('\0');
}

export function readWavenSearchNavigationSession(): WavenSearchNavigationSnapshot | null {
  return sessionSnapshot ? cloneSnapshot(sessionSnapshot) : null;
}

export function writeWavenSearchNavigationSession(
  snapshot: WavenSearchNavigationSnapshot,
): void {
  sessionSnapshot = cloneSnapshot(snapshot);
}

export function updateWavenSearchNavigationScroll(scrollY: number): void {
  if (!sessionSnapshot) return;
  sessionSnapshot = {
    ...sessionSnapshot,
    scrollY: boundedScrollY(scrollY),
  };
}

export function updateWavenSearchArtistsToExploreScroll(scrollX: number): void {
  if (!sessionSnapshot) return;
  sessionSnapshot = {
    ...sessionSnapshot,
    artistsToExploreX: boundedScrollY(scrollX),
  };
}

export function pushWavenSearchNavigationCheckpoint(
  snapshot: WavenSearchNavigationSnapshot,
  kind: SearchCheckpointKind = 'semantic',
): void {
  const next = cloneSnapshot(snapshot);
  const previous = backStack.at(-1);
  const coalescedScopeChange = Boolean(
    kind === 'scope' &&
      previous?.kind === 'scope' &&
      scopeContextKey(previous.snapshot) === scopeContextKey(next),
  );

  if (
    !coalescedScopeChange &&
    (!previous || semanticKey(previous.snapshot) !== semanticKey(next))
  ) {
    backStack.push({ kind, snapshot: next });
    if (backStack.length > SEARCH_NAVIGATION_HISTORY_LIMIT) backStack.shift();
  }
  sessionSnapshot = next;
}

export function popWavenSearchNavigationCheckpoint(): WavenSearchNavigationSnapshot | null {
  const previous = backStack.pop() ?? null;
  if (!previous) return null;
  sessionSnapshot = cloneSnapshot(previous.snapshot);
  return cloneSnapshot(previous.snapshot);
}

export function hasWavenSearchNavigationCheckpoint(): boolean {
  return backStack.length > 0;
}

export function clearWavenSearchNavigationHistory(): void {
  backStack.length = 0;
}
