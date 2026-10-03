import { matchesAnimeBaseEvidence, type AnimeCatalogEvidence, type AnimeLookupEntry } from './animeIdentity';
import { AnimeLookupError, describeAnimeLookupTitle, emitAnimeIdentityDiagnostic as emit, type AnimeIdentityDiagnosticSink } from './animeIdentityDiagnostics';

const ENDPOINT = 'https://graphql.anilist.co';
const FIELDS = 'id type format title { english romaji native } synonyms episodes startDate { year month day } relations { edges { relationType node { id type } } }';
const QUERY = `query($search:String!,$page:Int!){Page(page:$page,perPage:10){pageInfo{hasNextPage}media(search:$search,type:ANIME){${FIELDS}}}}`;
const RELATIONS = `query($ids:[Int]){Page(page:1,perPage:10){pageInfo{hasNextPage}media(id_in:$ids,type:ANIME){${FIELDS}}}}`;
const cache = new Map<string, { expires: number; entries: AnimeLookupEntry[] }>();
const MAX_CACHE = 32;
const TTL = 6 * 60 * 60_000;

function normalizeEntry(value: any): AnimeLookupEntry | null {
  if (!value || value.type !== 'ANIME' || !Number.isSafeInteger(value.id) || value.id <= 0) return null;
  const titles = [...Object.values(value.title || {}), ...(Array.isArray(value.synonyms) ? value.synonyms : [])]
    .filter((title): title is string => typeof title === 'string' && title.length > 0 && title.length <= 300);
  return {
    id: value.id, titles: [...new Set(titles)], format: String(value.format || ''),
    year: Number(value.startDate?.year) || 0, episodes: Number(value.episodes) || 0,
    releaseDate: [value.startDate?.year, value.startDate?.month, value.startDate?.day].every((part) => Number.isInteger(part) && part > 0)
      ? `${value.startDate.year}-${String(value.startDate.month).padStart(2, '0')}-${String(value.startDate.day).padStart(2, '0')}` : undefined,
    sequels: [],
    sequelIds: [...new Set<number>((Array.isArray(value.relations?.edges) ? value.relations.edges : [])
      .filter((edge: any) => edge?.relationType === 'SEQUEL' && edge.node?.type === 'ANIME'
        && Number.isSafeInteger(edge.node.id) && edge.node.id > 0).map((edge: any) => edge.node.id))],
  };
}

/** Bounded public metadata search; never substitutes stale data after failure. */
export async function lookupAnimeEntries(titles: string[], signal?: AbortSignal, options: {
  catalog?: AnimeCatalogEvidence; diagnostic?: AnimeIdentityDiagnosticSink;
} = {}): Promise<AnimeLookupEntry[]> {
  const searches = [...new Set(titles.filter((title) => typeof title === 'string' && title.trim().length > 0
    && title.length <= 300).map((title) => title.trim()))].slice(0, 3);
  if (!searches.length) throw new AnimeLookupError('lookup-missing-title');
  if (signal?.aborted) throw new AnimeLookupError('lookup-cancelled');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; cancel(); }, 12_000);
  const checkCancelled = () => {
    if (controller.signal.aborted) throw new AnimeLookupError(timedOut ? 'lookup-timeout' : 'lookup-cancelled');
  };
  const fetchPage = async (query: string, variables: object, scope: 'search' | 'relation'): Promise<{ entries: AnimeLookupEntry[]; hasNextPage: boolean }> => {
    checkCancelled();
    let response: Response;
    try {
      response = await fetch(ENDPOINT, { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }) });
    } catch { checkCancelled(); throw new AnimeLookupError('lookup-network-failed'); }
    if (!response.ok) throw new AnimeLookupError('lookup-http-rejected');
    let raw: string;
    try { raw = await response.text(); } catch { checkCancelled(); throw new AnimeLookupError('lookup-network-failed'); }
    checkCancelled();
    emit(options.diagnostic, { stage: 'lookup', scope, responseCharacters: raw.length });
    if (raw.length > 250_000) throw new AnimeLookupError('lookup-response-too-large');
    let body: any;
    try { body = JSON.parse(raw); } catch { throw new AnimeLookupError('lookup-malformed-response'); }
    if (body?.errors) throw new AnimeLookupError('lookup-graphql-failed');
    const page = body?.data?.Page;
    if (!Array.isArray(page?.media) || page.media.length > 10) throw new AnimeLookupError('lookup-malformed-response');
    if (typeof page.pageInfo?.hasNextPage !== 'boolean') throw new AnimeLookupError('lookup-incomplete-search');
    return { entries: page.media.map(normalizeEntry).filter((entry: AnimeLookupEntry | null) => entry !== null), hasNextPage: page.pageInfo.hasNextPage };
  };
  try {
    const result: AnimeLookupEntry[] = [];
    for (const title of searches) {
      checkCancelled();
      const saved = cache.get(title);
      emit(options.diagnostic, { stage: 'lookup', scope: 'search', query: describeAnimeLookupTitle(title), cached: Boolean(saved && saved.expires > Date.now()) });
      if (saved && saved.expires > Date.now()) { result.push(...saved.entries); continue; }
      const entries: AnimeLookupEntry[] = [];
      for (let page = 1; page <= 3; page++) {
        const reply = await fetchPage(QUERY, { search: title, page }, 'search');
        entries.push(...reply.entries);
        if (!reply.hasNextPage) break;
        if (page === 3) throw new AnimeLookupError('lookup-incomplete-search');
      }
      emit(options.diagnostic, { stage: 'lookup', scope: 'search', candidates: entries.length });
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(title, { expires: Date.now() + TTL, entries });
      result.push(...entries);
    }
    checkCancelled();
    // Cached search metadata is immutable. Hydrate only the uniquely verified
    // base's sequel graph for later seasons; never expand every search result.
    const unique = [...new Map(result.map((entry) => [entry.id, { ...entry, sequels: [] as AnimeLookupEntry[] }])).values()];
    const catalog = options.catalog;
    const bases = catalog ? unique.filter((entry) => matchesAnimeBaseEvidence(catalog, entry)) : [];
    if (catalog?.mediaType === 'tv' && (catalog.season ?? 0) > 1 && bases.length === 1) {
      const nodes = new Map<number, AnimeLookupEntry>([[bases[0].id, bases[0]]]);
      let pending = bases[0].sequelIds || [];
      let depth = 0;
      while (pending.length) {
        checkCancelled();
        const ids = [...new Set(pending)].filter((id) => !nodes.has(id));
        if (!ids.length) break;
        if (++depth > 8 || nodes.size + ids.length > 25) throw new AnimeLookupError('lookup-relation-limit');
        pending = [];
        for (let offset = 0; offset < ids.length; offset += 10) {
          const batch = ids.slice(offset, offset + 10);
          emit(options.diagnostic, { stage: 'lookup', scope: 'relation', depth, candidates: batch.length });
          const reply = await fetchPage(RELATIONS, { ids: batch }, 'relation');
          if (reply.hasNextPage) throw new AnimeLookupError('lookup-relation-incomplete');
          const related = reply.entries;
          if (related.length !== batch.length || related.some((entry) => !batch.includes(entry.id))
            || new Set(related.map((entry) => entry.id)).size !== batch.length) throw new AnimeLookupError('lookup-relation-incomplete');
          related.forEach((entry) => { nodes.set(entry.id, entry); pending.push(...(entry.sequelIds || [])); });
        }
      }
      for (const entry of nodes.values()) entry.sequels = (entry.sequelIds || []).map((id) => nodes.get(id)!);
    }
    checkCancelled();
    return unique;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
