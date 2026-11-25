import { wavenConnectivity } from '../../infrastructure/connectivity/connectivityService';
import { traceP8 } from '../../infrastructure/connectivity/phase8ValidationTrace';
import { offlineMetadata } from '../../infrastructure/connectivity/offlineMetadata';
import type {
  MusicAlbum,
  MusicAlbumDetail,
  MusicArtist,
  MusicArtistDetail,
  MusicDashboardProvider,
  MusicDashboardResult,
  MusicEntity,
  MusicMetadataProvider,
  MusicProviderDescriptor,
  MusicSearchResult,
} from '../../domain/music';
import { createSpotifyChartsDashboardProvider } from '../../infrastructure/music/providers/spotifyChartsDashboard';
import {
  createYouTubeMusicDashboardProvider,
  createYouTubeMusicMetadataProvider,
  createYouTubeMusicSearchDiscoveryProvider,
  readYouTubeMusicCatalogArtistHint,
  type WavenArtistPresentationProvider,
  type WavenSearchDiscoveryCategory,
  type WavenSearchDiscoveryProvider,
} from '../../infrastructure/music/providers/youtubeMusicMetadata';
import {
  canonicalizeWavenAlbumDetail,
  canonicalizeWavenArtistDetail,
  canonicalizeWavenDashboard,
  canonicalizeWavenSearchResult,
  readWavenPresentation,
  rememberWavenPresentation,
  wavenEntityArtworkUrl,
} from './wavenCanonicalPresentation';
import {
  queryMusicProviders,
  WavenProviderHealthBook,
  type WavenProviderQueryOptions,
} from './providerRequestBroker';

const EMPTY_SEARCH_RESULT: MusicSearchResult = {
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
  continuation: null,
};


const DISCOVERY_REFRESH_HINT_MS = 15 * 60 * 1_000;
const ARTISTS_TO_EXPLORE_LIMIT = 12;
const ARTIST_CANDIDATE_LIMIT = 18;

function refreshIsRecommended(capturedAt: number): boolean {
  return capturedAt > 0 && Date.now() - capturedAt >= DISCOVERY_REFRESH_HINT_MS;
}

function normalizeArtistIdentity(value: unknown): string {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\b(?:feat\.?|featuring)\b.*$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

interface ArtistCandidateEvidence {
  name: string;
  normalizedName: string;
  score: number;
  bestPosition: number;
  sourceHint: MusicArtist | null;
  evidenceTitles: readonly string[];
}

function normalizedDisplayIdentity(value: unknown): string {
  return String(value || '').normalize('NFKC').toLowerCase().trim();
}

function normalizedTitleIdentity(value: unknown): string {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function artistEntityKey(artist: MusicArtist): string {
  return `${artist.source.provider}\0${artist.source.id}`;
}

function artistArtwork(artist: MusicArtist | null | undefined): string | null {
  return wavenEntityArtworkUrl(artist);
}

function mergeArtistPresentation(
  identity: MusicArtist,
  presentation?: MusicArtist | null,
): MusicArtist {
  let merged = rememberWavenPresentation(identity, 'artist');
  if (
    presentation &&
    presentation.source.provider === identity.source.provider &&
    presentation.source.id === identity.source.id
  ) {
    merged = rememberWavenPresentation(presentation, 'artist');
  }
  return readWavenPresentation(merged, 'artist');
}

function collectArtistCandidates(
  trending: MusicDashboardResult,
  releases: MusicDashboardResult,
): ArtistCandidateEvidence[] {
  const scores = new Map<
    string,
    {
      name: string;
      score: number;
      bestPosition: number;
      sourceHint: MusicArtist | null;
      evidenceTitles: Set<string>;
    }
  >();

  const addEvidence = (
    item: MusicEntity,
    score: number,
    position: number,
  ) => {
    if (!("artistName" in item) || !item.artistName) return;
    const displayName = String(item.artistName).trim();
    const normalized = normalizeArtistIdentity(displayName);
    if (!displayName || !normalized || normalized === 'unknown artist') return;

    const sourceHint = readYouTubeMusicCatalogArtistHint(item);
    const title = 'title' in item ? normalizedTitleIdentity(item.title) : '';
    const existing = scores.get(normalized);
    if (!existing) {
      scores.set(normalized, {
        name: displayName,
        score,
        bestPosition: position,
        sourceHint,
        evidenceTitles: new Set(title ? [title] : []),
      });
      return;
    }

    existing.score += score;
    existing.bestPosition = Math.min(existing.bestPosition, position);
    if (!existing.sourceHint && sourceHint) existing.sourceHint = sourceHint;
    if (title) existing.evidenceTitles.add(title);
  };

  const trendingItems = trending.sections.flatMap((section) =>
    section.type === 'tracks' ? section.items : [],
  );
  trendingItems.forEach((item, index) => {
    addEvidence(item, Math.max(8, 48 - index), index);
  });

  const releaseItems = releases.sections.flatMap((section) =>
    section.type === 'albums' || section.type === 'tracks' ? section.items : [],
  );
  releaseItems.forEach((item, index) => {
    addEvidence(item, Math.max(6, 32 - index), index);
  });

  return [...scores.entries()]
    .sort(([leftKey, left], [rightKey, right]) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.bestPosition !== right.bestPosition) {
        return left.bestPosition - right.bestPosition;
      }
      return leftKey.localeCompare(rightKey);
    })
    .slice(0, ARTIST_CANDIDATE_LIMIT)
    .map(([normalizedName, candidate]) => ({
      name: candidate.name,
      normalizedName,
      score: candidate.score,
      bestPosition: candidate.bestPosition,
      sourceHint: candidate.sourceHint,
      evidenceTitles: [...candidate.evidenceTitles],
    }));
}

