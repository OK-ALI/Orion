import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MeasuredScrubber } from './MeasuredScrubber';

type Props = { controller: any; theme: any; isLandscape: boolean; legacyStyles: any };
type Command = (action: string, value?: unknown) => Promise<any>;

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

function formatContextTitle(route?: string): string {
  if (!route) return 'Desktop Connected';
  const clean = String(route).trim().toLowerCase();
  const routeMap: Record<string, string> = {
    home: 'Browsing Home',
    movie: 'Browsing Movies',
    tv: 'Browsing TV Shows',
    discover: 'Browsing Discover',
    'get-mobile': 'Get Orion Mobile',
    'music-home': 'Music Planet: Home',
    'music-explore': 'Music Planet: Explore',
    'music-library': 'Music Planet: Library',
    'music-favorites': 'Music Planet: Favorites',
    'music-playlists': 'Music Planet: Playlists',
    'music-queue': 'Music Planet: Queue',
    'music-history': 'Music Planet: History',
    library: 'Browsing Library',
    downloads: 'Browsing Downloads',
    constellation: 'Browsing Constellation',
    settings: 'Browsing Settings',
    search: 'Browsing Search',
    person: 'Viewing Filmography',
  };

  if (routeMap[clean]) return routeMap[clean];

  if (clean.startsWith('music-')) {
    const sub = clean.slice(6);
    const subCapitalized = sub.charAt(0).toUpperCase() + sub.slice(1);
    return `Music Planet: ${subCapitalized}`;
  }

  const capitalizedWords = clean
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `Browsing ${capitalizedWords}`;
}

function PlaybackPanel({ playback, capabilities, controller, controllerActive, pendingActions, command, styles, theme, legacyStyles }: any) {
  const action = (props: any) => (
    <RemoteAction {...props} disabled={!controllerActive || props.disabled} pending={pendingActions.has(props.action)} command={command} styles={styles} theme={theme} />
  );
  if (!playback.hasMedia) {
    return (
      <View style={styles.contextCard}>
        <Text style={styles.eyebrow}>DESKTOP CONTEXT</Text>
        <Text style={styles.title}>{formatContextTitle(controller.remoteContext?.route)}</Text>
        <Text style={styles.meta}>Touch, scroll and navigate without changing modes.</Text>
      </View>
    );
  }

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

  return (
    <View style={styles.playbackCard}>
      <View style={styles.playbackCopy}>
        <Text style={styles.eyebrow}>NOW PLAYING</Text>
        <Text style={styles.title} numberOfLines={2}>{playback.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{playback.type} {'\u00B7'} {playback.sourceLabel || 'Orion Player'}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, state === 'ready' && styles.statusDotReady]} />
          <Text style={styles.statusText}>{stateCopy[state] || 'Controls unavailable'}</Text>
        </View>
      </View>
      <MeasuredScrubber
        currentTime={playback.currentTime || 0}
        duration={playback.duration || 0}
        bufferedTime={playback.bufferedTime || 0}
        disabled={!controllerActive || !canSeek}
        formatTime={controller.formatTime}
        onScrubbing={controller.setIsScrubbing}
        onSeek={(seconds: number) => command('seek_to', { ...target, seconds })}
        styles={legacyStyles}
      />
      {!playback.duration ? <Text style={styles.timingUnavailable}>Playback timing unavailable</Text> : null}
      <View style={styles.transport}>
        {canPrevious && action({ action: 'previous', icon: 'play-skip-back', label: 'Previous', value: target })}
        {canSeek && action({ action: 'seek_-10', icon: 'play-back', label: '10 sec', value: target })}
        {primaryAllowed && action({ action: primaryAction, icon: playback.paused ? 'play' : 'pause', label: playback.paused ? 'Play' : 'Pause', value: target })}
        {state === 'loading' && !primaryAllowed && action({ action: 'play', icon: 'refresh', label: 'Retry', value: target })}
        {canSeek && action({ action: 'seek_+10', icon: 'play-forward', label: '10 sec', value: target })}
        {canNext && action({ action: 'next', icon: 'play-skip-forward', label: 'Next', value: target })}
      </View>
    </View>
  );
}

