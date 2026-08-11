import type { EmbeddedSubtitleTrackV1, SubtitleDiscoveryState } from '@orion/shared/types';
import { searchSubtitlesWithOutcome, type SubtitleTrack } from '../../services/subtitles';

type InternalSubtitleTrack = EmbeddedSubtitleTrackV1 & { url?: string };

const sessionTracks = new Map<string, InternalSubtitleTrack>();
const MAX_TRACKS_PER_SESSION = 32;

function opaqueId(sessionId: string, provider: string, input: string | number): string {
  return `subtitle:${sessionId}:${provider}:${String(input).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
}

function formatFrom(value?: string): EmbeddedSubtitleTrackV1['format'] {
  const input = String(value || '').toLowerCase();
  if (/\.vtt(?:$|\?)/.test(input)) return 'vtt';
  if (/\.srt(?:$|\?)/.test(input)) return 'srt';
  if (/\.(ass|ssa)(?:$|\?)/.test(input)) return 'ass';
  return 'unknown';
}

function publicTrack(track: InternalSubtitleTrack): EmbeddedSubtitleTrackV1 {
  const { url: _url, ...safe } = track;
  return safe;
}

function register(sessionId: string, tracks: InternalSubtitleTrack[]): EmbeddedSubtitleTrackV1[] {
  const bounded = tracks.slice(0, MAX_TRACKS_PER_SESSION);
  for (const track of bounded) sessionTracks.set(track.id, track);
  return bounded.map(publicTrack);
}

export function clearSubtitleSession(sessionId: string) {
  for (const id of sessionTracks.keys()) {
    if (id.startsWith(`subtitle:${sessionId}:`)) sessionTracks.delete(id);
  }
}

export function getInternalSubtitleTrack(id: string): InternalSubtitleTrack | null {
  return sessionTracks.get(id) || null;
}

export function createObservedSubtitleTrack(sessionId: string, input: {
  provider: string;
  language?: string;
  label?: string;
  formatHint?: string;
  method?: EmbeddedSubtitleTrackV1['discoveryMethod'];
}): EmbeddedSubtitleTrackV1 {
  const language = String(input.language || 'und').slice(0, 12);
  const id = opaqueId(sessionId, input.provider, `${language}-${input.label || 'observed'}`);
  return register(sessionId, [{
    id,
    language,
    label: input.label || 'Provider subtitle track',
    format: formatFrom(input.formatHint),
    provider: input.provider,
    discoveryMethod: input.method || 'request-capture',
    availability: 'limited',
  }])[0];
}

export async function discoverExternalSubtitleTracks(input: {
  sessionId: string;
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  language?: string;
}): Promise<{ state: SubtitleDiscoveryState; tracks: EmbeddedSubtitleTrackV1[] }> {
  try {
    const outcome = await searchSubtitlesWithOutcome({
      tmdbId: input.tmdbId,
      mediaType: input.mediaType,
      season: input.season,
      episode: input.episode,
      languages: input.language || 'en',
    });
    const tracks = register(input.sessionId, outcome.tracks.map((result: SubtitleTrack, index) => ({
      id: opaqueId(input.sessionId, result.provider, result.id || index),
      language: result.lang || 'und',
      label: result.release_name || result.langLabel || 'External subtitle',
      format: formatFrom(result.url),
      provider: result.provider,
      discoveryMethod: 'external' as const,
      availability: result.url ? 'available' as const : 'limited' as const,
      url: result.url,
    })));
    return { state: tracks.length ? 'available' : outcome.state, tracks };
  } catch (error) {
    const message = String(error || '').toLowerCase();
    return { state: /network|offline/.test(message) ? 'offline' : 'provider-failure', tracks: [] };
  }
}
