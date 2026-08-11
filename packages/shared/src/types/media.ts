/**
 * Orion Shared Types — Media & Playback
 *
 * TypeScript ports of the JSDoc types from the desktop's contracts.js.
 * These are the canonical type definitions shared across desktop and mobile.
 */

// ── Media Identity ───────────────────────────────────────────────────────────
export interface MediaIdentity {
  id: number | string;
  mediaType: "movie" | "tv";
  title: string;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
}

// ── Playback Session ─────────────────────────────────────────────────────────
export interface PlaybackSession {
  media: MediaIdentity;
  sourceId: string;
  resolvedUrl: string | null;
  currentTime: number;
  duration: number;
  fullscreen: boolean;
  pipOpen: boolean;
}

export type MobilePlayerSurface = "native" | "embed";
export type MobilePlayerHudState =
  | "visible"
  | "hidden"
  | "pinned"
  | "sheet-open"
  | "buffering"
  | "error";

/** @deprecated Compatibility shape retained for pre-v3 callers. */
export interface MobilePlaybackSessionV1 {
  schemaVersion: 1;
  id: string;
  media: MediaIdentity;
  sourceId: string;
  surface: MobilePlayerSurface;
  currentTime: number;
  duration: number;
  paused: boolean;
  buffering: boolean;
  updatedAt: number;
}

export type MobilePlaybackState =
  | "loading"
  | "playing"
  | "paused"
  | "buffering"
  | "seeking"
  | "ended"
  | "error"
  | "unobservable";

export type MobilePlaybackEvidence =
  | "native-video-event"
  | "provider-video-event"
  | "provider-message"
  | "manual-watched"
  | "opened-only";

export interface MobilePlaybackSessionV2 {
  schemaVersion: 2;
  id: string;
  media: MediaIdentity;
  sourceId: string;
  surface: MobilePlayerSurface;
  state: MobilePlaybackState;
  verified: boolean;
  lastVerifiedTime: number | null;
  startedAt: number;
  updatedAt: number;
}

export type MobilePlaybackSession = MobilePlaybackSessionV1 | MobilePlaybackSessionV2;

export interface MobilePlaybackTelemetryV1 {
  schemaVersion: 1;
  sessionId: string;
  sourceId: string;
  sequence: number;
  evidence: MobilePlaybackEvidence;
  state: MobilePlaybackState;
  currentTime: number | null;
  duration: number | null;
  bufferedPosition: number | null;
  observedAt: number;
}

export interface PlaybackPresentationMetadata {
  posterPath: string | null;
  backdropPath: string | null;
  seriesTitle: string | null;
  episodeTitle: string | null;
}

export interface PlaybackProgressV3 {
  schemaVersion: 3;
  key: string;
  mediaIdentity: MediaIdentity;
  presentation: PlaybackPresentationMetadata;
  currentTime: number;
  duration: number;
  percent: number | null;
  sourceId: string | null;
  evidence: MobilePlaybackEvidence | null;
  sessionId: string | null;
  startedAt: number;
  lastPlayedAt: number;
  completed: boolean;
}

export interface ContinueWatchingEntry {
  key: string;
  progress: PlaybackProgressV3;
  displayProgress: "percentage" | "elapsed";
}

export type MobileResumeStrategy = "url-param" | "verified-seek" | "native" | "none";

export type PlaybackHandoffStatus =
  | "preparing"
  | "loading"
  | "seeking"
  | "confirmed"
  | "unconfirmed"
  | "failed"
  | "cancelled";

export interface PlaybackHandoffV1 {
  schemaVersion: 1;
  id: string;
  reason: "manual" | "automatic" | "return";
  fromSessionId: string | null;
  fromSourceId: string;
  targetSourceId: string;
  requestedTime: number | null;
  confirmedTime: number | null;
  strategy: MobileResumeStrategy;
  status: PlaybackHandoffStatus;
  attemptedSourceIds: string[];
  startedAt: number;
  updatedAt: number;
  failureCode: string | null;
}

export type TrailerPlaybackState =
  | "idle"
  | "preparing"
  | "ready"
  | "playing"
  | "paused"
  | "rotating"
  | "network-error"
  | "removed"
  | "private"
  | "embed-disabled"
  | "client-identity-error"
  | "playback-error"
  | "exhausted";

export type TrailerProvider = "YouTube" | "Vimeo";

export interface TrailerCandidateV1 {
  id: string;
  site: TrailerProvider;
  providerKey: string;
  name: string;
  type: string;
  official: boolean;
  language: string | null;
  country: string | null;
  publishedAt: number | null;
  size: number | null;
  season: number | null;
  scope: "title" | "season";
  score: number;
}

export type TrailerFailureCategory =
  | "invalid-request"
  | "html5-playback"
  | "removed"
  | "private"
  | "embed-disabled"
  | "client-identity"
  | "network"
  | "timeout"
  | "provider-error";

export interface TrailerProviderError {
  provider: TrailerProvider;
  category: TrailerFailureCategory;
  publicCode: number | string | null;
  retryable: boolean;
}

export interface TrailerAttemptV1 {
  candidateId: string;
  attempt: number;
  startedAt: number;
  endedAt: number | null;
  result: "pending" | "ready" | "playing" | "failed";
  error: TrailerProviderError | null;
}

