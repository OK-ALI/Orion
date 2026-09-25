// Mobile-local copy of the v3.2.1 Desktop discovery definitions.
// Provider IDs are resolved per region; they are never global constants.
export const PROVIDER_HUBS = [
  { id: 'netflix', name: 'Netflix', aliases: ['Netflix'], colors: ['#21080d', '#e50914'] },
  { id: 'prime', name: 'Prime Video', aliases: ['Amazon Prime Video', 'Prime Video'], colors: ['#071b2d', '#00a8e1'] },
  { id: 'disney', name: 'Disney+', aliases: ['Disney Plus'], colors: ['#071b55', '#3469e8'] },
  { id: 'max', name: 'Max', aliases: ['Max', 'HBO Max'], colors: ['#17004e', '#7c3aed'] },
  { id: 'apple', name: 'Apple TV+', aliases: ['Apple TV Plus'], colors: ['#111827', '#64748b'] },
] as const;

export const WORLD_HUBS = [
  { id: 'marvel', name: 'Marvel', colors: ['#25090f', '#d12632'], filters: [
    { id: 'all', name: 'All', movie: 'with_companies=420|7505', tv: 'with_companies=38679|7505' },
    { id: 'mcu', name: 'MCU', movie: 'with_keywords=180547', tv: 'with_keywords=180547' },
    // TMDB has no X-Men franchise keyword. Its mutant keyword plus verified
    // Marvel production companies includes the core films and series.
    { id: 'xmen', name: 'X-Men', movie: 'with_companies=160251|19551|7505|420&with_keywords=1852', tv: 'with_companies=160251|19551|7505|38679|420&with_keywords=1852' },
    // The old "spider man" keyword is attached to unrelated titles. Sony's
    // Columbia comic-book superhero output includes its Spider-Man films.
    { id: 'spider', name: 'Spider-Man / Sony', movie: 'with_companies=5&with_keywords=9715,9717', tv: '' },
    { id: 'legacy', name: 'Legacy', movie: 'with_companies=19551|7505', tv: 'with_companies=38679' },
    { id: 'series', name: 'Series', movie: 'with_companies=420', tv: 'with_companies=38679' },
    { id: 'animation', name: 'Animation', movie: 'with_companies=7505&with_genres=16', tv: 'with_companies=7505&with_genres=16' },
  ] },
  { id: 'dc', name: 'DC', colors: ['#071a35', '#1877d2'], filters: [
    { id: 'all', name: 'All', movie: 'with_companies=429|9993', tv: 'with_companies=9993' },
    { id: 'dcu', name: 'DCU / DCEU', movie: 'with_keywords=229266', tv: 'with_keywords=229266' },
    { id: 'batman', name: 'Batman', movie: '', tv: '' },
    { id: 'superman', name: 'Superman', movie: '', tv: '' },
    { id: 'arrowverse', name: 'Arrowverse', movie: 'with_keywords=375211', tv: 'with_keywords=375211' },
    { id: 'series', name: 'Series', movie: 'with_companies=429', tv: 'with_companies=9993' },
    { id: 'animation', name: 'Animation', movie: 'with_companies=429&with_genres=16', tv: 'with_companies=9993&with_genres=16' },
  ] },
  { id: 'starwars', name: 'Star Wars', colors: ['#05070d', '#2f4968'], filters: [
    // TMDB keyword 377919 is invalid. Its literal "star wars" keyword 379196
    // omits the saga films; Lucasfilm + space opera is verified for both media types.
    { id: 'movies', name: 'Movies', movie: 'with_companies=1&with_keywords=161176', tv: 'with_companies=1&with_keywords=161176' },
    { id: 'series', name: 'Series', movie: 'with_companies=1&with_keywords=161176', tv: 'with_companies=1&with_keywords=161176' },
    { id: 'animation', name: 'Animation', movie: 'with_companies=1&with_keywords=161176&with_genres=16', tv: 'with_companies=1&with_keywords=161176&with_genres=16' },
    { id: 'classic', name: 'Classic era', movie: 'with_companies=1&with_keywords=161176&primary_release_date.lte=1999-12-31', tv: 'with_companies=1&with_keywords=161176&first_air_date.lte=1999-12-31' },
    { id: 'modern', name: 'Modern era', movie: 'with_companies=1&with_keywords=161176&primary_release_date.gte=2000-01-01', tv: 'with_companies=1&with_keywords=161176&first_air_date.gte=2000-01-01' },
  ] },
  { id: 'pixar', name: 'Pixar', colors: ['#112a46', '#3ea7dc'], filters: [
    { id: 'movies', name: 'Movies', movie: 'with_companies=3', tv: 'with_companies=3' },
    { id: 'shorts', name: 'Series / shorts', movie: 'with_companies=3&with_runtime.lte=45', tv: 'with_companies=3' },
    { id: 'classic', name: '1995–2009', movie: 'with_companies=3&primary_release_date.gte=1995-01-01&primary_release_date.lte=2009-12-31', tv: 'with_companies=3' },
    { id: 'modern', name: '2010–now', movie: 'with_companies=3&primary_release_date.gte=2010-01-01', tv: 'with_companies=3&first_air_date.gte=2010-01-01' },
  ] },
] as const;

