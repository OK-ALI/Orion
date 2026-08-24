import type { MobileDownloadTargetV1 } from './downloadIdentity';
import { searchSubtitlesWithOutcome, type SubtitleTrack } from '../../services/subtitles';

export type MobileDownloadSubtitleReadinessV1 =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'none'
  | 'offline'
  | 'provider-failure';

export interface MobileDownloadSubtitleOptionV1 {
  id: string;
  provider: 'subdl' | 'wyzie';
  providerLabel: 'SubDL' | 'Wyzie';
  language: string;
  languageLabel: string;
  label: string;
  format: 'vtt' | 'srt' | 'ass' | 'unknown';
}

export interface MobileDownloadSubtitleDiscoveryV1 {
  state: MobileDownloadSubtitleReadinessV1;
  tracks: MobileDownloadSubtitleOptionV1[];
  providers: Array<'SubDL' | 'Wyzie'>;
}

export interface MobileDownloadSubtitleSourceV1 extends MobileDownloadSubtitleOptionV1 {
  url: string;
}

const MAX_DOWNLOAD_SUBTITLES = 12;
const SUBTITLE_DISCOVERY_TIMEOUT_MS = 8_000;
const sourceRegistry = new Map<string, MobileDownloadSubtitleSourceV1>();

function formatFromUrl(url: string): MobileDownloadSubtitleOptionV1['format'] {
  const clean = url.toLowerCase().split('?')[0];
  if (clean.endsWith('.vtt')) return 'vtt';
  if (clean.endsWith('.srt')) return 'srt';
  if (clean.endsWith('.ass') || clean.endsWith('.ssa')) return 'ass';
  return 'unknown';
}

function cleanLabel(value: string | undefined, fallback: string): string {
  return String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || fallback;
}

function safeSource(track: SubtitleTrack): MobileDownloadSubtitleSourceV1 | null {
  if (!track.url || (track.provider !== 'subdl' && track.provider !== 'wyzie')) return null;
  let parsed: URL;
  try { parsed = new URL(track.url); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const format = formatFromUrl(track.url);
  if (format === 'unknown') return null;
  const language = String(track.lang || 'und').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'und';
  return {
    id: String(track.id).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 100),
    provider: track.provider,
    providerLabel: track.provider === 'subdl' ? 'SubDL' : 'Wyzie',
    language,
    languageLabel: cleanLabel(track.langLabel, language.toUpperCase()),
    label: cleanLabel(track.release_name, `${language.toUpperCase()} subtitle`),
    format,
    url: track.url,
  };
}

function publicTrack(track: MobileDownloadSubtitleSourceV1): MobileDownloadSubtitleOptionV1 {
  const { url: _url, ...safe } = track;
  return safe;
}

export async function discoverMobileDownloadSubtitlesV1(
  target: MobileDownloadTargetV1,
  language = 'en',
): Promise<MobileDownloadSubtitleDiscoveryV1> {
  sourceRegistry.clear();
  const outcome = await Promise.race([
    searchSubtitlesWithOutcome({
      tmdbId: String(target.media.id),
      mediaType: target.media.mediaType,
      season: target.media.season ?? undefined,
      episode: target.media.episode ?? undefined,
      languages: language,
    }),
    new Promise<{ tracks: SubtitleTrack[]; state: 'provider-failure' }>((resolve) => {
      setTimeout(() => resolve({ tracks: [], state: 'provider-failure' }), SUBTITLE_DISCOVERY_TIMEOUT_MS);
    }),
  ]);
  const sources = outcome.tracks.map(safeSource).filter((track): track is MobileDownloadSubtitleSourceV1 => Boolean(track)).slice(0, MAX_DOWNLOAD_SUBTITLES);
  for (const source of sources) sourceRegistry.set(source.id, source);
  const providers = Array.from(new Set(sources.map((source) => source.providerLabel)));
  if (sources.length) return { state: 'ready', tracks: sources.map(publicTrack), providers };
  if (outcome.state === 'offline') return { state: 'offline', tracks: [], providers: [] };
  if (outcome.state === 'provider-failure' || outcome.state === 'api-key-required') return { state: 'provider-failure', tracks: [], providers: [] };
  return { state: 'none', tracks: [], providers: [] };
}

export function getPreferredMobileDownloadSubtitleIdsV1(
  discovery: MobileDownloadSubtitleDiscoveryV1,
  language = 'en',
): string[] {
  if (discovery.state !== 'ready') return [];
  const preferred = discovery.tracks.find((track) => track.language.toLowerCase().startsWith(language.toLowerCase()));
  return preferred ? [preferred.id] : discovery.tracks[0] ? [discovery.tracks[0].id] : [];
}

/** Native-only handoff helper. UI callers never receive subtitle URLs. */
export function resolveMobileDownloadSubtitleSourcesForNativeV1(ids: readonly string[]): MobileDownloadSubtitleSourceV1[] {
  return ids.map((id) => sourceRegistry.get(id)).filter((track): track is MobileDownloadSubtitleSourceV1 => Boolean(track));
}
