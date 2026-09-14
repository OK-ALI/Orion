import type { MusicSourceRef, MusicTrack } from "../../domain/music";

/**
 * Stable queue intent. This is safe to persist because it contains no provider
 * playback URL or authorization header.
 */
export interface PlaybackQueueIntentItem {
  queueId: string;
  track: MusicTrack;
  streamingProvider: MusicSourceRef;
}

/**
 * Ephemeral playback lease produced by a streaming provider just before use.
 * WAVEN must never serialize this object into durable queue/library state.
 */
export interface ResolvedPlaybackSource {
  uri: string;
  headers?: Readonly<Record<string, string>>;
  mimeType?: string | null;
  expiresAtMs?: number | null;
}

/**
 * Native queue entry. `resolvedSource` is optional by design: unresolved
 * entries can stay in queue intent until JIT resolution is actually needed.
 */
export interface NativePlaybackQueueItem extends PlaybackQueueIntentItem {
  resolvedSource?: ResolvedPlaybackSource | null;
}

export const PLAYBACK_STATES = [
  "idle",
  "buffering",
  "ready",
  "playing",
  "paused",
  "ended",
  "error",
] as const;

export type PlaybackState = (typeof PLAYBACK_STATES)[number];

export const PLAYBACK_ERROR_CODES = [
  "source-unresolved",
  "source-expired",
  "source-invalid",
  "network",
  "decoder",
  "permission",
  "native-unavailable",
  "unknown",
] as const;

export type PlaybackErrorCode = (typeof PLAYBACK_ERROR_CODES)[number];

export interface PlaybackError {
  code: PlaybackErrorCode;
  message: string;
  queueId?: string | null;
  recoverable: boolean;
}

export interface PlaybackSnapshot {
  state: PlaybackState;
  queueIds: readonly string[];
  currentQueueId: string | null;
  currentIndex: number;
  positionMs: number;
  durationMs: number | null;
  playing: boolean;
  buffering: boolean;
  repeatMode: "off" | "one" | "all";
  shuffleEnabled: boolean;
  error: PlaybackError | null;
}