function resolveArtistCandidate(
  candidate: ArtistCandidateEvidence,
  result: MusicSearchResult,
): MusicArtist | null {
  if (candidate.sourceHint) {
    const canonical = result.artists.find(
      (artist) =>
        artist.source.provider === candidate.sourceHint?.source.provider &&
        artist.source.id === candidate.sourceHint?.source.id,
    );
    return mergeArtistPresentation(candidate.sourceHint, canonical);
  }

  // Display text is a query, never an identity. Resolve chart-derived names from
  // provider-linked track/album evidence and refuse to first-pick a homonym when
  // the provider cannot prove which Artist entity owns the evidence.
  const evidenceScores = new Map<
    string,
    { artist: MusicArtist; score: number; firstIndex: number }
  >();
  [...result.tracks, ...result.albums].forEach((item, index) => {
    if (normalizeArtistIdentity(item.artistName) !== candidate.normalizedName) {
      return;
    }
    const hint = readYouTubeMusicCatalogArtistHint(item);
    if (!hint) return;

    const key = `${hint.source.provider}\0${hint.source.id}`;
    const titleMatchesEvidence = candidate.evidenceTitles.includes(
      normalizedTitleIdentity(item.title),
    );
    const existing = evidenceScores.get(key);
    const evidenceScore = Math.max(1, 24 - index) + (titleMatchesEvidence ? 36 : 0);
    if (existing) {
      existing.score += evidenceScore;
      existing.firstIndex = Math.min(existing.firstIndex, index);
    } else {
      evidenceScores.set(key, { artist: hint, score: evidenceScore, firstIndex: index });
    }
  });

  const rankedEvidence = [...evidenceScores.entries()].sort(
    ([leftKey, left], [rightKey, right]) =>
      right.score - left.score ||
      left.firstIndex - right.firstIndex ||
      leftKey.localeCompare(rightKey),
  );
  const topEvidence = rankedEvidence[0];
  const secondEvidence = rankedEvidence[1];
  const evidenceIsDecisive = Boolean(
    topEvidence &&
      (!secondEvidence ||
        topEvidence[1].score >= secondEvidence[1].score + 12 ||
        topEvidence[1].score >= secondEvidence[1].score * 1.5),
  );

  if (topEvidence && evidenceIsDecisive) {
    const [evidenceId, evidence] = topEvidence;
    const canonical = result.artists.find(
      (artist) => `${artist.source.provider}\0${artist.source.id}` === evidenceId,
    );
    return mergeArtistPresentation(evidence.artist, canonical);
  }

  return null;
}

function rankSearchResultForQuery(
  result: MusicSearchResult,
  query: string,
): MusicSearchResult {
  const normalizedQuery = normalizeArtistIdentity(query);
  const displayQuery = normalizedDisplayIdentity(query);
  const normalizedQueryTitle = normalizedTitleIdentity(query);
  const artistEvidence = new Map<
    string,
    { artist: MusicArtist; score: number; firstIndex: number }
  >();

  [...result.tracks, ...result.albums].forEach((item, index) => {
    const hint = readYouTubeMusicCatalogArtistHint(item);
    if (!hint) return;
    const key = artistEntityKey(hint);
    const queryNameMatch = normalizeArtistIdentity(hint.name) === normalizedQuery;
    const existing = artistEvidence.get(key);
    const evidenceScore = Math.max(1, 28 - index) + (queryNameMatch ? 48 : 0);
    if (existing) {
      existing.artist = mergeArtistPresentation(existing.artist, hint);
      existing.score += evidenceScore;
      existing.firstIndex = Math.min(existing.firstIndex, index);
    } else {
      artistEvidence.set(key, {
        artist: hint,
        score: evidenceScore,
        firstIndex: index,
      });
    }
  });

  const artistByKey = new Map<string, MusicArtist>();
  result.artists.forEach((artist) => {
    const key = artistEntityKey(artist);
    const evidence = artistEvidence.get(key);
    artistByKey.set(
      key,
      evidence ? mergeArtistPresentation(evidence.artist, artist) : artist,
    );
  });

  // Cross-scope canonical evidence is allowed to enrich Artist Search. This is
  // deliberately identity-based, not a text-only promotion: a Track/Album must
  // carry a provider Artist browse identity, and only exact normalized query
  // names are promoted into the Artist result set.
  for (const [key, evidence] of artistEvidence) {
    if (normalizeArtistIdentity(evidence.artist.name) !== normalizedQuery) continue;
    const existing = artistByKey.get(key);
    artistByKey.set(
      key,
      existing
        ? mergeArtistPresentation(evidence.artist, existing)
        : evidence.artist,
    );
  }

  const artists = [...artistByKey.values()]
    .map((artist, index) => {
      const key = artistEntityKey(artist);
      const normalizedName = normalizeArtistIdentity(artist.name);
      let score = artistEvidence.get(key)?.score ?? 0;
      if (normalizedName === normalizedQuery) score += 90;
      if (normalizedDisplayIdentity(artist.name) === displayQuery) score += 24;
      if (normalizedName.startsWith(normalizedQuery) && normalizedQuery) score += 8;
      score -= index * 0.01;
      return { artist, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ artist }) => artist);

  const exactArtistEvidence = new Map<string, number>();
  for (const [key, evidence] of artistEvidence) {
    if (normalizeArtistIdentity(evidence.artist.name) === normalizedQuery) {
      exactArtistEvidence.set(key, evidence.score);
    }
  }
  const hasStrongArtistIntent = exactArtistEvidence.size > 0;

  const tracks = result.tracks
    .map((track, index) => {
      let score = 0;
      const hint = readYouTubeMusicCatalogArtistHint(track);
      const hintEvidence = hint
        ? exactArtistEvidence.get(artistEntityKey(hint)) ?? 0
        : 0;
      if (hintEvidence > 0) score += 64 + Math.min(36, hintEvidence);
      if (normalizeArtistIdentity(track.artistName) === normalizedQuery) score += 48;
      if (normalizedTitleIdentity(track.title) === normalizedQueryTitle) {
        score += hasStrongArtistIntent ? 42 : 64;
      }
      score -= index * 0.01;
      return { track, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ track }) => track);

  const albums = result.albums
    .map((album, index) => {
      let score = 0;
      const hint = readYouTubeMusicCatalogArtistHint(album);
      const hintEvidence = hint
        ? exactArtistEvidence.get(artistEntityKey(hint)) ?? 0
        : 0;
      if (hintEvidence > 0) score += 72 + Math.min(32, hintEvidence);
      if (normalizeArtistIdentity(album.artistName) === normalizedQuery) score += 48;
      if (normalizedTitleIdentity(album.title) === normalizedQueryTitle) {
        score += hasStrongArtistIntent ? 36 : 58;
      }
      score -= index * 0.01;
      return { album, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ album }) => album);

  return { ...result, tracks, artists, albums };
}

function entityKey(item: MusicEntity): string {
  return `${item.source.provider}\0${item.source.id}`;
}

