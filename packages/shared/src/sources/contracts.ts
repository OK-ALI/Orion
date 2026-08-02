/**
 * Cinema Source Contracts — TypeScript port
 *
 * Defines the source descriptor interface and validation logic.
 */

export const SOURCE_RELEASE_STATUSES = [
  "primary",
  "candidate",
  "experimental",
  "disabled",
] as const;

export const SOURCE_ID_POLICIES = [
  "tmdb",
  "imdb",
  "imdb-preferred",
  "async",
] as const;

export const SOURCE_PROGRESS_STRATEGIES = [
  "player-event",
  "frame-video",
  "native",
  "none",
] as const;

export const SOURCE_RESUME_STRATEGIES = [
  "url-param",
  "verified-seek",
  "native",
  "none",
] as const;

export const SOURCE_SUBTITLE_STRATEGIES = [
  "url-param",
  "request-capture",
  "text-track",
  "provider",
  "external",
] as const;

export type ReleaseStatus = (typeof SOURCE_RELEASE_STATUSES)[number];
export type IdPolicy = (typeof SOURCE_ID_POLICIES)[number];
export type ProgressStrategy = (typeof SOURCE_PROGRESS_STRATEGIES)[number];
export type ResumeStrategy = (typeof SOURCE_RESUME_STRATEGIES)[number];
export type SubtitleStrategy = (typeof SOURCE_SUBTITLE_STRATEGIES)[number];

export interface CinemaSourceDescriptor {
  id: string;
  label: string;
  releaseStatus: ReleaseStatus;
  media: { movie: boolean; tv: boolean; anime: boolean };
  idPolicy: { movie: IdPolicy; tv: IdPolicy };
  buildMovieUrl: (id: string | number) => string;
  buildEpisodeUrl: (id: string | number, season: number, episode: number) => string;
  expectedOrigins: string[];
  allowedNavigationOrigins: string[];
  requiredRequestOrigins: string[];
  progressStrategy: ProgressStrategy;
  resumeStrategy: ResumeStrategy;
  subtitleStrategy: SubtitleStrategy;
  supportsResume: boolean;
  supportsExternalSubtitles: boolean;
  supportsDownloads: boolean;
  /** Optional params */
  colorParam?: string;
  langParam?: string;
  resumeParam?: string;
  externalSubtitleParam?: string;
  externalSubtitleLabelParam?: string;
  params?: Record<string, string>;
  async?: boolean;
  animeOnly?: boolean;
  quarantined?: boolean;
  disabledReason?: string;
}

/**
 * Legacy-compatible source shape used by the desktop player.
 * The registry transforms CinemaSourceDescriptors into this format
 * so existing desktop code continues to work without changes.
 */
export interface LegacyCompatibleSource extends CinemaSourceDescriptor {
  tag: string | null;
  note: string | null;
  movieIdType: IdPolicy;
  tvIdType: IdPolicy;
  subtitleMode: "url" | "provider" | "captured";
  health: string;
  supportsProgress: boolean;
  progressViaFrames: boolean;
  movieUrl: (id: string | number) => string;
  tvUrl: (id: string | number, season: number, episode: number) => string;
}

const isFunction = (value: unknown): value is Function => typeof value === "function";
const isOrigin = (value: string): boolean => {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
};

export function validateSourceDescriptor(source: CinemaSourceDescriptor): string[] {
  const errors: string[] = [];
  if (!source || typeof source !== "object") return ["Source must be an object."];
  if (!source.id || !/^[a-z0-9-]+$/.test(source.id)) errors.push("id must be a stable lowercase identifier.");
  if (!source.label?.trim()) errors.push("label is required.");
  if (!(SOURCE_RELEASE_STATUSES as readonly string[]).includes(source.releaseStatus)) errors.push("releaseStatus is invalid.");
  if (!source.media || !["movie", "tv", "anime"].every((key) => typeof (source.media as Record<string, unknown>)[key] === "boolean")) {
    errors.push("media capabilities must be explicit booleans.");
  }
  if (!source.idPolicy || !(SOURCE_ID_POLICIES as readonly string[]).includes(source.idPolicy.movie) || !(SOURCE_ID_POLICIES as readonly string[]).includes(source.idPolicy.tv)) {
    errors.push("idPolicy must define supported movie and TV policies.");
  }
  if (source.media?.movie && !isFunction(source.buildMovieUrl)) errors.push("buildMovieUrl is required for movie sources.");
  if (source.media?.tv && !isFunction(source.buildEpisodeUrl)) errors.push("buildEpisodeUrl is required for TV sources.");
  for (const field of ["expectedOrigins", "allowedNavigationOrigins", "requiredRequestOrigins"] as const) {
    const arr = source[field];
    if (!Array.isArray(arr) || arr.some((value: string) => !isOrigin(value))) {
      errors.push(`${field} must contain normalized URL origins.`);
    }
  }
  if (!(SOURCE_PROGRESS_STRATEGIES as readonly string[]).includes(source.progressStrategy)) errors.push("progressStrategy is invalid.");
  if (!(SOURCE_RESUME_STRATEGIES as readonly string[]).includes(source.resumeStrategy)) errors.push("resumeStrategy is invalid.");
  if (!(SOURCE_SUBTITLE_STRATEGIES as readonly string[]).includes(source.subtitleStrategy)) errors.push("subtitleStrategy is invalid.");
  for (const field of ["supportsResume", "supportsExternalSubtitles", "supportsDownloads"] as const) {
    if (typeof source[field] !== "boolean") errors.push(`${field} must be boolean.`);
  }
  if (source.resumeStrategy === "url-param" && !source.resumeParam) errors.push("url-param resumeStrategy requires resumeParam.");
  if (!source.supportsResume && source.resumeStrategy !== "none") errors.push("non-resumable sources must use resumeStrategy none.");
  return errors;
}

export function assertSourceRegistry(sources: CinemaSourceDescriptor[]): true {
  const ids = new Set<string>();
  const failures: string[] = [];
  for (const source of sources) {
    const errors = validateSourceDescriptor(source);
    if (ids.has(source.id)) errors.push("id is duplicated.");
    ids.add(source.id);
    if (errors.length) failures.push(`${source.id || "unknown"}: ${errors.join(" ")}`);
  }
  if (failures.length) throw new Error(`Invalid Cinema source registry:\n${failures.join("\n")}`);
  return true;
}