export interface TrailerSessionV1 {
  id: string;
  mediaId: number;
  mediaType: "movie" | "tv";
  candidates: TrailerCandidateV1[];
  activeIndex: number;
  state: TrailerPlaybackState;
  attempts: TrailerAttemptV1[];
  startedAt: number;
}

export interface TrailerClientIdentity {
  applicationId: string;
  applicationVersion: string;
  origin: string;
  referrer: string;
}

export interface TrailerProviderAdapter {
  provider: TrailerProvider;
  createHtml(candidate: TrailerCandidateV1, identity: TrailerClientIdentity): string;
  classifyError(code: number | string | null): TrailerProviderError;
}

export type ShieldVerificationState =
  | "verified"
  | "limited"
  | "disabled"
  | "dependency-allowed"
  | "failed";

/** A renderer-safe subtitle reference. Provider URLs and request headers stay native/internal. */
export interface EmbeddedSubtitleTrackV1 {
  id: string;
  language: string;
  label: string;
  format: "vtt" | "srt" | "ass" | "unknown";
  provider: string;
  discoveryMethod: "url-param" | "text-track" | "request-capture" | "provider" | "external";
  availability: "available" | "limited" | "unavailable";
}

export type SubtitleDiscoveryState =
  | "idle"
  | "discovering"
  | "available"
  | "no-results"
  | "language-unavailable"
  | "api-key-required"
  | "provider-failure"
  | "invalid-file"
  | "offline";

export interface PlaybackProgressV2 {
  schemaVersion: 2;
  media: MediaIdentity;
  currentTime: number;
  duration: number;
  percent: number | null;
  sourceId: string | null;
  completed: boolean;
  updatedAt: number;
}

export type MobileResponsiveLayout =
  | "compact-phone"
  | "phone"
  | "tablet"
  | "large-tablet";

export type OrionThemeId =
  | "midnight-premiere"
  | "amoled"
  | "mocha"
  | "slate"
  | "projector-silver"
  | "custom";

export interface MobileThemePreferences {
  schemaVersion: 1;
  theme: OrionThemeId;
  followSystem: boolean;
  reducedMotion: boolean;
  customAccent?: string | null;
}

// ── Download Types ───────────────────────────────────────────────────────────
export type DownloadStatus =
  | "queued"
  | "preflighting"
  | "downloading"
  | "paused"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadProgress {
  progress: number;
  completedFragments?: number;
  totalFragments?: number;
  speed?: string;
  eta?: string;
  size?: string;
}

export interface DownloadRecord {
  schemaVersion: number;
  id: string;
  media: MediaIdentity;
  status: DownloadStatus;
  filePath: string | null;
  strategy: string;
  progress: DownloadProgress;
}

// ── Stream Candidates ────────────────────────────────────────────────────────
export interface StreamCandidateSummary {
  /** Opaque main-process identifier */
  id: string;
  kind: string;
  host: string;
  contentType: string;
  /** Redacted renderer-safe URL */
  displayUrl: string;
  capturedAt: number;
}

// ── Subtitles ────────────────────────────────────────────────────────────────
export interface SubtitleResult {
  provider: string;
  language: string;
  label: string;
  assetId: string;
  hearingImpaired: boolean;
}

// ── Settings ─────────────────────────────────────────────────────────────────
export interface SettingsSchema {
  startPage: string;
  downloadPath: string;
  downloadQuality: string;
  downloadConcurrency: number;
  theme: string;
  accentColor: string;
  closeToTray: boolean;
}

// ── TMDB API Types ───────────────────────────────────────────────────────────
export interface TmdbMediaItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  original_language?: string;
  origin_country?: string[];
  media_type?: "movie" | "tv";
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

export interface TmdbPaginatedResponse<T = TmdbMediaItem> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ── AniList Types ────────────────────────────────────────────────────────────
export interface AnilistTitle {
  romaji?: string;
  english?: string;
  native?: string;
}

export interface AnilistMedia {
  id: number;
  idMal?: number;
  title: AnilistTitle;
  description?: string;
  coverImage?: { extraLarge?: string; large?: string };
  bannerImage?: string;
  genres?: string[];
  averageScore?: number;
  episodes?: number;
  status?: string;
  season?: string;
  seasonYear?: number;
  studios?: { nodes: Array<{ name: string }> };
  startDate?: { year?: number; month?: number };
  relations?: {
    edges: Array<{
      relationType: string;
      node: {
        id: number;
        type: string;
        format: string;
        title: AnilistTitle;
        episodes?: number;
        startDate?: { year?: number; month?: number };
        seasonYear?: number;
      };
    }>;
  };
}

export interface AnilistSeason {
  seasonNum: number;
  id: number;
  title: string;
  episodes: number | null;
  year: number;
  month: number;
}

// ── Watchlist & Sync Types (Supabase) ────────────────────────────────────────
export interface WatchlistEntry {
  id: string;
  userId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  addedAt: string;
}

export interface WatchSession {
  id: string;
  userId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  season: number | null;
  episode: number | null;
  currentTime: number;
  duration: number;
  sourceId: string;
  updatedAt: string;
}
