import { tmdbFetch } from '@orion/shared/api';
import { mmkvStorageAdapter } from './storageAdapter';
import type { MobileNotificationEventV1 } from './mobileNotifications';

interface AvailabilitySnapshotEntryV1 {
  mediaKey: string;
  mediaType: 'movie' | 'tv';
  mediaId: string;
  title: string;
  releaseDate: string | null;
  released: boolean;
  providers: string[];
  providerSignature: string;
  region: string;
  checkedAt: number;
}

interface AvailabilitySnapshotV1 {
  schemaVersion: 1;
  entries: Record<string, AvailabilitySnapshotEntryV1>;
}

export interface WatchlistAvailabilityCheckResultV1 {
  checked: number;
  region: string;
  events: MobileNotificationEventV1[];
  nextCursor: number;
  throttled: boolean;
}

const SNAPSHOT_KEY = 'orion.mobile.availability.snapshot.v1';
const CURSOR_KEY = 'orion.mobile.availability.cursor.v1';
const LAST_CHECK_KEY = 'orion.mobile.availability.lastCheck.v1';
export const WATCHLIST_AVAILABILITY_BATCH_SIZE_V1 = 12;
export const WATCHLIST_AVAILABILITY_MIN_INTERVAL_MS_V1 = 15 * 60_000;

function readSnapshot(): AvailabilitySnapshotV1 {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(SNAPSHOT_KEY) || 'null');
    if (parsed?.schemaVersion === 1 && parsed.entries && typeof parsed.entries === 'object') return parsed;
  } catch {}
  return { schemaVersion: 1, entries: {} };
}

function persistSnapshot(snapshot: AvailabilitySnapshotV1): void {
  const entries = Object.fromEntries(
    Object.entries(snapshot.entries)
      .sort((a, b) => (b[1].checkedAt || 0) - (a[1].checkedAt || 0))
      .slice(0, 500),
  );
  mmkvStorageAdapter.set(SNAPSHOT_KEY, JSON.stringify({ schemaVersion: 1, entries }));
}

function parseMediaKey(key: string, item: any): { mediaType: 'movie' | 'tv'; mediaId: string } | null {
  const explicitType = item?.media_type === 'tv'
    ? 'tv'
    : item?.media_type === 'movie'
      ? 'movie'
      : item?.first_air_date || item?.name
        ? 'tv'
        : 'movie';
  const keyMatch = /^(movie|tv)_(.+)$/.exec(key);
  const mediaType = keyMatch?.[1] === 'tv' ? 'tv' : keyMatch?.[1] === 'movie' ? 'movie' : explicitType;
  const rawId = keyMatch?.[2] ?? item?.id;
  if (rawId === null || rawId === undefined || String(rawId).trim() === '') return null;
  return { mediaType, mediaId: String(rawId) };
}

function mediaTitle(item: any): string {
  return String(item?.title || item?.name || 'Saved title').trim() || 'Saved title';
}

