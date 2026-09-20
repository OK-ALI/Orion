import { isAnimeContent, tmdbFetch } from '@orion/shared/api';
import type { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { mmkvStorageAdapter } from './storageAdapter';
import type { MobileNotificationEventV1 } from './mobileNotifications';

export interface MobileEntertainmentAlertSelectionV1 {
  newMovies: boolean;
  newSeries: boolean;
  newEpisodes: boolean;
  animeReleases: boolean;
  upcoming: boolean;
}

export interface MobileEntertainmentAlertResultV1 {
  events: MobileNotificationEventV1[];
  catalogChecked: boolean;
  savedShowsChecked: number;
}

const CATALOG_LAST_CHECK_KEY = 'orion.mobile.notifications.entertainment.catalog.v1';
const SAVED_LAST_CHECK_KEY = 'orion.mobile.notifications.entertainment.saved.v1';
const SAVED_CURSOR_KEY = 'orion.mobile.notifications.entertainment.cursor.v1';
const PREFERENCE_SIGNATURE_KEY = 'orion.mobile.notifications.entertainment.preferenceSignature.v1';
const CATALOG_INTERVAL_MS = 6 * 60 * 60_000;
const SAVED_INTERVAL_MS = 30 * 60_000;
const SAVED_BATCH_SIZE = 12;

function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysUntil(dateKey: string, todayKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{4}-\d{2}-\d{2}$/.test(todayKey)) return null;
  const target = Date.parse(`${dateKey}T00:00:00Z`);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(today)) return null;
  return Math.round((target - today) / 86_400_000);
}

function itemTitle(item: any): string {
  return String(item?.title || item?.name || 'Untitled').trim() || 'Untitled';
}

function topTitles(results: TmdbMediaItem[]): string[] {
  return results.map(itemTitle).filter(Boolean).slice(0, 3);
}

function digestBody(titles: string[]): string {
  if (titles.length === 1) return `${titles[0]} is among today's new arrivals.`;
  if (titles.length === 2) return `${titles[0]} and ${titles[1]} are among today's new arrivals.`;
  return `${titles[0]}, ${titles[1]} and ${titles[2]} are among today's new arrivals.`;
}

function upcomingDigestBody(titles: string[]): string {
  if (titles.length === 1) return `${titles[0]} is coming next week.`;
  if (titles.length === 2) return `${titles[0]} and ${titles[1]} are coming next week.`;
  return `${titles[0]}, ${titles[1]} and ${titles[2]} are coming next week.`;
}

