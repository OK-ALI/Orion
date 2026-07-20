import { assertSourceRegistry } from "./contracts";
import { primarySources } from "./adapters/primary";
import { candidateSources } from "./adapters/candidates";
import { experimentalSources, disabledSources } from "./adapters/experimental";
import { allMangaSource } from "./adapters/allmanga";

const LEGACY_HEALTH = Object.freeze({
  primary: "ready",
  candidate: "experimental",
  experimental: "experimental",
  disabled: "unavailable",
});

const toLegacyCompatibleSource = (source) => Object.freeze({
  ...source,
  tag: source.animeOnly ? "ANIME" : ["candidate", "experimental"].includes(source.releaseStatus) ? "EXP" : null,
  note: source.releaseStatus === "candidate" ? "Candidate" : source.releaseStatus === "experimental" ? "Experimental" : source.releaseStatus === "disabled" ? source.disabledReason : null,
  movieIdType: source.idPolicy.movie,
  tvIdType: source.idPolicy.tv,
  subtitleMode: source.subtitleStrategy === "url-param" ? "url" : source.subtitleStrategy === "provider" ? "provider" : "captured",
  health: LEGACY_HEALTH[source.releaseStatus],
  supportsProgress: source.progressStrategy !== "none",
  progressViaFrames: source.progressStrategy === "frame-video",
  movieUrl: source.buildMovieUrl,
  tvUrl: source.buildEpisodeUrl,
});

export const ALL_CINEMA_SOURCES = Object.freeze([
  ...primarySources,
  ...candidateSources,
  ...experimentalSources,
  ...disabledSources,
  allMangaSource,
].map(toLegacyCompatibleSource));

assertSourceRegistry(ALL_CINEMA_SOURCES);

// Compatibility collection consumed by existing Movie/TV controls. Disabled and
// quarantined providers stay available to diagnostics but never appear as choices.
export const PLAYER_SOURCES = Object.freeze(
  ALL_CINEMA_SOURCES.filter((source) => source.releaseStatus !== "disabled" && !source.quarantined),
);

export const DEFAULT_CINEMA_SOURCE_ID = "videasy";

let runtimeHealthRecords = [];

export function updateCinemaSourceHealth(records) {
  runtimeHealthRecords = Array.isArray(records)
    ? records.filter((record) => record?.sourceId && record?.mediaType)
    : [];
}

export function getCinemaSourceRuntimeHealth(sourceId, mediaType = null) {
  const matches = runtimeHealthRecords.filter((record) =>
    record.sourceId === sourceId && (!mediaType || record.mediaType === mediaType),
  );
  if (!matches.length) return null;
  return matches.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}

export const getRegisteredSource = (sourceId) =>
  ALL_CINEMA_SOURCES.find((source) => source.id === sourceId) || null;

export const getSource = (sourceId) =>
  PLAYER_SOURCES.find((source) => source.id === sourceId) ||
  PLAYER_SOURCES.find((source) => source.id === DEFAULT_CINEMA_SOURCE_ID) ||
  PLAYER_SOURCES[0];

export const normalizeSelectableSourceId = (sourceId, { anime = false } = {}) => {
  const source = PLAYER_SOURCES.find((entry) => entry.id === sourceId);
  if (source && Boolean(source.animeOnly) === anime) return source.id;
  if (anime) return PLAYER_SOURCES.find((entry) => entry.animeOnly)?.id || DEFAULT_CINEMA_SOURCE_ID;
  return DEFAULT_CINEMA_SOURCE_ID;
};

export const sourceHealth = (sourceId) => getRegisteredSource(sourceId)?.health || "unavailable";
export const sourceSubtitleMode = (sourceId) => getSource(sourceId)?.subtitleMode || "captured";
export const sourceIsExperimental = (sourceId) => ["candidate", "experimental"].includes(getRegisteredSource(sourceId)?.releaseStatus);
export const sourceSupportsProgress = (sourceId) => getSource(sourceId)?.supportsProgress ?? false;
export const sourceProgressViaFrames = (sourceId) => getSource(sourceId)?.progressViaFrames ?? false;
export const sourceIsAsync = (sourceId) => getSource(sourceId)?.async ?? false;

