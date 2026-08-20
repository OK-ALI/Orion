export interface PlaybackRouteIdentity {
  season: number | null;
  episode: number | null;
}

function positiveRouteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The playback source already falls back missing TV route coordinates to S1E1.
 * Persisted playback truth must use the same effective identity so verified
 * History/Progress never become title-level TV records.
 */
export function resolvePlaybackRouteIdentity(
  mediaType: 'movie' | 'tv',
  season?: unknown,
  episode?: unknown,
): PlaybackRouteIdentity {
  if (mediaType !== 'tv') {
    return { season: null, episode: null };
  }

  return {
    season: positiveRouteNumber(season) ?? 1,
    episode: positiveRouteNumber(episode) ?? 1,
  };
}
