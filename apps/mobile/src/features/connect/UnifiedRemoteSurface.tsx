import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MeasuredScrubber } from './MeasuredScrubber';

type Props = { controller: any; theme: any; isLandscape: boolean; legacyStyles: any };
type Command = (action: string, value?: unknown) => Promise<any>;

function RemoteAction({ action, icon, label, value, disabled = false, pending, command, styles, theme }: any) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || pending}
    onPress={() => command(action, value)} style={({ pressed }) => [styles.action, pressed && styles.pressed, (disabled || pending) && styles.disabled]}>
    {pending ? <ActivityIndicator color={theme.accent} /> : <Ionicons name={icon} size={21} color={theme.text} />}
    <Text style={styles.actionLabel}>{label}</Text>
  </Pressable>;
}

function PlaybackPanel({ playback, capabilities, controller, pendingActions, command, styles, theme, legacyStyles }: any) {
  const action = (props: any) => <RemoteAction {...props} pending={pendingActions.has(props.action)} command={command} styles={styles} theme={theme} />;
  if (!playback.hasMedia) return <View style={styles.contextCard}>
    <Text style={styles.eyebrow}>DESKTOP CONTEXT</Text>
    <Text style={styles.title}>{controller.remoteContext?.route ? `Browsing ${controller.remoteContext.route}` : 'Desktop connected'}</Text>
    <Text style={styles.meta}>Touch, scroll and navigate without changing modes.</Text>
  </View>;

  const state = playback.controlState || 'unavailable';
  const stateCopy: Record<string, string> = {
    loading: 'Preparing controls', ready: 'Controls ready', limited: 'Limited controls',
    unobservable: 'Provider controls only', unavailable: 'Controls unavailable', failed: 'Control failed',
  };
  const target = { sessionId: playback.sessionId, sourceId: playback.sourceId };
  const canPlay = capabilities.canPlay ?? playback.canPlay ?? capabilities.canPlayPause;
  const canPause = capabilities.canPause ?? playback.canPause ?? capabilities.canPlayPause;
  const canPrevious = capabilities.canSkipPrevious ?? playback.canSkipPrevious;
  const canNext = capabilities.canSkipNext ?? playback.canSkipNext;
  const canSeek = Boolean(capabilities.canSeek && playback.canSeek && playback.duration > 0);
  const primaryAction = playback.paused ? 'play' : 'pause';
  const primaryAllowed = playback.paused ? canPlay : canPause;

  return <View style={styles.playbackCard}>
    <View style={styles.playbackCopy}>
      <Text style={styles.eyebrow}>NOW PLAYING</Text>
      <Text style={styles.title} numberOfLines={2}>{playback.title}</Text>
      <Text style={styles.meta} numberOfLines={1}>{playback.type} {'\u00B7'} {playback.sourceLabel || 'Orion Player'}</Text>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, state === 'ready' && styles.statusDotReady]} />
        <Text style={styles.statusText}>{stateCopy[state] || 'Controls unavailable'}</Text>
      </View>
    </View>
    <MeasuredScrubber currentTime={playback.currentTime || 0} duration={playback.duration || 0} bufferedTime={playback.bufferedTime || 0}
      disabled={!canSeek} formatTime={controller.formatTime} onScrubbing={controller.setIsScrubbing}
      onSeek={(seconds: number) => command('seek_to', { ...target, seconds })} styles={legacyStyles} />
    {!playback.duration ? <Text style={styles.timingUnavailable}>Playback timing unavailable</Text> : null}
    <View style={styles.transport}>
      {canPrevious && action({ action: 'previous', icon: 'play-skip-back', label: 'Previous', value: target })}
      {canSeek && action({ action: 'seek_-10', icon: 'play-back', label: '10 sec', value: target })}
      {primaryAllowed && action({ action: primaryAction, icon: playback.paused ? 'play' : 'pause', label: playback.paused ? 'Play' : 'Pause', value: target })}
      {state === 'loading' && !primaryAllowed && action({ action: 'play', icon: 'refresh', label: 'Retry', value: target })}
      {canSeek && action({ action: 'seek_+10', icon: 'play-forward', label: '10 sec', value: target })}
      {canNext && action({ action: 'next', icon: 'play-skip-forward', label: 'Next', value: target })}
    </View>
  </View>;
}

