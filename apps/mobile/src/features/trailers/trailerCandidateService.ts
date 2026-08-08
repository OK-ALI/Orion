import type { TrailerCandidateV1, TrailerProvider } from '@orion/shared/types';

const TYPE_SCORE: Record<string, number> = {
  trailer: 420,
  teaser: 300,
  clip: 120,
  featurette: 80,
};

const TITLE_PENALTIES = [
  'reaction', 'review', 'recap', 'interview', 'behind the scenes', 'making of',
  'bloopers', 'breakdown', 'fan made', 'fan-made', 'tv spot', 'commercial',
  'soundtrack', 'theme song', 'opening credits', 'ending credits',
];

export interface TmdbTrailerVideo {
  id?: string;
  key?: string;
  name?: string;
  site?: string;
  type?: string;
  official?: boolean;
  iso_639_1?: string;
  iso_3166_1?: string;
  published_at?: string;
  size?: number;
  seasonNum?: number;
}

function providerOf(site: string | undefined): TrailerProvider | null {
  const normalized = String(site || '').toLowerCase();
  if (normalized === 'youtube') return 'YouTube';
  if (normalized === 'vimeo') return 'Vimeo';
  return null;
}

function score(candidate: Omit<TrailerCandidateV1, 'score'>, preferredLanguage: string, originalLanguage: string) {
  const type = candidate.type.toLowerCase();
  const name = candidate.name.toLowerCase();
  let value = TYPE_SCORE[type] ?? 20;
  if (candidate.official) value += 500;
  if (candidate.language === preferredLanguage) value += 180;
  else if (candidate.language === originalLanguage) value += 130;
  else if (candidate.language === 'en') value += 100;
  if (candidate.scope === 'season') value += 90;
  if (candidate.site === 'YouTube') value += 10;
  value += Math.min(80, Math.max(0, (candidate.size || 0) / 27));
  if (candidate.publishedAt) {
    const publishedYear = new Date(candidate.publishedAt).getUTCFullYear();
    value += Math.max(0, Math.min(70, publishedYear - 1960));
  }
  for (const phrase of TITLE_PENALTIES) if (name.includes(phrase)) value -= 260;
  return Math.round(value);
}

export function normalizeTrailerCandidates(
  titleVideos: TmdbTrailerVideo[],
  seasonVideos: TmdbTrailerVideo[],
  preferredLanguage = 'en',
  originalLanguage = preferredLanguage,
): TrailerCandidateV1[] {
  const seen = new Set<string>();
  const candidates: TrailerCandidateV1[] = [];
  for (const [videos, scope] of [[titleVideos, 'title'], [seasonVideos, 'season']] as const) {
    for (const video of videos) {
      const site = providerOf(video.site);
      const providerKey = String(video.key || '').trim();
      if (!site || !providerKey) continue;
      const id = `${site.toLowerCase()}:${providerKey}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const base: Omit<TrailerCandidateV1, 'score'> = {
        id,
        site,
        providerKey,
        name: `${scope === 'season' && video.seasonNum ? `Season ${video.seasonNum}: ` : ''}${video.name || video.type || 'Trailer'}`,
        type: String(video.type || 'Video'),
        official: video.official === true,
        language: video.iso_639_1 || null,
        country: video.iso_3166_1 || null,
        publishedAt: video.published_at ? Date.parse(video.published_at) || null : null,
        size: Number.isFinite(video.size) ? Number(video.size) : null,
        season: Number.isFinite(video.seasonNum) ? Number(video.seasonNum) : null,
        scope,
      };
      candidates.push({ ...base, score: score(base, preferredLanguage, originalLanguage) });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
