import type { AnimeLookupEntry } from './animeIdentity';

const ENDPOINT = 'https://graphql.anilist.co';
const FIELDS = 'id type format title { english romaji native } synonyms episodes startDate { year month day }';
const QUERY = `query($search:String!){Page(page:1,perPage:10){pageInfo{hasNextPage}media(search:$search,type:ANIME){${FIELDS} relations{edges{relationType node{${FIELDS} relations{edges{relationType node{${FIELDS}}}}}}}}}}`;
const cache = new Map<string, { expires: number; entries: AnimeLookupEntry[] }>();
const MAX_CACHE = 32;
const TTL = 6 * 60 * 60_000;

function normalizeEntry(value: any, depth = 0): AnimeLookupEntry | null {
  if (!value || value.type !== 'ANIME' || !Number.isSafeInteger(value.id) || value.id <= 0 || depth > 2) return null;
  const titles = [...Object.values(value.title || {}), ...(Array.isArray(value.synonyms) ? value.synonyms : [])]
    .filter((title): title is string => typeof title === 'string' && title.length > 0 && title.length <= 300);
  return {
    id: value.id, titles: [...new Set(titles)], format: String(value.format || ''),
    year: Number(value.startDate?.year) || 0, episodes: Number(value.episodes) || 0,
    releaseDate: [value.startDate?.year, value.startDate?.month, value.startDate?.day].every((part) => Number.isInteger(part) && part > 0)
      ? `${value.startDate.year}-${String(value.startDate.month).padStart(2, '0')}-${String(value.startDate.day).padStart(2, '0')}` : undefined,
    sequels: (Array.isArray(value.relations?.edges) ? value.relations.edges : [])
      .filter((edge: any) => edge?.relationType === 'SEQUEL')
      .map((edge: any) => normalizeEntry(edge.node, depth + 1)).filter((entry: AnimeLookupEntry | null) => entry !== null),
  };
}

/** Bounded public metadata search; never substitutes stale data after failure. */
export async function lookupAnimeEntries(titles: string[], signal?: AbortSignal): Promise<AnimeLookupEntry[]> {
  const searches = [...new Set(titles.filter((title) => typeof title === 'string' && title.trim().length > 0
    && title.length <= 300).map((title) => title.trim()))].slice(0, 3);
  if (!searches.length || signal?.aborted) throw new Error('Anime lookup was cancelled or has no title.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 12_000);
  try {
    const result: AnimeLookupEntry[] = [];
    for (const title of searches) {
      if (controller.signal.aborted) throw new Error('Anime lookup cancelled.');
      const saved = cache.get(title);
      if (saved && saved.expires > Date.now()) { result.push(...saved.entries); continue; }
      const response = await fetch(ENDPOINT, { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { search: title } }) });
      if (!response.ok) throw new Error('Anime identity lookup is unavailable.');
      const raw = await response.text();
      if (raw.length > 250_000) throw new Error('Anime identity response exceeded its bound.');
      const body = JSON.parse(raw);
      const page = body?.data?.Page;
      if (body.errors || !Array.isArray(page?.media) || page.media.length > 10 || page.pageInfo?.hasNextPage !== false) {
        throw new Error('Anime lookup returned incomplete or ambiguous evidence.');
      }
      const entries = page.media.map((value: unknown) => normalizeEntry(value)).filter((entry: AnimeLookupEntry | null) => entry !== null);
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(title, { expires: Date.now() + TTL, entries });
      result.push(...entries);
    }
    if (controller.signal.aborted) throw new Error('Anime lookup cancelled.');
    return result;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
