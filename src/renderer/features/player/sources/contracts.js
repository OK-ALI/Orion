export const SOURCE_RELEASE_STATUSES = Object.freeze([
  "primary",
  "candidate",
  "experimental",
  "disabled",
]);

export const SOURCE_ID_POLICIES = Object.freeze([
  "tmdb",
  "imdb",
  "imdb-preferred",
  "async",
]);

export const SOURCE_PROGRESS_STRATEGIES = Object.freeze([
  "player-event",
  "frame-video",
  "native",
  "none",
]);

export const SOURCE_SUBTITLE_STRATEGIES = Object.freeze([
  "url-param",
  "request-capture",
  "text-track",
  "provider",
  "external",
]);

/**
 * @typedef {Object} CinemaSourceDescriptor
 * @property {string} id
 * @property {string} label
 * @property {"primary"|"candidate"|"experimental"|"disabled"} releaseStatus
 * @property {{movie: boolean, tv: boolean, anime: boolean}} media
 * @property {{movie: string, tv: string}} idPolicy
 * @property {(id: string|number) => string} buildMovieUrl
 * @property {(id: string|number, season: number, episode: number) => string} buildEpisodeUrl
 * @property {string[]} expectedOrigins
 * @property {string[]} allowedNavigationOrigins
 * @property {string[]} requiredRequestOrigins
 * @property {"player-event"|"frame-video"|"native"|"none"} progressStrategy
 * @property {"url-param"|"request-capture"|"text-track"|"provider"|"external"} subtitleStrategy
 * @property {boolean} supportsResume
 * @property {boolean} supportsExternalSubtitles
 * @property {boolean} supportsDownloads
 */

const isFunction = (value) => typeof value === "function";
const isOrigin = (value) => {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
};

export function validateSourceDescriptor(source) {
  const errors = [];
  if (!source || typeof source !== "object") return ["Source must be an object."];
  if (!source.id || !/^[a-z0-9-]+$/.test(source.id)) errors.push("id must be a stable lowercase identifier.");
  if (!source.label?.trim()) errors.push("label is required.");
  if (!SOURCE_RELEASE_STATUSES.includes(source.releaseStatus)) errors.push("releaseStatus is invalid.");
  if (!source.media || !["movie", "tv", "anime"].every((key) => typeof source.media[key] === "boolean")) {
    errors.push("media capabilities must be explicit booleans.");
  }
  if (!source.idPolicy || !SOURCE_ID_POLICIES.includes(source.idPolicy.movie) || !SOURCE_ID_POLICIES.includes(source.idPolicy.tv)) {
    errors.push("idPolicy must define supported movie and TV policies.");
  }
  if (source.media?.movie && !isFunction(source.buildMovieUrl)) errors.push("buildMovieUrl is required for movie sources.");
  if (source.media?.tv && !isFunction(source.buildEpisodeUrl)) errors.push("buildEpisodeUrl is required for TV sources.");
  for (const field of ["expectedOrigins", "allowedNavigationOrigins", "requiredRequestOrigins"]) {
    if (!Array.isArray(source[field]) || source[field].some((value) => !isOrigin(value))) {
      errors.push(`${field} must contain normalized URL origins.`);
    }
  }
  if (!SOURCE_PROGRESS_STRATEGIES.includes(source.progressStrategy)) errors.push("progressStrategy is invalid.");
  if (!SOURCE_SUBTITLE_STRATEGIES.includes(source.subtitleStrategy)) errors.push("subtitleStrategy is invalid.");
  for (const field of ["supportsResume", "supportsExternalSubtitles", "supportsDownloads"]) {
    if (typeof source[field] !== "boolean") errors.push(`${field} must be boolean.`);
  }
  return errors;
}

export function assertSourceRegistry(sources) {
  const ids = new Set();
  const failures = [];
  for (const source of sources) {
    const errors = validateSourceDescriptor(source);
    if (ids.has(source.id)) errors.push("id is duplicated.");
    ids.add(source.id);
    if (errors.length) failures.push(`${source.id || "unknown"}: ${errors.join(" ")}`);
  }
  if (failures.length) throw new Error(`Invalid Cinema source registry:\n${failures.join("\n")}`);
  return true;
}