function mergeEntities<T extends MusicEntity>(
  groups: readonly (readonly T[])[],
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const group of groups) {
    for (const item of group) {
      const key = entityKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

function mergeSearchResults(
  results: readonly MusicSearchResult[],
): MusicSearchResult {
  return canonicalizeWavenSearchResult({
    tracks: mergeEntities(results.map((result) => result.tracks)),
    artists: mergeEntities(results.map((result) => result.artists)),
    albums: mergeEntities(results.map((result) => result.albums)),
    playlists: mergeEntities(results.map((result) => result.playlists)),
    continuation:
      results.map((result) => result.continuation).find(Boolean) ?? null,
  });
}

export interface WavenDiscoverySearchResponse {
  result: MusicSearchResult;
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenDiscoveryDashboardResponse {
  result: MusicDashboardResult;
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenArtistDetailResponse {
  detail: MusicArtistDetail | null;
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenAlbumDetailResponse {
  detail: MusicAlbumDetail | null;
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenSearchQueryOptions extends WavenProviderQueryOptions {
  enrichArtistPresentation?: boolean;
}

export interface WavenDashboardQueryOptions extends WavenProviderQueryOptions {
  refresh?: boolean;
}

export interface WavenSearchDiscoveryQueryOptions extends WavenProviderQueryOptions {
  refresh?: boolean;
}

export interface WavenDiscoverySuggestionsResponse {
  suggestions: readonly string[];
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenSearchDiscoveryCategoriesResponse {
  categories: readonly WavenSearchDiscoveryCategory[];
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenSearchDiscoveryBrowseResponse {
  result: MusicDashboardResult;
  errors: readonly string[];
  cancelled: boolean;
}

export interface WavenArtistsToExploreResponse {
  artists: readonly MusicArtist[];
  errors: readonly string[];
  cancelled: boolean;
}

export type { WavenSearchDiscoveryCategory };

export class WavenDiscoveryRuntime {
  private discoveryListeners = new Set<(key: string) => void>();
  subscribeDiscovery = (listener: (key: string) => void) => { this.discoveryListeners.add(listener); return () => { this.discoveryListeners.delete(listener); }; };
  protected publishDiscovery(key: string) { this.discoveryListeners.forEach(listener => listener(key)); }
  private readonly healthBook = new WavenProviderHealthBook();
  private dashboardSessionCache: WavenDiscoveryDashboardResponse | null = null;
  private searchDiscoveryCategoriesSessionCache: WavenSearchDiscoveryCategoriesResponse | null = null;
  private readonly searchCategorySessionCache = new Map<string, WavenSearchDiscoveryBrowseResponse>();
  private readonly categoryGenerations = new Map<string, number>();
  private searchNewReleasesSessionCache: WavenSearchDiscoveryBrowseResponse | null = null;
  private searchNewReleasesSessionCapturedAt = 0;
  private searchNewReleasesGeneration = 0;
  private searchGlobalChartsSessionCache: WavenSearchDiscoveryBrowseResponse | null = null;
  private searchGlobalChartsSessionCapturedAt = 0;
  private searchGlobalChartsGeneration = 0;
  private artistsToExploreSessionCache: WavenArtistsToExploreResponse | null = null;
  private artistsToExploreSessionCapturedAt = 0;
  private artistsToExploreGeneration = 0;

  constructor(
    private readonly metadataProviders: readonly MusicMetadataProvider<AbortSignal>[],
    private readonly dashboardProviders: readonly MusicDashboardProvider<AbortSignal>[],
    private readonly searchDiscoveryProviders: readonly WavenSearchDiscoveryProvider[] = [],
  ) {}

  getDashboardSessionSnapshot(): WavenDiscoveryDashboardResponse | null {
    return this.dashboardSessionCache;
  }

  getSearchDiscoveryCategoriesSessionSnapshot(): WavenSearchDiscoveryCategoriesResponse | null {
    return this.searchDiscoveryCategoriesSessionCache;
  }

  getSearchDiscoveryCategorySessionSnapshot(
    category: WavenSearchDiscoveryCategory,
  ): WavenSearchDiscoveryBrowseResponse | null {
    return this.searchCategorySessionCache.get(`${category.browseId}\0${category.params}`) ?? null;
  }

  getSearchNewReleasesSessionSnapshot(): WavenSearchDiscoveryBrowseResponse | null {
    return this.searchNewReleasesSessionCache;
  }

  getSearchGlobalChartsSessionSnapshot(): WavenSearchDiscoveryBrowseResponse | null {
    return this.searchGlobalChartsSessionCache;
  }

  getArtistsToExploreSessionSnapshot(): WavenArtistsToExploreResponse | null {
    return this.artistsToExploreSessionCache;
  }

  getDiscoveryFreshnessHints(): {
    newReleasesRefreshRecommended: boolean;
    globalChartsRefreshRecommended: boolean;
    artistsRefreshRecommended: boolean;
  } {
    return {
      newReleasesRefreshRecommended: refreshIsRecommended(
        this.searchNewReleasesSessionCapturedAt,
      ),
      globalChartsRefreshRecommended: refreshIsRecommended(
        this.searchGlobalChartsSessionCapturedAt,
      ),
      artistsRefreshRecommended: refreshIsRecommended(
        this.artistsToExploreSessionCapturedAt,
      ),
    };
  }

  getProviderDescriptors(): readonly MusicProviderDescriptor[] {
    return [
      ...this.metadataProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        pluginId: null,
        capabilities: provider.capabilities ?? [],
        firstParty: true,
        requiresConfiguration: false,
        configured: true,
        pairedStreamingProviderId: null,
        health: this.healthBook.snapshot(provider.id),
      })),
      ...this.dashboardProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        pluginId: null,
        capabilities: provider.capabilities ?? [],
        firstParty: true,
        requiresConfiguration: false,
        configured: true,
        pairedStreamingProviderId: null,
        health: this.healthBook.snapshot(provider.id),
      })),
    ];
  }

  async search(
    query: string,
    options: WavenSearchQueryOptions = {},
  ): Promise<WavenDiscoverySearchResponse> {
    const { enrichArtistPresentation = true, ...providerOptions } = options;
    const safeQuery = String(query || '').trim().slice(0, 200);
    if (!safeQuery) {
      return {
        result: EMPTY_SEARCH_RESULT,
        errors: [],
        cancelled: false,
      };
    }

    const response = await queryMusicProviders(
      this.metadataProviders,
      this.healthBook,
      (provider, signal) => provider.search(safeQuery, { signal }),
      { ...providerOptions, timeoutMs: providerOptions.timeoutMs ?? 10_000 },
    );

    const mergedResult = mergeSearchResults(
      response.results.map((entry) => entry.value),
    );
    const rankedResult = rankSearchResultForQuery(mergedResult, safeQuery);
    const normalizedQuery = normalizeArtistIdentity(safeQuery);
    const exactArtistsNeedingPresentation = rankedResult.artists
      .filter(
        (artist) =>
          normalizeArtistIdentity(artist.name) === normalizedQuery &&
          !artistArtwork(artist),
      )
      .slice(0, 3);

    let result = rankedResult;
    if (
      enrichArtistPresentation &&
      exactArtistsNeedingPresentation.length &&
      !providerOptions.signal?.aborted
    ) {
      const enrichedExactArtists = await this.enrichArtistPresentations(
        exactArtistsNeedingPresentation,
        providerOptions,
        3,
      );
      const presentationByKey = new Map(
        enrichedExactArtists.map((artist) => [artistEntityKey(artist), artist]),
      );
      result = {
        ...rankedResult,
        artists: rankedResult.artists.map((artist) =>
          mergeArtistPresentation(
            artist,
            presentationByKey.get(artistEntityKey(artist)),
          ),
        ),
      };
    }

    return {
      result: canonicalizeWavenSearchResult(result),
      errors: response.errors,
      cancelled: response.cancelled,
    };
  }

  async getSuggestions(
    query: string,
    options: WavenProviderQueryOptions = {},
  ): Promise<WavenDiscoverySuggestionsResponse> {
    const safeQuery = String(query || '').trim().slice(0, 120);
    if (safeQuery.length < 2) {
      return {
        suggestions: [],
        errors: [],
        cancelled: false,
      };
    }

    const providers = this.metadataProviders.filter(
      (provider) => typeof provider.getSuggestions === 'function',
    );

    const response = await queryMusicProviders(
      providers,
      this.healthBook,
      (provider, signal) =>
        provider.getSuggestions!(safeQuery, { signal }),
      { ...options, timeoutMs: options.timeoutMs ?? 6_000 },
    );

    return {
      suggestions: [
        ...new Set(
          response.results.flatMap((entry) => entry.value),
        ),
      ].slice(0, 10),
      errors: response.errors,
      cancelled: response.cancelled,
    };
  }

  async getSearchDiscoveryCategories(
    options: WavenSearchDiscoveryQueryOptions = {},
  ): Promise<WavenSearchDiscoveryCategoriesResponse> {
    const { refresh = false, ...queryOptions } = options;
    if (!refresh && this.searchDiscoveryCategoriesSessionCache && !queryOptions.signal?.aborted) {
      return this.searchDiscoveryCategoriesSessionCache;
    }

    const response = await queryMusicProviders(
      this.searchDiscoveryProviders,
      this.healthBook,
      (provider, signal) => provider.getCategories({ signal }),
      { ...queryOptions, capability: 'discovery:categories', timeoutMs: queryOptions.timeoutMs ?? 10_000 },
    );

    const seen = new Set<string>();
    const categories = response.results.flatMap((entry) =>
      entry.value.filter((category) => {
        const key = `${category.browseId}\0${category.params}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );

    const result: WavenSearchDiscoveryCategoriesResponse = {
      categories,
      errors: response.errors,
      cancelled: response.cancelled,
    };

    if (!result.cancelled && categories.length > 0) {
      this.searchDiscoveryCategoriesSessionCache = result;
      this.publishDiscovery('categories');
    }

    return result;
  }

  async getSearchDiscoveryCategory(
    category: WavenSearchDiscoveryCategory,
    options: WavenSearchDiscoveryQueryOptions = {},
  ): Promise<WavenSearchDiscoveryBrowseResponse> {
    const { refresh = false, ...queryOptions } = options;
    const cacheKey = `${category.browseId}\0${category.params}`;
    const cached = this.searchCategorySessionCache.get(cacheKey);
    if (!refresh && cached && !queryOptions.signal?.aborted) {
      traceP8('category', 'cache', 0, cached.result.sections.length);
      return cached;
    }

    const categoryStartedAt = Date.now();
    const generation = (this.categoryGenerations.get(cacheKey) ?? 0) + 1;
    this.categoryGenerations.set(cacheKey, generation);
    traceP8('category', 'begin');
    const response = await queryMusicProviders(
      this.searchDiscoveryProviders,
      this.healthBook,
      (provider, signal) => provider.getCategory(category, { signal }),
      { ...queryOptions, capability: `discovery:category:${category.browseId}\0${category.params}`, isCurrent: () => generation === this.categoryGenerations.get(cacheKey), timeoutMs: queryOptions.timeoutMs ?? 12_000 },
    );

    const result: WavenSearchDiscoveryBrowseResponse = {
      result: canonicalizeWavenDashboard({
        sections: response.results.flatMap((entry) => entry.value.sections),
      }),
      errors: response.errors,
      cancelled: response.cancelled,
    };

    traceP8('category', result.cancelled ? 'cancelled' : result.errors.length ? 'failed' : result.result.sections.length ? 'ready' : 'empty', Date.now() - categoryStartedAt, result.result.sections.reduce((sum, section) => sum + section.items.length, 0));
    if (generation !== this.categoryGenerations.get(cacheKey)) return { result: { sections: [] }, errors: [], cancelled: true };
    if (!result.cancelled && result.result.sections.length > 0) {
      this.searchCategorySessionCache.set(cacheKey, result);
      this.publishDiscovery(`category:${cacheKey}`);
    } else if (!result.cancelled && !result.errors.length) {
      this.searchCategorySessionCache.set(cacheKey, cached ? { ...cached, errors: [] } : result);
      this.publishDiscovery(`category:${cacheKey}`);
    }

    return result;
  }

  async getSearchNewReleases(
    options: WavenSearchDiscoveryQueryOptions = {},
  ): Promise<WavenSearchDiscoveryBrowseResponse> {
    const { refresh = false, ...queryOptions } = options;
    if (
      !refresh &&
      this.searchNewReleasesSessionCache &&
      !queryOptions.signal?.aborted
    ) {
      traceP8('new_releases', 'cache', 0, this.searchNewReleasesSessionCache.result.sections.length);
      return this.searchNewReleasesSessionCache;
    }

    const requestGeneration = ++this.searchNewReleasesGeneration;

    const releaseStartedAt = Date.now();
    traceP8('new_releases', 'begin');
    const response = await queryMusicProviders(
      this.searchDiscoveryProviders,
      this.healthBook,
      (provider, signal) => provider.getNewReleases({ signal }),
      { ...queryOptions, capability: 'discovery:new-releases', isCurrent: () => requestGeneration === this.searchNewReleasesGeneration, timeoutMs: queryOptions.timeoutMs ?? 12_000 },
    );

    const result: WavenSearchDiscoveryBrowseResponse = {
      result: canonicalizeWavenDashboard({
        sections: response.results.flatMap((entry) => entry.value.sections),
      }),
      errors: response.errors,
      cancelled: response.cancelled,
    };

    traceP8('new_releases', result.cancelled ? 'cancelled' : result.errors.length > 0 ? 'failed' : result.result.sections.length > 0 ? 'ready' : 'empty', Date.now() - releaseStartedAt, result.result.sections.reduce((sum, section) => sum + section.items.length, 0));
    traceP8('new_releases', 'error_count', 0, result.errors.length);
    if (requestGeneration !== this.searchNewReleasesGeneration) {
      return (
        {
          result: { sections: [] },
          errors: [],
          cancelled: true,
        }
      );
    }

    if (
      !refresh &&
      this.searchNewReleasesSessionCache &&
      !queryOptions.signal?.aborted
    ) {
      return this.searchNewReleasesSessionCache;
    }

    if (!result.cancelled && result.result.sections.length > 0) {
      this.searchNewReleasesSessionCache = result;
      this.searchNewReleasesSessionCapturedAt = Date.now();
      this.artistsToExploreSessionCache = null;
      this.artistsToExploreSessionCapturedAt = 0;
      this.artistsToExploreGeneration += 1;
      this.publishDiscovery('home-releases');
    } else if (!result.cancelled && !result.errors.length) {
      this.searchNewReleasesSessionCache = this.searchNewReleasesSessionCache
        ? { ...this.searchNewReleasesSessionCache, errors: [] } : result;
      this.searchNewReleasesSessionCapturedAt = Date.now();
      this.publishDiscovery('home-releases');
    }

    return result;
  }

  async getSearchGlobalCharts(
    options: WavenSearchDiscoveryQueryOptions = {},
  ): Promise<WavenSearchDiscoveryBrowseResponse> {
    const { refresh = false, ...queryOptions } = options;
    if (
      !refresh &&
      this.searchGlobalChartsSessionCache &&
      !queryOptions.signal?.aborted
    ) {
      return this.searchGlobalChartsSessionCache;
    }

    const requestGeneration = ++this.searchGlobalChartsGeneration;

    const providers = this.dashboardProviders.filter(
      (provider) => provider.id === 'spotify-charts-dashboard',
    );
    const response = await queryMusicProviders(
      providers,
      this.healthBook,
      (provider, signal) => provider.getDashboard({ signal }),
      { ...queryOptions, timeoutMs: queryOptions.timeoutMs ?? 12_000 },
    );

    const result: WavenSearchDiscoveryBrowseResponse = {
      result: canonicalizeWavenDashboard({
        sections: response.results.flatMap((entry) => entry.value.sections),
      }),
      errors: response.errors,
      cancelled: response.cancelled,
    };

    if (requestGeneration !== this.searchGlobalChartsGeneration) {
      return (
        {
          result: { sections: [] },
          errors: [],
          cancelled: true,
        }
      );
    }

    if (
      !refresh &&
      this.searchGlobalChartsSessionCache &&
      !queryOptions.signal?.aborted
    ) {
      return this.searchGlobalChartsSessionCache;
    }

    if (!result.cancelled && result.result.sections.length > 0) {
      this.searchGlobalChartsSessionCache = result;
      this.publishDiscovery('home-charts');
      this.searchGlobalChartsSessionCapturedAt = Date.now();
      this.artistsToExploreSessionCache = null;
      this.artistsToExploreSessionCapturedAt = 0;
      this.artistsToExploreGeneration += 1;
    }

    return result;
  }

  async getArtistsToExplore(
    options: WavenSearchDiscoveryQueryOptions = {},
  ): Promise<WavenArtistsToExploreResponse> {
    const { refresh = false, ...queryOptions } = options;
    if (
      !refresh &&
      this.artistsToExploreSessionCache &&
      !queryOptions.signal?.aborted
    ) {
      return this.artistsToExploreSessionCache;
    }

    const [trendingResponse, releaseResponse] = await Promise.all([
      this.getSearchGlobalCharts({ ...queryOptions, refresh }),
      this.getSearchNewReleases({ ...queryOptions, refresh }),
    ]);

    if (
      queryOptions.signal?.aborted ||
      trendingResponse.cancelled ||
      releaseResponse.cancelled
    ) {
      return {
        artists: [],
        errors: [],
        cancelled: true,
      };
    }

    const requestGeneration = refresh
      ? ++this.artistsToExploreGeneration
      : this.artistsToExploreGeneration;

    if (
      !refresh &&
      this.artistsToExploreSessionCache &&
      !queryOptions.signal?.aborted
    ) {
      return this.artistsToExploreSessionCache;
    }

    const artistCandidates = collectArtistCandidates(
      trendingResponse.result,
      releaseResponse.result,
    );

    const artistLookups = await Promise.allSettled(
      artistCandidates.map(async (candidate) => {
        const response = await this.search(candidate.name, {
          ...queryOptions,
          enrichArtistPresentation: false,
          timeoutMs: Math.min(queryOptions.timeoutMs ?? 6_000, 6_000),
        });
        if (response.cancelled) return null;
        return resolveArtistCandidate(candidate, response.result);
      }),
    );

    if (requestGeneration !== this.artistsToExploreGeneration) {
      return (
        this.artistsToExploreSessionCache ?? {
          artists: [],
          errors: [],
          cancelled: true,
        }
      );
    }

    if (
      !refresh &&
      this.artistsToExploreSessionCache &&
      !queryOptions.signal?.aborted
    ) {
      return this.artistsToExploreSessionCache;
    }

    const errors = [
      ...trendingResponse.errors,
      ...releaseResponse.errors,
    ];
    const seenArtistKeys = new Set<string>();
    const artists: MusicArtist[] = [];

    for (const lookup of artistLookups) {
      if (lookup.status === 'rejected') {
        errors.push('Some artist discovery is unavailable.');
        continue;
      }

      const artist = lookup.value;
      if (!artist) continue;
      const key = entityKey(artist);
      const normalizedName = normalizeArtistIdentity(artist.name);
      if (!normalizedName || seenArtistKeys.has(key)) {
        continue;
      }
      seenArtistKeys.add(key);
      artists.push(artist);
      if (artists.length >= ARTISTS_TO_EXPLORE_LIMIT) break;
    }

    if (artists.length < ARTISTS_TO_EXPLORE_LIMIT && !queryOptions.signal?.aborted) {
      const fallbackQueries = ['top music artists', 'top artists'];
      for (const query of fallbackQueries) {
        if (artists.length >= ARTISTS_TO_EXPLORE_LIMIT) break;
        const response = await this.search(query, {
          ...queryOptions,
          timeoutMs: Math.min(queryOptions.timeoutMs ?? 6_000, 6_000),
        });
        if (response.cancelled) {
          return { artists: [], errors, cancelled: true };
        }
        errors.push(...response.errors);

        for (const artist of response.result.artists) {
          const normalizedName = normalizeArtistIdentity(artist.name);
          const key = entityKey(artist);
          if (!normalizedName || seenArtistKeys.has(key)) {
            continue;
          }
          seenArtistKeys.add(key);
          artists.push(artist);
          if (artists.length >= ARTISTS_TO_EXPLORE_LIMIT) break;
        }
      }
    }

    if (requestGeneration !== this.artistsToExploreGeneration) {
      return (
        this.artistsToExploreSessionCache ?? {
          artists: [],
          errors: [],
          cancelled: true,
        }
      );
    }

    const enrichedArtists = await this.enrichArtistPresentations(
      artists,
      queryOptions,
      ARTISTS_TO_EXPLORE_LIMIT,
    );

    if (
      queryOptions.signal?.aborted ||
      requestGeneration !== this.artistsToExploreGeneration
    ) {
      return (
        this.artistsToExploreSessionCache ?? {
          artists: [],
          errors: [],
          cancelled: true,
        }
      );
    }

    const result: WavenArtistsToExploreResponse = {
      artists: enrichedArtists,
      errors: [...new Set(errors)],
      cancelled: false,
    };

    if (enrichedArtists.length > 0) {
      this.artistsToExploreSessionCache = result;
      this.artistsToExploreSessionCapturedAt = Date.now();
    }

    return result;
  }

  async continueSearch(
    continuation: string,
    options: WavenProviderQueryOptions = {},
  ): Promise<WavenDiscoverySearchResponse> {
    const token = String(continuation || '');
    const providers = this.metadataProviders.filter(
      (provider) => typeof provider.continueSearch === 'function',
    );

    if (!token || token.length > 4_000 || !providers.length) {
      return {
        result: EMPTY_SEARCH_RESULT,
        errors: ['No additional search page is available.'],
        cancelled: false,
      };
    }

    const response = await queryMusicProviders(
      providers.slice(0, 1),
      this.healthBook,
      (provider, signal) =>
        provider.continueSearch!(token, { signal }),
      { ...options, timeoutMs: options.timeoutMs ?? 10_000 },
    );

    return {
      result: mergeSearchResults(
        response.results.map((entry) => entry.value),
      ),
      errors: response.errors,
      cancelled: response.cancelled,
    };
  }

  private metadataProviderFor(
    providerId: string,
  ): MusicMetadataProvider<AbortSignal> | null {
    return (
      this.metadataProviders.find((provider) => provider.id === providerId) ??
      null
    );
  }

  private artistPresentationProviderFor(
    providerId: string,
  ): WavenArtistPresentationProvider | null {
    const provider = this.metadataProviderFor(providerId);
    if (!provider || typeof (provider as WavenArtistPresentationProvider).getArtistPresentation !== 'function') {
      return null;
    }
    return provider as WavenArtistPresentationProvider;
  }

  private async enrichArtistPresentation(
    artist: MusicArtist,
    options: WavenProviderQueryOptions = {},
  ): Promise<MusicArtist> {
    if (artistArtwork(artist)) return artist;
    const provider = this.artistPresentationProviderFor(artist.source.provider);
    if (!provider || options.signal?.aborted) return artist;

    const response = await queryMusicProviders(
      [provider],
      this.healthBook,
      (activeProvider, signal) =>
        activeProvider.getArtistPresentation(artist, { signal }),
      { ...options, timeoutMs: Math.min(options.timeoutMs ?? 5_000, 5_000) },
    );

    return mergeArtistPresentation(artist, response.results[0]?.value ?? null);
  }

  private async enrichArtistPresentations(
    artists: readonly MusicArtist[],
    options: WavenProviderQueryOptions = {},
    limit = artists.length,
  ): Promise<MusicArtist[]> {
    const requestIndexes = artists
      .map((artist, index) => ({ artist, index }))
      .filter(({ artist }) => !artistArtwork(artist))
      .slice(0, Math.max(0, limit));

    if (!requestIndexes.length || options.signal?.aborted) return [...artists];

    const settled = await Promise.allSettled(
      requestIndexes.map(({ artist }) =>
        this.enrichArtistPresentation(artist, options),
      ),
    );
    const enriched = [...artists];
    settled.forEach((entry, resultIndex) => {
      if (entry.status !== 'fulfilled') return;
      const targetIndex = requestIndexes[resultIndex]?.index;
      if (targetIndex === undefined) return;
      enriched[targetIndex] = mergeArtistPresentation(
        enriched[targetIndex],
        entry.value,
      );
    });
    return enriched;
  }

  async getArtist(
    artist: MusicArtist,
    options: WavenProviderQueryOptions = {},
  ): Promise<WavenArtistDetailResponse> {
    const provider = this.metadataProviderFor(artist.source.provider);

    if (!provider || typeof provider.getArtist !== 'function') {
      return {
        detail: null,
        errors: ['Artist details are unavailable right now.'],
        cancelled: false,
      };
    }

    const response = await queryMusicProviders(
      [provider],
      this.healthBook,
      (activeProvider, signal) =>
        activeProvider.getArtist!(artist, { signal }),
      { ...options, timeoutMs: options.timeoutMs ?? 12_000 },
    );

    return {
      detail: response.results[0]?.value ? canonicalizeWavenArtistDetail(response.results[0].value) : null,
      errors: response.errors,
      cancelled: response.cancelled,
    };
  }

  async getAlbum(
    album: MusicAlbum,
    options: WavenProviderQueryOptions = {},
  ): Promise<WavenAlbumDetailResponse> {
    const provider = this.metadataProviderFor(album.source.provider);

    if (!provider || typeof provider.getAlbum !== 'function') {
      return {
        detail: null,
        errors: ['Album details are unavailable right now.'],
        cancelled: false,
      };
    }

    const response = await queryMusicProviders(
      [provider],
      this.healthBook,
      (activeProvider, signal) =>
        activeProvider.getAlbum!(album, { signal }),
      { ...options, timeoutMs: options.timeoutMs ?? 12_000 },
    );

    return {
      detail: response.results[0]?.value ? canonicalizeWavenAlbumDetail(response.results[0].value) : null,
      errors: response.errors,
      cancelled: response.cancelled,
    };
  }

  async getDashboard(
    options: WavenDashboardQueryOptions = {},
  ): Promise<WavenDiscoveryDashboardResponse> {
    const { refresh = false, ...queryOptions } = options;

    if (!refresh && this.dashboardSessionCache) {
      return this.dashboardSessionCache;
    }

    const response = await queryMusicProviders(
      this.dashboardProviders,
      this.healthBook,
      (provider, signal) => provider.getDashboard({ signal }),
      { ...queryOptions, timeoutMs: queryOptions.timeoutMs ?? 12_000 },
    );

    const sections = response.results.flatMap((entry) =>
      entry.value.sections.map((section) => ({
        ...section,
        attribution: section.attribution || entry.providerName,
      })),
    );

    const result: WavenDiscoveryDashboardResponse = {
      result: canonicalizeWavenDashboard({ sections }),
      errors: response.errors,
      cancelled: response.cancelled,
    };

    if (!result.cancelled && sections.length > 0) {
      this.dashboardSessionCache = result;
    }

    return result;
  }
}

/** Phase 8 adds bounded public metadata continuity around the accepted provider implementation. */
export class ResilientWavenDiscoveryRuntime extends WavenDiscoveryRuntime {
  private reads = new Map<string, { controller: AbortController; consumers: Set<object>; promise: Promise<unknown>; complete: boolean }>();
  /** Share a read, not a consumer's lifecycle. Only its last departed reader cancels it. */
  private sharedRead<T>(key: string, signal: AbortSignal, run: (signal: AbortSignal) => Promise<T>, cancelled: T): Promise<T> {
    let entry = this.reads.get(key);
    if (!entry || entry.controller.signal.aborted) {
      const next = { controller: new AbortController(), consumers: new Set<object>(), promise: Promise.resolve<unknown>(null), complete: false };
      entry = next;
      this.reads.set(key, next);
      next.promise = Promise.resolve().then(() => run(next.controller.signal)).finally(() => {
        next.complete = true;
        if (this.reads.get(key) === next) this.reads.delete(key);
      });
    }
    const shared = entry;
    return new Promise<T>((resolve, reject) => {
      const reader = {}; let done = false;
      const finish = (value: T, error?: unknown) => {
        if (done) return;
        done = true; signal.removeEventListener('abort', abort); shared.consumers.delete(reader);
        if (!shared.complete && !shared.consumers.size) shared.controller.abort();
        if (error !== undefined) reject(error); else resolve(value);
      };
      const abort = () => finish(cancelled);
      shared.consumers.add(reader); signal.addEventListener('abort', abort, { once: true });
      shared.promise.then(value => finish(value as T), error => finish(cancelled, error));
      if (signal.aborted) abort();
    });
  }
  private cached<T>(key: string): T | null {
    const cached = offlineMetadata.read<T>(key), value = cached?.value as Record<string, any> | undefined;
    if (!value || typeof value !== 'object') return null;
    const entity = (e: any) => !!e && typeof e.source?.provider === 'string' && typeof e.source?.id === 'string' && (typeof e.title === 'string' || typeof e.name === 'string');
    const list = (items: any) => Array.isArray(items) && items.every(entity);
    const valid = key === 'artists' ? list(value.artists)
      : key === 'categories' ? Array.isArray(value.categories) && value.categories.every((c: any) => c && typeof c.browseId === 'string' && typeof c.title === 'string' && typeof c.group === 'string')
      : key.startsWith('album:') ? entity(value.detail?.album) && list(value.detail?.tracks)
      : key.startsWith('artist:') ? entity(value.detail?.artist) && list(value.detail?.tracks) && list(value.detail?.albums)
      : Array.isArray(value.result?.sections) && value.result.sections.every((s: any) => s && typeof s.title === 'string' && ['tracks','artists','albums','playlists'].includes(s.type) && list(s.items));
    return valid ? { ...cached!.value, errors: [], cancelled: false } : null;
  }
  private async readResilient<T extends { errors: readonly string[]; cancelled: boolean }>(
    key: string, read: (refresh: boolean, signal?: AbortSignal) => Promise<T>, fallback: T, usable: (value: T) => boolean, options: { refresh?: boolean; signal?: AbortSignal } = {},
  ): Promise<T> {
    const cached = this.cached<T>(key);
    if (options.signal?.aborted) return { ...fallback, cancelled: true };
    if (!wavenConnectivity.canRequest()) {
      offlineMetadata.enqueue(key);
      return cached ?? { ...fallback, errors: [wavenConnectivity.getSnapshot().state === 'OFFLINE' ? 'You are offline. Connect to load this music.' : 'Reconnecting. Saved music is still available.'] };
    }
    const fresh = offlineMetadata.read<T>(key, false);
    if (!options.refresh && fresh && cached) return cached;
    const run = async (signal?: AbortSignal) => {
      if (signal?.aborted) return { ...fallback, cancelled: true };
      const response = await read(options.refresh === true || (!!cached && !fresh), signal);
      if (signal?.aborted) return { ...fallback, cancelled: true };
      if (!response.cancelled && !response.errors.length) {
        if (usable(response) || !cached) offlineMetadata.remember(key, response);
        else offlineMetadata.acknowledge(key); // A verified empty result is terminal, not a failed request.
        wavenConnectivity.reportRecoveryProgress();
        if (!usable(response) && cached) return cached;
      } else if (!response.cancelled) { offlineMetadata.enqueue(key); if (cached) return { ...cached, errors: response.errors }; }
      return response;
    };
    return options.signal ? this.sharedRead(key, options.signal, run, { ...fallback, cancelled: true }) : run();
  }
  override getSearchGlobalChartsSessionSnapshot() { return super.getSearchGlobalChartsSessionSnapshot() ?? this.cached<WavenSearchDiscoveryBrowseResponse>('home-charts'); }
  override getSearchNewReleasesSessionSnapshot() { return super.getSearchNewReleasesSessionSnapshot() ?? this.cached<WavenSearchDiscoveryBrowseResponse>('home-releases'); }
  override getSearchDiscoveryCategoriesSessionSnapshot() { return super.getSearchDiscoveryCategoriesSessionSnapshot() ?? this.cached<WavenSearchDiscoveryCategoriesResponse>('categories'); }
  override getArtistsToExploreSessionSnapshot() { return super.getArtistsToExploreSessionSnapshot() ?? this.cached<WavenArtistsToExploreResponse>('artists'); }
  override getSearchDiscoveryCategorySessionSnapshot(category: WavenSearchDiscoveryCategory) { return super.getSearchDiscoveryCategorySessionSnapshot(category) ?? this.cached<WavenSearchDiscoveryBrowseResponse>(`category:${category.browseId}\0${category.params}`); }
  override getDiscoveryFreshnessHints() {
    const base = super.getDiscoveryFreshnessHints();
    return { newReleasesRefreshRecommended: base.newReleasesRefreshRecommended || !!offlineMetadata.read('home-releases') && !offlineMetadata.read('home-releases', false),
      globalChartsRefreshRecommended: base.globalChartsRefreshRecommended || !!offlineMetadata.read('home-charts') && !offlineMetadata.read('home-charts', false),
      artistsRefreshRecommended: base.artistsRefreshRecommended || !!offlineMetadata.read('artists') && !offlineMetadata.read('artists', false) };
  }
  override getSearchGlobalCharts(options: WavenSearchDiscoveryQueryOptions = {}) {
    return this.readResilient('home-charts', (refresh, signal) => super.getSearchGlobalCharts({ ...options, signal, refresh }), { result: { sections: [] }, errors: [], cancelled: false } as WavenSearchDiscoveryBrowseResponse, value => value.result.sections.length > 0, options);
  }
  override getSearchNewReleases(options: WavenSearchDiscoveryQueryOptions = {}) {
    return this.readResilient('home-releases', (refresh, signal) => super.getSearchNewReleases({ ...options, signal, refresh }), { result: { sections: [] }, errors: [], cancelled: false } as WavenSearchDiscoveryBrowseResponse, value => value.result.sections.length > 0, options);
  }
  override getSearchDiscoveryCategories(options: WavenSearchDiscoveryQueryOptions = {}) {
    return this.readResilient('categories', (refresh, signal) => super.getSearchDiscoveryCategories({ ...options, signal, refresh }), { categories: [], errors: [], cancelled: false } as WavenSearchDiscoveryCategoriesResponse, value => value.categories.length > 0, options);
  }
  override getArtistsToExplore(options: WavenSearchDiscoveryQueryOptions = {}) {
    return this.readResilient('artists', (refresh, signal) => super.getArtistsToExplore({ ...options, signal, refresh }), { artists: [], errors: [], cancelled: false } as WavenArtistsToExploreResponse, value => value.artists.length > 0, options);
  }
  override getSearchDiscoveryCategory(category: WavenSearchDiscoveryCategory, options: WavenSearchDiscoveryQueryOptions = {}) {
    return this.readResilient(`category:${category.browseId}\0${category.params}`, (refresh, signal) => super.getSearchDiscoveryCategory(category, { ...options, signal, refresh }), { result: { sections: [] }, errors: [], cancelled: false } as WavenSearchDiscoveryBrowseResponse, value => value.result.sections.length > 0, options);
  }
  override getAlbum(album: MusicAlbum, options: WavenProviderQueryOptions = {}) {
    return this.readResilient(`album:${album.source.provider}\0${album.source.id}`, (_refresh, signal) => super.getAlbum(album, { ...options, signal }), { detail: null, errors: [], cancelled: false } as WavenAlbumDetailResponse, value => !!value.detail, options);
  }
  override getArtist(artist: MusicArtist, options: WavenProviderQueryOptions = {}) {
    return this.readResilient(`artist:${artist.source.provider}\0${artist.source.id}`, (_refresh, signal) => super.getArtist(artist, { ...options, signal }), { detail: null, errors: [], cancelled: false } as WavenArtistDetailResponse, value => !!value.detail, options);
  }
  async refreshPendingOfflineMetadata(signal: AbortSignal) {
    for (const key of offlineMetadata.pendingKeys()) {
      if (signal.aborted) return;
      // Pending means an unresolved read, even if an older valid cache is fresh.
      const options = { signal, refresh: true };
      let response: { errors: readonly string[]; cancelled: boolean } | null = null;
      if (key === 'home-charts') response = await this.getSearchGlobalCharts(options);
      else if (key === 'home-releases') response = await this.getSearchNewReleases(options);
      else if (key === 'categories') response = await this.getSearchDiscoveryCategories(options);
      else if (key === 'artists') response = await this.getArtistsToExplore(options);
      else if (key.startsWith('album:') || key.startsWith('artist:')) {
        const kind = key.startsWith('album:') ? 'album' : 'artist', [provider, id] = key.slice(kind.length + 1).split('\0');
        if (provider && id) response = kind === 'album' ? await this.getAlbum({ id, title: 'Album', source: { provider,id } }, options) : await this.getArtist({ id, name: 'Artist', source: { provider,id } }, options);
      } else if (key.startsWith('category:')) {
        const [browseId, params] = key.slice(9).split('\0');
        const category = this.getSearchDiscoveryCategoriesSessionSnapshot()?.categories.find(item => item.browseId === browseId && item.params === params)
          ?? (browseId && params ? { id: browseId, title: 'Discovery', group: 'Genres', browseId, params, accentColor: null } : null);
        if (category) response = await this.getSearchDiscoveryCategory(category, options);
      }
      if (response && !signal.aborted && !response.cancelled && !response.errors.length) offlineMetadata.acknowledge(key);
    }
    // Provider errors can be returned as result objects instead of exceptions.
    // If public refresh intent is still durable, make the recovery coordinator
    // retry with bounded backoff rather than declaring the epoch fully ONLINE.
    if (!signal.aborted && offlineMetadata.pendingKeys().length) {
      throw new Error('Public metadata recovery incomplete.');
    }
  }
}

export function createDefaultWavenDiscoveryRuntime(): ResilientWavenDiscoveryRuntime {
  return new ResilientWavenDiscoveryRuntime(
    [createYouTubeMusicMetadataProvider()],
    [
      createSpotifyChartsDashboardProvider(),
      createYouTubeMusicDashboardProvider(),
    ],
    [createYouTubeMusicSearchDiscoveryProvider()],
  );
}

export const wavenDiscoveryRuntime = createDefaultWavenDiscoveryRuntime();