const RemoteTouchpad = memo(function RemoteTouchpad({ pointerMode, setPointerMode, onLayout, panHandlers, styles, theme }: any) {
  const absolute = pointerMode === 'absolute';
  return <View style={styles.touchpadBlock}>
    <View style={styles.touchpadHeader}><View style={styles.touchpadCopy}>
      <Text style={styles.eyebrow}>TOUCHPAD ({absolute ? 'DIRECT 1:1 MIRROR' : 'TRACKPAD'})</Text>
      <Text style={styles.meta}>{absolute ? 'Touch area mirrors desktop 1:1 \u00B7 tap selects' : 'One finger moves \u00B7 tap selects \u00B7 two fingers scroll'}</Text>
    </View><Pressable style={styles.latency} onPress={() => setPointerMode(absolute ? 'relative' : 'absolute')}><Text style={styles.latencyText}>{absolute ? '1:1 Direct' : 'Trackpad'}</Text></Pressable></View>
    <View accessibilityLabel="Desktop touchpad" style={styles.touchpad} onLayout={onLayout} {...panHandlers}>
      <Ionicons name="hand-left-outline" size={38} color={theme.textMuted} />
      <Text style={styles.touchpadText}>Control Orion Desktop ({absolute ? '1:1 Surface Mode' : 'Trackpad Mode'})</Text>
    </View>
  </View>;
});

export function UnifiedRemoteSurface({ controller, theme, isLandscape, legacyStyles }: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [text, setText] = useState('');
  const context = controller.remoteContext;
  const capabilities = context?.capabilities || {};
  const command = useCallback<Command>(async (action, value) => {
    setPendingActions((previous) => new Set(previous).add(action));
    try { return await controller.sendRemoteCommand(action, value); }
    finally { setPendingActions((previous) => { const next = new Set(previous); next.delete(action); return next; }); }
  }, [controller.sendRemoteCommand]);
  const action = (props: any) => <RemoteAction {...props} pending={pendingActions.has(props.action)} command={command} styles={styles} theme={theme} />;

  return <ScrollView scrollEnabled={!controller.isPointerGestureActive} contentContainerStyle={[styles.root, isLandscape && styles.rootLandscape]} keyboardShouldPersistTaps="handled">
    <View style={isLandscape ? styles.leftPane : undefined}><PlaybackPanel playback={controller.nowPlaying} capabilities={capabilities} controller={controller} pendingActions={pendingActions} command={command} styles={styles} theme={theme} legacyStyles={legacyStyles} /></View>
    <View style={isLandscape ? styles.rightPane : undefined}>
      <RemoteTouchpad pointerMode={controller.pointerMode} setPointerMode={controller.setPointerMode} onLayout={controller.onTouchpadLayout} panHandlers={controller.panResponder.panHandlers} styles={styles} theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {action({ action: 'home', icon: 'home-outline', label: 'Home' })}{action({ action: 'back', icon: 'arrow-back', label: 'Back' })}
        {capabilities.canToggleSubtitles && action({ action: 'toggle_subtitles', icon: 'chatbox-ellipses-outline', label: 'Subtitles' })}
        {capabilities.canToggleFullscreen && action({ action: 'toggle_fullscreen', icon: 'expand-outline', label: 'Fullscreen' })}
        {capabilities.canTogglePip && action({ action: 'toggle_pip', icon: 'duplicate-outline', label: 'PiP' })}
        {context?.canType && <Pressable style={styles.action} onPress={() => setShowMore(true)}><Ionicons name="keypad-outline" size={21} color={theme.text} /><Text style={styles.actionLabel}>Type</Text></Pressable>}
        <Pressable style={styles.action} onPress={() => setShowMore(true)}><Ionicons name="ellipsis-horizontal" size={21} color={theme.text} /><Text style={styles.actionLabel}>More</Text></Pressable>
      </ScrollView>
      {controller.remoteError ? <Text style={styles.error}>{controller.remoteError}</Text> : null}
    </View>
    <Modal visible={showMore} transparent animationType="fade" onRequestClose={() => setShowMore(false)}><Pressable style={styles.scrim} onPress={() => setShowMore(false)}><Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
      <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Remote tools</Text><Pressable onPress={() => setShowMore(false)}><Ionicons name="close" size={24} color={theme.text} /></Pressable></View>
      {context?.canType && <View style={styles.typeRow}><TextInput value={text} onChangeText={setText} placeholder="Type on Desktop" placeholderTextColor={theme.textMuted} style={styles.input} /><Pressable style={styles.send} onPress={() => { void command('send_text', text); setText(''); }}><Ionicons name="send" size={19} color={theme.onAccent} /></Pressable></View>}
      <Text style={styles.eyebrow}>ACCESSIBILITY D-PAD</Text><View style={styles.dpad}>{action({ action: 'up', icon: 'chevron-up', label: 'Up' })}<View style={styles.dpadRow}>{action({ action: 'left', icon: 'chevron-back', label: 'Left' })}{action({ action: 'select', icon: 'radio-button-on', label: 'Select' })}{action({ action: 'right', icon: 'chevron-forward', label: 'Right' })}</View>{action({ action: 'down', icon: 'chevron-down', label: 'Down' })}</View>
      <View style={styles.rail}>{action({ action: 'toggle_mute', icon: controller.isMuted ? 'volume-mute' : 'volume-high', label: 'Mute' })}{action({ action: 'volume_down', icon: 'remove', label: 'Volume' })}{action({ action: 'volume_up', icon: 'add', label: 'Volume' })}{action({ action: 'menu', icon: 'menu', label: 'Menu' })}</View>
      <Pressable style={styles.disconnectAction} onPress={() => { setShowMore(false); controller.setShowDisconnectModal(true); }}><Ionicons name="power-outline" size={19} color={theme.danger} /><Text style={[styles.actionLabel, { color: theme.danger }]}>Disconnect remote</Text></Pressable>
    </Pressable></Pressable></Modal>
  </ScrollView>;
}

