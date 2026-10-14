import type { GlimpseReel } from './glimpseModel';
import { emptyGlimpseLikes, likedGlimpseReels, mergeGlimpseLikes, normalizeGlimpseLikes, normalizeLikedReel, type GlimpseLikesDocument } from './glimpseLikesSchema';

export const GLIMPSE_LIKES_KEY = 'likes';
export interface GlimpseMetadataStorage { getString(key: string): string | undefined; set(key: string, value: string): void }
export interface GlimpseLikesSnapshot { document: GlimpseLikesDocument; reels: GlimpseReel[]; unavailable: boolean }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** Synchronous, private metadata transactions. No network, account, library or Cloud dependency. */
export class GlimpseLikesStore {
  private snapshot: GlimpseLikesSnapshot;
  private listeners = new Set<() => void>();
  constructor(private storage: GlimpseMetadataStorage, private clock: () => number = Date.now) {
    try { this.snapshot = this.makeSnapshot(this.read()); }
    catch { this.snapshot = freeze({ document: emptyGlimpseLikes(), reels: [], unavailable: true }); }
  }
  private read() {
    const raw = this.storage.getString(GLIMPSE_LIKES_KEY);
    return raw === undefined ? emptyGlimpseLikes() : normalizeGlimpseLikes(JSON.parse(raw));
  }
  private makeSnapshot(document: GlimpseLikesDocument): GlimpseLikesSnapshot {
    return freeze({ document, reels: likedGlimpseReels(document), unavailable: false });
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setLiked(reel: GlimpseReel, liked: boolean) {
    if (this.snapshot.unavailable) throw new Error('Private Likes unavailable');
    const metadata = normalizeLikedReel(reel);
    // Include any already-persisted local transaction before issuing the next revision.
    const document = mergeGlimpseLikes(this.snapshot.document, this.read());
    const existing = document.records[metadata.id];
    if (existing && existing.tombstone === !liked) {
      if (JSON.stringify(document) !== JSON.stringify(this.snapshot.document)) this.publish(document);
      return;
    }
    const revision = document.localRevision + 1;
    const latestTime = Object.values(document.records).reduce((time, record) => Math.max(time, record.updatedAt), -1);
    const clockTime = this.clock();
    const updatedAt = Math.max(Number.isFinite(clockTime) ? Math.max(0, Math.trunc(clockTime)) : 0, latestTime + 1);
    if (!Number.isSafeInteger(revision) || !Number.isSafeInteger(updatedAt)) throw new Error('Private Like revision exhausted');
    const next = normalizeGlimpseLikes({ schemaVersion: 1, localRevision: revision,
      records: { ...document.records, [metadata.id]: { schemaVersion: 1, id: metadata.id, updatedAt, revision,
        tombstone: !liked, reel: liked ? metadata : null } } });
    this.storage.set(GLIMPSE_LIKES_KEY, JSON.stringify(next));
    this.publish(next); // Notify only after durable storage accepted the complete document.
  }
  private publish(document: GlimpseLikesDocument) {
    this.snapshot = this.makeSnapshot(document);
    this.listeners.forEach(listener => listener());
  }
}
