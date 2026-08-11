import { SUBTITLE_LANGUAGES } from '@orion/shared/tokens';
import * as SecureStore from 'expo-secure-store';

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

const SUBDL_KEY_STORAGE = 'orion_mobile_subdl_api_key';

export async function setSubtitleProviderKey(provider: 'subdl', value: string | null) {
  if (provider !== 'subdl') return;
  if (value) await SecureStore.setItemAsync(SUBDL_KEY_STORAGE, value);
  else await SecureStore.deleteItemAsync(SUBDL_KEY_STORAGE);
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

function isSafeSubtitleUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function classifyNetworkFailure(error: unknown): 'offline' | 'provider-failure' {
  const message = String(error || '').toLowerCase();
  return /network|offline|failed to fetch|timed out|timeout/.test(message) ? 'offline' : 'provider-failure';
}

/** Fetch subtitle search results without surfacing provider URLs to presentation callers. */
export async function searchSubtitlesWithOutcome(params: {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  languages?: string;
}): Promise<SubtitleSearchOutcome> {
  const { tmdbId, mediaType, season = 1, episode = 1, languages = 'en' } = params;
  const results: SubtitleTrack[] = [];
  const subdlApiKey = await SecureStore.getItemAsync(SUBDL_KEY_STORAGE).catch(() => null);
  let sawProviderFailure = false;
  let sawOffline = false;
  let sawInvalidFile = false;

  // 1. Fetch from SubDL API if Key present
  if (subdlApiKey) {
    try {
      let subdlUrl = `https://api.subdl.com/api/v1/subtitles?api_key=${encodeURIComponent(subdlApiKey)}&tmdb_id=${tmdbId}&type=${mediaType}&languages=${languages}`;
      if (mediaType === 'tv') {
        subdlUrl += `&season_number=${season}&episode_number=${episode}`;
      }

      const res = await fetch(subdlUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.status && Array.isArray(json.subtitles)) {
          json.subtitles.forEach((sub: any, idx: number) => {
            const rawLang = sub.lang || languages;
            const cleanLang = rawLang.toLowerCase();
            const langLabel = sub.language_name || LANG_MAP[cleanLang] || cleanLang.toUpperCase();
            const release = sub.release_name || sub.film_name || sub.name || `${langLabel} Subtitle`;

            const url = sub.url ? (sub.url.startsWith('http') ? sub.url : `https://dl.subdl.com${sub.url}`) : undefined;
            if (!url || !isSafeSubtitleUrl(url)) {
              sawInvalidFile = true;
              return;
            }
            results.push({
              id: `subdl_${sub.id || idx}`,
              file_id: `subdl_${sub.url || idx}`,
              lang: cleanLang,
              langLabel,
              release_name: release,
              url,
              provider: 'subdl',
            });
          });
        }
      } else {
        sawProviderFailure = true;
      }
    } catch (err) {
      sawOffline ||= classifyNetworkFailure(err) === 'offline';
      sawProviderFailure ||= classifyNetworkFailure(err) === 'provider-failure';
    }
  }

  // 2. Wyzie's public search endpoint does not require a bundled credential.
  try {
    let wyzieUrl = `https://sub.wyzie.ru/search?id=${tmdbId}`;
    if (mediaType === 'tv') {
      wyzieUrl += `&season=${season}&episode=${episode}`;
    }

      const res = await fetch(wyzieUrl);
      if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        json.forEach((sub: any, idx: number) => {
          const rawLang = sub.display || sub.language || 'en';
          const cleanLang = rawLang.toLowerCase();
          const langLabel = sub.display || LANG_MAP[cleanLang] || cleanLang.toUpperCase();
          const release = sub.release || sub.filename || sub.media || sub.title || `${langLabel} Subtitle`;

          if (!isSafeSubtitleUrl(sub.url)) {
            sawInvalidFile = true;
            return;
          }
          results.push({
            id: `wyzie_${sub.id || idx}`,
            file_id: `wyzie_${sub.url || idx}`,
            lang: cleanLang,
            langLabel,
            release_name: release,
            url: sub.url,
            provider: 'wyzie',
          });
        });
      }
    } else {
      sawProviderFailure = true;
    }
  } catch (err) {
    sawOffline ||= classifyNetworkFailure(err) === 'offline';
    sawProviderFailure ||= classifyNetworkFailure(err) === 'provider-failure';
  }

  if (results.length) return { tracks: results, state: 'available' };
  if (sawOffline) return { tracks: [], state: 'offline' };
  if (sawProviderFailure) return { tracks: [], state: 'provider-failure' };
  if (sawInvalidFile) return { tracks: [], state: 'invalid-file' };
  return { tracks: [], state: 'no-results' };
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
