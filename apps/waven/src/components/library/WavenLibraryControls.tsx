import { useWavenHomeStyles } from '../../theme/homeMaterialPreview';
import { useEffect, useState, type ReactNode } from 'react';
import { useWavenConnectivity } from '../../infrastructure/connectivity/connectivityHooks';
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WavenText as Text } from '../typography/WavenText';
import { WavenPressable } from '../interaction/WavenPressable';
import { WavenLivingWave } from '../player/WavenLivingWave';
import { WavenArtworkFallback } from '../artwork/WavenArtworkFallback';
import { useWavenArtworkLease } from '../../hooks/useWavenArtworkLease';
import { wavenArtworkLeaseKey } from '../../features/artwork/wavenArtworkLifecycle';
import { getLocalLibrary, useLocalLibrary } from '../../features/library/libraryRuntime';
import { libraryEntityKey, type LibraryEntity, type LibraryKind } from '../../features/library/localLibrary';
import type { MusicTrack } from '../../domain/music';
import { trackPlayback, useTrackPlaybackStatus, useWavenTrackPresentation } from '../../features/playback/trackPlaybackRuntime';
import { wavenColors, wavenLayout, wavenRadii, wavenSpacing } from '../../theme/tokens';

export function LibraryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const styles = useWavenHomeStyles(noirStyles, 'library');

  return <WavenPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[styles.button, disabled ? styles.disabled : null]}><Text style={styles.buttonText}>{label}</Text></WavenPressable>;
}
export function LibraryDialog({ title, visible, onClose, children }: { title: string; visible: boolean; onClose: () => void; children: ReactNode }) {
  const styles = useWavenHomeStyles(noirStyles, 'library');

  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View accessibilityViewIsModal style={styles.dialog}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>{children}
          <LibraryButton label="Close" onPress={onClose} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
export function LibraryNameInput({ value, onChange, label = 'Playlist name' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const styles = useWavenHomeStyles(noirStyles, 'library');

  return <TextInput accessibilityLabel={label} autoCapitalize="sentences" maxLength={120} placeholder={label}
    placeholderTextColor={styles.subtitle.color} value={value} onChangeText={onChange} style={styles.input} />;
}
export function LibraryNotice({ message }: { message?: string | null }) {
  const styles = useWavenHomeStyles(noirStyles, 'library');

  return message ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{message}</Text> : null;
}
export function WavenLibraryHeroArtwork({ track, size }: { track: MusicTrack; size: number }) {
  const uri = track.artworkUrl ?? null;
  const lease = useWavenArtworkLease({ leaseKey: wavenArtworkLeaseKey('track', track.source.provider, track.source.id), sourceKey: uri });
  return <View style={{ height: size, width: size }}>
    {lease.showFallback ? <WavenArtworkFallback accessibilityLabel={`${track.title} artwork`} seed={libraryEntityKey('track', track)} size={size} /> : null}
    {lease.backupSourceKey ? <Image accessible={false} source={{ uri: lease.backupSourceKey }} resizeMode="cover" style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }} /> : null}
    {uri ? <Image accessibilityLabel={`${track.title} artwork`} key={lease.imageKey} source={{ uri }} fadeDuration={0} resizeMode="cover" onLoad={lease.onLoad} onError={lease.onError} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: lease.hasRendered ? 1 : 0 }} /> : null}
  </View>;
}
/** Primary tap is music. Overflow remains exclusively for secondary Library actions. */
export function WavenTrackPlayTarget({ track, children, style, containerStyle }: {
  track: MusicTrack;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const connection = useWavenConnectivity();
  const rowState = useWavenTrackPresentation(track);
  const ready = connection.active && connection.internetReady;
  return <WavenPressable
    accessibilityRole="button"
    accessibilityLabel={`${ready ? rowState === 'failed' ? 'Retry' : 'Play' : 'Internet required to play'} ${track.title}${track.artistName ? ` by ${track.artistName}` : ''}. ${rowState === 'available' ? '' : rowState}`}
    accessibilityState={{ disabled: !ready, busy: rowState === 'preparing' || rowState === 'buffering', selected: rowState === 'playing' || rowState === 'paused' }}
    disabled={!ready}
    containerStyle={containerStyle}
    style={style}
    onPress={() => { void trackPlayback.play(track); }}
  >
    {children}
    <View style={styles.playIndicator}><WavenLivingWave state={rowState} /></View>
  </WavenPressable>;
}
export function WavenLibraryRow({ kind, entity, trailing, onOpen }: { kind: LibraryKind; entity: LibraryEntity; trailing?: ReactNode; onOpen?: () => void }) {
  const styles = useWavenHomeStyles(noirStyles, 'library');

  const title = 'name' in entity ? entity.name : entity.title;
  const uri = entity.artworkUrl || ('profileImageUrl' in entity ? entity.profileImageUrl : null);
  const lease = useWavenArtworkLease({ leaseKey: wavenArtworkLeaseKey(kind, entity.source.provider, entity.source.id), sourceKey: uri ?? null });
  const copy = <View style={styles.copy}>
    <View style={styles.artwork}>
      {lease.showFallback ? <WavenArtworkFallback accessibilityLabel={`${title} artwork`} seed={libraryEntityKey(kind, entity)} size={52} /> : null}
      {lease.backupSourceKey ? <Image accessible={false} source={{ uri: lease.backupSourceKey }} resizeMode="cover" style={[styles.image, { position: 'absolute', left: 0, top: 0 }]} /> : null}
      {uri ? <Image key={lease.imageKey} source={{ uri }} fadeDuration={0} resizeMode="cover" onLoad={lease.onLoad} onError={lease.onError} style={[styles.image, { position: 'absolute', left: 0, top: 0, opacity: lease.hasRendered ? 1 : 0 }]} /> : null}
    </View>
    <View style={styles.textCopy}><Text numberOfLines={2} style={styles.rowTitle}>{title}</Text>
      {'artistName' in entity && entity.artistName ? <Text numberOfLines={2} style={styles.subtitle}>{entity.artistName}</Text> : null}
    </View>
  </View>;
  const primary = kind === 'track'
    ? <WavenTrackPlayTarget track={entity as MusicTrack} containerStyle={styles.open} style={styles.playOpen}>{copy}</WavenTrackPlayTarget>
    : onOpen
      ? <WavenPressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} containerStyle={styles.open} style={styles.playOpen} onPress={onOpen}>{copy}</WavenPressable>
      : <View style={styles.open}>{copy}</View>;
  return <View style={styles.row}>
    {primary}
    {trailing ?? <WavenMusicLibraryActions kind={kind} entity={entity} />}
  </View>;
}
/** One menu model across Search songs, detail rows, Library and Recently Played. */
export function WavenMusicLibraryActions({ kind, entity }: { kind: LibraryKind; entity: LibraryEntity }) {
  const styles = useWavenHomeStyles(noirStyles, 'library');

  const connection = useWavenConnectivity();
  const ready = connection.active && connection.internetReady;
  const snapshot = useLocalLibrary(), owner = getLocalLibrary();
  const playback = useTrackPlaybackStatus(kind === 'track' ? JSON.stringify([entity.source.provider, entity.source.id]) : '');
  const [visible, setVisible] = useState(false), [name, setName] = useState(''), [message, setMessage] = useState<string | null>(null);
  const [openedScope, setOpenedScope] = useState(snapshot.state.scope);
  const key = libraryEntityKey(kind, entity), favorite = snapshot.state.favorites.some(f => f.key === key);
  const title = 'name' in entity ? entity.name : entity.title;
  const available = snapshot.status !== 'blocked' && snapshot.status !== 'unavailable';
  useEffect(() => { setVisible(false); setMessage(null); setName(''); }, [snapshot.state.scope, key]);
  const run = (action: () => void, success: string) => {
    if (openedScope !== owner.getSnapshot().state.scope) { setVisible(false); return; }
    try { action(); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save to Library.'); }
  };
  return <>
    <WavenPressable accessibilityRole="button" accessibilityLabel={`Music actions for ${title}`} onPress={() => {
      setOpenedScope(snapshot.state.scope); setVisible(true); setMessage(null);
    }} style={styles.more}><Text style={styles.moreText}>•••</Text></WavenPressable>
    <LibraryDialog title={title} visible={visible} onClose={() => setVisible(false)}>
      <LibraryNotice message={snapshot.notice} />
      {kind === 'track' ? <>
        <LibraryNotice message={!ready ? 'This song needs a connection to play. You can still save it to favorites or a playlist.' : null} />
        <LibraryButton label={playback.state === 'resolving' && playback.trackKey === JSON.stringify([entity.source.provider,entity.source.id]) ? 'Preparing audio…' : 'Play song'} disabled={!ready} onPress={() => {
          if (openedScope !== owner.getSnapshot().state.scope) { setVisible(false); return; }
          setVisible(false);
          void trackPlayback.play(entity as MusicTrack);
        }} />
        <LibraryNotice message={playback.trackKey === JSON.stringify([entity.source.provider, entity.source.id]) ? playback.message : null} />
      </> : null}
      <LibraryButton disabled={!available} label={favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={() => run(() => owner.setFavorite(kind, entity, !favorite), favorite ? 'Removed from favorites.' : 'Saved to favorites.')} />
      {kind === 'track' ? <>
        <Text style={styles.subtitle}>Add to a local playlist</Text>
        {snapshot.state.playlists.map(p => {
          const added = p.tracks.some(t => libraryEntityKey('track', t) === key);
          return <LibraryButton key={p.id} disabled={!available || added} label={`${p.title}${added ? ' · Added' : ''}`} onPress={() => run(() => owner.addTrack(p.id, entity as MusicTrack), `Added to ${p.title}.`)} />;
        })}
        {!snapshot.state.playlists.length ? <Text style={styles.subtitle}>Create your first playlist below.</Text> : null}
        <LibraryNameInput value={name} onChange={setName} />
        <LibraryButton disabled={!available || !name.trim()} label="Create playlist and add song" onPress={() => run(() => {
          const id = owner.createPlaylist(name); owner.addTrack(id, entity as MusicTrack); setName('');
        }, 'Playlist created. Song added.')} />
      </> : null}
      <LibraryNotice message={message} />
    </LibraryDialog>
  </>;
}
const styles = StyleSheet.create({
  button: { minHeight: wavenLayout.minimumTouchTarget, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: wavenColors.blueEdge, borderRadius: wavenRadii.sm, backgroundColor: wavenColors.canvas },
  buttonText: { color: wavenColors.textPrimary, fontSize: 14 }, disabled: { opacity: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', paddingHorizontal: 20 },
  dialog: { maxHeight: '100%', width: '100%', maxWidth: 560, alignSelf: 'center', borderColor: wavenColors.borderSubtle, borderWidth: 1, borderRadius: 22, backgroundColor: wavenColors.canvas },
  dialogContent: { padding: wavenSpacing.lg, gap: 12 }, title: { color: wavenColors.textPrimary, fontSize: 20, fontWeight: '700' },
  input: { minHeight: wavenLayout.minimumTouchTarget, color: wavenColors.textPrimary, borderWidth: 1, borderColor: wavenColors.borderSubtle, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Manrope_400Regular', fontSize: 16 },
  notice: { color: wavenColors.textSecondary, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }, open: { flex: 1 },
  playOpen: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: wavenLayout.minimumTouchTarget }, playIndicator: { marginLeft: 8, marginRight: 2 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }, textCopy: { flex: 1 },
  artwork: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' }, image: { width: 52, height: 52 },
  rowTitle: { color: wavenColors.textPrimary, fontSize: 14, fontWeight: '600' }, subtitle: { color: wavenColors.textMuted, fontSize: 12, lineHeight: 19 },
  more: { minHeight: wavenLayout.minimumTouchTarget, minWidth: wavenLayout.minimumTouchTarget, alignItems: 'center', justifyContent: 'center' }, moreText: { color: wavenColors.interactionBlue, fontSize: 16 },
});

const noirStyles = styles;