async function discoverToday(path: string): Promise<TmdbMediaItem[]> {
  try {
    const data = await tmdbFetch<TmdbPaginatedResponse>(path);
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

async function collectCatalogEvents(
  selection: MobileEntertainmentAlertSelectionV1,
  today: string,
): Promise<MobileNotificationEventV1[]> {
  const requests: Array<Promise<MobileNotificationEventV1 | null>> = [];

  if (selection.newMovies) {
    requests.push((async () => {
      const results = await discoverToday(`/discover/movie?sort_by=popularity.desc&include_adult=false&primary_release_date.gte=${today}&primary_release_date.lte=${today}&page=1`);
      const titles = topTitles(results);
      return titles.length ? {
        category: 'newMovies',
        dedupeKey: `catalog-new-movies:${today}`,
        title: 'New movies today',
        body: digestBody(titles),
        target: { target: 'discover', feed: 'new-releases', mediaType: 'movie', window: '30' },
      } : null;
    })());
  }

  if (selection.newSeries) {
    requests.push((async () => {
      const results = await discoverToday(`/discover/tv?sort_by=popularity.desc&include_adult=false&first_air_date.gte=${today}&first_air_date.lte=${today}&page=1`);
      const titles = topTitles(results.filter((item) => !isAnimeContent(item)));
      return titles.length ? {
        category: 'newSeries',
        dedupeKey: `catalog-new-series:${today}`,
        title: 'New series today',
        body: digestBody(titles),
        target: { target: 'discover', feed: 'new-releases', mediaType: 'tv', window: '30' },
      } : null;
    })());
  }

  if (selection.animeReleases) {
    requests.push((async () => {
      const results = await discoverToday(`/discover/tv?sort_by=popularity.desc&include_adult=false&with_genres=16&with_origin_country=JP&first_air_date.gte=${today}&first_air_date.lte=${today}&page=1`);
      const titles = topTitles(results);
      return titles.length ? {
        category: 'animeReleases',
        dedupeKey: `catalog-new-anime:${today}`,
        title: 'New anime today',
        body: digestBody(titles),
        target: { target: 'discover', feed: 'new-releases', mediaType: 'tv', region: 'asian', subfilter: 'jp', genreId: 16, window: '30' },
      } : null;
    })());
  }

  if (selection.upcoming) {
    requests.push((async () => {
      const targetDate = new Date(`${today}T12:00:00Z`);
      targetDate.setUTCDate(targetDate.getUTCDate() + 7);
      const dateKey = targetDate.toISOString().slice(0, 10);
      const [movies, series] = await Promise.all([
        discoverToday(`/discover/movie?sort_by=popularity.desc&include_adult=false&primary_release_date.gte=${dateKey}&primary_release_date.lte=${dateKey}&page=1`),
        discoverToday(`/discover/tv?sort_by=popularity.desc&include_adult=false&first_air_date.gte=${dateKey}&first_air_date.lte=${dateKey}&page=1`),
      ]);
      const titles = topTitles([...movies, ...series].sort((a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0)));
      return titles.length ? {
        category: 'upcoming',
        dedupeKey: `catalog-upcoming-week:${dateKey}`,
        title: 'Coming next week',
        body: upcomingDigestBody(titles),
        target: { target: 'discover', feed: 'upcoming', mediaType: 'all', window: '30' },
      } : null;
    })());
  }

  return (await Promise.all(requests)).filter((event): event is MobileNotificationEventV1 => !!event);
}

function parseSavedIdentity(key: string, item: any): { mediaType: 'movie' | 'tv'; mediaId: string } | null {
  const keyMatch = /^(movie|tv)_(.+)$/.exec(key);
  const mediaType = keyMatch?.[1] === 'tv' || item?.media_type === 'tv' || item?.first_air_date ? 'tv' : 'movie';
  const rawId = keyMatch?.[2] ?? item?.id;
  if (rawId === null || rawId === undefined || String(rawId).trim() === '') return null;
  return { mediaType, mediaId: String(rawId) };
}

function orderedSavedKeys(saved: Record<string, any>, savedOrder: string[]): string[] {
  const ordered = savedOrder.filter((key) => saved[key]);
  const seen = new Set(ordered);
  for (const key of Object.keys(saved)) if (!seen.has(key)) ordered.push(key);
  return ordered;
}

function upcomingEvent(
  category: 'upcoming',
  dedupeIdentity: string,
  title: string,
  dateKey: string,
  days: number,
  target: MobileNotificationEventV1['target'],
  detail?: string,
): MobileNotificationEventV1 | null {
  if (days !== 7 && days !== 1) return null;
  return {
    category,
    dedupeKey: `upcoming:${dedupeIdentity}:${dateKey}:${days}`,
    title: days === 1 ? `${title} arrives tomorrow` : `${title} arrives in a week`,
    body: detail || (days === 1 ? 'A title from My List releases tomorrow.' : 'A title from My List releases in seven days.'),
    target,
  };
}

async function collectSavedEvents(
  saved: Record<string, any>,
  savedOrder: string[],
  selection: MobileEntertainmentAlertSelectionV1,
  today: string,
): Promise<{ events: MobileNotificationEventV1[]; checked: number }> {
  const keys = orderedSavedKeys(saved, savedOrder);
  if (!keys.length) return { events: [], checked: 0 };

  const rawCursor = Number(mmkvStorageAdapter.get(SAVED_CURSOR_KEY) || 0);
  const cursor = Number.isFinite(rawCursor) && rawCursor >= 0 ? rawCursor % keys.length : 0;
  const count = Math.min(SAVED_BATCH_SIZE, keys.length);
  const batch = Array.from({ length: count }, (_, index) => keys[(cursor + index) % keys.length]);
  const events: MobileNotificationEventV1[] = [];
  let checked = 0;

  for (const key of batch) {
    const item = saved[key];
    const identity = parseSavedIdentity(key, item);
    if (!identity) continue;

    if (identity.mediaType === 'movie') {
      checked += 1;
      if (selection.upcoming) {
        const releaseDate = String(item?.release_date || '').slice(0, 10);
        const days = daysUntil(releaseDate, today);
        const event = upcomingEvent(
          'upcoming',
          `${identity.mediaType}:${identity.mediaId}`,
          itemTitle(item),
          releaseDate,
          days ?? -1,
          { target: 'media', mediaId: identity.mediaId, mediaType: identity.mediaType },
        );
        if (event) events.push(event);
      }
      continue;
    }

    if (!selection.newEpisodes && !selection.animeReleases && !selection.upcoming) continue;
    try {
      const details = await tmdbFetch<any>(`/tv/${identity.mediaId}`);
      checked += 1;
      const title = itemTitle(details || item);
      const anime = isAnimeContent(details as TmdbMediaItem);
      const lastEpisode = details?.last_episode_to_air;
      if (lastEpisode?.air_date === today) {
        const category = anime && selection.animeReleases ? 'animeReleases' : selection.newEpisodes ? 'newEpisodes' : null;
        if (category) {
          const season = Number(lastEpisode.season_number);
          const episode = Number(lastEpisode.episode_number);
          const episodeLabel = Number.isFinite(season) && Number.isFinite(episode) ? `S${season} E${episode}` : 'A new episode';
          events.push({
            category,
            dedupeKey: `new-episode:${identity.mediaId}:${season}:${episode}:${today}`,
            title: `${title} has a new episode`,
            body: `${episodeLabel} is available today.`,
            target: { target: 'media', mediaId: identity.mediaId, mediaType: 'tv' },
          });
        }
      }

      if (selection.upcoming) {
        const nextEpisode = details?.next_episode_to_air;
        const nextDate = String(nextEpisode?.air_date || '').slice(0, 10);
        const days = daysUntil(nextDate, today);
        const season = Number(nextEpisode?.season_number);
        const episode = Number(nextEpisode?.episode_number);
        const episodeLabel = Number.isFinite(season) && Number.isFinite(episode) ? `S${season} E${episode}` : 'The next episode';
        const event = upcomingEvent(
          'upcoming',
          `tv:${identity.mediaId}:${season}:${episode}`,
          title,
          nextDate,
          days ?? -1,
          { target: 'media', mediaId: identity.mediaId, mediaType: 'tv' },
          days === 1 ? `${episodeLabel} airs tomorrow.` : `${episodeLabel} airs in seven days.`,
        );
        if (event) events.push(event);
      }
    } catch {
      // One title must never block the rest of Orion's bounded entertainment check.
    }
  }

  mmkvStorageAdapter.set(SAVED_CURSOR_KEY, String((cursor + count) % keys.length));
  return { events, checked };
}

function selectionSignature(selection: MobileEntertainmentAlertSelectionV1): string {
  return Object.entries(selection).filter(([, enabled]) => enabled).map(([key]) => key).sort().join('|');
}

export async function checkMobileEntertainmentAlertsV1(
  saved: Record<string, any>,
  savedOrder: string[],
  selection: MobileEntertainmentAlertSelectionV1,
  options: { now?: Date } = {},
): Promise<MobileEntertainmentAlertResultV1> {
  const now = options.now || new Date();
  const nowMs = now.getTime();
  const today = localDateKey(now);
  const signature = selectionSignature(selection);
  if (!signature) return { events: [], catalogChecked: false, savedShowsChecked: 0 };

  const priorSignature = mmkvStorageAdapter.get(PREFERENCE_SIGNATURE_KEY) || '';
  const preferencesChanged = priorSignature !== signature;
  mmkvStorageAdapter.set(PREFERENCE_SIGNATURE_KEY, signature);

  const events: MobileNotificationEventV1[] = [];
  let catalogChecked = false;
  let savedShowsChecked = 0;
  const lastCatalog = Number(mmkvStorageAdapter.get(CATALOG_LAST_CHECK_KEY) || 0);
  const catalogEnabled = selection.newMovies || selection.newSeries || selection.animeReleases;
  if (catalogEnabled && (preferencesChanged || !Number.isFinite(lastCatalog) || nowMs - lastCatalog >= CATALOG_INTERVAL_MS)) {
    events.push(...await collectCatalogEvents(selection, today));
    mmkvStorageAdapter.set(CATALOG_LAST_CHECK_KEY, String(nowMs));
    catalogChecked = true;
  }

  const lastSaved = Number(mmkvStorageAdapter.get(SAVED_LAST_CHECK_KEY) || 0);
  const savedEnabled = selection.newEpisodes || selection.animeReleases || selection.upcoming;
  if (savedEnabled && (preferencesChanged || !Number.isFinite(lastSaved) || nowMs - lastSaved >= SAVED_INTERVAL_MS)) {
    const savedResult = await collectSavedEvents(saved, savedOrder, selection, today);
    events.push(...savedResult.events);
    savedShowsChecked = savedResult.checked;
    mmkvStorageAdapter.set(SAVED_LAST_CHECK_KEY, String(nowMs));
  }

  return { events, catalogChecked, savedShowsChecked };
}
