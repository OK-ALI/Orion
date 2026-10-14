/** Catalog evidence for Glimpse only; neither title names nor playback providers classify a series. */
export type GlimpseSeriesFormat = 'seasonal' | 'serial' | 'unknown';
export interface GlimpseSeriesDetails {
  type?: string; genres?: { id: number }[];
  seasons?: { season_number: number; episode_count: number }[];
}
export const GLIMPSE_SOAP_GENRE = 10766;
// This is a conservative catalog heuristic, not a TMDb guarantee about broadcast cadence.
export const GLIMPSE_SERIAL_SEASON_EPISODES = 80;
export function classifyGlimpseSeries(details: GlimpseSeriesDetails): GlimpseSeriesFormat {
  const type = (details.type || '').trim().toLowerCase();
  if (type === 'soap opera' || type === 'soap' || details.genres?.some(genre => genre.id === GLIMPSE_SOAP_GENRE)) return 'serial';
  if (type !== 'scripted' && type !== 'miniseries') return 'unknown';
  const counts = (details.seasons || []).filter(season => Number.isSafeInteger(season.season_number) && season.season_number > 0
    && Number.isSafeInteger(season.episode_count) && season.episode_count > 0).map(season => season.episode_count);
  if (counts.some(count => count >= GLIMPSE_SERIAL_SEASON_EPISODES)) return 'serial';
  return counts.length ? 'seasonal' : 'unknown';
}
