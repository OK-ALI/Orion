import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import { tmdbFetch } from "../../../services/tmdb";
import { normalizePersonSummary } from "../../../shared/utils/credits";
import { buildCinemaDiscoverPaths, getConstellationCinema } from "./manifest";

export const CONSTELLATION_CACHE_VERSION = 1;
export const CONSTELLATION_CACHE_TTL = 86_400_000;
const CACHE_POOL_LIMIT = 7;
const CREDIT_CONCURRENCY = 2;
const SEEDS_PER_MEDIA = 5;
const CAST_LIMIT = 12;

const JOB_CRAFT = new Map([
  ["Director", "directing"], ["Co-Director", "directing"],
  ["Writer", "writing"], ["Screenplay", "writing"], ["Story", "writing"],
  ["Teleplay", "writing"], ["Novel", "writing"], ["Characters", "writing"], ["Creator", "writing"],
  ["Producer", "production"], ["Executive Producer", "production"],
  ["Co-Producer", "production"], ["Associate Producer", "production"],
]);

const JOB_WEIGHT = new Map([
  ["Director", 1.5], ["Co-Director", 1.35], ["Creator", 1.4],
  ["Writer", 1.15], ["Screenplay", 1.2], ["Story", 1.05], ["Teleplay", 1.05],
  ["Novel", 0.9], ["Characters", 0.8], ["Executive Producer", 0.85],
  ["Producer", 0.75], ["Co-Producer", 0.65], ["Associate Producer", 0.55],
]);

function mediaIdentity(media) {
  return `${media.media_type}_${media.id}`;
}

function mediaSummary(media) {
  return {
    id: media.id,
    media_type: media.media_type,
    title: media.title || media.name || "Untitled",
    name: media.name,
    poster_path: media.poster_path || null,
    release_date: media.release_date || "",
    first_air_date: media.first_air_date || "",
    popularity: Number(media.popularity) || 0,
  };
}

function primaryDepartment(craftScores) {
  const labels = { acting: "Acting", directing: "Directing", writing: "Writing", production: "Production" };
  return labels[Object.entries(craftScores).sort((a, b) => b[1] - a[1])[0]?.[0]] || "Person";
}

