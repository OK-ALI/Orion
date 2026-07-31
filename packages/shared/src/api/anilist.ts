/**
 * Orion AniList API Client — Platform-Agnostic
 *
 * Ported from the desktop's tmdb.js AniList section
 * with storage adapter injection.
 */

import type { IStorageAdapter } from "./storageAdapter";
import type { AnilistMedia, AnilistSeason } from "../types/media";

const ANILIST_API = "https://graphql.anilist.co";
const ANILIST_CACHE_KEY = "orion_anilistCache";
const ANILIST_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

const ANILIST_QUERY = `
query ($search: String, $type: MediaType) {
  Media(search: $search, type: $type, sort: SEARCH_MATCH) {
    id
    idMal
    title { romaji english native }
    description(asHtml: false)
    coverImage { extraLarge large }
    bannerImage
    genres
    averageScore
    episodes
    status
    season
    seasonYear
    studios(isMain: true) { nodes { name } }
    startDate { year month }
    relations {
      edges {
        relationType
        node {
          id
          type
          format
          title { romaji english }
          episodes
          startDate { year month }
          seasonYear
        }
      }
    }
  }
}`;

// ── Client Config ───────────────────────────────────────────────────────────
let anilistStorage: IStorageAdapter | null = null;

export function initAnilistClient(storage: IStorageAdapter): void {
  anilistStorage = storage;
}

function getStorage(): IStorageAdapter {
  if (!anilistStorage) {
    throw new Error("AniList client not initialized. Call initAnilistClient() first.");
  }
  return anilistStorage;
}

// ── Cache ───────────────────────────────────────────────────────────────────
interface CacheEntry {
  data: AnilistMedia | null;
  ts: number;
}

let anilistCache: Record<string, CacheEntry> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getAnilistCache(): Record<string, CacheEntry> {
  if (anilistCache) return anilistCache;
  const storage = getStorage();
  try {
    const raw = storage.get(ANILIST_CACHE_KEY);
    anilistCache = raw ? JSON.parse(raw) : {};
  } catch {
    anilistCache = {};
  }
  const now = Date.now();
  for (const key of Object.keys(anilistCache!)) {
    if (now - anilistCache![key].ts > ANILIST_CACHE_TTL) {
      delete anilistCache![key];
    }
  }
  return anilistCache!;
}

function flushAnilistCache(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      getStorage().set(ANILIST_CACHE_KEY, JSON.stringify(anilistCache));
    } catch {
      // Ignore storage errors
    }
  }, 500);
}

// ── Public API ──────────────────────────────────────────────────────────────

export function cleanAnilistDescription(desc: string | null | undefined): string | null | undefined {
  if (!desc) return desc;
  let clean = desc
    .split("<")
    .map((chunk, i) => (i === 0 ? chunk : chunk.slice(chunk.indexOf(">") + 1)))
    .join("")
    .replace(/>/g, "");
  clean = clean.replace(/\(Source:[^)]*\)/gi, "");
  clean = clean.replace(/\bNote:[^\n]*/gi, "");
  clean = clean.replace(/[\s\n]+$/, "").trim();
  return clean;
}

export async function fetchAnilistData(
  title: string,
  type: "ANIME" | "MANGA" = "ANIME",
  tmdbId: number | null = null
): Promise<AnilistMedia | null> {
  const cacheKey = tmdbId
    ? `${type}__tmdb_${tmdbId}`
    : `${type}__${title.toLowerCase().trim()}`;

  const cache = getAnilistCache();
  const entry = cache[cacheKey];
  if (entry && Date.now() - entry.ts <= ANILIST_CACHE_TTL) {
    const cachedTitles = [
      entry.data?.title?.romaji,
      entry.data?.title?.english,
      entry.data?.title?.native,
    ]
      .filter(Boolean)
      .map((t) => t!.toLowerCase());
    const searchTitle = title.toLowerCase();
    const isMismatch =
      entry.data !== null &&
      cachedTitles.length > 0 &&
      !cachedTitles.some(
        (t) => t.includes(searchTitle) || searchTitle.includes(t)
      );
    if (!isMismatch) return entry.data;
    delete cache[cacheKey];
    flushAnilistCache();
  }

  try {
    const res = await fetch(ANILIST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { search: title, type },
      }),
    });
    const json = (await res.json()) as { data?: { Media?: AnilistMedia } };
    const data: AnilistMedia | null = json?.data?.Media ?? null;

    cache[cacheKey] = { data, ts: Date.now() };
    flushAnilistCache();

    return data;
  } catch {
    if (entry) return entry.data;
    return null;
  }
}

export function buildAnilistSeasons(anilistData: AnilistMedia | null): AnilistSeason[] | null {
  if (!anilistData) return null;

  const main: AnilistSeason = {
    seasonNum: 0, // Will be reassigned
    id: anilistData.id,
    title:
      anilistData.title?.english ??
      anilistData.title?.romaji ??
      anilistData.title?.native ??
      "",
    episodes: anilistData.episodes ?? null,
    year: anilistData.startDate?.year ?? anilistData.seasonYear ?? 9999,
    month: anilistData.startDate?.month ?? 0,
  };

  const sequels: AnilistSeason[] = (anilistData.relations?.edges ?? [])
    .filter(
      (e) =>
        e.relationType === "SEQUEL" &&
        e.node.type === "ANIME" &&
        (e.node.format === "TV" || e.node.format === "TV_SHORT")
    )
    .map((e) => ({
      seasonNum: 0,
      id: e.node.id,
      title: e.node.title?.english ?? e.node.title?.romaji ?? "",
      episodes: e.node.episodes ?? null,
      year: e.node.startDate?.year ?? e.node.seasonYear ?? 9999,
      month: e.node.startDate?.month ?? 0,
    }));

  const all = [main, ...sequels].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );

  return all.map((s, i) => ({ ...s, seasonNum: i + 1 }));
}