function mediaReleaseDate(item: any): string | null {
  const value = String(item?.release_date || item?.first_air_date || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function releasedByDate(releaseDate: string | null, now: Date): boolean {
  return !!releaseDate && releaseDate <= localDateKey(now);
}

export function inferMobileWatchRegionV1(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  const parts = locale.replace('_', '-').split('-');
  const region = [...parts].reverse().find((part) => /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : 'US';
}

function collectStreamingProviders(regionPayload: any): string[] {
  const groups = [regionPayload?.flatrate, regionPayload?.free, regionPayload?.ads];
  const names = groups
    .flatMap((group) => Array.isArray(group) ? group : [])
    .map((provider) => String(provider?.provider_name || '').trim())
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

async function fetchAvailabilityEntry(
  mediaKey: string,
  item: any,
  region: string,
  now: Date,
): Promise<AvailabilitySnapshotEntryV1 | null> {
  const identity = parseMediaKey(mediaKey, item);
  if (!identity) return null;
  try {
    const payload = await tmdbFetch<any>(`/${identity.mediaType}/${identity.mediaId}/watch/providers`);
    const providers = collectStreamingProviders(payload?.results?.[region]);
    const releaseDate = mediaReleaseDate(item);
    return {
      mediaKey,
      mediaType: identity.mediaType,
      mediaId: identity.mediaId,
      title: mediaTitle(item),
      releaseDate,
      released: releasedByDate(releaseDate, now),
      providers,
      providerSignature: providers.join('|').toLowerCase(),
      region,
      checkedAt: now.getTime(),
    };
  } catch {
    return null;
  }
}

function availabilityEvents(
  previous: AvailabilitySnapshotEntryV1,
  current: AvailabilitySnapshotEntryV1,
): MobileNotificationEventV1[] {
  const events: MobileNotificationEventV1[] = [];
  if (!previous.released && current.released && current.releaseDate) {
    events.push({
      category: 'watchlist',
      dedupeKey: `watchlist-release:${current.mediaKey}:${current.releaseDate}`,
      title: `${current.title} is now available`,
      body: 'A saved title from My List has reached its release date.',
      target: { target: 'media', mediaId: current.mediaId, mediaType: current.mediaType },
    });
  }

  if (previous.providerSignature !== current.providerSignature) {
    const body = current.providers.length
      ? `Streaming availability changed in ${current.region}: ${current.providers.slice(0, 3).join(', ')}${current.providers.length > 3 ? ' and more' : ''}.`
      : `Streaming availability changed in ${current.region}. No tracked streaming provider is listed right now.`;
    events.push({
      category: 'watchlist',
      dedupeKey: `watchlist-availability:${current.mediaKey}:${current.region}:${current.providerSignature || 'none'}`,
      title: `${current.title} availability changed`,
      body,
      target: { target: 'media', mediaId: current.mediaId, mediaType: current.mediaType },
    });
  }
  return events;
}

function orderedSavedKeys(saved: Record<string, any>, savedOrder: string[]): string[] {
  const ordered = savedOrder.filter((key) => saved[key]);
  const seen = new Set(ordered);
  for (const key of Object.keys(saved)) {
    if (!seen.has(key)) ordered.push(key);
  }
  return ordered;
}

export async function checkWatchlistAvailabilityV1(
  saved: Record<string, any>,
  savedOrder: string[],
  options: { force?: boolean; now?: Date } = {},
): Promise<WatchlistAvailabilityCheckResultV1> {
  const now = options.now || new Date();
  const region = inferMobileWatchRegionV1();
  const keys = orderedSavedKeys(saved, savedOrder);
  const lastCheck = Number(mmkvStorageAdapter.get(LAST_CHECK_KEY) || 0);
  if (!options.force && Number.isFinite(lastCheck) && now.getTime() - lastCheck < WATCHLIST_AVAILABILITY_MIN_INTERVAL_MS_V1) {
    return { checked: 0, region, events: [], nextCursor: Number(mmkvStorageAdapter.get(CURSOR_KEY) || 0) || 0, throttled: true };
  }
  if (!keys.length) {
    mmkvStorageAdapter.set(LAST_CHECK_KEY, String(now.getTime()));
    mmkvStorageAdapter.set(CURSOR_KEY, '0');
    return { checked: 0, region, events: [], nextCursor: 0, throttled: false };
  }

  const rawCursor = Number(mmkvStorageAdapter.get(CURSOR_KEY) || 0);
  const cursor = Number.isFinite(rawCursor) && rawCursor >= 0 ? rawCursor % keys.length : 0;
  const count = Math.min(WATCHLIST_AVAILABILITY_BATCH_SIZE_V1, keys.length);
  const batch = Array.from({ length: count }, (_, index) => keys[(cursor + index) % keys.length]);
  const snapshot = readSnapshot();
  const events: MobileNotificationEventV1[] = [];
  let checked = 0;

  for (const key of batch) {
    const current = await fetchAvailabilityEntry(key, saved[key], region, now);
    if (!current) continue;
    checked += 1;
    const previous = snapshot.entries[key];
    if (previous && previous.region === region) events.push(...availabilityEvents(previous, current));
    snapshot.entries[key] = current;
  }

  const nextCursor = (cursor + count) % keys.length;
  persistSnapshot(snapshot);
  mmkvStorageAdapter.set(CURSOR_KEY, String(nextCursor));
  mmkvStorageAdapter.set(LAST_CHECK_KEY, String(now.getTime()));
  return { checked, region, events, nextCursor, throttled: false };
}
