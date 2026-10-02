import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { isAnimeContent, lookupAnimeEntries, tmdbFetch, verifyAnimeIdentity, type AnimeIdentityResult } from '@orion/shared/api';
import { getRegisteredSource } from '@orion/shared/sources';
import { useOrionTheme } from '../../context/ThemeContext';
import { useMobilePlayerController } from './MobilePlayerController';

export interface AnimeTestSelection {
  identity: Extract<AnimeIdentityResult, { state: 'verified' }>;
  variant: 'sub' | 'dub';
}

const titlesOf = (detail: any): string[] => [...new Set<string>([
  detail.name, detail.original_name, detail.title, detail.original_title,
  ...(detail.alternative_titles?.results || detail.alternative_titles?.titles || []).map((entry: any) => entry?.title),
].filter((value) => typeof value === 'string' && value.trim().length > 0))];
const yearOf = (date: unknown): number => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : 0;

/** Explicit testing lane. Unverified providers never become ordinary source rows. */
export function AnimeSourceChoices({ id, type, season, episode, onSelect }: {
  id: string; type: 'movie' | 'tv'; season: number | null; episode: number | null;
  onSelect(selection: AnimeTestSelection): void;
}) {
  const { theme } = useOrionTheme();
  const controller = useMobilePlayerController();
  const [detail, setDetail] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = useRef<AbortController | null>(null);
  useEffect(() => {
    const request = new AbortController();
    scope.current = request;
    setDetail(null); setError(null); setExpanded(false); setBusy(false);
    tmdbFetch<any>(`/${type}/${id}?append_to_response=alternative_titles`, { signal: request.signal })
      .then((result) => { if (!request.signal.aborted && String(result?.id) === id && isAnimeContent(result)) setDetail(result); })
      .catch(() => {});
    return () => { request.abort(); };
  }, [id, type, season, episode]);

  const testVariant = async (variant: 'sub' | 'dub') => {
    const request = scope.current;
    const source = getRegisteredSource('aniembed');
    if (busy || !detail || !request || request.signal.aborted || type !== 'tv' || !season || !episode
      || source?.animeProvider?.variants.includes(variant) !== true || source.supportsDownloads) return;
    setBusy(true); setError(null);
    try {
      const selectedSeason = await tmdbFetch<any>(`/tv/${id}/season/${season}`, { signal: request.signal });
      if (request.signal.aborted) return;
      const episodes = selectedSeason?.episodes;
      // Only canonical released TMDb episode numbers, with a complete season list.
      if (!Array.isArray(episodes) || selectedSeason.season_number !== season
        || !episodes.some((entry: any) => entry?.episode_number === episode && entry?.air_date
          && Date.parse(entry.air_date) <= Date.now())
        || episodes.some((entry: any, index: number) => entry?.episode_number !== index + 1)) {
        throw new Error('unsupported-numbering');
      }
      const entries = await lookupAnimeEntries(titlesOf(detail), request.signal);
      if (request.signal.aborted) return;
      const result = verifyAnimeIdentity({ tmdbId: id, mediaType: type, titles: titlesOf(detail),
        year: yearOf(detail.first_air_date), season, episode, episodeCount: episodes.length,
        seasonYear: yearOf(selectedSeason.air_date),
        seasonAirDate: selectedSeason.air_date,
        seasonTitles: titlesOf({ name: selectedSeason.name }).filter((title) => !/^season\s*\d+$/i.test(title)),
      }, entries);
      if (result.state !== 'verified') throw new Error(result.reason);
      onSelect({ identity: result, variant });
      controller.closeOverlay();
    } catch {
      if (!request.signal.aborted) setError('Orion could not verify this Anime season and episode. Choose an existing source.');
    } finally { if (!request.signal.aborted) setBusy(false); }
  };

  if (!detail || type !== 'tv' || (season ?? 0) < 1 || (episode ?? 0) < 1) return null;
  return <View style={[styles.section, { borderColor: theme.border }]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.action}>
      <Text style={[styles.title, { color: theme.text }]}>Anime source testing</Text>
    </Pressable>
    {expanded && <>
      <Text style={[styles.copy, { color: theme.textSecondary }]}>Experimental playback test. Episode identity is checked first. Playback, variants and downloads have not been physically qualified.</Text>
      {(['sub', 'dub'] as const).map((variant) => <Pressable key={variant} accessibilityRole="button"
        disabled={busy} accessibilityState={{ disabled: busy }}
        accessibilityLabel={`Test AniEmbed ${variant === 'sub' ? 'Sub' : 'Dub'}. Experimental; downloads disabled.`}
        onPress={() => { void testVariant(variant); }} style={[styles.action, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>Test AniEmbed · {variant === 'sub' ? 'Sub' : 'Dub'}</Text>
      </Pressable>)}
      {busy && <ActivityIndicator accessibilityLabel="Verifying Anime identity" color={theme.accent} />}
      {error && <Text accessibilityLiveRegion="polite" style={[styles.copy, { color: theme.danger }]}>{error}</Text>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, paddingTop: 8, marginTop: 8, gap: 8 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
  title: { fontSize: 13, fontWeight: '700' },
  copy: { fontSize: 12, lineHeight: 18, paddingHorizontal: 12 },
});