function createStyles(theme: any) { return StyleSheet.create({
  root: { paddingHorizontal: 18, paddingBottom: 44, gap: 14 }, rootLandscape: { flexDirection: 'row', alignItems: 'stretch' }, leftPane: { width: '43%', minWidth: 280 }, rightPane: { flex: 1, gap: 12, minWidth: 0 },
  playbackCard: { padding: 14, borderRadius: 22, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, gap: 8 }, contextCard: { padding: 16, borderRadius: 22, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  playbackCopy: { minWidth: 0 }, eyebrow: { color: theme.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: theme.text, fontSize: 19, lineHeight: 23, fontWeight: '800', marginTop: 3 }, meta: { color: theme.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.textMuted }, statusDotReady: { backgroundColor: theme.success || theme.accent }, statusText: { flexShrink: 1, color: theme.textSecondary, fontSize: 11, fontWeight: '700' }, timingUnavailable: { color: theme.textMuted, fontSize: 12, fontWeight: '600' },
  transport: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }, action: { minWidth: 58, minHeight: 48, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border }, actionLabel: { color: theme.text, fontSize: 10, fontWeight: '700' }, pressed: { opacity: .78, transform: [{ scale: .97 }] }, disabled: { opacity: .42 },
  touchpadBlock: { gap: 9, flex: 1 }, touchpadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, touchpadCopy: { flex: 1, minWidth: 0 }, latency: { backgroundColor: theme.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, latencyText: { color: theme.textSecondary, fontSize: 11, fontWeight: '700' }, touchpad: { minHeight: 210, flex: 1, borderRadius: 28, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', gap: 10 }, touchpadText: { color: theme.textSecondary, fontWeight: '700', textAlign: 'center', paddingHorizontal: 16 }, rail: { flexDirection: 'row', gap: 9, paddingVertical: 2 }, error: { color: theme.danger, padding: 12, backgroundColor: theme.dangerSoft || theme.accentSoft, borderRadius: 14 },
  scrim: { flex: 1, backgroundColor: theme.scrim || 'rgba(0, 0, 0, 0.72)', justifyContent: 'flex-end', padding: 16 }, sheet: { maxHeight: '82%', padding: 18, borderRadius: 28, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, gap: 16 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sheetTitle: { color: theme.text, fontSize: 22, fontWeight: '800' }, typeRow: { flexDirection: 'row', gap: 8 }, input: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: theme.border, color: theme.text, paddingHorizontal: 14, backgroundColor: theme.elevated }, send: { width: 50, height: 50, borderRadius: 15, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }, dpad: { alignItems: 'center', gap: 7 }, dpadRow: { flexDirection: 'row', gap: 8 }, disconnectAction: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft || theme.surface },
}); }
