// Company and keyword IDs were verified against TMDB v3 on 2026-06-28.
// Provider IDs are intentionally absent because they vary by regional catalog.
export const PROVIDER_HUBS = [
  { id: "netflix", name: "Netflix", aliases: ["Netflix"], gradient: "linear-gradient(135deg,#21080d,#e50914)" },
  { id: "prime", name: "Prime Video", aliases: ["Amazon Prime Video", "Prime Video"], gradient: "linear-gradient(135deg,#071b2d,#00a8e1)" },
  { id: "disney", name: "Disney+", aliases: ["Disney Plus"], gradient: "linear-gradient(135deg,#071b55,#3469e8)" },
  { id: "max", name: "Max", aliases: ["Max", "HBO Max"], gradient: "linear-gradient(135deg,#17004e,#7c3aed)" },
  { id: "apple", name: "Apple TV+", aliases: ["Apple TV Plus"], gradient: "linear-gradient(135deg,#111827,#64748b)" },
];

export const WORLD_HUBS = [
  {
    id: "marvel", name: "Marvel", gradient: "linear-gradient(135deg,#25090f,#d12632)",
    filters: [
      { id: "all", name: "All", movie: "with_companies=420|7505", tv: "with_companies=38679|7505" },
      { id: "mcu", name: "MCU", movie: "with_keywords=180547", tv: "with_keywords=180547" },
      { id: "xmen", name: "X-Men", movie: "with_keywords=377742", tv: "with_keywords=377742" },
      { id: "spider", name: "Spider-Man / Sony", movie: "with_keywords=373794", tv: "with_keywords=373794" },
      { id: "legacy", name: "Legacy", movie: "with_companies=19551|7505", tv: "with_companies=38679" },
      { id: "series", name: "Series", movie: "with_companies=420", tv: "with_companies=38679" },
      { id: "animation", name: "Animation", movie: "with_companies=7505&with_genres=16", tv: "with_companies=7505&with_genres=16" },
    ],
  },
  {
    id: "dc", name: "DC", gradient: "linear-gradient(135deg,#071a35,#1877d2)",
    filters: [
      { id: "all", name: "All", movie: "with_companies=429|9993", tv: "with_companies=9993" },
      { id: "dcu", name: "DCU / DCEU", movie: "with_keywords=229266", tv: "with_keywords=229266" },
      { id: "batman", name: "Batman", movie: "with_keywords=349974", tv: "with_keywords=349974" },
      { id: "superman", name: "Superman", movie: "with_keywords=377234", tv: "with_keywords=377234" },
      { id: "arrowverse", name: "Arrowverse", movie: "with_keywords=375211", tv: "with_keywords=375211" },
      { id: "series", name: "Series", movie: "with_companies=429", tv: "with_companies=9993" },
      { id: "animation", name: "Animation", movie: "with_companies=429&with_genres=16", tv: "with_companies=9993&with_genres=16" },
    ],
  },
  {
    id: "starwars", name: "Star Wars", gradient: "linear-gradient(135deg,#05070d,#2f4968)",
    filters: [
      { id: "movies", name: "Movies", movie: "with_companies=1&with_keywords=377919", tv: "with_keywords=377919" },
      { id: "series", name: "Series", movie: "with_keywords=377919", tv: "with_companies=1&with_keywords=377919" },
      { id: "animation", name: "Animation", movie: "with_keywords=377919&with_genres=16", tv: "with_keywords=377919&with_genres=16" },
      { id: "classic", name: "Classic era", movie: "with_keywords=377919&primary_release_date.lte=1999-12-31", tv: "with_keywords=377919&first_air_date.lte=1999-12-31" },
      { id: "modern", name: "Modern era", movie: "with_keywords=377919&primary_release_date.gte=2000-01-01", tv: "with_keywords=377919&first_air_date.gte=2000-01-01" },
    ],
  },
  {
    id: "pixar", name: "Pixar", gradient: "linear-gradient(135deg,#112a46,#3ea7dc)",
    filters: [
      { id: "movies", name: "Movies", movie: "with_companies=3", tv: "with_companies=3" },
      { id: "shorts", name: "Series / shorts", movie: "with_companies=3&with_runtime.lte=45", tv: "with_companies=3" },
      { id: "classic", name: "1995–2009", movie: "with_companies=3&primary_release_date.gte=1995-01-01&primary_release_date.lte=2009-12-31", tv: "with_companies=3" },
      { id: "modern", name: "2010–now", movie: "with_companies=3&primary_release_date.gte=2010-01-01", tv: "with_companies=3&first_air_date.gte=2010-01-01" },
    ],
  },
];

export function inferWatchRegion() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  const candidate = locale.split("-").find((part) => /^[A-Z]{2}$/.test(part));
  return candidate || "US";
}

export function findProviderId(catalog, hub) {
  return findProviderIds(catalog, hub)[0] || null;
}

export function findProviderIds(catalog, hub) {
  const names = hub.aliases.map((name) => name.toLowerCase());
  const matches = (catalog || []).filter((provider) => {
    const providerName = String(provider.provider_name || "").trim().toLowerCase();
    return names.some((name) =>
      providerName === name ||
      providerName.startsWith(`${name} `) ||
      (name.length >= 6 && providerName.includes(name)),
    );
  });
  return [...new Set(matches.map((provider) => Number(provider.provider_id)).filter(Boolean))];
}
