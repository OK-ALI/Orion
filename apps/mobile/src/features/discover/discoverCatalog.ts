export const REGION_PRESETS = {
  all: { name: 'Global', countries: '' },
  hollywood: { name: 'Hollywood', countries: 'US|GB|CA|AU|IE|NZ' },
  bollywood: { name: 'Bollywood', countries: 'IN' },
  asian: { name: 'Asian Content', countries: 'KR|JP|CN|TW|HK|TH' },
};
export const SUBFILTER_PRESETS = {
  hollywood: [
    { id: 'all', name: 'All Western', countries: 'US|GB|CA|AU|IE|NZ' },
    { id: 'us', name: 'United States', countries: 'US' },
    { id: 'gb', name: 'United Kingdom', countries: 'GB' },
    { id: 'ca', name: 'Canada', countries: 'CA' },
    { id: 'au', name: 'Australia', countries: 'AU' },
  ],
  bollywood: [
    { id: 'all', name: 'All Indian', countries: 'IN' },
    { id: 'hi', name: 'Hindi / Bollywood', countries: 'IN', language: 'hi' },
    { id: 'ta', name: 'Tamil / Kollywood', countries: 'IN', language: 'ta' },
    { id: 'te', name: 'Telugu / Tollywood', countries: 'IN', language: 'te' },
    { id: 'ml', name: 'Malayalam', countries: 'IN', language: 'ml' },
  ],
  asian: [
    { id: 'all', name: 'All Asian', countries: 'KR|JP|CN|TW|HK|TH' },
    { id: 'kr', name: 'K-Content', countries: 'KR' },
    { id: 'jp', name: 'J-Content', countries: 'JP' },
    { id: 'cn', name: 'C-Content', countries: 'CN' },
    { id: 'tw_hk', name: 'HK & Taiwan', countries: 'TW|HK' },
    { id: 'th', name: 'Thai Content', countries: 'TH' },
  ],
};
export function getRegionQueryParams(region: string, subfilter: string) {
  if (!region || region === 'all') {
    return { countryParam: '', languageParam: '' };
  }
  const presets = SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] || [];
  const activeSub = presets.find((sf) => sf.id === subfilter) || presets[0];
  if (activeSub) {
    const countries = activeSub.countries || '';
    const language = (activeSub as any).language || '';
    const countryParam = countries ? `&with_origin_country=${countries}` : '';
    const languageParam = language ? `&with_original_language=${language}` : '';
    return { countryParam, languageParam };
  }
  const regPreset = REGION_PRESETS[region as keyof typeof REGION_PRESETS];
  const countries = regPreset?.countries || '';
  const countryParam = countries ? `&with_origin_country=${countries}` : '';
  return { countryParam, languageParam: '' };
}
export const MOVIE_GENRES = [
  { id: 28, name: 'Action', icon: 'flash-outline', accent: '#ef4444', colors: ['rgba(239, 68, 68, 0.25)', 'rgba(125, 0, 8, 0.4)'] },
  { id: 12, name: 'Adventure', icon: 'compass-outline', accent: '#f97316', colors: ['rgba(249, 115, 22, 0.25)', 'rgba(139, 69, 0, 0.4)'] },
  { id: 16, name: 'Animation', icon: 'sparkles-outline', accent: '#06b6d4', colors: ['rgba(6, 182, 212, 0.25)', 'rgba(0, 139, 139, 0.4)'] },
  { id: 35, name: 'Comedy', icon: 'happy-outline', accent: '#ec4899', colors: ['rgba(236, 72, 153, 0.25)', 'rgba(199, 21, 133, 0.4)'] },
  { id: 80, name: 'Crime', icon: 'finger-print-outline', accent: '#a855f7', colors: ['rgba(168, 85, 247, 0.25)', 'rgba(49, 0, 98, 0.4)'] },
  { id: 99, name: 'Documentary', icon: 'film-outline', accent: '#10b981', colors: ['rgba(16, 185, 129, 0.25)', 'rgba(30, 94, 58, 0.4)'] },
  { id: 18, name: 'Drama', icon: 'heart-dislike-outline', accent: '#3b82f6', colors: ['rgba(59, 130, 246, 0.25)', 'rgba(32, 78, 122, 0.4)'] },
  { id: 10751, name: 'Family', icon: 'people-outline', accent: '#f472b6', colors: ['rgba(244, 114, 182, 0.25)', 'rgba(219, 112, 147, 0.4)'] },
  { id: 14, name: 'Fantasy', icon: 'planet-outline', accent: '#8b5cf6', colors: ['rgba(139, 92, 246, 0.25)', 'rgba(102, 51, 153, 0.4)'] },
  { id: 36, name: 'History', icon: 'library-outline', accent: '#d97706', colors: ['rgba(217, 119, 6, 0.25)', 'rgba(92, 45, 12, 0.4)'] },
  { id: 27, name: 'Horror', icon: 'skull-outline', accent: '#f43f5e', colors: ['rgba(244, 63, 94, 0.25)', 'rgba(15, 15, 15, 0.5)'] },
  { id: 9648, name: 'Mystery', icon: 'eye-outline', accent: '#64748b', colors: ['rgba(100, 116, 139, 0.25)', 'rgba(71, 80, 88, 0.4)'] },
  { id: 10749, name: 'Romance', icon: 'heart-outline', accent: '#fb7185', colors: ['rgba(251, 113, 133, 0.25)', 'rgba(178, 34, 34, 0.4)'] },
  { id: 878, name: 'Sci-Fi', icon: 'rocket-outline', accent: '#38bdf8', colors: ['rgba(56, 189, 248, 0.25)', 'rgba(0, 0, 139, 0.4)'] },
  { id: 53, name: 'Thriller', icon: 'flame-outline', accent: '#ef4444', colors: ['rgba(239, 68, 68, 0.25)', 'rgba(194, 28, 44, 0.4)'] },
  { id: 10752, name: 'War', icon: 'shield-outline', accent: '#84cc16', colors: ['rgba(132, 204, 22, 0.25)', 'rgba(85, 107, 47, 0.4)'] },
  { id: 37, name: 'Western', icon: 'bonfire-outline', accent: '#b45309', colors: ['rgba(180, 83, 9, 0.25)', 'rgba(139, 90, 43, 0.4)'] },
];
export const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure', icon: 'flash-outline', accent: '#ef4444', colors: ['rgba(239, 68, 68, 0.25)', 'rgba(125, 0, 8, 0.4)'] },
  { id: 16, name: 'Animation', icon: 'sparkles-outline', accent: '#06b6d4', colors: ['rgba(6, 182, 212, 0.25)', 'rgba(0, 139, 139, 0.4)'] },
  { id: 35, name: 'Comedy', icon: 'happy-outline', accent: '#ec4899', colors: ['rgba(236, 72, 153, 0.25)', 'rgba(199, 21, 133, 0.4)'] },
  { id: 80, name: 'Crime', icon: 'finger-print-outline', accent: '#a855f7', colors: ['rgba(168, 85, 247, 0.25)', 'rgba(49, 0, 98, 0.4)'] },
  { id: 99, name: 'Documentary', icon: 'film-outline', accent: '#10b981', colors: ['rgba(16, 185, 129, 0.25)', 'rgba(30, 94, 58, 0.4)'] },
  { id: 18, name: 'Drama', icon: 'heart-dislike-outline', accent: '#3b82f6', colors: ['rgba(59, 130, 246, 0.25)', 'rgba(32, 78, 122, 0.4)'] },
  { id: 10751, name: 'Family', icon: 'people-outline', accent: '#f472b6', colors: ['rgba(244, 114, 182, 0.25)', 'rgba(219, 112, 147, 0.4)'] },
  { id: 10762, name: 'Kids', icon: 'shapes-outline', accent: '#f59e0b', colors: ['rgba(245, 158, 11, 0.25)', 'rgba(204, 144, 44, 0.4)'] },
  { id: 9648, name: 'Mystery', icon: 'eye-outline', accent: '#64748b', colors: ['rgba(100, 116, 139, 0.25)', 'rgba(71, 80, 88, 0.4)'] },
  { id: 10765, name: 'Sci-Fi & Fantasy', icon: 'planet-outline', accent: '#38bdf8', colors: ['rgba(56, 189, 248, 0.25)', 'rgba(0, 0, 139, 0.4)'] },
  { id: 10768, name: 'War & Politics', icon: 'shield-outline', accent: '#84cc16', colors: ['rgba(132, 204, 22, 0.25)', 'rgba(59, 77, 32, 0.4)'] },
  { id: 37, name: 'Western', icon: 'bonfire-outline', accent: '#b45309', colors: ['rgba(180, 83, 9, 0.25)', 'rgba(139, 90, 43, 0.4)'] },
];
export const MEDIA_FILTERS = [
  { id: 'all', name: 'All' },
  { id: 'movie', name: 'Movies' },
  { id: 'tv', name: 'Series' },
  { id: 'anime', name: 'Anime' },
  { id: 'person', name: 'Constellation' },
];
export const TYPE_FILTERS = [
  { id: 'all', name: 'All Types' },
  { id: 'movie', name: 'Movies Only' },
  { id: 'tv', name: 'TV Shows Only' },
];
export const SORT_OPTIONS = [
  { id: 'popularity.desc', label: 'Most Popular' },
  { id: 'vote_average.desc', label: 'Top Rated' },
  { id: 'primary_release_date.desc', label: 'Newest Release' },
];
export const RATING_OPTIONS = [
  { id: '0', label: 'Rating: Any' },
  { id: '8', label: '★ 8.0 & Above' },
  { id: '7', label: '★ 7.0 & Above' },
  { id: '6', label: '★ 6.0 & Above' },
  { id: '5', label: '★ 5.0 & Above' },
];
export const YEAR_OPTIONS = ['', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015'];
