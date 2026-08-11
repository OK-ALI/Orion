import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MeasuredScrubber } from './MeasuredScrubber';

type Props = { controller: any; theme: any; isLandscape: boolean; legacyStyles: any };
type Command = (action: string, value?: unknown) => Promise<unknown>;

function RemoteAction({ action, icon, label, value, disabled = false, pending, command, styles, theme }: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || pending}
      onPress={() => command(action, value)}
      style={({ pressed }) => [styles.action, pressed && styles.pressed, (disabled || pending) && styles.disabled]}
    >
      {pending ? <ActivityIndicator color={theme.accent} /> : <Ionicons name={icon} size={21} color={theme.text} />}
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function PlaybackPanel({ playback, capabilities, controller, pendingActions, command, styles, theme, legacyStyles }: any) {
  const action = (props: any) => (
    <RemoteAction {...props} pending={pendingActions.has(props.action)} command={command} styles={styles} theme={theme} />
  );
  if (!playback.hasMedia) {
    return (
      <View style={styles.contextCard}>
        <Text style={styles.eyebrow}>DESKTOP CONTEXT</Text>
        <Text style={styles.title}>{controller.remoteContext?.route ? `Browsing ${controller.remoteContext.route}` : 'Desktop connected'}</Text>
        <Text style={styles.meta}>Touch, scroll and navigate without changing modes.</Text>
      </View>
    );
  }
  return (
    <View style={styles.playbackCard}>
      <View style={styles.playbackHeading}>
        <View style={styles.playbackCopy}>
          <Text style={styles.eyebrow}>NOW PLAYING</Text>
          <Text style={styles.title} numberOfLines={1}>{playback.title}</Text>
          <Text style={styles.meta}>{playback.type} · {playback.progress}</Text>
        </View>
        <Pressable onPress={() => controller.setShowDisconnectModal(true)} style={styles.disconnect}>
          <Ionicons name="power-outline" size={18} color={theme.danger} />
        </Pressable>
      </View>
      <MeasuredScrubber
        currentTime={playback.currentTime || 0}
        duration={playback.duration || 0}
        bufferedTime={playback.bufferedTime || 0}
        disabled={!playback.canSeek}
        formatTime={controller.formatTime}
        onScrubbing={controller.setIsScrubbing}
        onSeek={(seconds: number) => command('seek_to', seconds)}
        styles={legacyStyles}
      />
      <View style={styles.transport}>
        {action({ action: 'previous', icon: 'play-skip-back', label: 'Previous' })}
        {action({ action: 'seek_-10', icon: 'play-back', label: '10 sec', disabled: !capabilities.canSeek })}
        {action({ action: 'toggle_play', icon: controller.isPlaying ? 'pause' : 'play', label: controller.isPlaying ? 'Pause' : 'Play' })}
        {action({ action: 'seek_+10', icon: 'play-forward', label: '10 sec', disabled: !capabilities.canSeek })}
        {action({ action: 'next', icon: 'play-skip-forward', label: 'Next' })}
      </View>
    </View>
  );
}

const RemoteTouchpad = memo(function RemoteTouchpad({ pointerMode, setPointerMode, onLayout, panHandlers, styles, theme }: any) {
  const absolute = pointerMode === 'absolute';
  return (
    <View style={styles.touchpadBlock}>
      <View style={styles.touchpadHeader}>
        <View style={styles.touchpadCopy}>
          <Text style={styles.eyebrow}>TOUCHPAD ({absolute ? 'DIRECT 1:1 MIRROR' : 'TRACKPAD'})</Text>
          <Text style={styles.meta}>{absolute ? 'Touch area mirrors desktop 1:1 · tap selects' : 'One finger moves · tap selects · two fingers scroll'}</Text>
        </View>
        <Pressable style={styles.latency} onPress={() => setPointerMode(absolute ? 'relative' : 'absolute')}>
          <Text style={styles.latencyText}>{absolute ? '1:1 Direct' : 'Trackpad'}</Text>
        </Pressable>
      </View>
      <View accessibilityLabel="Desktop touchpad" style={styles.touchpad} onLayout={onLayout} {...panHandlers}>
        <Ionicons name="hand-left-outline" size={38} color={theme.textMuted} />
        <Text style={styles.touchpadText}>Control Orion Desktop ({absolute ? '1:1 Surface Mode' : 'Trackpad Mode'})</Text>
      </View>
    </View>
  );
});

