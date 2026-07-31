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

function withLanguage(path: string): string {
  const lang = getTmdbLanguage();
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
  options: { signal?: AbortSignal } = {}
): Promise<T> {
  const { apiToken } = getConfig();
  const localizedPath = withLanguage(path);
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

export async function fetchSearch(
  query: string,
  page = 1,
  options: { signal?: AbortSignal } = {}
): Promise<TmdbPaginatedResponse> {
  return tmdbFetch<TmdbPaginatedResponse>(
    `/search/multi?query=${encodeURIComponent(query)}&page=${page}`,
    options
  );
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
