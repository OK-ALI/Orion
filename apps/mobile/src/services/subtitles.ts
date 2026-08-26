import * as SecureStore from 'expo-secure-store';

export interface SubtitleTrack {
  id: string;
  file_id: string;
  lang: string;
  langLabel: string;
  release_name?: string;
  url?: string;
  provider: 'subdl' | 'wyzie';
  format?: 'vtt' | 'srt' | 'ass' | 'unknown';
}

export type SubtitleSearchState =
  | 'available'
  | 'no-results'
  | 'language-unavailable'
  | 'api-key-required'
  | 'invalid-key'
  | 'quota-or-rate-limited'
  | 'provider-failure'
  | 'invalid-file'
  | 'offline';

export interface SubtitleSearchOutcome {
  tracks: SubtitleTrack[];
  state: SubtitleSearchState;
  providerOutcomes: Record<'subdl' | 'wyzie', SubtitleProviderOutcome>;
}

export interface SubtitleProviderOutcome {
  configured: boolean;
  state: SubtitleSearchState | 'not-configured';
  count: number;
}

export interface SubtitleProviderConfiguration {
  subdl: boolean;
  wyzie: boolean;
}

const SUBDL_KEY_NAME = 'orion.mobile.subtitles.subdl.v1';
const WYZIE_KEY_NAME = 'orion.mobile.subtitles.wyzie.v1';
const SEARCH_TIMEOUT_MS = 12_000;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ru', label: 'Russian' },
];

const LANG_MAP: Record<string, string> = Object.fromEntries(SUPPORTED_LANGUAGES.map((entry) => [entry.code, entry.label]));

function providerStorageKey(provider: 'subdl' | 'wyzie'): string {
  return provider === 'subdl' ? SUBDL_KEY_NAME : WYZIE_KEY_NAME;
}

function cleanProviderKey(provider: 'subdl' | 'wyzie', value: string | null | undefined): string | null {
  const key = String(value || '').trim();
  if (!key || /[\r\n\u0000-\u001f\u007f]/.test(key)) return null;
  if (provider === 'subdl') return key.length >= 8 && key.length <= 240 ? key : null;
  return /^wyzie-[A-Za-z0-9_-]{6,220}$/i.test(key) ? key : null;
}

export async function setSubtitleProviderKey(provider: 'subdl' | 'wyzie', value: string | null): Promise<void> {
  const storageKey = providerStorageKey(provider);
  const raw = String(value || '').trim();
  const cleaned = cleanProviderKey(provider, raw);
  if (raw && !cleaned) {
    throw new Error(provider === 'subdl' ? 'Enter a valid SubDL API key.' : 'Enter a valid Wyzie API key beginning with wyzie-.');
  }
  try {
    if (cleaned) await SecureStore.setItemAsync(storageKey, cleaned);
    else await SecureStore.deleteItemAsync(storageKey);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Enter a valid ')) throw error;
    throw new Error('Orion could not update protected subtitle provider storage.');
  }
}

export async function getSubtitleProviderKey(provider: 'subdl' | 'wyzie'): Promise<string | null> {
  try {
    return cleanProviderKey(provider, await SecureStore.getItemAsync(providerStorageKey(provider)));
  } catch {
    return null;
  }
}

export async function getSubtitleProviderConfiguration(): Promise<SubtitleProviderConfiguration> {
  const [subdl, wyzie] = await Promise.all([getSubtitleProviderKey('subdl'), getSubtitleProviderKey('wyzie')]);
  return { subdl: Boolean(subdl), wyzie: Boolean(wyzie) };
}

function classifyNetworkFailure(error: unknown): 'offline' | 'provider-failure' {
  const message = String(error || '').toLowerCase();
  return /network|offline|failed to fetch|timed out|timeout|abort/.test(message) ? 'offline' : 'provider-failure';
}

function cleanLanguage(value: unknown, fallback = 'und'): string {
  return String(value || fallback).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12) || fallback;
}

function cleanText(value: unknown, fallback: string, max = 120): string {
  return String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) || fallback;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type InternalSubtitleSearchOutcome = Pick<SubtitleSearchOutcome, 'tracks' | 'state'>;

