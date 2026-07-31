export const CONSTELLATION_CINEMAS = [
  { id: "global", label: "Global", countries: [], languages: [] },
  { id: "hollywood", label: "Hollywood", countries: ["US", "GB", "CA", "AU", "IE", "NZ"], languages: [] },
  { id: "bollywood", label: "Bollywood", countries: ["IN"], languages: ["hi"] },
  { id: "south-indian", label: "South Indian", countries: ["IN"], languages: ["ta", "te", "ml", "kn"] },
  { id: "korean", label: "Korean", countries: ["KR"], languages: ["ko"] },
  { id: "japanese", label: "Japanese", countries: ["JP"], languages: ["ja"] },
  { id: "chinese", label: "Chinese", countries: ["CN", "HK", "TW"], languages: ["zh"] },
];

export const CONSTELLATION_CRAFTS = [
  { id: "all", label: "Everyone" },
  { id: "acting", label: "Acting" },
  { id: "directing", label: "Directing" },
  { id: "writing", label: "Writing" },
  { id: "production", label: "Production" },
];

export const CONSTELLATION_MEDIA = [
  { id: "all", label: "All media" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "Television" },
];

export const CONSTELLATION_SORTS = [
  { id: "popular", label: "Popular" },
  { id: "credits", label: "Most credited" },
  { id: "name", label: "A–Z" },
];

export const DEFAULT_CONSTELLATION_PREFERENCES = {
  cinema: "global",
  craft: "all",
  media: "all",
  sort: "popular",
};

export function getConstellationCinema(id) {
  return CONSTELLATION_CINEMAS.find((cinema) => cinema.id === id) || CONSTELLATION_CINEMAS[0];
}

export function buildCinemaDiscoverPaths(cinemaId, mediaType, page = 1) {
  const cinema = getConstellationCinema(cinemaId);
  if (cinema.id === "global") return [];
  const country = cinema.countries.length ? `&with_origin_country=${cinema.countries.join("|")}` : "";
  const languages = cinema.languages.length ? cinema.languages : [""];
  return languages.map((language) => {
    const originalLanguage = language ? `&with_original_language=${language}` : "";
    const adult = mediaType === "movie" ? "&include_adult=false" : "";
    return `/discover/${mediaType}?sort_by=popularity.desc&vote_count.gte=20${adult}${country}${originalLanguage}&page=${Math.max(1, Number(page) || 1)}`;
  });
}
