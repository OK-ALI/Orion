/**
 * Desktop cinema source policy.
 *
 * The shared registry remains the compatibility source of truth for adapters,
 * request manifests, and old saved identifiers. Desktop applies the accepted
 * 3.2.0 visibility/routing policy at this boundary so a retired source can
 * never become a UI choice or an automatic failover target.
 */

import {
  DEFAULT_CINEMA_SOURCE_ID as SHARED_DEFAULT_CINEMA_SOURCE_ID,
  PLAYER_SOURCES as SHARED_PLAYER_SOURCES,
  getCinemaSourceRuntimeHealth,
  getEffectivePlayerSources as getSharedEffectivePlayerSources,
} from "@orion/shared/sources";

export * from "@orion/shared/sources";

export const DESKTOP_RETIRED_SOURCE_IDS = Object.freeze(new Set([
  "videasy",
  "vidking",
  "vsembed",
]));

export const DESKTOP_QUARANTINED_SOURCE_IDS = Object.freeze(new Set([
  "autoembed",
]));

const DESKTOP_SOURCE_ORDER = Object.freeze([
  "vixsrc",
  "vidsrc",
  "vidlink",
  "111movies",
  "vidnest",
  "vidsrc-ir",
  "cinesrc",
]);

const DESKTOP_SOURCE_ORDER_INDEX = new Map(
  DESKTOP_SOURCE_ORDER.map((sourceId, index) => [sourceId, index]),
);

function isDesktopVisibleSource(source) {
  return Boolean(source)
    && !source.async
    && !source.animeOnly
    && source.releaseStatus !== "disabled"
    && source.availability !== "temporarily-unavailable"
    && !source.quarantined
    && !DESKTOP_QUARANTINED_SOURCE_IDS.has(source.id)
    && !DESKTOP_RETIRED_SOURCE_IDS.has(source.id)
    && DESKTOP_SOURCE_ORDER_INDEX.has(source.id);
}

function orderDesktopSources(sources) {
  return [...sources].sort(
    (left, right) => DESKTOP_SOURCE_ORDER_INDEX.get(left.id) - DESKTOP_SOURCE_ORDER_INDEX.get(right.id),
  );
}

export const DESKTOP_PLAYER_SOURCES = Object.freeze(orderDesktopSources(
  SHARED_PLAYER_SOURCES.filter(isDesktopVisibleSource),
));

// Compatibility aliases used throughout the existing Desktop renderer.
export const PLAYER_SOURCES = DESKTOP_PLAYER_SOURCES;

export const DESKTOP_DEFAULT_CINEMA_SOURCE_ID =
  DESKTOP_PLAYER_SOURCES.find((source) => source.id === "vixsrc")?.id
  ?? DESKTOP_PLAYER_SOURCES[0]?.id
  ?? SHARED_DEFAULT_CINEMA_SOURCE_ID;

export const DEFAULT_CINEMA_SOURCE_ID = DESKTOP_DEFAULT_CINEMA_SOURCE_ID;

export const DESKTOP_AUTOMATIC_PLAYER_SOURCES = Object.freeze(
  DESKTOP_PLAYER_SOURCES.filter(
    (source) => source.id === DESKTOP_DEFAULT_CINEMA_SOURCE_ID
      && source.routingMode === "automatic",
  ),
);

export const AUTOMATIC_PLAYER_SOURCES = DESKTOP_AUTOMATIC_PLAYER_SOURCES;

export function getEffectiveDesktopPlayerSources() {
  return orderDesktopSources(getSharedEffectivePlayerSources().filter(isDesktopVisibleSource));
}

export const getEffectivePlayerSources = getEffectiveDesktopPlayerSources;

export function getDesktopSource(sourceId) {
  const sources = getEffectiveDesktopPlayerSources();
  return sources.find((source) => source.id === sourceId)
    ?? sources.find((source) => source.id === DESKTOP_DEFAULT_CINEMA_SOURCE_ID)
    ?? DESKTOP_PLAYER_SOURCES[0]
    ?? null;
}

export const getSource = getDesktopSource;

export function normalizeDesktopSelectableSourceId(sourceId, { mediaType = null } = {}) {
  const source = getEffectiveDesktopPlayerSources().find((entry) => entry.id === sourceId);
  const supportsMedia = !mediaType
    || (mediaType === "movie" ? source?.media?.movie : source?.media?.tv);
  return source && supportsMedia ? source.id : DESKTOP_DEFAULT_CINEMA_SOURCE_ID;
}

export function normalizeSelectableSourceId(sourceId, options = {}) {
  const mediaType = options?.mediaType ?? (options?.anime ? "tv" : null);
  return normalizeDesktopSelectableSourceId(sourceId, { mediaType });
}

function automaticDesktopCandidates({ mediaType = null, attempted = [], now = Date.now() } = {}) {
  const attemptedIds = new Set(attempted.filter(Boolean));
  return getEffectiveDesktopPlayerSources().filter((source) => {
    const supportsMedia = !mediaType
      || (mediaType === "movie" ? source.media?.movie : source.media?.tv);
    const health = getCinemaSourceRuntimeHealth(source.id, mediaType);
    return source.id === DESKTOP_DEFAULT_CINEMA_SOURCE_ID
      && source.routingMode === "automatic"
      && supportsMedia
      && !attemptedIds.has(source.id)
      && (!health?.cooldownUntil || health.cooldownUntil <= now);
  });
}

export function getNextHealthyDesktopSource(
  currentId,
  { mediaType = null, attempted = [], now = Date.now() } = {},
) {
  const attemptedIds = [currentId, ...attempted].filter(Boolean);
  const candidates = automaticDesktopCandidates({ mediaType, attempted: attemptedIds, now });
  if (!candidates.length) return null;
  const stateScore = {
    ready: 0,
    slow: 1,
    checking: 2,
    unknown: 3,
    degraded: 4,
    failed: 5,
    disabled: 6,
  };
  return [...candidates].sort((left, right) => {
    const leftHealth = getCinemaSourceRuntimeHealth(left.id, mediaType);
    const rightHealth = getCinemaSourceRuntimeHealth(right.id, mediaType);
    const leftScore = stateScore[leftHealth?.state ?? "unknown"] ?? 3;
    const rightScore = stateScore[rightHealth?.state ?? "unknown"] ?? 3;
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftStartup = Number.isFinite(leftHealth?.startupMs)
      ? leftHealth.startupMs
      : Number.MAX_SAFE_INTEGER;
    const rightStartup = Number.isFinite(rightHealth?.startupMs)
      ? rightHealth.startupMs
      : Number.MAX_SAFE_INTEGER;
    return leftStartup - rightStartup;
  })[0].id;
}

export function getNextHealthyNonAsyncSource(currentId, options = {}) {
  return getNextHealthyDesktopSource(currentId, options);
}

export function getNextNonAsyncSource(currentId) {
  return getNextHealthyDesktopSource(currentId);
}
