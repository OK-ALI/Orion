import { getRegisteredSource, isManualAnimeProvider } from '@orion/shared/sources';
import { mmkvStorageAdapter } from '../../services/storageAdapter';

export type AnimeVariant = 'sub' | 'dub';
export interface AnimeSourceAffinity { providerId: string; variant: AnimeVariant }
const KEY = 'orion.player.anime-affinity.v1';
export const MAX_ANIME_AFFINITIES = 32;
type Entry = AnimeSourceAffinity & { tmdbId: string };
const flowChoices = new Map<string, AnimeSourceAffinity | { generalSourceId: string }>();
const validId = (id: string) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));

export function validAnimeAffinity(value: unknown): value is AnimeSourceAffinity {
  if (!value || typeof value !== 'object') return false;
  const entry = value as AnimeSourceAffinity;
  const source = getRegisteredSource(entry.providerId);
  return isManualAnimeProvider(entry.providerId) && source?.animeProvider?.variants.includes(entry.variant) === true
    && ['sub', 'dub'].includes(entry.variant);
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
export function preferredAnimeSource(tmdbId: string, routedSource?: string, routedVariant?: string,
  preference?: { sourceId: string; variant?: string } | null): AnimeSourceAffinity | null {
  const flow = getAnimeFlowChoice(tmdbId);
  if ((routedSource && !isManualAnimeProvider(routedSource)) || (flow && 'generalSourceId' in flow)) return null;
  const routed = { providerId: routedSource, variant: routedVariant };
  if (isManualAnimeProvider(routedSource) && validAnimeAffinity(routed)) return routed;
  if (isManualAnimeProvider(routedSource) && routedVariant != null) return null;
  if (flow && validAnimeAffinity(flow)) return flow;
  if (preference?.sourceId && !isManualAnimeProvider(preference.sourceId)) return null;
  const saved = { providerId: preference?.sourceId, variant: preference?.variant };
  // An unqualified provider requires explicit selection or a prior verified success.
  if (routedSource === 'anilink') return null;
  return (validAnimeAffinity(saved) ? saved : null) || (validAnimeAffinity({ providerId: 'aniembed', variant: 'sub' })
    ? { providerId: 'aniembed', variant: 'sub' } : null);
}
