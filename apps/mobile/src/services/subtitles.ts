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

/**
 * Fetch subtitle tracks from SubDL and Wyzie APIs matching Desktop logic
 */
export async function searchSubtitles(params: {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  languages?: string;
}): Promise<SubtitleTrack[]> {
  const { tmdbId, mediaType, season = 1, episode = 1, languages = 'en' } = params;
  const results: SubtitleTrack[] = [];
  const subdlApiKey = await SecureStore.getItemAsync(SUBDL_KEY_STORAGE).catch(() => null);

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

            results.push({
              id: `subdl_${sub.id || idx}`,
              file_id: `subdl_${sub.url || idx}`,
              lang: cleanLang,
              langLabel,
              release_name: release,
              url: sub.url ? (sub.url.startsWith('http') ? sub.url : `https://dl.subdl.com${sub.url}`) : undefined,
              provider: 'subdl',
            });
          });
        }
      }
    } catch (err) {
      console.warn('SubDL Search Error:', err);
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
    }
  } catch (err) {
    console.warn('Wyzie Subtitles Error:', err);
  }

  return results;
}
