/**
 * Orion TMDB API Client — Platform-Agnostic
 *
 * Ported from the desktop's tmdb.js with storage adapter injection
 * to replace direct localStorage usage.
 */

import type { IStorageAdapter } from "./storageAdapter";
import type { TmdbMediaItem, TmdbPaginatedResponse } from "../types/media";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

// ── In-memory TMDB response cache (session-scoped) ──────────────────────────
const tmdbCache = new Map<string, { data: unknown; expiresAt: number }>();
const TMDB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Request queue (max 4 concurrent TMDB fetches) ───────────────────────────
let inflight = 0;
const MAX_INFLIGHT = 4;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inflight < MAX_INFLIGHT) {
    inflight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function releaseSlot(): void {
  inflight--;
  if (waiters.length > 0) {
    inflight++;
    waiters.shift()!();
  }
}

// ── Error handlers ──────────────────────────────────────────────────────────
type ErrorHandler = (() => void) | null;
let onAuthError: ErrorHandler = null;
let onUnreachable: ErrorHandler = null;

export function setApiErrorHandlers(
  onAuth: ErrorHandler,
  onUnreachableHandler: ErrorHandler
): void {
  onAuthError = onAuth;
  onUnreachable = onUnreachableHandler;
}

// ── Client Configuration ────────────────────────────────────────────────────
export interface TmdbClientConfig {
  /** TMDB read access token (Bearer token) */
  apiToken: string;
  /** Platform storage adapter for persistent caching */
  storage: IStorageAdapter;
  /** Default metadata language (e.g., "en-US") */
  defaultLanguage?: string;
}

let clientConfig: TmdbClientConfig | null = null;

/**
 * Initialize the TMDB client with platform-specific configuration.
 * Must be called before any API requests.
 */
export function initTmdbClient(config: TmdbClientConfig): void {
  clientConfig = config;
}

function getConfig(): TmdbClientConfig {
  if (!clientConfig) {
    throw new Error("TMDB client not initialized. Call initTmdbClient() first.");
  }
  return clientConfig;
}

function getTmdbLanguage(): string {
  const { storage, defaultLanguage } = getConfig();
  try {
    const raw = storage.get("orion_tmdbLang");
    return raw ? JSON.parse(raw) : (defaultLanguage ?? "en-US");
  } catch {
    return defaultLanguage ?? "en-US";
  }
}

function withLanguage(path: string, languageOverride?: string): string {
  const lang = languageOverride?.trim() || getTmdbLanguage();
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}language=${lang}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function imgUrl(path: string | null, size = "w500"): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

/** Clear all in-memory and persisted TMDB caches. */
export function clearTmdbCache(): void {
  tmdbCache.clear();
  try {
    getConfig().storage.remove("orion_trendingCache");
  } catch {
    // Ignore if client not initialized
  }
}

export async function tmdbFetch<T = unknown>(
  path: string,
  options: { signal?: AbortSignal; language?: string } = {}
): Promise<T> {
  const { apiToken } = getConfig();
  const localizedPath = withLanguage(path, options.language);
  const cacheKey = `${apiToken}|${localizedPath}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data as T;

  await acquireSlot();

  let res: Response;
  try {
    res = await fetch(`${TMDB_BASE}${localizedPath}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: options.signal,
    });
  } catch (error: unknown) {
    releaseSlot();
    if (error instanceof Error && error.name === "AbortError") throw error;
    onUnreachable?.();
    throw new Error("TMDB unreachable");
  }

  releaseSlot();

  if (res.status === 401 || res.status === 403) {
    onAuthError?.();
    throw new Error(`TMDB ${res.status}`);
  }

  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = (await res.json()) as T;
  tmdbCache.set(cacheKey, { data, expiresAt: Date.now() + TMDB_CACHE_TTL });

  // Evict stale entries to prevent unbounded memory growth
  if (tmdbCache.size > 80) {
    const now = Date.now();
    for (const [k, v] of tmdbCache) {
      if (now >= v.expiresAt) tmdbCache.delete(k);
    }
  }

  return data;
}

// ── Convenience wrappers ────────────────────────────────────────────────────

export async function fetchTrending(
  mediaType: "movie" | "tv" | "all" = "all",
  timeWindow: "day" | "week" = "week",
  options: { signal?: AbortSignal } = {}
): Promise<TmdbPaginatedResponse> {
  return tmdbFetch<TmdbPaginatedResponse>(
    `/trending/${mediaType}/${timeWindow}`,
    options
  );
}

export async function fetchMovieDetails(
  id: number | string,
  options: { signal?: AbortSignal } = {}
): Promise<TmdbMediaItem & Record<string, unknown>> {
  return tmdbFetch(`/movie/${id}?append_to_response=credits,external_ids,recommendations,videos`, options);
}

export async function fetchTvDetails(
  id: number | string,
  options: { signal?: AbortSignal } = {}
): Promise<TmdbMediaItem & Record<string, unknown>> {
  return tmdbFetch(`/tv/${id}?append_to_response=credits,external_ids,recommendations,videos`, options);
}

export async function fetchPersonDetails(
  id: number | string,
  options: { signal?: AbortSignal } = {}
): Promise<any> {
  return tmdbFetch(`/person/${id}?append_to_response=combined_credits,external_ids`, options);
}

function normalizeSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function buildSearchVariants(query: string): string[] {
  const original = String(query || '').replace(/\s+/g, ' ').trim();
  if (!original) return [];
  const normalized = normalizeSearchText(original);
  const variants = [original];
  if (normalized && normalized !== original.toLocaleLowerCase()) variants.push(normalized);
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.length <= 4 && tokens.every((token) => /^[a-z0-9]+$/i.test(token))) {
    variants.push(tokens.slice().reverse().join(' '));
  }
  return [...new Set(variants)].slice(0, 3);
}

function searchResultFields(item: TmdbMediaItem): string[] {
  return [item.title, item.name, item.original_title, item.original_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function searchResultScore(query: string, item: TmdbMediaItem): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const compactQuery = normalizedQuery.replace(/\s+/g, '');
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  let score = 0;
  for (const field of searchResultFields(item)) {
    const normalizedField = normalizeSearchText(field);
    if (!normalizedField) continue;
    const compactField = normalizedField.replace(/\s+/g, '');
    const fieldTokens = normalizedField.split(' ').filter(Boolean);
    if (normalizedField === normalizedQuery) score = Math.max(score, 1200);
    else if (compactField === compactQuery) score = Math.max(score, 1160);
    else if (normalizedField.startsWith(normalizedQuery)) score = Math.max(score, 1020);
    else if (normalizedField.includes(normalizedQuery)) score = Math.max(score, 900);
    if (queryTokens.every((token) => fieldTokens.some((candidate) => candidate.startsWith(token)))) {
      score = Math.max(score, 980 - Math.max(0, fieldTokens.length - queryTokens.length) * 8);
    }
  }
  return score + Math.max(0, Math.min(180, Number(item.popularity) || 0)) / 10;
}

function normalizePersonSearchResult(item: TmdbMediaItem): TmdbMediaItem {
  return { ...item, media_type: 'person' };
}

function mergeSearchResults(query: string, groups: TmdbMediaItem[][]): TmdbMediaItem[] {
  const unique = new Map<string, TmdbMediaItem>();
  for (const group of groups) {
    for (const item of group) {
      if (item.id == null || !item.media_type) continue;
      const key = `${item.media_type}:${item.id}`;
      if (!unique.has(key)) unique.set(key, item);
    }
  }
  return [...unique.values()].sort((a, b) => {
    const score = searchResultScore(query, b) - searchResultScore(query, a);
    return Math.abs(score) > 0.0001 ? score : (Number(b.popularity) || 0) - (Number(a.popularity) || 0);
  });
}

async function fetchMultiSearchPage(
  query: string,
  page: number,
  options: { signal?: AbortSignal },
): Promise<TmdbPaginatedResponse> {
  return tmdbFetch<TmdbPaginatedResponse>(
    `/search/multi?query=${encodeURIComponent(query)}&page=${page}`,
    options,
  );
}

export async function fetchPersonSearch(
  query: string,
  page = 1,
  options: { signal?: AbortSignal } = {},
): Promise<TmdbPaginatedResponse> {
  return tmdbFetch<TmdbPaginatedResponse>(
    `/search/person?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`,
    options,
  );
}

export async function fetchSearch(
  query: string,
  page = 1,
  options: { signal?: AbortSignal } = {},
): Promise<TmdbPaginatedResponse> {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return { page: 1, results: [], total_pages: 0, total_results: 0 };
  if (page > 1) return fetchMultiSearchPage(normalizedQuery, page, options);

  const variants = buildSearchVariants(normalizedQuery);
  const primary = variants[0];
  const [multi, people] = await Promise.all([
    fetchMultiSearchPage(primary, 1, options),
    fetchPersonSearch(primary, 1, options).catch(() => null),
  ]);
  const groups: TmdbMediaItem[][] = [multi.results || []];
  if (people?.results?.length) groups.push(people.results.map(normalizePersonSearchResult));

  const followUps: Array<Promise<TmdbPaginatedResponse | null>> = [];
  if ((people?.total_pages || 0) > 1) {
    followUps.push(fetchPersonSearch(primary, 2, options).catch(() => null));
  }
  for (const variant of variants.slice(1)) {
    followUps.push(fetchPersonSearch(variant, 1, options).catch(() => null));
  }
  if (variants[1] && variants[1] !== primary.toLocaleLowerCase()) {
    followUps.push(fetchMultiSearchPage(variants[1], 1, options).catch(() => null));
  }

  for (const response of await Promise.all(followUps)) {
    if (!response?.results?.length) continue;
    const personOnly = response.results.every((item) => item.media_type == null || item.media_type === 'person');
    groups.push(personOnly ? response.results.map(normalizePersonSearchResult) : response.results);
  }

  const results = mergeSearchResults(normalizedQuery, groups);
  return {
    page: Number(multi.page) || 1,
    results,
    total_pages: Math.max(1, Number(multi.total_pages) || 1),
    total_results: Number(multi.total_results) || results.length,
  };
}

export async function fetchEpisodeGroup(
  groupId: string,
  options: { signal?: AbortSignal } = {}
): Promise<unknown> {
  return tmdbFetch(`/tv/episode_group/${groupId}`, options);
}

// ── Anime detection ─────────────────────────────────────────────────────────

export function isAnimeContent(
  item: TmdbMediaItem,
  details?: TmdbMediaItem
): boolean {
  const d = details ?? item;
  const lang = d.original_language;
  const countries = d.origin_country ?? [];
  const genreIds = d.genre_ids ?? (d.genres ?? []).map((g) => g.id);
  const hasAnimation = genreIds.includes(16);
  return hasAnimation && (lang === "ja" || countries.includes("JP"));
}

export const ANIME_DEFAULT_SOURCE = "allmanga";
export const NON_ANIME_DEFAULT_SOURCE = "vidking";
