/**
 * Cinema Source Registry — Platform-Agnostic
 *
 * Ported from desktop's registry.js with full TypeScript typing.
 * This registry assembles all source adapters and provides lookup,
 * health tracking, URL building, and failover logic.
 */

import {
  assertSourceRegistry,
  type CinemaSourceDescriptor,
  type LegacyCompatibleSource,
  type IdPolicy,
  type ProviderRequestManifestV1,
} from "./contracts";
import { primarySources } from "./adapters/primary";
import { candidateSources } from "./adapters/candidates";
import { experimentalSources, disabledSources } from "./adapters/experimental";
import { allMangaSource } from "./adapters/allmanga";

// ── Legacy health mapping ───────────────────────────────────────────────────
const LEGACY_HEALTH: Record<string, string> = Object.freeze({
  primary: "ready",
  candidate: "experimental",
  experimental: "experimental",
  disabled: "unavailable",
});

const COMMON_OBSERVATION_RULES = Object.freeze([
  { id: "doubleclick", kind: "advertisement" as const, hostPattern: "doubleclick.net", action: "block" as const },
  { id: "google-ads", kind: "advertisement" as const, hostPattern: "googlesyndication.com", action: "block" as const },
  { id: "adsterra", kind: "advertisement" as const, hostPattern: "adsterra.com", action: "block" as const },
  { id: "popcash", kind: "popup" as const, hostPattern: "popcash.net", action: "block" as const },
  { id: "exoclick", kind: "advertisement" as const, hostPattern: "exoclick.com", action: "block" as const },
]);

function createObservationManifest(source: CinemaSourceDescriptor): ProviderRequestManifestV1 {
  return {
    schemaVersion: 1,
    sourceId: source.id,
    // Every provider starts in compatibility-first observation mode. Blocking
    // provider-specific subresources is enabled only after device evidence.
    mode: "observe",
    allowedNavigationOrigins: Array.from(new Set([...source.expectedOrigins, ...source.allowedNavigationOrigins])),
    requiredOrigins: Array.from(new Set(source.requiredRequestOrigins)),
    mediaOrigins: [],
    artworkOrigins: [],
    subtitleOrigins: [],
    popupPolicy: "block",
    rules: [...COMMON_OBSERVATION_RULES],
  };
}

function toLegacyCompatibleSource(source: CinemaSourceDescriptor): LegacyCompatibleSource {
  return Object.freeze({
    ...source,
    requestManifest: source.requestManifest ?? createObservationManifest(source),
    tag: source.animeOnly ? "ANIME" : ["candidate", "experimental"].includes(source.releaseStatus) ? "EXP" : null,
    note: source.releaseStatus === "candidate" ? "Candidate" : source.releaseStatus === "experimental" ? "Experimental" : source.releaseStatus === "disabled" ? (source.disabledReason ?? null) : null,
    movieIdType: source.idPolicy.movie,
    tvIdType: source.idPolicy.tv,
    subtitleMode: source.subtitleStrategy === "url-param" ? "url" as const : source.subtitleStrategy === "provider" ? "provider" as const : "captured" as const,
    health: LEGACY_HEALTH[source.releaseStatus] ?? "unavailable",
    supportsProgress: source.progressStrategy !== "none",
    progressViaFrames: source.progressStrategy === "frame-video",
    movieUrl: source.buildMovieUrl,
    tvUrl: source.buildEpisodeUrl,
  }) as LegacyCompatibleSource;
}

// ── Registry ────────────────────────────────────────────────────────────────
export const ALL_CINEMA_SOURCES: readonly LegacyCompatibleSource[] = Object.freeze([
  ...primarySources,
  ...candidateSources,
  ...experimentalSources,
  ...disabledSources,
  allMangaSource,
].map(toLegacyCompatibleSource));

assertSourceRegistry(ALL_CINEMA_SOURCES as unknown as CinemaSourceDescriptor[]);

