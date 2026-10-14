import { normalizeGlimpseTitleMetadata } from './glimpseTitleMetadata';
import { glimpseReelId, type GlimpseReel } from './glimpseModel';

export interface GlimpseLikeRecord {
  schemaVersion: 1; id: string; updatedAt: number; revision: number;
  tombstone: boolean; reel: GlimpseReel | null;
}
export interface GlimpseLikesDocument {
  schemaVersion: 1; localRevision: number; records: Record<string, GlimpseLikeRecord>;
}
export const emptyGlimpseLikes = (): GlimpseLikesDocument => ({ schemaVersion: 1, localRevision: 0, records: {} });
const integer = (value: unknown, minimum: number) => Number.isSafeInteger(value) && Number(value) >= minimum;
const text = (value: unknown, limit: number) => typeof value === 'string' && value.length <= limit;
const nullableText = (value: unknown, limit: number) => value === null || text(value, limit);

function validateId(id: unknown): string {
  if (typeof id !== 'string') throw new Error('Invalid Like identity');
  const match = /^tmdb:(movie|tv):([1-9]\d*)(?::s([1-9]\d*):e([1-9]\d*))?:youtube:([A-Za-z0-9_-]{11})$/.exec(id);
  if (!match || glimpseReelId({ tmdbId: Number(match[2]), mediaType: match[1] as 'movie' | 'tv',
    isAnime: false, season: match[3] ? Number(match[3]) : null, episode: match[4] ? Number(match[4]) : null }, match[5]!) !== id) {
    throw new Error('Invalid Like identity');
  }
  return id;
}
/** Copy only the versioned metadata contract; never store provider pages or media bytes. */
export function normalizeLikedReel(input: unknown): GlimpseReel {
  const reel = input as GlimpseReel;
  if (!reel || reel.schemaVersion !== 1 || !reel.media || !reel.video
    || typeof reel.media.isAnime !== 'boolean' || ![null, 'number'].includes(reel.media.season === null ? null : typeof reel.media.season)
    || ![null, 'number'].includes(reel.media.episode === null ? null : typeof reel.media.episode)
    || reel.video.provider !== 'youtube' || !text(reel.title, 1000) || !text(reel.clipTitle, 2000)
    || !text(reel.video.type, 64) || !nullableText(reel.video.language, 32)
    || !nullableText(reel.artworkPath, 1000) || !nullableText(reel.posterPath, 1000) || !nullableText(reel.year, 32)
    || (reel.video.durationSeconds !== null && (!Number.isFinite(reel.video.durationSeconds) || reel.video.durationSeconds <= 0))) {
    throw new Error('Invalid Like metadata');
  }
  const id = glimpseReelId(reel.media, reel.video.key);
  if (reel.id !== id) throw new Error('Mismatched Like identity');
  const dimensions = reel.video.dimensions;
  if (dimensions && (!Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height) || dimensions.width <= 0 || dimensions.height <= 0)) {
    throw new Error('Invalid Like dimensions');
  }
  return { schemaVersion: 1, id,
    media: { tmdbId: reel.media.tmdbId, mediaType: reel.media.mediaType, isAnime: reel.media.isAnime, season: reel.media.season, episode: reel.media.episode },
    title: reel.title, clipTitle: reel.clipTitle,
    video: { provider: 'youtube', key: reel.video.key, type: reel.video.type, language: reel.video.language,
      durationSeconds: reel.video.durationSeconds, dimensions: dimensions ? { width: dimensions.width, height: dimensions.height } : null },
    artworkPath: reel.artworkPath, posterPath: reel.posterPath, year: reel.year,
    ...(reel.catalog !== undefined ? { catalog: normalizeGlimpseTitleMetadata(reel.catalog) } : {}) };
}
export function normalizeGlimpseLikes(input: unknown): GlimpseLikesDocument {
  const doc = input as GlimpseLikesDocument;
  if (!doc || doc.schemaVersion !== 1 || !integer(doc.localRevision, 0)
    || !doc.records || typeof doc.records !== 'object' || Array.isArray(doc.records)) throw new Error('Unsupported Like document');
  const records: Record<string, GlimpseLikeRecord> = {};
  for (const id of Object.keys(doc.records).sort()) {
    validateId(id);
    const record = doc.records[id];
    if (!record || record.schemaVersion !== 1 || record.id !== id || !integer(record.updatedAt, 0)
      || !integer(record.revision, 1) || record.revision > doc.localRevision || typeof record.tombstone !== 'boolean'
      || (record.tombstone && record.reel !== null)) throw new Error('Invalid Like record');
    const reel = record.tombstone ? null : normalizeLikedReel(record.reel);
    if (reel && reel.id !== id) throw new Error('Mismatched Like record');
    records[id] = { schemaVersion: 1, id, updatedAt: record.updatedAt, revision: record.revision, tombstone: record.tombstone, reel };
  }
  return { schemaVersion: 1, localRevision: doc.localRevision, records };
}
/** Total order: updatedAt, revision, removal on ties, then canonical metadata bytes. */
function winner(a: GlimpseLikeRecord, b: GlimpseLikeRecord) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b;
  if (a.tombstone !== b.tombstone) return a.tombstone ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}
export function mergeGlimpseLikes(left: GlimpseLikesDocument, right: GlimpseLikesDocument): GlimpseLikesDocument {
  const a = normalizeGlimpseLikes(left); const b = normalizeGlimpseLikes(right);
  const records: Record<string, GlimpseLikeRecord> = {};
  for (const id of [...new Set([...Object.keys(a.records), ...Object.keys(b.records)])].sort()) {
    records[id] = a.records[id] && b.records[id] ? winner(a.records[id]!, b.records[id]!) : (a.records[id] || b.records[id])!;
  }
  return { schemaVersion: 1, localRevision: Math.max(a.localRevision, b.localRevision), records };
}
export function likedGlimpseReels(doc: GlimpseLikesDocument): GlimpseReel[] {
  return Object.values(doc.records).filter(record => !record.tombstone && record.reel)
    .sort((a, b) => a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(record => record.reel!);
}
