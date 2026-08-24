export interface SubtitleTrack {
  id: string;
  file_id: string;
  lang: string;
  langLabel: string;
  release_name?: string;
  url?: string;
  provider: 'subdl' | 'wyzie';
}

export type SubtitleSearchState =
  | 'available'
  | 'no-results'
  | 'language-unavailable'
  | 'api-key-required'
  | 'provider-failure'
  | 'invalid-file'
  | 'offline';

export interface SubtitleSearchOutcome {
  tracks: SubtitleTrack[];
  state: SubtitleSearchState;
}

/**
 * Compatibility shim retained for older callers. Provider credentials are no longer
 * accepted or persisted on-device; Orion Mobile talks only to the subtitle broker.
 */
export async function setSubtitleProviderKey(_provider: 'subdl', _value: string | null): Promise<void> {
  return;
}

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

const LANG_MAP: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ar: 'Arabic',
  tr: 'Turkish',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ru: 'Russian',
};

function classifyNetworkFailure(error: unknown): 'offline' | 'provider-failure' {
  const message = String(error || '').toLowerCase();
  return /network|offline|failed to fetch|timed out|timeout/.test(message) ? 'offline' : 'provider-failure';
}

function subtitleBrokerBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_ORION_SUBTITLE_BROKER_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function safeBrokerSubtitleUrl(value: unknown, brokerOrigin: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === brokerOrigin && url.pathname.startsWith('/v1/subtitles/file/');
  } catch {
    return false;
  }
}

/** Fetch subtitle search results through Orion's server-side credential broker. */
export async function searchSubtitlesWithOutcome(params: {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  languages?: string;
}): Promise<SubtitleSearchOutcome> {
  const brokerBase = subtitleBrokerBaseUrl();
  if (!brokerBase) return { tracks: [], state: 'provider-failure' };

  const { tmdbId, mediaType, season = 1, episode = 1, languages = 'en' } = params;
  const brokerOrigin = new URL(brokerBase).origin;
  const searchUrl = new URL(`${brokerBase}/v1/subtitles/search`);
  searchUrl.searchParams.set('tmdb_id', tmdbId);
  searchUrl.searchParams.set('type', mediaType);
  searchUrl.searchParams.set('language', languages);
  if (mediaType === 'tv') {
    searchUrl.searchParams.set('season', String(season));
    searchUrl.searchParams.set('episode', String(episode));
  }

  try {
    const res = await fetch(searchUrl.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      if (res.status === 404) return { tracks: [], state: 'no-results' };
      return { tracks: [], state: 'provider-failure' };
    }

    const json = await res.json();
    const rawTracks = Array.isArray(json?.subtitles) ? json.subtitles : [];
    let sawInvalidFile = false;
    const tracks: SubtitleTrack[] = [];

    rawTracks.forEach((sub: any, idx: number) => {
      const provider = sub?.provider === 'subdl' || sub?.provider === 'wyzie' ? sub.provider : null;
      if (!provider || !safeBrokerSubtitleUrl(sub?.url, brokerOrigin)) {
        sawInvalidFile = true;
        return;
      }
      const rawLang = String(sub.lang || languages || 'und');
      const cleanLang = rawLang.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12) || 'und';
      const langLabel = String(sub.langLabel || LANG_MAP[cleanLang] || cleanLang.toUpperCase());
      const release = String(sub.release_name || `${langLabel} Subtitle`);
      const id = String(sub.id || `${provider}_${idx}`).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 100);
      tracks.push({
        id,
        file_id: String(sub.file_id || id).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 120),
        lang: cleanLang,
        langLabel,
        release_name: release,
        url: sub.url,
        provider,
      });
    });

    if (tracks.length) return { tracks, state: 'available' };
    if (sawInvalidFile) return { tracks: [], state: 'invalid-file' };
    const state = json?.state;
    if (state === 'language-unavailable') return { tracks: [], state };
    if (state === 'offline') return { tracks: [], state };
    if (state === 'provider-failure') return { tracks: [], state };
    return { tracks: [], state: 'no-results' };
  } catch (err) {
    return { tracks: [], state: classifyNetworkFailure(err) };
  }
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