async function searchSubDL(params: {
  key: string;
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  languages: string;
}): Promise<InternalSubtitleSearchOutcome> {
  const query = new URLSearchParams({
    api_key: params.key,
    tmdb_id: params.tmdbId,
    type: params.mediaType === 'tv' ? 'tv' : 'movie',
    subs_per_page: '30',
  });
  if (params.mediaType === 'tv' && params.season != null) query.set('season_number', String(params.season));
  if (params.mediaType === 'tv' && params.episode != null) query.set('episode_number', String(params.episode));
  if (params.languages) query.set('languages', params.languages.split('-')[0].toUpperCase());

  try {
    const response = await fetchWithTimeout(`https://api.subdl.com/api/v1/subtitles?${query.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) return { tracks: [], state: 'invalid-key' };
    if (response.status === 402 || response.status === 429) return { tracks: [], state: 'quota-or-rate-limited' };
    if (!response.ok) return { tracks: [], state: 'provider-failure' };
    const json = await response.json();
    if (json?.status === false) {
      const message = String(json?.message || json?.error || '').toLowerCase();
      return { tracks: [], state: /key|auth|unauthor|forbidden/.test(message) ? 'invalid-key' : 'no-results' };
    }
    const values = Array.isArray(json?.subtitles) ? json.subtitles : [];
    const tracks = values.flatMap((sub: any, index: number): SubtitleTrack[] => {
      const relative = String(sub?.url || '').trim();
      if (!relative || !relative.startsWith('/')) return [];
      const lang = cleanLanguage(sub?.lang, params.languages || 'und');
      const id = cleanText(`subdl_${sub?.sd_id ?? index}`, `subdl_${index}`, 100).replace(/[^A-Za-z0-9._:-]/g, '');
      return [{
        id,
        file_id: id,
        lang,
        langLabel: cleanText(LANG_MAP[lang] || lang.toUpperCase(), lang.toUpperCase(), 60),
        release_name: cleanText(sub?.release_name || sub?.name, `${lang.toUpperCase()} subtitle`),
        url: `https://dl.subdl.com${relative}`,
        provider: 'subdl',
      }];
    });
    return tracks.length ? { tracks, state: 'available' } : { tracks: [], state: 'no-results' };
  } catch (error) {
    return { tracks: [], state: classifyNetworkFailure(error) };
  }
}