export type SelectedHub = { kind: 'provider' | 'world'; id: string } | null;
export type ProviderCatalog = { region: string; movie: Array<{ provider_id: number; provider_name: string }>; tv: Array<{ provider_id: number; provider_name: string }> };

// TMDB does not tag the principal Batman/Superman films with the matching
// character keywords. These title facets retain Discover's result/grid/page
// lifecycle, but use TMDB's title-search endpoint instead of empty keywords.
export function hubTitleSearch(hub: SelectedHub, facetId: string, mediaType: 'movie' | 'tv'): string | null {
  if (hub?.kind !== 'world') return null;
  if (hub.id === 'marvel' && facetId === 'spider' && mediaType === 'tv') return 'Spider-Man';
  if (hub.id === 'dc' && facetId === 'batman') return 'Batman';
  if (hub.id === 'dc' && facetId === 'superman') return 'Superman';
  return null;
}

function normalizeFacetTitle(value: unknown): string {
  return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function hubTitleSearchMatches(
  hub: SelectedHub,
  facetId: string,
  mediaType: 'movie' | 'tv',
  item: { title?: string; original_title?: string; name?: string; original_name?: string },
): boolean {
  const query = hubTitleSearch(hub, facetId, mediaType);
  if (!query) return true;
  const needle = normalizeFacetTitle(query);
  if (!needle) return false;
  return [item.title, item.original_title, item.name, item.original_name]
    .some((value) => normalizeFacetTitle(value).includes(needle));
}

export function inferWatchRegion(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
    return locale.split('-').find((part) => /^[A-Z]{2}$/.test(part)) || 'US';
  } catch { return 'US'; }
}

export function findProviderIds(catalog: ProviderCatalog['movie'], hub: typeof PROVIDER_HUBS[number]): number[] {
  const names: string[] = hub.aliases.map((name) => name.toLowerCase());
  const matches = (catalog || []).filter((provider) => {
    const name = String(provider.provider_name || '').trim().toLowerCase();
    return names.some((alias) => name === alias || name.startsWith(`${alias} `) || (alias.length >= 6 && name.includes(alias)));
  });
  return [...new Set(matches.map((provider) => Number(provider.provider_id)).filter(Boolean))];
}

export function hubQueryParams(hub: SelectedHub, facetId: string, mediaType: 'movie' | 'tv', catalog: ProviderCatalog | null): string | null {
  if (!hub) return '';
  if (hub.kind === 'provider') {
    const provider = PROVIDER_HUBS.find((item) => item.id === hub.id);
    if (!provider || !catalog) return null;
    const ids = findProviderIds(catalog[mediaType], provider);
    return ids.length ? `&watch_region=${catalog.region}&with_watch_providers=${ids.join('|')}` : null;
  }
  const world = WORLD_HUBS.find((item) => item.id === hub.id);
  const facet = world?.filters.find((item) => item.id === facetId) || world?.filters[0];
  return facet ? `&${facet[mediaType]}` : null;
}
