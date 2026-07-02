import { normalizePersonSummary } from "../shared/utils/credits";
import { tmdbFetch } from "./tmdb";

const languageNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "language" })
  : null;
const regionNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

export const SEARCH_CINEMAS = [
  { id: "global", label: "Global" },
  { id: "hollywood", label: "Hollywood" },
  { id: "bollywood", label: "Bollywood" },
  { id: "south-indian", label: "South Indian" },
  { id: "korean", label: "Korean" },
  { id: "japanese", label: "Japanese" },
  { id: "chinese", label: "Chinese" },
];

const SOUTH_INDIAN_LANGUAGES = new Set(["ta", "te", "ml", "kn"]);
const HOLLYWOOD_COUNTRIES = new Set(["US", "GB", "CA", "AU", "IE", "NZ"]);
const CHINESE_COUNTRIES = new Set(["CN", "HK", "TW"]);

function searchCountries(item = {}) {
  return [...(item.origin_country || []), ...(item.production_countries || [])]
    .map((country) => typeof country === "string" ? country : country?.iso_3166_1)
    .filter(Boolean);
}

export function getSearchCinemaId(item = {}) {
  if (item.media_type === "person") return "people";
  const language = String(item.original_language || "").toLowerCase();
  const countries = searchCountries(item);
  if (SOUTH_INDIAN_LANGUAGES.has(language)) return "south-indian";
  if (language === "ko" || countries.includes("KR")) return "korean";
  if (language === "ja" || countries.includes("JP")) return "japanese";
  if (language.startsWith("zh") || countries.some((country) => CHINESE_COUNTRIES.has(country))) return "chinese";
  if (language === "hi" || countries.includes("IN")) return "bollywood";
  if (countries.some((country) => HOLLYWOOD_COUNTRIES.has(country)) || (language === "en" && !countries.length)) return "hollywood";
  return "other";
}

export function getSearchCinemaLabel(item = {}) {
  const cinemaId = getSearchCinemaId(item);
  return SEARCH_CINEMAS.find((cinema) => cinema.id === cinemaId)?.label || "";
}

export function filterSearchResults(results = [], type = "all", cinema = "global") {
  return results.filter((item) => {
    if (type !== "all" && item.media_type !== type) return false;
    if (cinema === "global") return true;
    return getSearchCinemaId(item) === cinema;
  });
}

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
  const cinema = getSearchCinemaLabel(item);
  return {
    title,
    originalTitle: sameLocalizedTitle ? "" : originalTitle,
    facts: [year, cinema, language, regions, rating].filter(Boolean),
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
