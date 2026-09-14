import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { wavenColors, wavenRadii, wavenSpacing } from '../../../theme/tokens';
import type {
  NativePlaybackQueueItem,
  PlaybackRecoveryState,
  PlaybackSnapshot,
  ResolvedPlaybackSource,
} from '../contracts';
import {
  getPersistedPlaybackRecoveryState,
  nativePlayback,
  replaceNativeQueue,
  resolveNativeQueueItem,
  subscribeNativePlayback,
} from '../native/WavenPlaybackNative';

const P4_PHYSICAL_VALIDATION = process.env.EXPO_PUBLIC_WAVEN_P4_PHYSICAL_VALIDATION === '1';

const HARNESS_QUEUE: readonly NativePlaybackQueueItem[] = [
  {
    queueId: 'p43-harness-track-a',
    track: {
      id: 'p43-track-a',
      title: 'Harness Track A',
      artistName: 'WAVEN Phase 4',
      albumTitle: 'Native Playback Validation',
      source: { provider: 'p4-harness', id: 'track-a' },
      providerRefs: [{ provider: 'p4-harness', id: 'track-a' }],
    },
    streamingProvider: { provider: 'p4-harness', id: 'manual-ephemeral-source' },
  },
  {
    queueId: 'p43-harness-track-b',
    track: {
      id: 'p43-track-b',
      title: 'Harness Track B',
      artistName: 'WAVEN Phase 4',
      albumTitle: 'Native Playback Validation',
      source: { provider: 'p4-harness', id: 'track-b' },
      providerRefs: [{ provider: 'p4-harness', id: 'track-b' }],
    },
    streamingProvider: { provider: 'p4-harness', id: 'manual-ephemeral-source' },
  },
];

const REPEAT_SEQUENCE = ['off', 'one', 'all'] as const;

type SnapshotCommand = () => Promise<PlaybackSnapshot>;

function stringify(value: unknown): string {
  if (value == null) return 'null';
  return JSON.stringify(value, null, 2);
}

function parseHeaders(raw: string): Record<string, string> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object of string values.');
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`Header '${key}' must have a string value.`);
    }
    result[key] = value;
  }
  return result;
}

