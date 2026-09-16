import type {
  MusicDashboardProvider,
  MusicDashboardResult,
  MusicEntity,
  MusicMetadataProvider,
  MusicProviderDescriptor,
  MusicSearchResult,
} from '../../domain/music';
import {
  createYouTubeMusicDashboardProvider,
  createYouTubeMusicMetadataProvider,
} from '../../infrastructure/music/providers/youtubeMusicMetadata';
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
  return {
    tracks: mergeEntities(results.map((result) => result.tracks)),
    artists: mergeEntities(results.map((result) => result.artists)),
    albums: mergeEntities(results.map((result) => result.albums)),
    playlists: mergeEntities(results.map((result) => result.playlists)),
    continuation:
      results.map((result) => result.continuation).find(Boolean) ?? null,
  };
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

export interface WavenDiscoverySuggestionsResponse {
  suggestions: readonly string[];
  errors: readonly string[];
  cancelled: boolean;
}

export class WavenDiscoveryRuntime {
  private readonly healthBook = new WavenProviderHealthBook();

  constructor(
    private readonly metadataProviders: readonly MusicMetadataProvider<AbortSignal>[],
    private readonly dashboardProviders: readonly MusicDashboardProvider<AbortSignal>[],
  ) {}

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
    options: WavenProviderQueryOptions = {},
  ): Promise<WavenDiscoverySearchResponse> {
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

  async getDashboard(
    options: WavenProviderQueryOptions = {},
  ): Promise<WavenDiscoveryDashboardResponse> {
    const response = await queryMusicProviders(
      this.dashboardProviders,
      this.healthBook,
      (provider, signal) => provider.getDashboard({ signal }),
      { ...options, timeoutMs: options.timeoutMs ?? 12_000 },
    );

    const sections = response.results.flatMap((entry) =>
      entry.value.sections.map((section) => ({
        ...section,
        attribution: section.attribution || entry.providerName,
      })),
    );

    return {
      result: { sections },
      errors: response.errors,
      cancelled: response.cancelled,
    };
  }
}

export function createDefaultWavenDiscoveryRuntime(): WavenDiscoveryRuntime {
  return new WavenDiscoveryRuntime(
    [createYouTubeMusicMetadataProvider()],
    [createYouTubeMusicDashboardProvider()],
  );
}

export const wavenDiscoveryRuntime = createDefaultWavenDiscoveryRuntime();