export function aggregateConstellationCredits(seedCredits = []) {
  const people = new Map();
  const addContribution = (raw, media, craft, weight) => {
    if (raw?.id == null) return;
    const source = mediaSummary(media);
    const current = people.get(raw.id) || {
      ...normalizePersonSummary(raw),
      crafts: [], mediaTypes: [], representativeCredits: [], contributionCount: 0,
      score: 0, _sources: new Set(), _craftScores: {},
    };
    current.name = raw.name || current.name;
    current.profile_path = raw.profile_path || current.profile_path;
    current.popularity = Math.max(current.popularity || 0, Number(raw.popularity) || 0);
    if (!current.crafts.includes(craft)) current.crafts.push(craft);
    if (!current.mediaTypes.includes(media.media_type)) current.mediaTypes.push(media.media_type);
    current._craftScores[craft] = (current._craftScores[craft] || 0) + weight;
    const sourceKey = mediaIdentity(media);
    if (!current._sources.has(sourceKey)) {
      current._sources.add(sourceKey);
      current.contributionCount += 1;
      current.representativeCredits.push(source);
      current.representativeCredits.sort((a, b) => b.popularity - a.popularity);
      current.representativeCredits = current.representativeCredits.slice(0, 3);
    }
    current.score += weight * (1 + Math.log10((source.popularity || 0) + 1));
    people.set(raw.id, current);
  };

  seedCredits.forEach(({ media, credits }) => {
    (credits?.cast || []).slice(0, CAST_LIMIT).forEach((person, index) => {
      addContribution(person, media, "acting", 1.25 / (1 + index * 0.08));
    });
    (credits?.crew || []).forEach((person) => {
      const jobs = person.jobs?.length ? person.jobs.map((entry) => entry.job) : [person.job];
      [...new Set(jobs.filter(Boolean))].forEach((job) => {
        const craft = JOB_CRAFT.get(job);
        if (craft) addContribution(person, media, craft, JOB_WEIGHT.get(job) || 0.5);
      });
    });
  });

  return [...people.values()].map((person) => {
    const knownFor = person.representativeCredits.map((credit) => ({ ...credit }));
    const result = {
      ...person,
      known_for_department: primaryDepartment(person._craftScores),
      known_for: knownFor,
      score: Number(person.score.toFixed(4)),
    };
    delete result._sources;
    delete result._craftScores;
    return result;
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function mergeConstellationPeople(previous = [], incoming = []) {
  const merged = new Map(previous.map((person) => [person.id, { ...person }]));
  incoming.forEach((person) => {
    const current = merged.get(person.id);
    if (!current) { merged.set(person.id, { ...person }); return; }
    const credits = [...(current.representativeCredits || []), ...(person.representativeCredits || [])];
    const seenCredits = new Set();
    merged.set(person.id, {
      ...current,
      ...person,
      profile_path: person.profile_path || current.profile_path,
      crafts: [...new Set([...(current.crafts || []), ...(person.crafts || [])])],
      mediaTypes: [...new Set([...(current.mediaTypes || []), ...(person.mediaTypes || [])])],
      representativeCredits: credits.filter((credit) => {
        const key = mediaIdentity(credit);
        if (seenCredits.has(key)) return false;
        seenCredits.add(key); return true;
      }).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 3),
      contributionCount: (current.contributionCount || 0) + (person.contributionCount || 0),
      score: (current.score || 0) + (person.score || 0),
    });
  });
  return [...merged.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function filterConstellationPeople(people = [], filters = {}) {
  const query = String(filters.query || "").trim().toLocaleLowerCase();
  const filtered = people.filter((person) => {
    if (filters.craft && filters.craft !== "all" && !(person.crafts || []).includes(filters.craft)) return false;
    if (filters.media && filters.media !== "all" && !(person.mediaTypes || []).includes(filters.media)) return false;
    if (!query) return true;
    return `${person.name || ""} ${(person.known_for || []).map((item) => item.title || item.name).join(" ")}`.toLocaleLowerCase().includes(query);
  });
  return [...filtered].sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    if (filters.sort === "credits") return (b.contributionCount || 0) - (a.contributionCount || 0) || (b.score || 0) - (a.score || 0);
    return (b.score || b.popularity || 0) - (a.score || a.popularity || 0) || a.name.localeCompare(b.name);
  });
}

export function selectPersonalizedSeeds(history = [], saved = [], limit = 8) {
  const seen = new Set();
  return [...history, ...saved].filter((item) => {
    const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
    const key = `${mediaType}_${item.id}`;
    if (item.id == null || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, limit).map((item) => ({ ...item, media_type: item.media_type || (item.first_air_date ? "tv" : "movie") }));
}

export async function mapWithConcurrency(items, limit, mapper, onItem) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: "fulfilled", value: await mapper(items[index], index) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
      onItem?.(results[index], index, results.filter(Boolean).length, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, worker));
  return results;
}

async function fetchCreditSeeds(mediaSeeds, apiKey, onProgress) {
  const successful = [];
  const outcomes = await mapWithConcurrency(mediaSeeds, CREDIT_CONCURRENCY, async (media) => {
    const endpoint = media.media_type === "tv" ? `/tv/${media.id}/aggregate_credits` : `/movie/${media.id}/credits`;
    return { media, credits: await tmdbFetch(endpoint, apiKey) };
  }, (outcome, _index, completed, total) => {
    if (outcome.status === "fulfilled") successful.push(outcome.value);
    onProgress?.({ phase: "mapping", completed, total, people: aggregateConstellationCredits(successful) });
  });
  return { successful, failures: outcomes.filter((outcome) => outcome.status === "rejected").length };
}

function normalizeGlobalPerson(person, trendingBoost = 0) {
  const summary = normalizePersonSummary(person);
  const mediaTypes = [...new Set((summary.known_for || []).map((item) => item.media_type).filter(Boolean))];
  const craft = String(summary.known_for_department || "").toLowerCase();
  const craftId = { acting: "acting", directing: "directing", writing: "writing", production: "production" }[craft];
  return {
    ...summary,
    crafts: craftId ? [craftId] : [],
    mediaTypes,
    representativeCredits: summary.known_for || [],
    contributionCount: (summary.known_for || []).length,
    score: (summary.popularity || 0) + trendingBoost,
  };
}

export async function fetchGlobalConstellationPool({ page = 1, apiKey, onProgress }) {
  const requests = page === 1
    ? [tmdbFetch("/trending/person/week", apiKey), tmdbFetch("/person/popular?page=1", apiKey)]
    : [tmdbFetch(`/person/popular?page=${page}`, apiKey)];
  const responses = await Promise.allSettled(requests);
  const trending = responses[0]?.status === "fulfilled" ? responses[0].value.results || [] : [];
  const popularResponse = responses[responses.length - 1]?.status === "fulfilled" ? responses[responses.length - 1].value : {};
  const people = mergeConstellationPeople(
    trending.map((person, index) => normalizeGlobalPerson(person, Math.max(0, 40 - index))),
    (popularResponse.results || []).map((person) => normalizeGlobalPerson(person)),
  );
  onProgress?.({ phase: "mapping", completed: responses.length, total: responses.length, people });
  if (!people.length) throw new Error("No people data is currently available.");
  return {
    version: CONSTELLATION_CACHE_VERSION, cinemaId: "global", people,
    seedPage: page, totalPages: Number(popularResponse.total_pages) || page,
    generatedAt: Date.now(), partialFailures: responses.filter((result) => result.status === "rejected").length,
  };
}

export async function fetchCinemaConstellationPool({ cinemaId, page = 1, apiKey, onProgress }) {
  const cinema = getConstellationCinema(cinemaId);
  if (cinema.id === "global") return fetchGlobalConstellationPool({ page, apiKey, onProgress });
  const discoverTasks = ["movie", "tv"].flatMap((mediaType) => buildCinemaDiscoverPaths(cinema.id, mediaType, page).map((path) => ({ mediaType, path })));
  const discover = await mapWithConcurrency(discoverTasks, CREDIT_CONCURRENCY, async (task) => ({
    ...task, data: await tmdbFetch(task.path, apiKey),
  }), (_outcome, _index, completed, total) => {
    onProgress?.({ phase: "discovering", completed, total, people: [] });
  });
  const successfulDiscover = discover.flatMap((outcome) => outcome.status === "fulfilled" ? [outcome.value] : []);
  const seeds = ["movie", "tv"].flatMap((mediaType) => {
    const seen = new Set();
    return successfulDiscover.filter((result) => result.mediaType === mediaType)
      .flatMap((result) => result.data.results || [])
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
      .slice(0, SEEDS_PER_MEDIA)
      .map((item) => ({ ...item, media_type: mediaType }));
  });
  if (!seeds.length) throw new Error(`No ${cinema.label} titles are currently available.`);
  const credits = await fetchCreditSeeds(seeds, apiKey, onProgress);
  const people = aggregateConstellationCredits(credits.successful);
  if (!people.length) throw new Error(`No ${cinema.label} credits are currently available.`);
  return {
    version: CONSTELLATION_CACHE_VERSION, cinemaId: cinema.id, people,
    seedPage: page,
    totalPages: Math.max(page, ...successfulDiscover.map((result) => Number(result.data.total_pages) || 1)),
    generatedAt: Date.now(),
    partialFailures: discover.filter((result) => result.status === "rejected").length + credits.failures,
  };
}

export async function fetchPersonalConstellation({ history, saved, apiKey, onProgress }) {
  const seeds = selectPersonalizedSeeds(history, saved);
  if (!seeds.length) return [];
  const credits = await fetchCreditSeeds(seeds, apiKey, onProgress);
  return aggregateConstellationCredits(credits.successful);
}

export function getCachedConstellationPool(cinemaId, now = Date.now()) {
  const cache = storage.get(STORAGE_KEYS.CONSTELLATION_CACHE);
  if (cache?.version !== CONSTELLATION_CACHE_VERSION) return null;
  const pool = cache.pools?.[cinemaId];
  if (!pool || now - pool.generatedAt >= CONSTELLATION_CACHE_TTL) return null;
  return pool;
}

export function setCachedConstellationPool(pool) {
  const current = storage.get(STORAGE_KEYS.CONSTELLATION_CACHE);
  const pools = current?.version === CONSTELLATION_CACHE_VERSION ? { ...(current.pools || {}) } : {};
  pools[pool.cinemaId] = pool;
  const retained = Object.fromEntries(Object.entries(pools).sort((a, b) => b[1].generatedAt - a[1].generatedAt).slice(0, CACHE_POOL_LIMIT));
  storage.set(STORAGE_KEYS.CONSTELLATION_CACHE, { version: CONSTELLATION_CACHE_VERSION, pools: retained });
}

export function mergeConstellationPools(current, incoming) {
  if (!current) return incoming;
  return {
    ...incoming,
    people: mergeConstellationPeople(current.people, incoming.people),
    seedPage: Math.max(current.seedPage || 1, incoming.seedPage || 1),
    partialFailures: (current.partialFailures || 0) + (incoming.partialFailures || 0),
  };
}
