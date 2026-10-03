import { getRegisteredSource } from '@orion/shared/sources';
import { mmkvStorageAdapter } from '../../services/storageAdapter';

export type AnimeVariant = 'sub' | 'dub';
export interface AnimeSourceAffinity { providerId: 'aniembed'; variant: AnimeVariant }
const KEY = 'orion.player.anime-affinity.v1';
export const MAX_ANIME_AFFINITIES = 32;
type Entry = AnimeSourceAffinity & { tmdbId: string };
const flowChoices = new Map<string, AnimeSourceAffinity | { generalSourceId: string }>();
const validId = (id: string) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));

export function validAnimeAffinity(value: unknown): value is AnimeSourceAffinity {
  if (!value || typeof value !== 'object') return false;
  const entry = value as AnimeSourceAffinity;
  const source = getRegisteredSource(entry.providerId);
  return entry.providerId === 'aniembed' && source?.animeOnly === true
    && source.routingMode === 'manual-only' && source.animeProvider?.playbackQualified === true
    && source.animeProvider.variants.includes(entry.variant) && ['sub', 'dub'].includes(entry.variant);
}

export function parseAnimeAffinities(raw: string | null): Entry[] {
  if (!raw || raw.length > 8192) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    return values.filter((value): value is Entry => {
      const id = value && typeof value === 'object' ? (value as Partial<Entry>).tmdbId : null;
      if (!validAnimeAffinity(value) || typeof id !== 'string' || !validId(id) || seen.has(id)) return false;
      seen.add(id); return true;
    }).slice(0, MAX_ANIME_AFFINITIES).map(({ tmdbId, providerId, variant }) => ({ tmdbId, providerId, variant }));
  } catch { return []; }
}

export function getAnimeAffinity(tmdbId: string): AnimeSourceAffinity | null {
  try {
    const entry = parseAnimeAffinities(mmkvStorageAdapter.get(KEY)).find((value) => value.tmdbId === tmdbId);
    return entry ? { providerId: entry.providerId, variant: entry.variant } : null;
  } catch { return null; }
}

/** Only verified successful playback persists affinity; progress stays in Orion's library. */
export function rememberAnimeAffinity(tmdbId: string, affinity: AnimeSourceAffinity): void {
  if (!validId(tmdbId) || !validAnimeAffinity(affinity)) return;
  try {
    const next = [{ tmdbId, providerId: affinity.providerId, variant: affinity.variant },
      ...parseAnimeAffinities(mmkvStorageAdapter.get(KEY)).filter((entry) => entry.tmdbId !== tmdbId)]
      .slice(0, MAX_ANIME_AFFINITIES);
    mmkvStorageAdapter.set(KEY, JSON.stringify(next));
  } catch { /* Storage failure cannot change verified playback or identity. */ }
}

export function setAnimeFlowChoice(tmdbId: string, choice: AnimeSourceAffinity | { generalSourceId: string }): void {
  if (!validId(tmdbId)) return;
  if ('generalSourceId' in choice) {
    const source = getRegisteredSource(choice.generalSourceId);
    if (!source || source.animeOnly || !source.media.tv) return;
  } else if (!validAnimeAffinity(choice)) return;
  flowChoices.delete(tmdbId); flowChoices.set(tmdbId, choice);
  if (flowChoices.size > MAX_ANIME_AFFINITIES) flowChoices.delete(flowChoices.keys().next().value!);
}

export function clearAnimeFlowChoice(tmdbId: string): void { flowChoices.delete(tmdbId); }
export function getAnimeFlowChoice(tmdbId: string) { return flowChoices.get(tmdbId) ?? null; }

/** Initial preference is Anime-scoped, independent of General Auto and download routing. */
export function preferredAnimeSource(tmdbId: string, routedSource?: string, routedVariant?: string): AnimeSourceAffinity | null {
  const flow = getAnimeFlowChoice(tmdbId);
  if ((routedSource && routedSource !== 'aniembed') || (flow && 'generalSourceId' in flow)) return null;
  const routed = { providerId: 'aniembed', variant: routedVariant };
  if (routedSource === 'aniembed' && validAnimeAffinity(routed)) return routed;
  if (routedSource === 'aniembed' && routedVariant != null) return null;
  if (flow && validAnimeAffinity(flow)) return flow;
  return getAnimeAffinity(tmdbId) || (validAnimeAffinity({ providerId: 'aniembed', variant: 'sub' })
    ? { providerId: 'aniembed', variant: 'sub' } : null);
}
