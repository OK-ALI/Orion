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

export interface MobilePlaybackSession {
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

export type TrailerPlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "embed-rejected"
  | "network-error"
  | "playback-error";

export type ShieldVerificationState =
  | "verified"
  | "limited"
  | "disabled"
  | "dependency-allowed"
  | "failed";

export interface PlaybackProgressV2 {
  schemaVersion: 2;
  media: MediaIdentity;
  currentTime: number;
  duration: number;
  percent: number;
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
