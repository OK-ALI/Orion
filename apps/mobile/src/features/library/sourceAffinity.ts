import type { IStorageAdapter } from '@orion/shared/api';
import type { MobilePlaybackEvidence } from '@orion/shared/types';
import { getEffectivePlayerSources } from '@orion/shared/sources';
import { canPersistVerifiedPlayback } from '../playback/playbackEvidence';

export type SourceVariant = 'sub' | 'dub' | 'raw';
export interface SourcePreference { sourceId: string; variant?: SourceVariant }
interface Entry extends SourcePreference { key: string; updatedAt: number }
const KEY = 'sourceAffinityV1';
export const MAX_SOURCE_AFFINITIES = 200;
const excluded = new Set(['local', 'videasy', 'vsembed', 'autoembed']);
const identityKey = (type: 'movie' | 'tv', id: string | number) =>
  /^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id)) ? `${type}:${id}` : null;

export function validateSourcePreference(value: unknown, type: 'movie' | 'tv'): SourcePreference | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as SourcePreference;
  const source = getEffectivePlayerSources().find((entry) => entry.id === input.sourceId);
  if (!source || excluded.has(source.id) || source.async || source.quarantined
    || source.releaseStatus === 'disabled' || source.availability === 'temporarily-unavailable'
    || !(type === 'movie' ? source.media.movie : source.media.tv)) return null;
  if (source.animeProvider) {
    if (!source.animeProvider.playbackQualified || !input.variant
      || !source.animeProvider.variants.includes(input.variant)) return null;
    return { sourceId: source.id, variant: input.variant };
  }
  return { sourceId: source.id };
}

function read(storage: IStorageAdapter): Entry[] {
  try {
    const raw = storage.get(KEY);
    if (!raw || raw.length > 40_000) return [];
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    return values.flatMap((entry) => {
      const match = typeof entry?.key === 'string' ? /^(movie|tv):([1-9]\d*)$/.exec(entry.key) : null;
      const preference = match && validateSourcePreference(entry, match[1] as 'movie' | 'tv');
      if (!match || !identityKey(match[1] as 'movie' | 'tv', match[2]) || !preference
        || !Number.isFinite(entry.updatedAt) || entry.updatedAt <= 0 || seen.has(entry.key)) return [];
      seen.add(entry.key);
      return [{ key: entry.key, ...preference, updatedAt: entry.updatedAt }];
    }).slice(0, MAX_SOURCE_AFFINITIES);
  } catch { return []; }
}

/** Uses the existing profile-owned library adapter; never persists URLs or episode positions. */
export function rememberSourcePreference(storage: IStorageAdapter, type: 'movie' | 'tv', id: string | number,
  preference: SourcePreference, evidence: MobilePlaybackEvidence | null | undefined, sessionId: string | null | undefined, now = Date.now()): boolean {
  const key = identityKey(type, id);
  const safe = validateSourcePreference(preference, type);
  if (!key || !safe || (typeof sessionId !== 'string' || !canPersistVerifiedPlayback(evidence, sessionId)) || !Number.isFinite(now) || now <= 0) return false;
  try {
    const entries = read(storage);
    if ((entries.find((entry) => entry.key === key)?.updatedAt || 0) > now) return false;
    storage.set(KEY, JSON.stringify([{ key, ...safe, updatedAt: now }, ...entries.filter((entry) => entry.key !== key)]
      .slice(0, MAX_SOURCE_AFFINITIES)));
    return true;
  } catch { return false; }
}

/** Durable success wins; verified legacy progress/history supplies a migration fallback. */
export function resolveSourcePreference(storage: IStorageAdapter, type: 'movie' | 'tv', id: string | number,
  progress: Record<string, any>, history: any[], legacyAnime?: SourcePreference | null): SourcePreference | null {
  const key = identityKey(type, id);
  if (!key) return null;
  const saved = read(storage).find((entry) => entry.key === key);
  if (saved) return { sourceId: saved.sourceId, ...(saved.variant ? { variant: saved.variant } : {}) };
  const records = [...Object.values(progress), ...history].filter((entry) => {
    const media = entry?.mediaIdentity || entry;
    return media && String(media.id) === String(id) && (media.mediaType || media.media_type) === type
      && typeof entry.sessionId === 'string' && canPersistVerifiedPlayback(entry.evidence, entry.sessionId);
  }).sort((a, b) => Number(b.lastPlayedAt || b.updatedAt || 0) - Number(a.lastPlayedAt || a.updatedAt || 0));
  for (const record of records) {
    const preference = validateSourcePreference({ sourceId: record.sourceId,
      variant: record.sourceVariant || (record.sourceId === legacyAnime?.sourceId ? legacyAnime?.variant : undefined) }, type);
    if (preference) return preference;
  }
  return null;
}
