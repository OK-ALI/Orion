import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileDownloadAssetV1, MobileDownloadManagementResultV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import { useResponsiveLayout } from '../../services/responsive';
import {
  chooseNativeLibraryStorageTargetV1,
  chooseNativeDeviceStorageTargetV1,
  deleteAllNativeDownloadsV1,
  deleteNativeDownloadAssetsV1,
  formatNativeDownloadManagementResultV1,
  locateNativeDownloadAssetV1,
  playNativeDownloadAssetLocallyV1,
  reconcileNativeDownloadsV1,
  removeUnavailableNativeDownloadRecordsV1,
} from './nativeDownloadEngine';
import { setMobileDownloadLibraryStorageTargetV1 } from './downloadPreferences';

type ManagementMode = 'manage' | 'free-space';
type ManagementSort = 'size' | 'title' | 'destination';
type ConfirmAction = 'delete-selected' | 'delete-all' | 'remove-unavailable';

interface ConfirmationSnapshot {
  action: ConfirmAction;
  assets: readonly MobileDownloadAssetV1[];
}

interface DownloadManagementSheetProps {
  visible: boolean;
  mode: ManagementMode;
  assets: MobileDownloadAssetV1[];
  initialAssetIds?: readonly string[];
  onClose: () => void;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${Math.round(value)} B`;
  const kib = value / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 100 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(mib >= 100 ? 0 : 1)} MB`;
  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

function titleOf(asset: MobileDownloadAssetV1): string {
  const primary = asset.media.mediaType === 'tv' ? asset.media.seriesTitle || asset.media.title : asset.media.title;
  if (asset.media.mediaType !== 'tv') return primary;
  const marker = asset.media.season !== null && asset.media.episode !== null
    ? `S${asset.media.season} E${asset.media.episode}`
    : 'Episode';
  return `${primary} · ${marker}${asset.media.episodeTitle ? ` · ${asset.media.episodeTitle}` : ''}`;
}

function destinationOf(asset: MobileDownloadAssetV1): string {
  if (asset.destination === 'device-storage') return 'Device Storage';
  return asset.storageTarget.mode === 'user-folder'
    ? `Orion Library · ${asset.storageTarget.displayName}`
    : 'Orion Library';
}

function knownVerifiedBytes(asset: MobileDownloadAssetV1): number {
  return asset.artifacts.reduce((total, artifact) => (
    total + (artifact.availability === 'verified' ? Math.max(0, artifact.observedSizeBytes || 0) : 0)
  ), 0);
}

function snapshotAsset(asset: MobileDownloadAssetV1): MobileDownloadAssetV1 {
  return {
    ...asset,
    media: { ...asset.media },
    storageTarget: { ...asset.storageTarget },
    locator: { ...asset.locator },
    tracks: asset.tracks.map((track) => ({ ...track })),
    artifacts: asset.artifacts.map((artifact) => ({ ...artifact, actions: { ...artifact.actions } })),
    actions: { ...asset.actions },
  };
}

function resultMessage(result: MobileDownloadManagementResultV1): string {
  return formatNativeDownloadManagementResultV1(result, formatBytes);
}

export function DownloadManagementSheet({ visible, mode, assets, initialAssetIds = [], onClose }: DownloadManagementSheetProps) {
  const { theme, preferences } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialAssetIds));
  const [sort, setSort] = useState<ManagementSort>(mode === 'free-space' ? 'size' : 'title');
  const [confirmation, setConfirmation] = useState<ConfirmationSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(initialAssetIds));
    setSort(mode === 'free-space' ? 'size' : 'title');
    setConfirmation(null);
    setMessage(null);
  }, [initialAssetIds, mode, visible]);

  const sortedAssets = useMemo(() => [...assets].sort((left, right) => {
    if (sort === 'size') return knownVerifiedBytes(right) - knownVerifiedBytes(left);
    if (sort === 'destination') return destinationOf(left).localeCompare(destinationOf(right)) || titleOf(left).localeCompare(titleOf(right));
    return titleOf(left).localeCompare(titleOf(right));
  }), [assets, sort]);
  const selectedAssets = useMemo(() => sortedAssets.filter((asset) => selected.has(asset.assetId)), [selected, sortedAssets]);
  const selectedBytes = selectedAssets.reduce((total, asset) => total + knownVerifiedBytes(asset), 0);
  const selectedDestinations = [...new Set(selectedAssets.map(destinationOf))];
  const unavailableSelected = selectedAssets.filter((asset) => asset.availability === 'unavailable');

  const toggle = (assetId: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(assetId)) next.delete(assetId); else next.add(assetId);
    return next;
  });

  const run = async (action: () => Promise<MobileDownloadManagementResultV1>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage(resultMessage(result));
      setSelected(new Set(result.retainedAssetIds));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The download action could not be completed.');
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  };

  const runAssetAction = async (assetId: string, action: 'play-local' | 'locate') => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'play-local') await playNativeDownloadAssetLocallyV1(assetId);
      else await locateNativeDownloadAssetV1(assetId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Orion could not complete this download action.');
    } finally {
      setBusy(false);
    }
  };

  const reselectFolder = async (asset: MobileDownloadAssetV1) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const libraryFolder = asset.destination === 'orion-library' && asset.storageTarget.mode === 'user-folder';
      const target = libraryFolder
        ? await chooseNativeLibraryStorageTargetV1()
        : await chooseNativeDeviceStorageTargetV1();
      if (!target) setMessage('No storage folder was selected.');
      else {
        if (libraryFolder) setMobileDownloadLibraryStorageTargetV1(target);
        await reconcileNativeDownloadsV1();
        setMessage(`Reconnected ${target.displayName}. Artifact availability was refreshed.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Orion could not reconnect this storage folder.');
    } finally {
      setBusy(false);
    }
  };

  const openConfirmation = (action: ConfirmAction) => {
    const source = action === 'delete-all' ? sortedAssets : action === 'remove-unavailable' ? unavailableSelected : selectedAssets;
    setConfirmation({ action, assets: source.map(snapshotAsset) });
  };

  const executeConfirmation = () => {
    const snapshot = confirmation;
    if (!snapshot || snapshot.assets.length === 0) return;
    if (snapshot.action === 'delete-all') void run(deleteAllNativeDownloadsV1);
    else if (snapshot.action === 'remove-unavailable') void run(() => removeUnavailableNativeDownloadRecordsV1(snapshot.assets.map((asset) => asset.assetId)));
    else void run(() => deleteNativeDownloadAssetsV1(snapshot.assets.map((asset) => ({
      assetId: asset.assetId,
      managementToken: asset.managementToken,
    }))));
  };

  const confirm = confirmation?.action ?? null;
  const confirmAssets = confirmation?.assets ?? [];
  const confirmBytes = confirmAssets.reduce((total, asset) => total + knownVerifiedBytes(asset), 0);
  const confirmDestinations = [...new Set(confirmAssets.map(destinationOf))];
  const confirmLegacySidecarCount = confirmAssets.filter((asset) => asset.artifacts.length <= 1).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={preferences.reducedMotion ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.scrim, { backgroundColor: theme.mediaScrim }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close download management" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, isTablet && styles.sheetTablet, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: theme.textMuted }]}>{mode === 'free-space' ? 'STORAGE' : 'DOWNLOADS'}</Text>
              <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{mode === 'free-space' ? 'Free Up Space' : 'Manage Downloads'}</Text>
              <Text style={[styles.subheading, { color: theme.textSecondary }]}>Select exact download copies. Orion never clears a Device Storage folder.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [styles.close, { backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.toolbar}>
            {(['size', 'title', 'destination'] as const).map((value) => (
              <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: sort === value }} onPress={() => setSort(value)} style={({ pressed }) => [styles.chip, { borderColor: sort === value ? theme.accent : theme.border, backgroundColor: sort === value ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface }]}>
                <Text style={[styles.chipText, { color: sort === value ? theme.accent : theme.textSecondary }]}>{value === 'size' ? 'Size' : value === 'title' ? 'Title' : 'Location'}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh artifact availability" disabled={busy} onPress={() => void reconcileNativeDownloadsV1()} style={({ pressed }) => [styles.chip, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}>
              <Ionicons name="refresh" size={16} color={theme.textSecondary} />
              <Text style={[styles.chipText, { color: theme.textSecondary }]}>Refresh</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]} showsVerticalScrollIndicator={false}>
            {sortedAssets.map((asset) => {
              const checked = selected.has(asset.assetId);
              const bytes = knownVerifiedBytes(asset);
              const availabilityColor = asset.availability === 'verified' ? theme.success : asset.availability === 'checking' ? theme.textMuted : theme.warning;
              return (
                <View key={asset.assetId} style={[styles.row, isTablet && styles.rowTablet, { backgroundColor: theme.surface, borderColor: checked ? theme.accent : theme.border }]}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`Select ${titleOf(asset)}, ${destinationOf(asset)}, ${formatBytes(bytes)}`}
                    onPress={() => toggle(asset.assetId)}
                    style={styles.selectRow}
                  >
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? theme.accent : theme.textMuted} />
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={2} style={[styles.rowTitle, { color: theme.text }]}>{titleOf(asset)}</Text>
                      <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{destinationOf(asset)} · {formatBytes(bytes)}</Text>
                      <Text style={[styles.rowState, { color: availabilityColor }]}>{asset.availability === 'unavailable' ? 'Unavailable · reconnect or reselect folder' : asset.availability === 'missing' ? 'Missing · needs attention' : asset.availability === 'checking' ? 'Checking' : 'Verified'}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.rowActions}>
                    {asset.actions.open ? <IconAction label="Play Locally" icon="open-outline" onPress={() => void runAssetAction(asset.assetId, 'play-local')} /> : null}
                    {asset.actions.locate ? <IconAction label="Locate" icon="folder-open-outline" onPress={() => void runAssetAction(asset.assetId, 'locate')} /> : null}
                    {asset.availability === 'unavailable' && (asset.destination === 'device-storage' || asset.storageTarget.mode === 'user-folder') ? <IconAction label="Reselect folder" icon="folder-outline" onPress={() => void reselectFolder(asset)} /> : null}
                  </View>
                </View>
              );
            })}
            {sortedAssets.length === 0 ? <Text style={[styles.empty, { color: theme.textSecondary }]}>No completed download copies.</Text> : null}
          </ScrollView>

          {message ? <Text accessibilityRole="alert" style={[styles.message, { color: theme.textSecondary, backgroundColor: theme.surface }]}>{message}</Text> : null}
          <View style={styles.selectionSummary}>
            <Text style={[styles.summaryText, { color: theme.textSecondary }]}>{selectedAssets.length} selected · {formatBytes(selectedBytes)} · {selectedDestinations.join(', ') || 'No location'}</Text>
            <Pressable accessibilityRole="button" onPress={() => setSelected(selected.size === sortedAssets.length ? new Set() : new Set(sortedAssets.map((asset) => asset.assetId)))} style={({ pressed }) => [styles.linkButton, pressed && { opacity: 0.72 }]}>
              <Text style={[styles.linkText, { color: theme.accent }]}>{selected.size === sortedAssets.length && sortedAssets.length ? 'Clear all' : 'Select all'}</Text>
            </Pressable>
          </View>
          <View style={styles.footer}>
            {unavailableSelected.length ? <FooterButton label="Remove from Orion" icon="document-text-outline" tone="neutral" disabled={busy} onPress={() => openConfirmation('remove-unavailable')} /> : null}
            <FooterButton label="Delete selected" icon="trash-outline" tone="danger" disabled={busy || selectedAssets.length === 0} onPress={() => openConfirmation('delete-selected')} />
            <FooterButton label="Delete all downloads" icon="trash-bin-outline" tone="danger" disabled={busy || sortedAssets.length === 0} onPress={() => openConfirmation('delete-all')} />
          </View>
        </View>

        <Modal visible={confirm !== null} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}>
          <View style={[styles.confirmScrim, { backgroundColor: theme.mediaScrim }]}>
            <View style={[styles.confirmCard, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
              <Text accessibilityRole="header" style={[styles.confirmTitle, { color: theme.text }]}>{confirm === 'remove-unavailable' ? 'Remove unavailable records from Orion?' : confirm === 'delete-all' ? 'Delete all downloads?' : 'Delete selected downloads?'}</Text>
              <Text style={[styles.confirmBody, { color: theme.textSecondary }]}>{confirmAssets.length} cop{confirmAssets.length === 1 ? 'y' : 'ies'} · {confirmDestinations.join(', ') || 'No location'} · {formatBytes(confirmBytes)} known bytes.</Text>
              {confirmLegacySidecarCount && confirm !== 'remove-unavailable' ? <Text style={[styles.confirmWarning, { color: theme.warning }]}>Some legacy copies have no exact subtitle ownership record. Orion will leave untracked sidecars untouched.</Text> : null}
              <Text style={[styles.confirmBody, { color: theme.textSecondary }]}>{confirm === 'remove-unavailable' ? 'Android cannot confirm whether these files still exist. Orion will remove only its records and tracked metadata. Physical files or subtitle sidecars may remain, and no storage reclamation will be claimed.' : 'Only exact persisted Orion-owned artifacts will be deleted. Conclusively missing files are treated as already absent and their stale records are removed.'}</Text>
              <View style={styles.confirmActions}>
                <FooterButton label="Keep downloads" icon="close" tone="neutral" disabled={busy} onPress={() => setConfirmation(null)} />
                <FooterButton label={confirm === 'remove-unavailable' ? 'Remove from Orion' : 'Delete'} icon="trash-outline" tone="danger" disabled={busy || confirmAssets.length === 0} onPress={executeConfirmation} />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );

  function IconAction({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
    return <Pressable accessibilityRole="button" accessibilityLabel={`${label} download`} disabled={busy} onPress={onPress} style={({ pressed }) => [styles.iconAction, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated }]}><Ionicons name={icon} size={18} color={theme.textSecondary} /></Pressable>;
  }

  function FooterButton({ label, icon, tone, disabled, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; tone: 'danger' | 'neutral'; disabled?: boolean; onPress: () => void }) {
    const color = tone === 'danger' ? theme.danger : theme.textSecondary;
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.footerButton, { borderColor: tone === 'danger' ? theme.danger : theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.surface, opacity: disabled ? 0.48 : 1 }]}><Ionicons name={icon} size={17} color={color} /><Text style={[styles.footerButtonText, { color }]}>{label}</Text></Pressable>;
  }
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '91%', borderTopWidth: 1, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], padding: spacing[4], gap: spacing[3] },
  sheetTablet: { width: 760, alignSelf: 'center', borderWidth: 1, borderBottomWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 21, fontWeight: '900', marginTop: 2 },
  subheading: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  chipText: { fontSize: fontSizes.xs, fontWeight: '800' },
  list: { maxHeight: 430 },
  listContent: { gap: spacing[2], paddingBottom: spacing[2] },
  listContentTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { minHeight: 78, borderWidth: 1, borderRadius: radii.lg, padding: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowTablet: { width: '49%', flexGrow: 1 },
  selectRow: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: fontSizes.xs, lineHeight: 17, fontWeight: '900' },
  rowMeta: { fontSize: 10, marginTop: 3 },
  rowState: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 4 },
  iconAction: { width: 48, height: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', fontSize: fontSizes.sm, padding: spacing[6] },
  message: { fontSize: fontSizes.xs, lineHeight: 18, borderRadius: radii.md, padding: spacing[2] },
  selectionSummary: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  summaryText: { flex: 1, minWidth: 190, fontSize: fontSizes.xs, fontWeight: '700' },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[2] },
  linkText: { fontSize: fontSizes.xs, fontWeight: '900' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  footerButton: { minHeight: 48, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  footerButtonText: { fontSize: fontSizes.xs, fontWeight: '900' },
  confirmScrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[5] },
  confirmCard: { width: '100%', maxWidth: 520, borderWidth: 1, borderRadius: radii['2xl'], padding: spacing[5], gap: spacing[3] },
  confirmTitle: { fontSize: 20, fontWeight: '900' },
  confirmBody: { fontSize: fontSizes.sm, lineHeight: 21 },
  confirmWarning: { fontSize: fontSizes.xs, lineHeight: 18, fontWeight: '800' },
  confirmActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
});
