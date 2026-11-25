import type { IStorageAdapter } from '@orion/shared/api';
import { libraryUtf8Bytes } from '../../features/library/localLibrary';

export const OFFLINE_METADATA_KEY = 'waven.connectivity.public.v1';
export const METADATA_LIMITS = { records: 64, pending: 32, bytes: 3 * 1024 * 1024, freshMs: 15 * 60_000, staleMs: 48 * 60 * 60_000 } as const;
interface CacheEntry { key: string; capturedAt: number; value: unknown }
interface CacheState { version: 1; entries: CacheEntry[]; pending: string[] }
const fields = new Set(['result','sections','items','tracks','artists','albums','playlists','artist','album','playlist','detail','categories','id','name','title','artistName','albumTitle','albumArtist','durationMs','provider','providerTrackId','providerRefs','source','artworkUrl','profileImageUrl','description','biography','releaseDate','primaryType','type','kind','attribution','group','browseId','params','label','subtitle']);
function safeText(value: string): string | undefined {
  if (/https?:\/\//i.test(value) || /(?:authorization|bearer|cookie|token|signature)=/i.test(value)) return undefined;
  return value.slice(0, 4096);
}
/** Strict metadata projection. Arbitrary provider/private/stream fields never enter the cache. */
export function cleanOfflineMetadata(value: unknown, depth = 0): unknown {
  if (depth > 14) return null;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return safeText(value) ?? null;
  if (Array.isArray(value)) return value.slice(0, 250).map(item => cleanOfflineMetadata(item, depth + 1));
  if (!value || typeof value !== 'object') return null;
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!fields.has(key)) continue;
    if (key === 'artworkUrl' || key === 'profileImageUrl') {
      if (typeof raw === 'string' && /^https:\/\//i.test(raw) && !/[?&](token|sig|signature|expire|expires|authorization|key)=/i.test(raw)) result[key] = raw.slice(0, 4096);
      continue;
    }
    result[key] = cleanOfflineMetadata(raw, depth + 1);
  }
  return result;
}
function validKey(key: unknown): key is string { return typeof key === 'string' && key.length <= 1600 && /^(home-charts|home-releases|categories|artists)$|^(category|artist|album):[^\0]+\0[^\0]*$/.test(key) && !/https?:\/\//i.test(key); }
/** Public catalogue cache and durable refresh intent; never a Library or Cloud mutation owner. */
export class OfflineMetadataStore {
  private storage: IStorageAdapter | null = null;
  private state: CacheState = { version: 1, entries: [], pending: [] };
  private blocked = false;
  private problem: string | null = null;
  constructor(private now = Date.now) {}
  getNotice = () => this.problem;
  unavailable() { this.blocked = true; this.problem = 'Discovery caching is unavailable. Saved music is unchanged.'; }
  getSummary = () => ({ version: this.state.version, records: this.state.entries.length, pending: this.state.pending.length, persisted: !!this.storage && !this.blocked, notice: this.problem });
  configure(storage: IStorageAdapter) {
    this.state = { version: 1, entries: [], pending: [] }; this.blocked = false; this.problem = null;
    this.storage = storage;
    try {
      const raw = storage.get(OFFLINE_METADATA_KEY); if (!raw) return;
      if (libraryUtf8Bytes(raw) > METADATA_LIMITS.bytes) throw new Error('Cache exceeds its budget.');
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1) { this.blocked = true; this.problem = 'Cached discovery needs a newer WAVEN version. Saved music is unchanged.'; return; }
      if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.pending)) throw new Error('Invalid cache.');
      this.state = { version: 1, entries: parsed.entries.filter((e: CacheEntry) => validKey(e?.key) && Number.isFinite(e.capturedAt) && e.capturedAt >= 0 && e.capturedAt <= this.now() + 60_000)
        .slice(0, METADATA_LIMITS.records).map((e: CacheEntry) => ({ key: e.key, capturedAt: e.capturedAt, value: cleanOfflineMetadata(e.value) })),
        pending: [...new Set<string>(parsed.pending.filter(validKey))].slice(0, METADATA_LIMITS.pending) };
    } catch {
      // Preserve a corrupt original in one fixed slot before allowing a repaired cache.
      try {
        const raw = storage.get(OFFLINE_METADATA_KEY), prior = storage.get(`${OFFLINE_METADATA_KEY}.original`);
        if (!raw || libraryUtf8Bytes(raw) > METADATA_LIMITS.bytes || (prior && prior !== raw)) throw new Error('Cache backup unavailable.');
        if (!prior) { storage.set(`${OFFLINE_METADATA_KEY}.original`, raw); if (storage.get(`${OFFLINE_METADATA_KEY}.original`) !== raw) throw new Error('Cache backup not verified.'); }
        this.problem = 'Discovery cache recovered. Saved music is unchanged.';
      } catch { this.blocked = true; this.problem = 'Discovery cache is unavailable. Saved music is unchanged.'; }
    }
  }
  read<T>(key: string, allowStale = true): { value: T; capturedAt: number; fresh: boolean } | null {
    const entry = this.state.entries.find(e => e.key === key); if (!entry) return null;
    const age = Math.max(0, this.now() - entry.capturedAt);
    if (age > (allowStale ? METADATA_LIMITS.staleMs : METADATA_LIMITS.freshMs)) return null;
    return { value: JSON.parse(JSON.stringify(entry.value)) as T, capturedAt: entry.capturedAt, fresh: age <= METADATA_LIMITS.freshMs };
  }
  private commit(next: CacheState): boolean {
    if (this.blocked || !this.storage) return false;
    next.entries = next.entries.filter(e => this.now() - e.capturedAt <= METADATA_LIMITS.staleMs).sort((a,b) => b.capturedAt - a.capturedAt || a.key.localeCompare(b.key)).slice(0, METADATA_LIMITS.records);
    let raw = JSON.stringify(next);
    while (libraryUtf8Bytes(raw) > METADATA_LIMITS.bytes && next.entries.length) { next.entries.pop(); raw = JSON.stringify(next); }
    if (libraryUtf8Bytes(raw) > METADATA_LIMITS.bytes) return false;
    let before: string | null = null;
    let capturedBefore = false;
    try {
      before = this.storage.get(OFFLINE_METADATA_KEY); capturedBefore = true; this.storage.set(OFFLINE_METADATA_KEY, raw);
      if (this.storage.get(OFFLINE_METADATA_KEY) !== raw) throw new Error('Cache write not verified.');
      this.state = next; return true;
    } catch {
      try { if (!capturedBefore) this.blocked = true; else if (before !== null) this.storage.set(OFFLINE_METADATA_KEY, before); else this.storage.remove(OFFLINE_METADATA_KEY); } catch { this.blocked = true; }
      this.problem = 'Discovery caching is unavailable. Saved music is unchanged.'; return false;
    }
  }
  remember(key: string, value: unknown) {
    if (!validKey(key)) return false;
    return this.commit({ version: 1, pending: this.state.pending.filter(k => k !== key), entries: [{ key, capturedAt: this.now(), value: cleanOfflineMetadata(value) }, ...this.state.entries.filter(e => e.key !== key)] });
  }
  enqueue(key: string) {
    if (!validKey(key) || this.state.pending.includes(key)) return false;
    if (this.state.pending.length >= METADATA_LIMITS.pending) return false;
    return this.commit({ ...this.state, entries: [...this.state.entries], pending: [...this.state.pending, key] });
  }
  pendingKeys() { return [...this.state.pending]; }
  acknowledge(key: string) { return this.commit({ ...this.state, entries: [...this.state.entries], pending: this.state.pending.filter(k => k !== key) }); }
}
export const offlineMetadata = new OfflineMetadataStore();
