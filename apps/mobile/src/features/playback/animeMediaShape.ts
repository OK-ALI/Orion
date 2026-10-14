import { getRegisteredSource, getSource, getSourceUrl, isManualAnimeProvider } from '@orion/shared/sources';
import type { CanonicalAnimeIdentity } from './animeCanonicalRepair';
import type { AnimeSourceAffinity } from './animeSourceAffinity';

const movieChoices = new Map<string, AnimeSourceAffinity | { generalSourceId: string }>();
const validMovieChoice = (value: unknown): value is AnimeSourceAffinity => {
  if (!value || typeof value !== 'object') return false;
  const choice = value as AnimeSourceAffinity;
  return mobileAnimeSupportsMedia(choice.providerId, 'movie') && ['sub', 'dub'].includes(choice.variant)
    && getRegisteredSource(choice.providerId)?.animeProvider?.variants.includes(choice.variant) === true;
};
export const getMovieAnimeFlowChoice = (id: string) => movieChoices.get(id) ?? null;
export const clearMovieAnimeFlowChoice = (id: string) => { movieChoices.delete(id); };
export function setMovieAnimeFlowChoice(id: string, choice: AnimeSourceAffinity | { generalSourceId: string }): void {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return;
  if ('generalSourceId' in choice) {
    const source = getRegisteredSource(choice.generalSourceId);
    if (!source || source.animeOnly || !source.media.movie) return;
  } else if (!validMovieChoice(choice)) return;
  movieChoices.delete(id); movieChoices.set(id, choice);
  if (movieChoices.size > 32) movieChoices.delete(movieChoices.keys().next().value!);
}
/** Separate film flow identity; TV choices and the existing durable Library stay intact. */
export function preferredMovieAnimeSource(id: string, routedSource?: string, routedVariant?: string,
  preference?: { sourceId: string; variant?: string } | null): AnimeSourceAffinity | null {
  const flow = getMovieAnimeFlowChoice(id);
  if ((routedSource && !isManualAnimeProvider(routedSource)) || (flow && 'generalSourceId' in flow)) return null;
  const routed = { providerId: routedSource, variant: routedVariant };
  if (isManualAnimeProvider(routedSource) && validMovieChoice(routed)) return routed;
  if (isManualAnimeProvider(routedSource) && routedVariant != null) return null;
  if (flow && validMovieChoice(flow)) return flow;
  if (preference?.sourceId && !isManualAnimeProvider(preference.sourceId)) return null;
  const saved = { providerId: preference?.sourceId, variant: preference?.variant };
  if (routedSource === 'anilink') return null;
  return validMovieChoice(saved) ? saved : { providerId: 'aniembed', variant: 'sub' };
}

/** Mobile-only qualification: both public players represent a film as one item.
 * This does not invent TMDb season/episode coordinates or change Desktop caps. */
export function mobileAnimeSupportsMedia(providerId: string, type: 'movie' | 'tv'): boolean {
  const source = getRegisteredSource(providerId);
  return Boolean(source && isManualAnimeProvider(providerId) && (source.media[type]
    || (type === 'movie' && ['aniembed', 'anilink'].includes(providerId))));
}

export function animeSelectionMatches(identity: CanonicalAnimeIdentity, id: string, type: 'movie' | 'tv', season: number | null, episode: number | null): boolean {
  if (identity.tmdbId !== id || !Number.isSafeInteger(identity.anilistId) || identity.anilistId <= 0) return false;
  return type === 'movie' ? 'mediaType' in identity && identity.mediaType === 'movie'
    : 'episode' in identity && identity.season === season && identity.episode === episode;
}

/** Restore a successful explicit film choice at the Anime player boundary only. */
export function getMobileAnimeFilmResumeSource(providerId: string | null | undefined, type: 'movie' | 'tv'): string | null {
  if (!providerId || type !== 'movie' || !mobileAnimeSupportsMedia(providerId, type)) return null;
  const effective = getSource(providerId);
  return effective.id === providerId && !effective.quarantined && effective.releaseStatus !== 'disabled'
    && effective.availability !== 'temporarily-unavailable' ? providerId : null;
}

export function getMobileAnimePlaybackUrl(providerId: string, identity: CanonicalAnimeIdentity, params: Record<string, string | number | null | undefined>): string {
  const film = 'mediaType' in identity && identity.mediaType === 'movie';
  if (!mobileAnimeSupportsMedia(providerId, film ? 'movie' : 'tv')) throw new Error('Unsupported Anime media shape.');
  // Provider ordinal 1 means the sole film content item. Canonical movie history
  // and routing remain movie:<TMDb ID>, without fabricated season/episode fields.
  const item = 'episode' in identity ? identity.providerEpisode ?? identity.episode : 1;
  const season = 'season' in identity ? identity.season : 1;
  if (typeof season !== 'number' || !Number.isSafeInteger(season) || season < 1
    || typeof item !== 'number' || !Number.isSafeInteger(item) || item < 1) throw new Error('Verified Anime item identity is required.');
  return getSourceUrl(providerId, 'tv', { tmdbId: identity.tmdbId, anilistId: identity.anilistId }, season, item, params);
}
