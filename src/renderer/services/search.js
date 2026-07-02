import { normalizePersonSummary } from "../shared/utils/credits";
import { tmdbFetch } from "./tmdb";

const languageNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "language" })
  : null;
const regionNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

export function getSearchResultTitle(item = {}) {
  return item.title || item.name || "Untitled";
}

export function getSearchTitleKey(item = {}) {
  return getSearchResultTitle(item).trim().toLocaleLowerCase();
}

function displayLanguage(code) {
  if (!code) return "";
  try { return languageNames?.of(code) || code.toUpperCase(); } catch { return code.toUpperCase(); }
}

function displayRegions(codes = []) {
  return codes.slice(0, 2).map((code) => {
    try { return regionNames?.of(code) || code; } catch { return code; }
  }).join(", ");
}

export function getSearchResultIdentity(item = {}, duplicateTitle = false) {
  const isPerson = item.media_type === "person";
  if (isPerson) {
    const knownFor = (item.known_for || [])
      .map((known) => known.title || known.name)
      .filter(Boolean)
      .slice(0, 3);
    return {
      title: item.name || "Unknown person",
      originalTitle: "",
      facts: [item.known_for_department || "Person"],
      supportingLabel: knownFor.length ? "Known for" : "",
      supportingText: knownFor.join(", "),
      duplicateTitle: false,
    };
  }
  const title = getSearchResultTitle(item);
  const originalTitle = item.original_title || item.original_name || "";
  const sameLocalizedTitle = originalTitle.localeCompare(title, undefined, { sensitivity: "base" }) === 0;
  const year = String(item.release_date || item.first_air_date || "").slice(0, 4);
  const language = displayLanguage(item.original_language);
  const regions = displayRegions(item.origin_country || []);
  const rating = Number(item.vote_average) > 0 ? `★ ${Number(item.vote_average).toFixed(1)}` : "";
  return {
    title,
    originalTitle: sameLocalizedTitle ? "" : originalTitle,
    facts: [year, language, regions, rating].filter(Boolean),
    supportingLabel: originalTitle && !sameLocalizedTitle ? "Original title" : "",
    supportingText: originalTitle && !sameLocalizedTitle ? originalTitle : "",
    duplicateTitle,
  };
}

export function findDuplicateSearchTitles(results = []) {
  const counts = new Map();
  results.filter((item) => item.media_type !== "person").forEach((item) => {
    const key = getSearchTitleKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

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
