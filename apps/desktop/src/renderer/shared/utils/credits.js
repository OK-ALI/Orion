const MEDIA_TYPES = new Set(["movie", "tv"]);

function uniqueText(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function inferMediaType(item) {
  if (MEDIA_TYPES.has(item?.media_type)) return item.media_type;
  if (item?.title || item?.release_date) return "movie";
  if (item?.name || item?.first_air_date) return "tv";
  return null;
}

export function normalizePersonSummary(person = {}) {
  return {
    id: person.id,
    media_type: "person",
    name: person.name || "Unknown person",
    profile_path: person.profile_path || null,
    known_for_department: person.known_for_department || "",
    popularity: Number(person.popularity) || 0,
    known_for: (person.known_for || [])
      .filter((item) => MEDIA_TYPES.has(inferMediaType(item)))
      .map((item) => ({ ...item, media_type: inferMediaType(item) })),
  };
}

export function normalizeCredit(item = {}) {
  const mediaType = inferMediaType(item);
  if (!mediaType || item.id == null) return null;
  const roles = uniqueText([
    item.character,
    ...(item.roles || []).map((role) => role?.character),
  ]);
  const jobs = uniqueText([
    item.job,
    ...(item.jobs || []).map((job) => job?.job),
  ]);
  return {
    ...item,
    media_type: mediaType,
    title: item.title || item.name || "Untitled",
    release_date: item.release_date || item.first_air_date || "",
    roles,
    jobs,
    popularity: Number(item.popularity) || 0,
    vote_count: Number(item.vote_count) || 0,
  };
}

export function normalizeCredits(items = []) {
  const merged = new Map();
  for (const raw of items) {
    const credit = normalizeCredit(raw);
    if (!credit) continue;
    const key = `${credit.media_type}_${credit.id}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, credit);
      continue;
    }
    merged.set(key, {
      ...existing,
      ...credit,
      roles: uniqueText([...(existing.roles || []), ...(credit.roles || [])]),
      jobs: uniqueText([...(existing.jobs || []), ...(credit.jobs || [])]),
      popularity: Math.max(existing.popularity || 0, credit.popularity || 0),
      vote_count: Math.max(existing.vote_count || 0, credit.vote_count || 0),
    });
  }
  return [...merged.values()];
}

export function normalizeCombinedCredits(data = {}) {
  return normalizeCredits([...(data.cast || []), ...(data.crew || [])]);
}

export function selectKnownFor(credits = [], limit = 12) {
  return [...credits]
    .sort((a, b) => {
      const scoreA = (a.popularity || 0) + Math.log10((a.vote_count || 0) + 1) * 4;
      const scoreB = (b.popularity || 0) + Math.log10((b.vote_count || 0) + 1) * 4;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

const KEY_CREW_JOBS = new Map([
  ["Director", 0],
  ["Creator", 1],
  ["Screenplay", 2],
  ["Writer", 3],
  ["Executive Producer", 4],
  ["Producer", 5],
]);

export function extractKeyCrew(crew = [], creators = [], limit = 12) {
  const entries = [
    ...creators.map((person) => ({ ...person, job: "Creator" })),
    ...crew.filter((person) => KEY_CREW_JOBS.has(person.job)),
  ];
  const seen = new Set();
  return entries
    .sort((a, b) => (KEY_CREW_JOBS.get(a.job) ?? 99) - (KEY_CREW_JOBS.get(b.job) ?? 99))
    .filter((person) => {
      const key = `${person.id}_${person.job}`;
      if (person.id == null || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((person) => ({ ...normalizePersonSummary(person), job: person.job }));
}