export const PLAYER_SOURCES: readonly LegacyCompatibleSource[] = Object.freeze(
  ALL_CINEMA_SOURCES.filter((source) => source.releaseStatus !== "disabled" && !source.quarantined)
);

export const DEFAULT_CINEMA_SOURCE_ID = "videasy";

// ── Runtime health tracking ─────────────────────────────────────────────────
interface HealthRecord {
  sourceId: string;
  mediaType: string;
  state?: string;
  startupMs?: number;
  cooldownUntil?: number;
  updatedAt?: number;
}

let runtimeHealthRecords: HealthRecord[] = [];

export function updateCinemaSourceHealth(records: HealthRecord[]): void {
  runtimeHealthRecords = Array.isArray(records)
    ? records.filter((record) => record?.sourceId && record?.mediaType)
    : [];
}

export function getCinemaSourceRuntimeHealth(
  sourceId: string,
  mediaType: string | null = null
): HealthRecord | null {
  const matches = runtimeHealthRecords.filter(
    (record) => record.sourceId === sourceId && (!mediaType || record.mediaType === mediaType)
  );
  if (!matches.length) return null;
  return matches.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
}

// ── Source lookup ───────────────────────────────────────────────────────────
export function getRegisteredSource(sourceId: string): LegacyCompatibleSource | null {
  return ALL_CINEMA_SOURCES.find((source) => source.id === sourceId) ?? null;
}

export function getSource(sourceId: string): LegacyCompatibleSource {
  return (
    PLAYER_SOURCES.find((source) => source.id === sourceId) ??
    PLAYER_SOURCES.find((source) => source.id === DEFAULT_CINEMA_SOURCE_ID) ??
    PLAYER_SOURCES[0]
  );
}

export function normalizeSelectableSourceId(
  sourceId: string,
  { anime = false }: { anime?: boolean } = {}
): string {
  const source = PLAYER_SOURCES.find((entry) => entry.id === sourceId);
  if (source && Boolean(source.animeOnly) === anime) return source.id;
  if (anime) return PLAYER_SOURCES.find((entry) => entry.animeOnly)?.id ?? DEFAULT_CINEMA_SOURCE_ID;
  return DEFAULT_CINEMA_SOURCE_ID;
}

// ── Source property accessors ───────────────────────────────────────────────
export const sourceHealth = (sourceId: string): string =>
  getRegisteredSource(sourceId)?.health ?? "unavailable";

export const sourceSubtitleMode = (sourceId: string): string =>
  getSource(sourceId)?.subtitleMode ?? "captured";

export const sourceIsExperimental = (sourceId: string): boolean =>
  ["candidate", "experimental"].includes(getRegisteredSource(sourceId)?.releaseStatus ?? "");

export const sourceSupportsProgress = (sourceId: string): boolean =>
  getSource(sourceId)?.supportsProgress ?? false;

export const sourceProgressViaFrames = (sourceId: string): boolean =>
  getSource(sourceId)?.progressViaFrames ?? false;

export const sourceIsAsync = (sourceId: string): boolean =>
  getSource(sourceId)?.async ?? false;

export const sourceResumeStrategy = (sourceId: string) =>
  getSource(sourceId)?.resumeStrategy ?? "none";

// ── Resume params ───────────────────────────────────────────────────────────
export function getSourceResumeParams(
  sourceId: string,
  seconds: number
): Record<string, number> {
  const source = getSource(sourceId);
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return source.resumeParam && value > 0 ? { [source.resumeParam]: value } : {};
}

// ── ID resolution ───────────────────────────────────────────────────────────
export function resolveSourceMediaId(
  sourceId: string,
  type: "movie" | "tv",
  ids: { tmdbId?: number | string; id?: number | string; imdbId?: string } = {}
): string | number | undefined {
  const source = getSource(sourceId);
  const policy = type === "movie" ? source.idPolicy.movie : source.idPolicy.tv;
  const tmdbId = ids.tmdbId ?? ids.id;
  const imdbId = ids.imdbId;
  if (policy === "imdb") return imdbId ?? tmdbId;
  if (policy === "imdb-preferred") return imdbId ?? tmdbId;
  return tmdbId ?? imdbId;
}