export function getSourceResumeParams(sourceId, seconds) {
  const source = getSource(sourceId);
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return source.resumeParam && value > 0 ? { [source.resumeParam]: value } : {};
}

export function resolveSourceMediaId(sourceId, type, ids = {}) {
  const source = getSource(sourceId);
  const policy = type === "movie" ? source.idPolicy.movie : source.idPolicy.tv;
  const tmdbId = ids.tmdbId ?? ids.id;
  const imdbId = ids.imdbId;
  if (policy === "imdb") return imdbId || tmdbId;
  if (policy === "imdb-preferred") return imdbId || tmdbId;
  return tmdbId || imdbId;
}

export function getSourceUrl(sourceId, type, ids, season, episode, extraParams = {}, accentColor = null, subtitleLang = null) {
  const source = getSource(sourceId);
  const mediaId = typeof ids === "object" && ids !== null ? resolveSourceMediaId(source.id, type, ids) : ids;
  const baseUrl = type === "movie"
    ? source.buildMovieUrl(mediaId)
    : source.buildEpisodeUrl(mediaId, season, episode);
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(source.params || {})) url.searchParams.set(key, value);
  if (accentColor && source.colorParam) url.searchParams.set(source.colorParam, accentColor.replace(/^#/, ""));
  if (subtitleLang && source.langParam) url.searchParams.set(source.langParam, subtitleLang);
  for (const [key, value] of Object.entries(extraParams || {})) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }
  return url.toString();
}

export function getNextNonAsyncSource(currentId) {
  const candidates = PLAYER_SOURCES.filter((source) => !source.async && !source.quarantined);
  if (!candidates.length) return null;
  const index = candidates.findIndex((source) => source.id === currentId);
  return candidates[index < 0 ? 0 : (index + 1) % candidates.length].id;
}

export function getNextHealthyNonAsyncSource(currentId, {
  includeExperimental = false,
  mediaType = null,
  attempted = [],
  now = Date.now(),
} = {}) {
  const attemptedIds = new Set([currentId, ...attempted].filter(Boolean));
  const baseEligible = PLAYER_SOURCES.filter((source) =>
    !source.async &&
    !source.quarantined &&
    !attemptedIds.has(source.id) &&
    (includeExperimental || source.releaseStatus === "primary"),
  );
  const notCoolingDown = (source) => {
    const health = getCinemaSourceRuntimeHealth(source.id, mediaType);
    return !health?.cooldownUntil || health.cooldownUntil <= now;
  };
  const healthy = baseEligible.filter(notCoolingDown);
  const fallbacks = PLAYER_SOURCES.filter((source) =>
    !source.async &&
    !source.quarantined &&
    !attemptedIds.has(source.id) &&
    (includeExperimental || ["primary", "candidate"].includes(source.releaseStatus)) &&
    notCoolingDown(source),
  );
  const candidates = healthy.length ? healthy : fallbacks.length ? fallbacks : baseEligible;
  if (!candidates.length) return null;
  const stateScore = { ready: 0, slow: 1, checking: 2, unknown: 3, degraded: 4, failed: 5, disabled: 6 };
  return [...candidates].sort((a, b) => {
    const aHealth = getCinemaSourceRuntimeHealth(a.id, mediaType);
    const bHealth = getCinemaSourceRuntimeHealth(b.id, mediaType);
    const aScore = stateScore[aHealth?.state || "unknown"] ?? 3;
    const bScore = stateScore[bHealth?.state || "unknown"] ?? 3;
    if (aScore !== bScore) return aScore - bScore;
    const aStartup = Number.isFinite(aHealth?.startupMs) ? aHealth.startupMs : Number.MAX_SAFE_INTEGER;
    const bStartup = Number.isFinite(bHealth?.startupMs) ? bHealth.startupMs : Number.MAX_SAFE_INTEGER;
    return aStartup - bStartup;
  })[0].id;
}

export const NEEDS_INTERCEPT = Object.freeze(PLAYER_SOURCES.map((source) => source.id));