export function UnifiedRemoteSurface({ controller, theme, isLandscape, legacyStyles }: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [text, setText] = useState('');
  const context = controller.remoteContext;
  const playback = controller.nowPlaying;
  const capabilities = context?.capabilities || {};

  const command = useCallback<Command>(async (action, value) => {
    setPendingActions((previous) => new Set(previous).add(action));
    try { return await controller.sendRemoteCommand(action, value); }
    finally {
      setPendingActions((previous) => { const next = new Set(previous); next.delete(action); return next; });
    }
  }, [controller.sendRemoteCommand]);

  const action = (props: any) => (
    <RemoteAction {...props} pending={pendingActions.has(props.action)} command={command} styles={styles} theme={theme} />
  );

  return (
    <ScrollView
      scrollEnabled={!controller.isPointerGestureActive}
      contentContainerStyle={[styles.root, isLandscape && styles.rootLandscape]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={isLandscape ? styles.leftPane : undefined}>
        <PlaybackPanel playback={playback} capabilities={capabilities} controller={controller} pendingActions={pendingActions} command={command} styles={styles} theme={theme} legacyStyles={legacyStyles} />
      </View>
      <View style={isLandscape ? styles.rightPane : undefined}>
        <RemoteTouchpad pointerMode={controller.pointerMode} setPointerMode={controller.setPointerMode} onLayout={controller.onTouchpadLayout} panHandlers={controller.panResponder.panHandlers} styles={styles} theme={theme} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {!playback.hasMedia && action({ action: 'home', icon: 'home-outline', label: 'Home' })}
          {!playback.hasMedia && action({ action: 'back', icon: 'arrow-back', label: 'Back' })}
          {capabilities.canToggleSubtitles && action({ action: 'toggle_subtitles', icon: 'chatbox-ellipses-outline', label: 'Subtitles' })}
          {capabilities.canFullscreen && action({ action: 'toggle_fullscreen', icon: 'expand-outline', label: 'Fullscreen' })}
          {capabilities.canPip && action({ action: 'toggle_pip', icon: 'duplicate-outline', label: 'PiP' })}
          {context?.canType && <Pressable style={styles.action} onPress={() => setShowMore(true)}><Ionicons name="keypad-outline" size={21} color={theme.text} /><Text style={styles.actionLabel}>Type</Text></Pressable>}
          <Pressable style={styles.action} onPress={() => setShowMore(true)}><Ionicons name="ellipsis-horizontal" size={21} color={theme.text} /><Text style={styles.actionLabel}>More</Text></Pressable>
        </ScrollView>
        {controller.remoteError ? <Text style={styles.error}>{controller.remoteError}</Text> : null}
      </View>
      <Modal visible={showMore} transparent animationType="fade" onRequestClose={() => setShowMore(false)}>
        <Pressable style={styles.scrim} onPress={() => setShowMore(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Remote tools</Text><Pressable onPress={() => setShowMore(false)}><Ionicons name="close" size={24} color={theme.text} /></Pressable></View>
            {context?.canType && <View style={styles.typeRow}><TextInput value={text} onChangeText={setText} placeholder="Type on Desktop" placeholderTextColor={theme.textMuted} style={styles.input} /><Pressable style={styles.send} onPress={() => { void command('send_text', text); setText(''); }}><Ionicons name="send" size={19} color={theme.onAccent} /></Pressable></View>}
            <Text style={styles.eyebrow}>ACCESSIBILITY D-PAD</Text>
            <View style={styles.dpad}>{action({ action: 'up', icon: 'chevron-up', label: 'Up' })}<View style={styles.dpadRow}>{action({ action: 'left', icon: 'chevron-back', label: 'Left' })}{action({ action: 'select', icon: 'radio-button-on', label: 'Select' })}{action({ action: 'right', icon: 'chevron-forward', label: 'Right' })}</View>{action({ action: 'down', icon: 'chevron-down', label: 'Down' })}</View>
            <View style={styles.rail}>{action({ action: 'toggle_mute', icon: controller.isMuted ? 'volume-mute' : 'volume-high', label: 'Mute' })}{action({ action: 'volume_down', icon: 'remove', label: 'Volume' })}{action({ action: 'volume_up', icon: 'add', label: 'Volume' })}{action({ action: 'menu', icon: 'menu', label: 'Menu' })}</View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function createStyles(theme: any) { return StyleSheet.create({
  root: { paddingHorizontal: 18, paddingBottom: 44, gap: 16 }, rootLandscape: { flexDirection: 'row', alignItems: 'stretch' }, leftPane: { width: '45%' }, rightPane: { flex: 1, gap: 14 },
  playbackCard: { padding: 16, borderRadius: 24, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, gap: 12 }, contextCard: { padding: 18, borderRadius: 24, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  playbackHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, playbackCopy: { flex: 1 }, eyebrow: { color: theme.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 3 }, meta: { color: theme.textSecondary, fontSize: 13, marginTop: 3 }, disconnect: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  transport: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }, action: { minWidth: 58, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border }, actionLabel: { color: theme.text, fontSize: 10, fontWeight: '700' }, pressed: { opacity: .78, transform: [{ scale: .97 }] }, disabled: { opacity: .42 },
  touchpadBlock: { gap: 9 }, touchpadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, touchpadCopy: { flex: 1 }, latency: { backgroundColor: theme.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, latencyText: { color: theme.textSecondary, fontSize: 11, fontWeight: '700' }, touchpad: { minHeight: 230, flex: 1, borderRadius: 28, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', gap: 10 }, touchpadText: { color: theme.textSecondary, fontWeight: '700' }, rail: { flexDirection: 'row', gap: 9, paddingVertical: 2 }, error: { color: theme.danger, padding: 12, backgroundColor: theme.dangerSoft || theme.accentSoft, borderRadius: 14 },
  scrim: { flex: 1, backgroundColor: theme.scrim || 'rgba(0, 0, 0, 0.72)', justifyContent: 'flex-end', padding: 16 }, sheet: { maxHeight: '82%', padding: 18, borderRadius: 28, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, gap: 16 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sheetTitle: { color: theme.text, fontSize: 22, fontWeight: '800' }, typeRow: { flexDirection: 'row', gap: 8 }, input: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: theme.border, color: theme.text, paddingHorizontal: 14, backgroundColor: theme.elevated }, send: { width: 50, height: 50, borderRadius: 15, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }, dpad: { alignItems: 'center', gap: 7 }, dpadRow: { flexDirection: 'row', gap: 8 },
}); }