async function searchWyzie(params: {
  key: string;
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  languages: string;
}): Promise<InternalSubtitleSearchOutcome> {
  const query = new URLSearchParams({ id: params.tmdbId, format: 'srt', key: params.key });
  if (params.languages) query.set('language', params.languages);
  if (params.mediaType === 'tv' && params.season != null) query.set('season', String(params.season));
  if (params.mediaType === 'tv' && params.episode != null) query.set('episode', String(params.episode));

  try {
    const response = await fetchWithTimeout(`https://sub.wyzie.io/search?${query.toString()}`, { headers: { Accept: 'application/json' } });
    if (response.status === 401 || response.status === 403) return { tracks: [], state: 'invalid-key' };
    if (response.status === 402 || response.status === 429) return { tracks: [], state: 'quota-or-rate-limited' };
    if (!response.ok) return { tracks: [], state: 'provider-failure' };
    const json = await response.json();
    if (!Array.isArray(json)) {
      const message = String(json?.message || json?.error || '').toLowerCase();
      return { tracks: [], state: /key|auth|unauthor|forbidden/.test(message) ? 'invalid-key' : 'no-results' };
    }
    const values = json;
    const tracks = values.flatMap((sub: any, index: number): SubtitleTrack[] => {
      const rawUrl = String(sub?.url || '').trim();
      const url = rawUrl.startsWith('https://') ? rawUrl : rawUrl.startsWith('/') ? `https://sub.wyzie.io${rawUrl}` : '';
      if (!url) return [];
      const lang = cleanLanguage(sub?.language, params.languages || 'und');
      const id = cleanText(`wyzie_${sub?.id ?? index}_${Math.abs(hashString(url))}`, `wyzie_${index}`, 100).replace(/[^A-Za-z0-9._:-]/g, '');
      const rawFormat = cleanText(sub?.format, 'unknown', 12).toLowerCase();
      const format = rawFormat === 'srt' || rawFormat === 'vtt' || rawFormat === 'ass' ? rawFormat : 'unknown';
      return [{
        id,
        file_id: id,
        lang,
        langLabel: cleanText(sub?.display || LANG_MAP[lang] || lang.toUpperCase(), lang.toUpperCase(), 60),
        release_name: cleanText(sub?.release || sub?.fileName || sub?.display || sub?.name, `${lang.toUpperCase()} subtitle`),
        url,
        provider: 'wyzie',
        format,
      }];
    });
    return tracks.length ? { tracks, state: 'available' } : { tracks: [], state: 'no-results' };
  } catch (error) {
    return { tracks: [], state: classifyNetworkFailure(error) };
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return hash;
}

/**
 * Direct user-owned subtitle discovery. Keys live only in SecureStore and are
 * read for the duration of provider requests. They are never exported through
 * EXPO_PUBLIC_* variables or copied into the durable download repository.
 */
export async function searchSubtitlesWithOutcome(params: {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  languages?: string;
}): Promise<SubtitleSearchOutcome> {
  const { tmdbId, mediaType, season, episode, languages = 'en' } = params;
  const [subdlKey, wyzieKey] = await Promise.all([getSubtitleProviderKey('subdl'), getSubtitleProviderKey('wyzie')]);
  const searches: Array<{ provider: 'subdl' | 'wyzie'; request: Promise<InternalSubtitleSearchOutcome> }> = [];
  if (subdlKey) searches.push({ provider: 'subdl', request: searchSubDL({ key: subdlKey, tmdbId, mediaType, season, episode, languages }) });
  if (wyzieKey) searches.push({ provider: 'wyzie', request: searchWyzie({ key: wyzieKey, tmdbId, mediaType, season, episode, languages }) });
  const providerOutcomes: SubtitleSearchOutcome['providerOutcomes'] = {
    subdl: { configured: Boolean(subdlKey), state: subdlKey ? 'provider-failure' : 'not-configured', count: 0 },
    wyzie: { configured: Boolean(wyzieKey), state: wyzieKey ? 'provider-failure' : 'not-configured', count: 0 },
  };
  if (!searches.length) return { tracks: [], state: 'api-key-required', providerOutcomes };

  const resolved = await Promise.all(searches.map(async ({ provider, request }) => ({ provider, outcome: await request })));
  for (const { provider, outcome } of resolved) {
    providerOutcomes[provider] = { configured: true, state: outcome.state, count: outcome.tracks.length };
  }
  const tracks = resolved.flatMap(({ outcome }) => outcome.tracks).slice(0, 60);
  if (tracks.length) return { tracks, state: 'available', providerOutcomes };
  const outcomes = resolved.map(({ outcome }) => outcome);
  if (outcomes.some((outcome) => outcome.state === 'invalid-key')) return { tracks: [], state: 'invalid-key', providerOutcomes };
  if (outcomes.some((outcome) => outcome.state === 'quota-or-rate-limited')) return { tracks: [], state: 'quota-or-rate-limited', providerOutcomes };
  if (outcomes.every((outcome) => outcome.state === 'offline')) return { tracks: [], state: 'offline', providerOutcomes };
  if (outcomes.some((outcome) => outcome.state === 'provider-failure')) return { tracks: [], state: 'provider-failure', providerOutcomes };
  return { tracks: [], state: 'no-results', providerOutcomes };
}

/** Backwards-compatible legacy track-only result. */
export async function searchSubtitles(params: {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  languages?: string;
}): Promise<SubtitleTrack[]> {
  return (await searchSubtitlesWithOutcome(params)).tracks;
}

/*
 * The former broker implementation is intentionally not used by active Mobile
 * discovery. Keeping this file as the compatibility owner avoids creating a
 * second subtitle service while the direct user-owned model is physically proven.
 */
