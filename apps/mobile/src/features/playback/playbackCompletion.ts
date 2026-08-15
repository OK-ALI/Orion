import type { MobilePlaybackState } from '@orion/shared/types';

export const PLAYBACK_COMPLETION_REMAINING_SECONDS = 20;
export const NEXT_EPISODE_COUNTDOWN_SECONDS = 5;

export interface PlaybackCompletionSample {
  verified: boolean;
  state: MobilePlaybackState;
  currentTime: number | null | undefined;
  duration: number | null | undefined;
}

export function isVerifiedPlaybackCompletion({
  verified,
  state,
  currentTime,
  duration,
}: PlaybackCompletionSample): boolean {
  if (!verified || !['playing', 'ended'].includes(state)) return false;
  const current = Number(currentTime);
  const total = Number(duration);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0 || current < 0) {
    return false;
  }
  const remaining = total - current;
  return remaining >= 0 && remaining <= PLAYBACK_COMPLETION_REMAINING_SECONDS;
}

export interface NextEpisodeCandidate {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  stillPath: string | null;
  airDate: string | null;
}

function localDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextReleasedEpisode(
  episodes: unknown,
  seasonNumber: number,
  currentEpisodeNumber: number,
  today = localDateKey(),
): NextEpisodeCandidate | null {
  if (!Array.isArray(episodes) || seasonNumber <= 0 || currentEpisodeNumber <= 0) return null;
  const next = episodes
    .filter((entry: any) => Number(entry?.episode_number) > currentEpisodeNumber)
    .sort((a: any, b: any) => Number(a?.episode_number) - Number(b?.episode_number))[0];
  if (!next) return null;
  const airDate = typeof next.air_date === 'string' && next.air_date.trim()
    ? next.air_date.slice(0, 10)
    : null;
  if (airDate && airDate > today) return null;
  return {
    seasonNumber,
    episodeNumber: Number(next.episode_number),
    name: String(next.name || `Episode ${Number(next.episode_number)}`),
    stillPath: typeof next.still_path === 'string' && next.still_path ? next.still_path : null,
    airDate,
  };
}