export function PlaybackDebugHarness() {
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot | null>(null);
  const [recovery, setRecovery] = useState<PlaybackRecoveryState | null>(null);
  const [sourceUri, setSourceUri] = useState('');
  const [mimeType, setMimeType] = useState('audio/mpeg');
  const [headersJson, setHeadersJson] = useState('');
  const [notice, setNotice] = useState('Load the stable queue, inject an ephemeral source, then play.');
  const [busy, setBusy] = useState(false);

  const currentQueueId = snapshot?.currentQueueId ?? HARNESS_QUEUE[0].queueId;

  useEffect(() => {
    const harnessEnabled = __DEV__ || P4_PHYSICAL_VALIDATION;
    if (!harnessEnabled || Platform.OS !== 'android') return undefined;

    try {
      const subscription = subscribeNativePlayback(setSnapshot);
      nativePlayback.getSnapshot().then(setSnapshot).catch(() => undefined);
      return () => subscription.remove();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }, []);

  const source = useMemo<ResolvedPlaybackSource | null>(() => {
    if (!sourceUri.trim()) return null;
    try {
      return {
        uri: sourceUri.trim(),
        mimeType: mimeType.trim() || null,
        headers: parseHeaders(headersJson),
      };
    } catch {
      return null;
    }
  }, [headersJson, mimeType, sourceUri]);

  const run = useCallback(async (label: string, command: SnapshotCommand) => {
    setBusy(true);
    setNotice(`${label}…`);
    try {
      const next = await command();
      setSnapshot(next);
      setNotice(`${label}: OK`);
    } catch (error) {
      setNotice(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const buildSource = useCallback((): ResolvedPlaybackSource => {
    const uri = sourceUri.trim();
    if (!uri) throw new Error('Enter an http(s), file, or content source URI first.');
    return {
      uri,
      mimeType: mimeType.trim() || null,
      headers: parseHeaders(headersJson),
    };
  }, [headersJson, mimeType, sourceUri]);

  const resolveCurrent = useCallback(async () => {
    const playbackSource = buildSource();
    await run(`Resolve ${currentQueueId}`, () =>
      resolveNativeQueueItem(currentQueueId, playbackSource),
    );
  }, [buildSource, currentQueueId, run]);

  const resolveAll = useCallback(async () => {
    setBusy(true);
    setNotice('Resolving both harness queue items…');
    try {
      const playbackSource = buildSource();
      let next: PlaybackSnapshot | null = null;
      for (const item of HARNESS_QUEUE) {
        next = await resolveNativeQueueItem(item.queueId, playbackSource);
      }
      if (next) setSnapshot(next);
      setNotice('Resolve all: OK');
    } catch (error) {
      setNotice(`Resolve all: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }, [buildSource]);

  const refreshRecovery = useCallback(async () => {
    setBusy(true);
    try {
      const next = await getPersistedPlaybackRecoveryState();
      setRecovery(next);
      setNotice('Recovery state refreshed.');
    } catch (error) {
      setNotice(`Recovery read: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const seekBy = useCallback(
    async (deltaMs: number) => {
      await run(deltaMs < 0 ? 'Seek -15s' : 'Seek +15s', async () => {
        const current = snapshot ?? (await nativePlayback.getSnapshot());
        return nativePlayback.seekTo(Math.max(0, current.positionMs + deltaMs));
      });
    },
    [run, snapshot],
  );

  const cycleRepeat = useCallback(async () => {
    const current = snapshot?.repeatMode ?? 'off';
    const index = REPEAT_SEQUENCE.indexOf(current);
    const next = REPEAT_SEQUENCE[(index + 1) % REPEAT_SEQUENCE.length];
    await run(`Repeat ${next}`, () => nativePlayback.setRepeatMode(next));
  }, [run, snapshot?.repeatMode]);

  if (!__DEV__) {
    if (!P4_PHYSICAL_VALIDATION) {
      return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.disabledCard}>
          <Text style={styles.title}>Playback Harness Disabled</Text>
          <Text style={styles.body}>This route is available only in WAVEN development builds.</Text>
          <Link href="/" style={styles.link}>Return to WAVEN</Link>
        </View>
      </SafeAreaView>
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PHASE 4 DEVELOPMENT HARNESS</Text>
            <Text style={styles.title}>Native Playback Control</Text>
            <Text style={styles.body}>
              One Media3 owner. Stable queue intent. Ephemeral source injection. This is validation tooling, not the final WAVEN player.
            </Text>
          </View>
          <Link href="/" style={styles.link}>Back</Link>
        </View>

        {Platform.OS !== 'android' ? (
          <Text style={styles.warning}>Android development build required.</Text>
        ) : null}

        <Section title="1. Queue intent">
          <Text style={styles.body}>Two stable P3-shaped queue items are loaded unresolved.</Text>
          <Control label="Load stable queue" disabled={busy} onPress={() => run('Load queue', () => replaceNativeQueue(HARNESS_QUEUE))} />
        </Section>

        <Section title="2. Ephemeral source">
          <Text style={styles.body}>
            Paste a temporary playable URI. It is sent to native memory only and is not part of durable recovery state.
          </Text>
          <TextInput
            accessibilityLabel="Ephemeral playback source URI"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSourceUri}
            placeholder="https://… / file://… / content://…"
            placeholderTextColor={wavenColors.mutedGray}
            style={styles.input}
            value={sourceUri}
          />
          <TextInput
            accessibilityLabel="Playback MIME type"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setMimeType}
            placeholder="audio/mpeg"
            placeholderTextColor={wavenColors.mutedGray}
            style={styles.input}
            value={mimeType}
          />
          <TextInput
            accessibilityLabel="Playback request headers JSON"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={setHeadersJson}
            placeholder={'Optional headers JSON, e.g. {"Referer":"…"}'}
            placeholderTextColor={wavenColors.mutedGray}
            style={[styles.input, styles.multilineInput]}
            value={headersJson}
          />
          <Text style={styles.small}>Current queue id: {currentQueueId}</Text>
          <Text style={styles.small}>Source syntax: {source ? 'valid' : 'not ready'}</Text>
          <View style={styles.row}>
            <Control label="Resolve current" disabled={busy} onPress={resolveCurrent} />
            <Control label="Resolve all" disabled={busy} onPress={resolveAll} />
          </View>
        </Section>

        <Section title="3. Native transport">
          <View style={styles.row}>
            <Control label="Previous" disabled={busy} onPress={() => run('Previous', nativePlayback.previous)} />
            <Control label="Play" disabled={busy} onPress={() => run('Play', nativePlayback.play)} primary />
            <Control label="Pause" disabled={busy} onPress={() => run('Pause', nativePlayback.pause)} />
            <Control label="Next" disabled={busy} onPress={() => run('Next', nativePlayback.next)} />
          </View>
          <View style={styles.row}>
            <Control label="-15 sec" disabled={busy} onPress={() => seekBy(-15_000)} />
            <Control label="+15 sec" disabled={busy} onPress={() => seekBy(15_000)} />
            <Control label={`Repeat: ${snapshot?.repeatMode ?? 'off'}`} disabled={busy} onPress={cycleRepeat} />
            <Control
              label={`Shuffle: ${snapshot?.shuffleEnabled ? 'on' : 'off'}`}
              disabled={busy}
              onPress={() => run('Toggle shuffle', () => nativePlayback.setShuffleEnabled(!(snapshot?.shuffleEnabled ?? false)))}
            />
          </View>
          <View style={styles.row}>
            <Control label="Refresh snapshot" disabled={busy} onPress={() => run('Snapshot', nativePlayback.getSnapshot)} />
            <Control label="Stop / clear queue" disabled={busy} onPress={() => run('Stop', nativePlayback.stop)} danger />
          </View>
        </Section>

        <Section title="4. Recovery inspection">
          <Control label="Read persisted recovery intent" disabled={busy} onPress={refreshRecovery} />
          <DebugBlock value={stringify(recovery)} />
        </Section>

        <Section title="Live native snapshot / errors">
          <Text style={styles.notice}>{notice}</Text>
          <DebugBlock value={stringify(snapshot)} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Control({
  danger = false,
  disabled,
  label,
  onPress,
  primary = false,
}: {
  danger?: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void | Promise<void>;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        primary && styles.controlPrimary,
        danger && styles.controlDanger,
        (pressed || disabled) && styles.controlDimmed,
      ]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

function DebugBlock({ value }: { value: string }) {
  return (
    <ScrollView horizontal style={styles.debugBlock}>
      <Text selectable style={styles.debugText}>{value}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: wavenColors.black },
  content: { gap: wavenSpacing.md, padding: wavenSpacing.lg, paddingBottom: wavenSpacing.xxl },
  headerRow: { flexDirection: 'row', gap: wavenSpacing.md, justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  eyebrow: { color: wavenColors.activeBlue, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: wavenColors.coolWhite, fontSize: 26, fontWeight: '800', marginTop: 6 },
  body: { color: wavenColors.steelGray, fontSize: 13, lineHeight: 19, marginTop: 8 },
  small: { color: wavenColors.mutedGray, fontSize: 12, marginTop: 8 },
  warning: { color: '#FFB86B', fontSize: 13, fontWeight: '700' },
  link: { color: wavenColors.skyBlue, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  section: {
    backgroundColor: wavenColors.surface,
    borderColor: wavenColors.elevatedSurface,
    borderRadius: wavenRadii.md,
    borderWidth: 1,
    gap: wavenSpacing.sm,
    padding: wavenSpacing.md,
  },
  sectionTitle: { color: wavenColors.silver, fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: wavenSpacing.sm, marginTop: 4 },
  input: {
    backgroundColor: wavenColors.elevatedSurface,
    borderColor: wavenColors.deepBlue,
    borderRadius: wavenRadii.sm,
    borderWidth: 1,
    color: wavenColors.coolWhite,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: { minHeight: 76, textAlignVertical: 'top' },
  control: {
    backgroundColor: wavenColors.elevatedSurface,
    borderColor: wavenColors.mutedGray,
    borderRadius: wavenRadii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  controlPrimary: { backgroundColor: wavenColors.deepBlue, borderColor: wavenColors.activeBlue },
  controlDanger: { borderColor: '#843E4A' },
  controlDimmed: { opacity: 0.5 },
  controlText: { color: wavenColors.coolWhite, fontSize: 12, fontWeight: '700' },
  notice: { color: wavenColors.skyBlue, fontSize: 12, lineHeight: 18 },
  debugBlock: {
    backgroundColor: '#030507',
    borderRadius: wavenRadii.sm,
    maxHeight: 260,
    marginTop: 4,
    padding: 10,
  },
  debugText: { color: wavenColors.silver, fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
  disabledCard: {
    backgroundColor: wavenColors.surface,
    borderRadius: wavenRadii.md,
    margin: wavenSpacing.lg,
    padding: wavenSpacing.lg,
  },
});
