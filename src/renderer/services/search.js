import { normalizePersonSummary } from "../shared/utils/credits";
import { tmdbFetch } from "./tmdb";

export function normalizeSearchResults(results = []) {
  return results.flatMap((item) => {
    if (item?.media_type === "person") return [normalizePersonSummary(item)];
    if (item?.media_type === "movie" || item?.media_type === "tv") return [item];
    return [];
  });
}

export function appendUniqueSearchResults(previous = [], incoming = []) {
  const seen = new Set();
  return [...previous, ...incoming].filter((item) => {
    const key = `${item.media_type}_${item.id}`;
    if (item.id == null || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchTmdb(query, page, apiKey) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery || !apiKey) return { page: 1, totalPages: 0, results: [] };
  const data = await tmdbFetch(
    `/search/multi?query=${encodeURIComponent(normalizedQuery)}&page=${Math.max(1, Number(page) || 1)}&include_adult=false`,
    apiKey,
  );
  return {
    page: Number(data.page) || 1,
    totalPages: Math.min(Number(data.total_pages) || 1, 500),
    results: normalizeSearchResults(data.results || []),
  };
}