// ── URL building ────────────────────────────────────────────────────────────
export function getSourceUrl(
  sourceId: string,
  type: "movie" | "tv",
  ids: { tmdbId?: number | string; id?: number | string; imdbId?: string } | string | number,
  season: number,
  episode: number,
  extraParams: Record<string, string | number | null | undefined> = {},
  accentColor: string | null = null,
  subtitleLang: string | null = null
): string {
  const source = getSource(sourceId);
  const mediaId =
    typeof ids === "object" && ids !== null
      ? resolveSourceMediaId(source.id, type, ids)
      : ids;
  const baseUrl =
    type === "movie"
      ? source.buildMovieUrl(mediaId as string | number)
      : source.buildEpisodeUrl(mediaId as string | number, season, episode);
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(source.params ?? {})) {
    url.searchParams.set(key, value);
  }
  if (accentColor && source.colorParam) {
    url.searchParams.set(source.colorParam, accentColor.replace(/^#/, ""));
  }
  if (subtitleLang && source.langParam) {
    url.searchParams.set(source.langParam, subtitleLang);
  }
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// ── Source failover ─────────────────────────────────────────────────────────
export function getNextNonAsyncSource(currentId: string): string | null {
  const candidates = PLAYER_SOURCES.filter((source) => !source.async && !source.quarantined);
  if (!candidates.length) return null;
  const index = candidates.findIndex((source) => source.id === currentId);
  return candidates[index < 0 ? 0 : (index + 1) % candidates.length].id;
}

export function getNextHealthyNonAsyncSource(
  currentId: string,
  {
    includeExperimental = false,
    mediaType = null as string | null,
    attempted = [] as string[],
    now = Date.now(),
  } = {}
): string | null {
  const attemptedIds = new Set([currentId, ...attempted].filter(Boolean));
  const baseEligible = PLAYER_SOURCES.filter(
    (source) =>
      !source.async &&
      !source.quarantined &&
      !attemptedIds.has(source.id) &&
      (includeExperimental || source.releaseStatus === "primary")
  );
  const notCoolingDown = (source: LegacyCompatibleSource): boolean => {
    const health = getCinemaSourceRuntimeHealth(source.id, mediaType);
    return !health?.cooldownUntil || health.cooldownUntil <= now;
  };
  const healthy = baseEligible.filter(notCoolingDown);
  const fallbacks = PLAYER_SOURCES.filter(
    (source) =>
      !source.async &&
      !source.quarantined &&
      !attemptedIds.has(source.id) &&
      (includeExperimental || ["primary", "candidate"].includes(source.releaseStatus)) &&
      notCoolingDown(source)
  );
  const candidates = healthy.length ? healthy : fallbacks.length ? fallbacks : baseEligible;
  if (!candidates.length) return null;
  const stateScore: Record<string, number> = {
    ready: 0, slow: 1, checking: 2, unknown: 3, degraded: 4, failed: 5, disabled: 6,
  };
  return [...candidates].sort((a, b) => {
    const aHealth = getCinemaSourceRuntimeHealth(a.id, mediaType);
    const bHealth = getCinemaSourceRuntimeHealth(b.id, mediaType);
    const aScore = stateScore[aHealth?.state ?? "unknown"] ?? 3;
    const bScore = stateScore[bHealth?.state ?? "unknown"] ?? 3;
    if (aScore !== bScore) return aScore - bScore;
    const aStartup = Number.isFinite(aHealth?.startupMs) ? aHealth!.startupMs! : Number.MAX_SAFE_INTEGER;
    const bStartup = Number.isFinite(bHealth?.startupMs) ? bHealth!.startupMs! : Number.MAX_SAFE_INTEGER;
    return aStartup - bStartup;
  })[0].id;
}

export const NEEDS_INTERCEPT: readonly string[] = Object.freeze(
  PLAYER_SOURCES.map((source) => source.id)
);
