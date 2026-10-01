import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileDownloadAssetV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import { mobileDownloadItemKeyFromMediaV1 } from './downloadIdentity';
import { discoverMobileDownloadSubtitlesV1, type MobileDownloadSubtitleDiscoveryV1 } from './downloadSubtitles';
import { addNativeCompletedSubtitleV1, removeNativeCompletedSubtitleV1 } from './nativeDownloadEngine';

interface Props {
  asset: MobileDownloadAssetV1 | null;
  onClose: () => void;
}

export function CompletedSubtitleManager({ asset, onClose }: Props) {
  const { theme } = useOrionTheme();
  const [discovery, setDiscovery] = useState<MobileDownloadSubtitleDiscoveryV1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDiscovery(null);
    setMessage(null);
  }, [asset?.assetId]);

  const search = async () => {
    if (!asset || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const itemKey = mobileDownloadItemKeyFromMediaV1(asset.media);
      const groupKey = `${asset.media.libraryKind}:${String(asset.media.id)}`;
      setDiscovery(await discoverMobileDownloadSubtitlesV1({ schemaVersion: 1, groupKey, itemKey, media: asset.media }));
    } catch (_error) {
      setDiscovery(null);
      setMessage('Subtitle providers are unavailable right now.');
    } finally {
      setBusy(false);
    }
  };

  const change = async (kind: 'add' | 'remove', trackId: string) => {
    if (!asset || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = kind === 'add'
        ? await addNativeCompletedSubtitleV1(asset.assetId, asset.managementToken, trackId)
        : await removeNativeCompletedSubtitleV1(asset.assetId, asset.managementToken, trackId);
      setMessage(result);
      setDiscovery(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Orion could not update saved subtitles.');
    } finally {
      setBusy(false);
    }
  };

  const saved = asset?.tracks.filter((track) => track.kind === 'subtitle') || [];
  const options = discovery?.tracks.filter((track) => !saved.some((entry) => entry.id === track.id)) || [];
  return (
    <Modal visible={asset !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={[styles.scrim, { backgroundColor: theme.mediaScrim }]}>
        <View style={[styles.card, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Manage Subtitles</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]} numberOfLines={2}>{asset?.media.title}. Saved subtitle files live beside this video. Orion keeps up to two verified tracks.</Text>
          <Text style={[styles.heading, { color: theme.text }]}>Saved</Text>
          {saved.length === 0 ? <Text style={[styles.body, { color: theme.textSecondary }]}>None</Text> : null}
          {saved.map((track) => (
            <View key={track.id} style={[styles.row, { borderColor: theme.border }]}>
              <Text style={[styles.track, { color: theme.text }]} numberOfLines={2}>{track.label} · {track.language || 'und'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${track.label}`} disabled={busy} onPress={() => void change('remove', track.id)} style={styles.action}>
                <Text style={[styles.actionText, { color: theme.danger }]}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Find subtitles for this download" disabled={busy || saved.length >= 2} onPress={() => void search()} style={[styles.search, { borderColor: theme.accent, opacity: busy || saved.length >= 2 ? 0.5 : 1 }]}>
            <Text style={[styles.actionText, { color: theme.accent }]}>Find SubDL / Wyzie subtitles</Text>
          </Pressable>
          <ScrollView style={styles.results} contentContainerStyle={styles.resultContent}>
            {discovery?.state === 'ready' && options.length === 0 ? <Text style={[styles.body, { color: theme.textSecondary }]}>No new matches</Text> : null}
            {discovery && discovery.state !== 'ready' ? <Text style={[styles.body, { color: theme.textSecondary }]}>{discovery.state === 'none' ? 'No match' : 'Subtitle providers are unavailable right now.'}</Text> : null}
            {options.map((track) => (
              <View key={track.id} style={[styles.row, { borderColor: theme.border }]}>
                <View style={styles.copy}>
                  <Text style={[styles.track, { color: theme.text }]} numberOfLines={2}>{track.label}</Text>
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>{track.providerLabel} · {track.languageLabel} · {track.format.toUpperCase()}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Save ${track.label}`} disabled={busy || saved.length >= 2} onPress={() => void change('add', track.id)} style={styles.action}>
                  <Text style={[styles.actionText, { color: theme.accent }]}>Save</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {message ? <Text accessibilityRole="alert" style={[styles.body, { color: theme.textSecondary }]}>{message}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Close subtitle management" disabled={busy} onPress={onClose} style={[styles.close, { borderColor: theme.border }]}>
            <Text style={[styles.actionText, { color: theme.text }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: spacing[4] },
  card: { width: '100%', maxWidth: 560, maxHeight: '85%', alignSelf: 'center', padding: spacing[4], gap: spacing[2], borderWidth: 1, borderRadius: radii['2xl'] },
  title: { fontSize: 20, fontWeight: '900' },
  body: { fontSize: fontSizes.xs, lineHeight: 19 },
  heading: { fontSize: fontSizes.sm, fontWeight: '900', marginTop: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radii.md, padding: spacing[2], gap: spacing[2] },
  copy: { flex: 1 },
  track: { flex: 1, fontSize: fontSizes.xs, fontWeight: '800' },
  meta: { fontSize: 10, marginTop: 3 },
  action: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] },
  actionText: { fontSize: fontSizes.xs, fontWeight: '900' },
  search: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radii.md },
  results: { maxHeight: 260 },
  resultContent: { gap: spacing[2] },
  close: { minHeight: 44, borderWidth: 1, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
});
