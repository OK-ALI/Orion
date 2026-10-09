import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRegisteredSource, PLAYER_SOURCES, isManualAnimeProvider } from '@orion/shared/sources';
import { radii } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { getMobileSourceHealthV2 } from '../../services/sourceHealth';
import { getMobileSourceContinuityCapability } from './mobileSources';
import { useMobilePlayerController } from './MobilePlayerController';
import type { AnimeSourceSelection } from './useAnimeSource';
import type { AnimeVariant } from './animeSourceAffinity';

/** Selection uses Orion's existing source switch and resume prompt. */
interface AnimeSourceChoicesProps {
  currentSourceId: string; variant?: AnimeVariant;
  prepare(variant: AnimeVariant, providerId?: string): Promise<AnimeSourceSelection | null>;
  onSelect(selection: AnimeSourceSelection): void;
}
export function AnimeSourceChoices(props: AnimeSourceChoicesProps) {
  return <View style={{ gap: 8 }}>{PLAYER_SOURCES.filter((source) => isManualAnimeProvider(source.id)).map((source) =>
    <AnimeProviderChoice key={source.id} {...props} providerId={source.id} />)}</View>;
}
function AnimeProviderChoice({ currentSourceId, variant, prepare, onSelect, providerId }: AnimeSourceChoicesProps & { providerId: string }) {
  const { theme } = useOrionTheme();
  const controller = useMobilePlayerController();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(0);
  useEffect(() => () => { operation.current += 1; }, []);
  const source = getRegisteredSource(providerId);
  const selected = currentSourceId === source?.id;
  const capability = getMobileSourceContinuityCapability(providerId);
  const health = getMobileSourceHealthV2(providerId, 'tv');
  const choose = async (next: AnimeVariant) => {
    if (busy || (selected && variant === next) || !source?.animeProvider?.variants.includes(next)) return;
    const attempt = ++operation.current;
    setBusy(true); setError(null);
    try {
      const selection = await prepare(next, providerId);
      if (attempt !== operation.current) return;
      if (!selection) { setError('Orion could not verify this Anime season and episode. Choose another source.'); return; }
      onSelect(selection); controller.closeOverlay();
    } finally { if (attempt === operation.current) setBusy(false); }
  };
  if (!source) return null;
  return <View style={[styles.card, { backgroundColor: selected ? theme.accentSoft : theme.surface,
    borderColor: selected ? theme.accent : theme.border }]}>
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: selected ? theme.accent : theme.elevated, borderColor: theme.border }]}>
        <Ionicons name={selected ? 'play' : 'hardware-chip-outline'} size={17} color={selected ? theme.onAccent : theme.textSecondary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: theme.text }]}>{source.label}</Text>
        <Text style={[styles.status, { color: health?.state === 'failed' ? theme.danger : theme.textSecondary }]}>
          {health?.state === 'ready' ? 'Playing normally' : health?.state === 'failed' ? 'Having trouble' : 'Ready'}
        </Text>
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? theme.accent : theme.textSecondary} />
    </View>
    <View style={styles.variants}>
      {source.animeProvider?.variants.filter((value): value is AnimeVariant => value === 'sub' || value === 'dub').map((value) => {
        const active = selected && variant === value;
        return <Pressable key={value} accessibilityRole="button" disabled={busy}
          accessibilityLabel={source.label + ' · ' + (value === 'sub' ? 'Sub' : 'Dub') + '. ' + capability.label + '.'}
          accessibilityHint={capability.description} accessibilityState={{ selected: active, disabled: busy }}
          onPress={() => { void choose(value); }}
          style={[styles.variant, { backgroundColor: active ? theme.accent : theme.elevated,
            borderColor: active ? theme.accent : theme.border }]}>
          <Text style={[styles.variantText, { color: active ? theme.onAccent : theme.text }]}>{value === 'sub' ? 'Sub' : 'Dub'}</Text>
        </Pressable>;
      })}
      {busy && <ActivityIndicator accessibilityLabel="Verifying episode" color={theme.accent} />}
    </View>
    <Text style={[styles.status, { color: theme.textSecondary }]}>{capability.shortLabel}</Text>
    {error && <Text accessibilityLiveRegion="polite" style={[styles.status, { color: theme.danger }]}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 }, name: { fontSize: 14, fontWeight: '800' },
  status: { fontSize: 11, lineHeight: 16 }, variants: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  variant: { minHeight: 44, minWidth: 52, borderRadius: radii.lg, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  variantText: { fontSize: 12, fontWeight: '700' },
});
