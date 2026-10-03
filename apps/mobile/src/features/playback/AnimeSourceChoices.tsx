import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { isAnimeContent, lookupAnimeEntries, tmdbFetch, type AnimeIdentityResult } from '@orion/shared/api';
import { getRegisteredSource } from '@orion/shared/sources';
import { useOrionTheme } from '../../context/ThemeContext';
import { useMobilePlayerController } from './MobilePlayerController';
import { resolveAnimeTestIdentity } from './animeIdentityRequest';
import { createAnimeIdentityTrace } from './animeIdentityDiagnostics';

export interface AnimeTestSelection {
  identity: Extract<AnimeIdentityResult, { state: 'verified' }>;
  variant: 'sub' | 'dub';
}

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
    const diagnostic = createAnimeIdentityTrace();
    try {
      const result = await resolveAnimeTestIdentity({ id, type, season, episode, detail, variant, signal: request.signal },
        { fetchSeason: tmdbFetch, lookup: lookupAnimeEntries }, diagnostic);
      if (request.signal.aborted) return;
      if (result.state !== 'verified') {
        setError('Orion could not verify this Anime season and episode. Choose an existing source.');
        return;
      }
      onSelect({ identity: result, variant });
      controller.closeOverlay();
    } catch {
      diagnostic({ stage: 'decision', outcome: 'rejected', reason: 'selection-failed' });
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