function SystemControlsPanel({ controller, controllerActive, styles, theme }: any) {
  const volume = controller.systemVolume ?? 50;
  const isMuted = Boolean(controller.systemMuted);
  const brightness = controller.displayBrightness ?? 100;
  const brightnessSupported = Boolean(controller.brightnessSupported);

  const adjustVolume = (delta: number) => {
    if (!controllerActive) return;
    const next = Math.max(0, Math.min(100, volume + delta));
    void controller.setSystemVolume(next);
  };

  const adjustBrightness = (delta: number) => {
    if (!controllerActive || !brightnessSupported) return;
    const next = Math.max(0, Math.min(100, brightness + delta));
    void controller.setDisplayBrightness(next);
  };

  const volIcon = isMuted
    ? 'volume-mute'
    : volume < 30
      ? 'volume-low'
      : volume < 70
        ? 'volume-medium'
        : 'volume-high';

  return (
    <View style={[styles.systemCard, !controllerActive && styles.controllerDisabled]}>
      <View style={styles.systemHeader}>
        <Text style={styles.eyebrow}>PC SYSTEM CONTROLS</Text>
      </View>

      {/* PC Master Volume */}
      <View style={styles.systemRow}>
        <View style={styles.systemMeta}>
          <Ionicons name={volIcon} size={18} color={isMuted ? theme.warning : theme.accent} />
          <Text style={styles.systemLabel}>Master Volume</Text>
          <Text style={[styles.systemValue, isMuted && { color: theme.warning }]}>
            {isMuted ? 'Muted' : `${volume}%`}
          </Text>
        </View>
        <View style={styles.controlGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease PC volume"
            disabled={!controllerActive || volume <= 0}
            onPress={() => adjustVolume(-5)}
            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, (!controllerActive || volume <= 0) && styles.disabled]}
          >
            <Ionicons name="remove" size={18} color={theme.text} />
          </Pressable>

          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                { width: `${volume}%`, backgroundColor: isMuted ? theme.textMuted : theme.accent },
              ]}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase PC volume"
            disabled={!controllerActive || volume >= 100}
            onPress={() => adjustVolume(5)}
            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, (!controllerActive || volume >= 100) && styles.disabled]}
          >
            <Ionicons name="add" size={18} color={theme.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute PC' : 'Mute PC'}
            disabled={!controllerActive}
            onPress={() => void controller.toggleSystemMute()}
            style={({ pressed }) => [
              styles.muteBtn,
              isMuted && styles.muteBtnActive,
              pressed && styles.pressed,
              !controllerActive && styles.disabled,
            ]}
          >
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-medium'} size={18} color={isMuted ? theme.onAccent : theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Display Brightness */}
      <View style={styles.systemRow}>
        <View style={styles.systemMeta}>
          <Ionicons
            name={brightnessSupported ? 'sunny' : 'sunny-outline'}
            size={18}
            color={brightnessSupported ? theme.accent : theme.textMuted}
          />
          <Text style={styles.systemLabel}>Display Brightness</Text>
          <Text style={[styles.systemValue, !brightnessSupported && { color: theme.textMuted }]}>
            {brightnessSupported ? `${brightness}%` : 'Not supported'}
          </Text>
        </View>
        {brightnessSupported ? (
          <View style={styles.controlGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease display brightness"
              disabled={!controllerActive || brightness <= 0}
              onPress={() => adjustBrightness(-10)}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, (!controllerActive || brightness <= 0) && styles.disabled]}
            >
              <Ionicons name="remove" size={18} color={theme.text} />
            </Pressable>

            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${brightness}%`, backgroundColor: theme.accent }]} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase display brightness"
              disabled={!controllerActive || brightness >= 100}
              onPress={() => adjustBrightness(10)}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, (!controllerActive || brightness >= 100) && styles.disabled]}
            >
              <Ionicons name="add" size={18} color={theme.text} />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.unsupportedNotice}>
            Brightness control is unavailable. Enable DDC/CI in your monitor's OSD settings.
          </Text>
        )}
      </View>
    </View>
  );
}

const RemoteTouchpad = memo(function RemoteTouchpad({ pointerMode, setPointerMode, onLayout, panHandlers, scrollPanHandlers, horizontalScrollPanHandlers, styles, theme, disabled = false }: any) {
  const absolute = pointerMode === 'absolute';
  return (
    <View style={[styles.touchpadBlock, disabled && styles.controllerDisabled]} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.touchpadHeader}>
        <View style={styles.touchpadCopy}>
          <Text style={styles.eyebrow}>TOUCHPAD ({absolute ? 'DIRECT 1:1 MIRROR' : 'TRACKPAD'})</Text>
          <Text style={styles.meta}>{absolute ? 'Touch area mirrors desktop 1:1 \u00B7 tap selects' : 'One finger moves \u00B7 tap selects \u00B7 scroll strips or 2 fingers scroll'}</Text>
        </View>
        <Pressable style={styles.latency} onPress={() => setPointerMode(absolute ? 'relative' : 'absolute')}>
          <Text style={styles.latencyText}>{absolute ? '1:1 Direct' : 'Trackpad'}</Text>
        </Pressable>
      </View>
      <View style={styles.touchpadRow}>
        <View accessibilityLabel="Desktop touchpad" style={styles.touchpad} onLayout={onLayout} {...panHandlers}>
          <Ionicons name="hand-left-outline" size={38} color={theme.textMuted} />
          <Text style={styles.touchpadText}>Control Orion Desktop ({absolute ? '1:1 Surface Mode' : 'Trackpad Mode'})</Text>
        </View>
        <View accessibilityLabel="Vertical scroll strip" style={styles.scrollStrip} {...scrollPanHandlers}>
          <Ionicons name="chevron-up" size={14} color={theme.textMuted} />
          <View style={styles.scrollThumbGrip}>
            <Ionicons name="swap-vertical" size={16} color={theme.accent} />
          </View>
          <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
        </View>
      </View>
      <View accessibilityLabel="Horizontal scroll strip" style={styles.horizontalScrollStrip} {...horizontalScrollPanHandlers}>
        <Ionicons name="chevron-back" size={14} color={theme.textMuted} />
        <View style={styles.horizontalScrollThumbGrip}>
          <Ionicons name="swap-horizontal" size={16} color={theme.accent} />
          <Text style={styles.horizontalScrollLabel}>HORIZONTAL SCROLL</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
      </View>
    </View>
  );
});

export function UnifiedRemoteSurface({ controller, theme, isLandscape, legacyStyles }: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [text, setText] = useState('');
  const liveDebounceRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const context = controller.remoteContext;
  const capabilities = context?.capabilities || {};
  const isActiveController = Boolean(controller.isActiveController);
  const activeControllerName = String(controller.activeControllerName || '');
  const command = useCallback<Command>(async (action, value) => {
    setPendingActions((previous) => new Set(previous).add(action));
    try { return await controller.sendRemoteCommand(action, value); }
    finally { setPendingActions((previous) => { const next = new Set(previous); next.delete(action); return next; }); }
  }, [controller.sendRemoteCommand]);

  const lastLiveSendAtRef = useRef(0);
  const pendingLiveTextRef = useRef<string | null>(null);

  const handleLiveTextChange = useCallback((newText: string) => {
    setText(newText);
    pendingLiveTextRef.current = newText;

    if (liveDebounceRef.current) {
      clearTimeout(liveDebounceRef.current);
      liveDebounceRef.current = null;
    }

    const now = Date.now();
    const elapsed = now - lastLiveSendAtRef.current;

    if (elapsed >= 16) {
      lastLiveSendAtRef.current = now;
      pendingLiveTextRef.current = null;
      void controller.sendRemoteCommand('send_text', { text: newText, submit: false });
    } else {
      liveDebounceRef.current = setTimeout(() => {
        liveDebounceRef.current = null;
        lastLiveSendAtRef.current = Date.now();
        const pending = pendingLiveTextRef.current;
        pendingLiveTextRef.current = null;
        if (pending !== null) {
          void controller.sendRemoteCommand('send_text', { text: pending, submit: false });
        }
      }, 16 - elapsed);
    }
  }, [controller]);

  const handleClearText = useCallback(() => {
    if (liveDebounceRef.current) {
      clearTimeout(liveDebounceRef.current);
      liveDebounceRef.current = null;
    }
    lastLiveSendAtRef.current = Date.now();
    pendingLiveTextRef.current = null;
    setText('');
    void controller.sendRemoteCommand('send_text', { text: '', submit: false });
  }, [controller]);

  const handleSendExplicit = useCallback(() => {
    if (liveDebounceRef.current) {
      clearTimeout(liveDebounceRef.current);
      liveDebounceRef.current = null;
    }
    pendingLiveTextRef.current = null;
    void command('send_text', { text, submit: true });
    Keyboard.dismiss();
  }, [command, text]);

  const action = (props: any) => (
    <RemoteAction {...props} disabled={!isActiveController || props.disabled} pending={pendingActions.has(props.action)} command={command} styles={styles} theme={theme} />
  );

  return (
    <ScrollView scrollEnabled={!controller.isPointerGestureActive} contentContainerStyle={[styles.root, isLandscape && styles.rootLandscape]} keyboardShouldPersistTaps="handled">
      <View style={isLandscape ? styles.leftPane : undefined} pointerEvents={isActiveController ? 'auto' : 'none'}>
        <PlaybackPanel playback={controller.nowPlaying} capabilities={capabilities} controller={controller} controllerActive={isActiveController} pendingActions={pendingActions} command={command} styles={styles} theme={theme} legacyStyles={legacyStyles} />
        <SystemControlsPanel controller={controller} controllerActive={isActiveController} styles={styles} theme={theme} />
      </View>
      <View style={isLandscape ? styles.rightPane : undefined}>
        {!isActiveController ? (
          <View style={styles.controllerCard}>
            <View style={styles.controllerCopy}>
              <Text style={styles.eyebrow}>CONTROLLER ACCESS</Text>
              <Text style={styles.controllerTitle}>{activeControllerName ? `${activeControllerName} is controlling Orion Desktop` : 'No phone currently controls Orion Desktop'}</Text>
              <Text style={styles.meta}>You can keep watching live context and playback status from this trusted phone.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take Control"
              disabled={!controller.canTakeControl || pendingActions.has('smart_connect_take_control')}
              onPress={() => void command('smart_connect_take_control')}
              style={({ pressed }) => [styles.takeControl, pressed && styles.pressed, (!controller.canTakeControl || pendingActions.has('smart_connect_take_control')) && styles.disabled]}
            >
              {pendingActions.has('smart_connect_take_control') ? <ActivityIndicator color={theme.onAccent} /> : <Ionicons name="radio-button-on" size={19} color={theme.onAccent} />}
              <Text style={styles.takeControlText}>Take Control</Text>
            </Pressable>
          </View>
        ) : null}
        <RemoteTouchpad pointerMode={controller.pointerMode} setPointerMode={controller.setPointerMode} onLayout={controller.onTouchpadLayout} panHandlers={controller.panResponder.panHandlers} scrollPanHandlers={controller.scrollPanResponder?.panHandlers} horizontalScrollPanHandlers={controller.horizontalScrollPanResponder?.panHandlers} styles={styles} theme={theme} disabled={!isActiveController} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {action({ action: 'home', icon: 'home-outline', label: 'Home' })}
          {action({ action: 'back', icon: 'arrow-back', label: 'Back' })}
          {capabilities.canToggleSubtitles && action({ action: 'toggle_subtitles', icon: 'chatbox-ellipses-outline', label: 'Subtitles' })}
          {capabilities.canToggleFullscreen && action({ action: 'toggle_fullscreen', icon: 'expand-outline', label: 'Fullscreen' })}
          {capabilities.canTogglePip && action({ action: 'toggle_pip', icon: 'duplicate-outline', label: 'PiP' })}
          {context?.canType && (
            <Pressable
              disabled={!isActiveController}
              style={[styles.action, !isActiveController && styles.disabled]}
              onPress={() => {
                setShowMore(true);
                setTimeout(() => inputRef.current?.focus(), 150);
              }}
            >
              <Ionicons name="keypad-outline" size={21} color={theme.text} />
              <Text style={styles.actionLabel}>Type</Text>
            </Pressable>
          )}
          <Pressable disabled={!isActiveController} style={[styles.action, !isActiveController && styles.disabled]} onPress={() => setShowMore(true)}>
            <Ionicons name="ellipsis-horizontal" size={21} color={theme.text} />
            <Text style={styles.actionLabel}>More</Text>
          </Pressable>
        </ScrollView>
        {controller.remoteError ? <Text style={styles.error}>{controller.remoteError}</Text> : null}
      </View>
      <Modal visible={showMore && isActiveController} transparent animationType="fade" onRequestClose={() => setShowMore(false)}>
        <Pressable style={styles.scrim} onPress={() => setShowMore(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Remote tools</Text>
              <Pressable onPress={() => setShowMore(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            {context?.canType && (
              <View style={styles.typeRow}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={inputRef}
                    value={text}
                    onChangeText={handleLiveTextChange}
                    placeholder="Type on Desktop"
                    placeholderTextColor={theme.textMuted}
                    style={styles.input}
                    returnKeyType="send"
                    onSubmitEditing={handleSendExplicit}
                  />
                  {text.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear text"
                      style={styles.clearBtn}
                      onPress={handleClearText}
                    >
                      <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send text"
                  style={styles.send}
                  onPress={handleSendExplicit}
                >
                  <Ionicons name="send" size={19} color={theme.onAccent} />
                </Pressable>
              </View>
            )}
            <Text style={styles.eyebrow}>TV & ACCESSIBILITY D-PAD</Text>
            <View style={styles.dpad}>
              {action({ action: 'up', icon: 'chevron-up', label: 'Up' })}
              <View style={styles.dpadRow}>
                {action({ action: 'left', icon: 'chevron-back', label: 'Left' })}
                {action({ action: 'select', icon: 'radio-button-on', label: 'Select' })}
                {action({ action: 'right', icon: 'chevron-forward', label: 'Right' })}
              </View>
              {action({ action: 'down', icon: 'chevron-down', label: 'Down' })}
            </View>
            <View style={styles.rail}>
              {action({ action: 'system.volume.mute', icon: controller.systemMuted ? 'volume-mute' : 'volume-high', label: 'PC Mute', value: !controller.systemMuted })}
              {action({ action: 'system.volume.set', icon: 'remove', label: 'Vol -5', value: Math.max(0, (controller.systemVolume ?? 50) - 5) })}
              {action({ action: 'system.volume.set', icon: 'add', label: 'Vol +5', value: Math.min(100, (controller.systemVolume ?? 50) + 5) })}
              {action({ action: 'menu', icon: 'menu', label: 'Menu' })}
            </View>
            <Pressable style={styles.disconnectAction} onPress={() => { setShowMore(false); controller.setShowDisconnectModal(true); }}>
              <Ionicons name="power-outline" size={19} color={theme.danger} />
              <Text style={[styles.actionLabel, { color: theme.danger }]}>Disconnect remote</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    root: { paddingHorizontal: 18, paddingBottom: 68, gap: 18 },
    rootLandscape: { flexDirection: 'row', alignItems: 'stretch' },
    leftPane: { width: '43%', minWidth: 280, gap: 14 },
    rightPane: { flex: 1, gap: 12, minWidth: 0 },
    controllerCard: { padding: 14, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, gap: 12 },
    controllerCopy: { gap: 2 },
    controllerTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
    controllerDisabled: { opacity: 0.55 },
    takeControl: { minHeight: 48, borderRadius: 16, backgroundColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
    takeControlText: { color: theme.onAccent, fontSize: 13, fontWeight: '800' },
    playbackCard: { padding: 16, borderRadius: 22, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, gap: 10 },
    contextCard: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 4 },
    playbackCopy: { minWidth: 0 },
    eyebrow: { color: theme.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
    title: { color: theme.text, fontSize: 19, lineHeight: 23, fontWeight: '800', marginTop: 3 },
    meta: { color: theme.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.textMuted },
    statusDotReady: { backgroundColor: theme.success || theme.accent },
    statusText: { flexShrink: 1, color: theme.textSecondary, fontSize: 11, fontWeight: '700' },
    timingUnavailable: { color: theme.textMuted, fontSize: 12, fontWeight: '600' },
    transport: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
    action: { minWidth: 64, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border },
    actionLabel: { color: theme.text, fontSize: 10, fontWeight: '700' },
    pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
    disabled: { opacity: 0.42 },
    touchpadBlock: { gap: 12, flex: 1 },
    touchpadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    touchpadCopy: { flex: 1, minWidth: 0 },
    latency: { backgroundColor: theme.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    latencyText: { color: theme.textSecondary, fontSize: 11, fontWeight: '700' },
    touchpadRow: { flexDirection: 'row', gap: 10, minHeight: 210, flex: 1 },
    touchpad: { minHeight: 210, flex: 1, borderRadius: 28, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', gap: 10 },
    touchpadText: { color: theme.textSecondary, fontWeight: '700', textAlign: 'center', paddingHorizontal: 16 },
    scrollStrip: { width: 44, minHeight: 210, borderRadius: 22, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
    scrollThumbGrip: { width: 30, height: 46, borderRadius: 15, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    horizontalScrollStrip: { height: 42, width: '100%', borderRadius: 21, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 10 },
    horizontalScrollThumbGrip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border },
    horizontalScrollLabel: { color: theme.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    rail: { flexDirection: 'row', gap: 12, paddingVertical: 6, paddingHorizontal: 2, marginTop: 4 },
    error: { color: theme.danger, padding: 12, backgroundColor: theme.dangerSoft || theme.accentSoft, borderRadius: 14 },
    scrim: { flex: 1, backgroundColor: theme.scrim || 'rgba(0, 0, 0, 0.72)', justifyContent: 'flex-end', padding: 16 },
    sheet: { maxHeight: '82%', padding: 18, borderRadius: 28, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, gap: 16 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { color: theme.text, fontSize: 22, fontWeight: '800' },
    typeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    inputWrapper: { flex: 1, position: 'relative', justifyContent: 'center' },
    input: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: theme.border, color: theme.text, paddingLeft: 14, paddingRight: 38, backgroundColor: theme.elevated },
    clearBtn: { position: 'absolute', right: 8, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    send: { width: 50, height: 50, borderRadius: 15, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    dpad: { alignItems: 'center', gap: 7 },
    dpadRow: { flexDirection: 'row', gap: 8 },
    disconnectAction: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft || theme.surface },
    // PC System Controls Styles
    systemCard: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 14 },
    systemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    systemRow: { gap: 8 },
    systemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    systemLabel: { color: theme.text, fontSize: 13, fontWeight: '700', flex: 1 },
    systemValue: { color: theme.textSecondary, fontSize: 12, fontWeight: '700' },
    controlGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    muteBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    muteBtnActive: { backgroundColor: theme.warning, borderColor: theme.warning },
    sliderTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', justifyContent: 'center' },
    sliderFill: { height: '100%', borderRadius: 5 },
    unsupportedNotice: { color: theme.textMuted, fontSize: 11, fontStyle: 'italic', paddingVertical: 4 },
  });
}
