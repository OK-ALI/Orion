import type { IStorageAdapter } from '@orion/shared/api';
import type { MusicAlbum, MusicArtist, MusicTrack } from '../../domain/music';

export const LIBRARY_SCHEMA_VERSION = 2;
export const LIBRARY_LIMITS = { favorites: 5000, playlists: 100, playlistTracks: 1000, history: 200 } as const;
export const LIBRARY_BYTE_BUDGET = 2 * 1024 * 1024;
export const LIBRARY_RECOVERY_LIMIT = 4;
export const LIBRARY_RECOVERY_BYTE_BUDGET = 8 * 1024 * 1024;
export type LibraryKind = 'track' | 'album' | 'artist';
export type LibraryEntity = MusicTrack | MusicAlbum | MusicArtist;
export interface Favorite { key: string; kind: LibraryKind; entity: LibraryEntity; addedAt: number }
export interface LocalPlaylist { id: string; title: string; createdAt: number; updatedAt: number; tracks: MusicTrack[] }
export interface HistoryEntry { key: string; track: MusicTrack; playedAt: number; playCount: number }
export interface LibraryState {
  version: 2; scope: string; revision: number; favorites: Favorite[];
  playlists: LocalPlaylist[]; history: HistoryEntry[];
  preferences: { historyEnabled: boolean };
  historyReceipt: string | null;
}
export interface LibrarySnapshot {
  status: 'ready' | 'recovered' | 'unavailable' | 'blocked'; notice: string | null; state: LibraryState;
}
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const string = (v: unknown, max = 1000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const time = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
export function libraryUtf8Bytes(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) { const code = value.charCodeAt(i);
    if (code < 0x80) bytes++; else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
  } return bytes;
}
export const libraryScope = (accountId?: string | null) => accountId ? `google:${encodeURIComponent(accountId)}` : 'local';
export const libraryStorageKey = (scope: string) => `waven.library.${scope}`;
export function libraryEntityKey(kind: LibraryKind, entity: LibraryEntity): string {
  return JSON.stringify([kind, entity.source.provider, entity.source.id]);
}
function artwork(value: unknown): string | undefined {
  const url = string(value, 4096);
  // Artwork is metadata; signed media leases and credentials are never durable.
  return /^https?:\/\//i.test(url) && !/[?&](?:token|sig|signature|expire|expires|authorization)=/i.test(url) ? url : undefined;
}
export function cleanLibraryEntity(kind: LibraryKind, value: unknown): LibraryEntity | null {
  const v = object(value), ref = object(v.source);
  const provider = string(ref.provider, 100), id = string(ref.id, 512);
  const title = string(kind === 'artist' ? v.name : v.title);
  if (!provider || !id || !title || /^https?:\/\//i.test(id)) return null;
  const base = { id: `${provider}:${id}`, source: { provider, id }, artworkUrl: artwork(v.artworkUrl) };
  if (kind === 'artist') return { ...base, name: title, profileImageUrl: artwork(v.profileImageUrl) };
  if (kind === 'album') return { ...base, title, artistName: string(v.artistName) || undefined,
    releaseDate: string(v.releaseDate, 32) || undefined, primaryType: string(v.primaryType, 32) || undefined };
  const providerTrackId = string(v.providerTrackId, 512);
  return { ...base, title, artistName: string(v.artistName), albumTitle: string(v.albumTitle) || undefined,
    albumArtist: string(v.albumArtist) || undefined, durationMs: time(v.durationMs) || undefined,
    provider: string(v.provider, 100) || undefined, providerTrackId: providerTrackId && !/^https?:\/\//i.test(providerTrackId) ? providerTrackId : undefined,
    providerRefs: list(v.providerRefs).flatMap((raw) => { const r = object(raw), p = string(r.provider, 100), i = string(r.id, 512);
      return p && i && !/^https?:\/\//i.test(i) ? [{ provider: p, id: i }] : []; }) };
}
const empty = (scope: string): LibraryState => ({ version: 2, scope, revision: 0, favorites: [], playlists: [], history: [], preferences: { historyEnabled: true }, historyReceipt: null });
function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>(); return items.filter((item) => { const id = key(item); if (seen.has(id)) return false; seen.add(id); return true; });
}
function tracks(value: unknown): MusicTrack[] {
  return unique(list(value).flatMap(v => { const t = cleanLibraryEntity('track', v); return t ? [t as MusicTrack] : []; }), t => libraryEntityKey('track', t)).slice(0, LIBRARY_LIMITS.playlistTracks);
}
/** V1 was a flat liked-entity/list-of-tracks shape. Migration preserves identity and sequence. */
export function hydrateLibrary(value: unknown, scope: string): LibraryState {
  const v = object(value);
  if (v.scope !== scope) throw new Error('Library account does not match its storage namespace.');
  if (v.version !== 1 && v.version !== 2) throw new Error('Unsupported Library schema. Existing data is preserved.');
  const result = empty(scope); result.revision = time(v.revision);
  const favorites = v.version === 1 ? (['track', 'album', 'artist'] as const).flatMap(kind =>
    list(v[kind === 'track' ? 'likedTracks' : kind === 'album' ? 'likedAlbums' : 'likedArtists']).map(entity => ({ kind, entity, addedAt: 0 }))) : list(v.favorites);
  result.favorites = unique(favorites.flatMap(raw => {
    const f = object(raw), kind = f.kind;
    if (kind !== 'track' && kind !== 'album' && kind !== 'artist') return [];
    const entity = cleanLibraryEntity(kind, f.entity);
    return entity ? [{ key: libraryEntityKey(kind, entity), kind: kind as LibraryKind, entity, addedAt: time(f.addedAt) }] : [];
  }), f => f.key).sort((a, b) => b.addedAt - a.addedAt || a.key.localeCompare(b.key)).slice(0, LIBRARY_LIMITS.favorites);
  result.playlists = unique(list(v.playlists).flatMap(raw => {
    const p = object(raw), id = string(p.id, 128), title = string(v.version === 1 ? p.name : p.title, 120);
    return id && title ? [{ id, title, createdAt: time(p.createdAt), updatedAt: time(p.updatedAt ?? p.createdAt), tracks: tracks(p.tracks) }] : [];
  }), p => p.id).slice(0, LIBRARY_LIMITS.playlists);
  result.history = unique(list(v.history).flatMap(raw => {
    const h = object(raw), track = cleanLibraryEntity('track', h.track) as MusicTrack | null;
    return track ? [{ key: libraryEntityKey('track', track), track, playedAt: time(h.playedAt), playCount: Math.max(1, time(h.playCount)) }] : [];
  }).sort((a, b) => b.playedAt - a.playedAt || a.key.localeCompare(b.key)), h => h.key).slice(0, LIBRARY_LIMITS.history);
  result.preferences.historyEnabled = object(v.preferences).historyEnabled !== false;
  result.historyReceipt = typeof v.historyReceipt === 'string' ? v.historyReceipt : null;
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}

/** Sole durable Library owner. Every published mutation has completed a verified local write. */
export class LocalLibraryRepository {
  private listeners = new Set<() => void>();
  private snapshot: LibrarySnapshot;
  private nonce = 0;
  constructor(private storage: IStorageAdapter, private now: () => number = Date.now, scope = 'local') {
    this.snapshot = freeze({ status: 'ready', notice: null, state: empty(scope) }); this.switchScope(scope);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(snapshot: LibrarySnapshot) { this.snapshot = freeze(snapshot); this.listeners.forEach(l => l()); }
  private verifiedWrite(key: string, value: string) {
    this.storage.set(key, value); if (this.storage.get(key) !== value) throw new Error('Local storage did not confirm the write.');
  }
  private preserve(key: string, raw: string) {
    let free: string | null = null, bytes = 0;
    for (let slot = 0; slot < LIBRARY_RECOVERY_LIMIT; slot++) {
      const backup = `${key}.recovery.${slot}`, prior = this.storage.get(backup);
      if (prior === raw) return;
      if (prior === null) free ??= backup;
      else bytes += libraryUtf8Bytes(prior);
    }
    // Never evict an original to make room. Exhaustion blocks repair before overwrite.
    if (!free || bytes + libraryUtf8Bytes(raw) > LIBRARY_RECOVERY_BYTE_BUDGET) {
      throw new Error('Library recovery space is full. Existing data is preserved; recovery backups need review before repair.');
    }
    this.verifiedWrite(free, raw);
  }
  switchScope(scope: string) {
    const key = libraryStorageKey(scope);
    try {
      const raw = this.storage.get(key);
      if (raw === null) { this.publish({ status: 'ready', notice: null, state: empty(scope) }); return; }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const record = object(parsed);
      if (typeof record.version === 'number' && record.version > 2) {
        this.publish({ status: 'blocked', notice: 'This Library needs a newer WAVEN version. Its data is preserved.', state: empty(scope) }); return;
      }
      let state: LibraryState, notice: string | null = null;
      try { state = hydrateLibrary(parsed, scope); }
      catch {
        this.preserve(key, raw);
        const previous = this.storage.get(`${key}.previous`);
        try { state = previous ? hydrateLibrary(JSON.parse(previous), scope) : empty(scope); } catch { state = empty(scope); }
        notice = 'Library recovered. The original local data was kept in a recovery backup.';
      }
      const normalized = JSON.stringify(state);
      if (normalized !== raw) {
        if (!notice) this.preserve(key, raw);
        this.verifiedWrite(key, normalized);
        notice = notice ?? (record.version === 1 ? 'Your local Library was upgraded safely.' : 'Library records were repaired; the original data was kept.');
      }
      this.publish({ status: notice ? 'recovered' : 'ready', notice, state });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Library recovery space is full.')) {
        this.publish({ status: 'blocked', notice: error.message, state: empty(scope) }); return;
      }
      this.publish({ status: 'unavailable', notice: 'Local Library storage is unavailable. Existing data is preserved. Try again in a WAVEN native build.', state: empty(scope) });
    }
  }
  private mutate(change: (state: LibraryState) => void) {
    if (this.snapshot.status === 'blocked' || this.snapshot.status === 'unavailable') throw new Error(this.snapshot.notice ?? 'Library unavailable.');
    const current = this.snapshot.state, next = JSON.parse(JSON.stringify(current)) as LibraryState;
    change(next);
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    next.revision++;
    const key = libraryStorageKey(current.scope), old = this.storage.get(key), serialized = JSON.stringify(next);
    if (libraryUtf8Bytes(serialized) > LIBRARY_BYTE_BUDGET && libraryUtf8Bytes(serialized) >= libraryUtf8Bytes(JSON.stringify(current))) {
      throw new Error('Local Library storage limit reached (2 MiB per profile).');
    }
    if (old !== null) this.verifiedWrite(`${key}.previous`, old);
    try { this.verifiedWrite(key, serialized); }
    catch (error) { try { if (old !== null) this.verifiedWrite(key, old); else this.storage.remove(key); } catch { /* previous remains available */ } throw error; }
    this.publish({ ...this.snapshot, state: next });
  }
  setFavorite(kind: LibraryKind, entity: LibraryEntity, favorite: boolean) {
    const clean = cleanLibraryEntity(kind, entity); if (!clean) throw new Error('This music item has no stable provider identity.');
    const key = libraryEntityKey(kind, clean);
    this.mutate(state => {
      if (state.favorites.some(f => f.key === key) === favorite) return;
      if (!favorite) { state.favorites = state.favorites.filter(f => f.key !== key); return; }
      if (state.favorites.length >= LIBRARY_LIMITS.favorites) throw new Error('Favorite limit reached.');
      state.favorites.push({ key, kind, entity: clean, addedAt: this.now() });
      state.favorites.sort((a, b) => b.addedAt - a.addedAt || a.key.localeCompare(b.key));
    });
  }
  createPlaylist(title: string): string {
    const name = title.trim().slice(0, 120); if (!name) throw new Error('Give your playlist a name.');
    let id: string;
    do { id = `local-${this.now().toString(36)}-${(++this.nonce).toString(36)}`; } while (this.snapshot.state.playlists.some(p => p.id === id));
    this.mutate(state => {
      if (state.playlists.length >= LIBRARY_LIMITS.playlists) throw new Error('Playlist limit reached.');
      state.playlists.push({ id, title: name, createdAt: this.now(), updatedAt: this.now(), tracks: [] });
    }); return id;
  }
  renamePlaylist(id: string, title: string) {
    const name = title.trim().slice(0, 120); if (!name) throw new Error('Give your playlist a name.');
    this.mutate(s => { const p = this.playlist(s, id); if (p.title !== name) { p.title = name; p.updatedAt = this.now(); } });
  }
  deletePlaylist(id: string) { this.mutate(s => { s.playlists = s.playlists.filter(p => p.id !== id); }); }
  private playlist(state: LibraryState, id: string) { const p = state.playlists.find(p => p.id === id); if (!p) throw new Error('Playlist no longer exists.'); return p; }
  addTrack(id: string, track: MusicTrack) {
    const clean = cleanLibraryEntity('track', track) as MusicTrack | null; if (!clean) throw new Error('This song has no stable provider identity.');
    this.mutate(s => {
      const p = this.playlist(s, id), key = libraryEntityKey('track', clean);
      if (p.tracks.some(t => libraryEntityKey('track', t) === key)) return;
      if (p.tracks.length >= LIBRARY_LIMITS.playlistTracks) throw new Error('Playlist song limit reached.');
      p.tracks.push(clean); p.updatedAt = this.now();
    });
  }
  removeTrack(id: string, key: string) {
    this.mutate(s => { const p = this.playlist(s, id); if (!p.tracks.some(t => libraryEntityKey('track', t) === key)) return;
      p.tracks = p.tracks.filter(t => libraryEntityKey('track', t) !== key); p.updatedAt = this.now(); });
  }
  moveTrack(id: string, key: string, offset: -1 | 1) {
    this.mutate(s => { const p = this.playlist(s, id), from = p.tracks.findIndex(t => libraryEntityKey('track', t) === key), to = from + offset;
      if (from < 0 || to < 0 || to >= p.tracks.length) return;
      const [track] = p.tracks.splice(from, 1); p.tracks.splice(to, 0, track); p.updatedAt = this.now(); });
  }
  setHistoryEnabled(enabled: boolean) { this.mutate(s => { s.preferences.historyEnabled = enabled; }); }
  clearHistory() { this.mutate(s => { s.history = []; }); }
  recordPlayed(track: MusicTrack, ownerScope: string, occurrence?: string) {
    if (ownerScope !== this.snapshot.state.scope || !this.snapshot.state.preferences.historyEnabled) return;
    const clean = cleanLibraryEntity('track', track) as MusicTrack | null; if (!clean) return;
    this.mutate(s => { if (occurrence && s.historyReceipt === occurrence) return;
      s.historyReceipt = occurrence ?? null;
      const key = libraryEntityKey('track', clean), prior = s.history.find(h => h.key === key);
      s.history = [{ key, track: clean, playedAt: Math.max(this.now(), (s.history[0]?.playedAt ?? -1) + 1), playCount: (prior?.playCount ?? 0) + 1 }, ...s.history.filter(h => h.key !== key)].slice(0, LIBRARY_LIMITS.history); });
  }
  /** Global provenance prevents an existing native queue becoming another account's history. */
  queueOwner(queueIds: readonly string[]): string | null {
    let prior: Record<string, unknown>;
    try { prior = object(JSON.parse(this.storage.get('waven.library.queue-owner') ?? '{}')); } catch { throw new Error('Queue ownership metadata is damaged; history recording is paused.'); }
    return prior.fingerprint === JSON.stringify(queueIds) && typeof prior.scope === 'string' ? prior.scope : null;
  }
  claimQueue(queueIds: readonly string[]): string {
    const key = 'waven.library.queue-owner', fingerprint = JSON.stringify(queueIds);
    let prior: Record<string, unknown>;
    try { prior = object(JSON.parse(this.storage.get(key) ?? '{}')); } catch { throw new Error('Queue ownership metadata is damaged; history recording is paused.'); }
    if (prior.fingerprint === fingerprint && typeof prior.scope === 'string') return prior.scope;
    const scope = this.snapshot.state.scope;
    this.verifiedWrite(key, JSON.stringify({ fingerprint, scope })); return scope;
  }
  reportHistoryIssue() {
    this.publish({ ...this.snapshot, notice: 'Listening history could not be saved. Your existing Library and playback are preserved.' });
  }
}
