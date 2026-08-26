import type { MobileDownloadTargetV1 } from './downloadIdentity';
import { searchSubtitlesWithOutcome, type SubtitleProviderOutcome, type SubtitleSearchOutcome, type SubtitleTrack } from '../../services/subtitles';

export type MobileDownloadSubtitleReadinessV1 =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'none'
  | 'offline'
  | 'provider-key-required'
  | 'provider-key-invalid'
  | 'provider-limited'
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
  providerOutcomes: Record<'subdl' | 'wyzie', SubtitleProviderOutcome>;
}

export interface MobileDownloadSubtitleSourceV1 extends MobileDownloadSubtitleOptionV1 {
  url: string;
}

const MAX_DOWNLOAD_SUBTITLES = 12;
const SUBTITLE_DISCOVERY_TIMEOUT_MS = 8_000;
const sourceRegistry = new Map<string, MobileDownloadSubtitleSourceV1>();

function formatFromUrl(url: string): MobileDownloadSubtitleOptionV1['format'] {
  let queryFormat = '';
  try { queryFormat = new URL(url).searchParams.get('format')?.toLowerCase() || ''; } catch {}
  if (queryFormat === 'vtt' || queryFormat === 'srt' || queryFormat === 'ass') return queryFormat;
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
  const format = track.format && track.format !== 'unknown' ? track.format : formatFromUrl(track.url);
  if (format === 'unknown' && track.provider !== 'subdl') return null;
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
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const outcome = await Promise.race([
    searchSubtitlesWithOutcome({
      tmdbId: String(target.media.id),
      mediaType: target.media.mediaType,
      season: target.media.season ?? undefined,
      episode: target.media.episode ?? undefined,
      languages: language,
    }),
    new Promise<SubtitleSearchOutcome>((resolve) => {
      timeout = setTimeout(() => resolve({
        tracks: [],
        state: 'provider-failure',
        providerOutcomes: {
          subdl: { configured: false, state: 'provider-failure', count: 0 },
          wyzie: { configured: false, state: 'provider-failure', count: 0 },
        },
      }), SUBTITLE_DISCOVERY_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timeout !== null) clearTimeout(timeout);
  });
  const sources = outcome.tracks.map(safeSource).filter((track): track is MobileDownloadSubtitleSourceV1 => Boolean(track)).slice(0, MAX_DOWNLOAD_SUBTITLES);
  for (const source of sources) sourceRegistry.set(source.id, source);
  const providers = Array.from(new Set(sources.map((source) => source.providerLabel)));
  if (sources.length) return { state: 'ready', tracks: sources.map(publicTrack), providers, providerOutcomes: outcome.providerOutcomes };
  if (outcome.state === 'offline') return { state: 'offline', tracks: [], providers: [], providerOutcomes: outcome.providerOutcomes };
  if (outcome.state === 'api-key-required') return { state: 'provider-key-required', tracks: [], providers: [], providerOutcomes: outcome.providerOutcomes };
  if (outcome.state === 'invalid-key') return { state: 'provider-key-invalid', tracks: [], providers: [], providerOutcomes: outcome.providerOutcomes };
  if (outcome.state === 'quota-or-rate-limited') return { state: 'provider-limited', tracks: [], providers: [], providerOutcomes: outcome.providerOutcomes };
  if (outcome.state === 'provider-failure') return { state: 'provider-failure', tracks: [], providers: [], providerOutcomes: outcome.providerOutcomes };
  return { state: 'none', tracks: [], providers: [], providerOutcomes: outcome.providerOutcomes };
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
