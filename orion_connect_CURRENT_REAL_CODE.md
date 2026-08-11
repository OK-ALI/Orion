# Orion Connect - Current Real Code Diagnostic

Generated: 08/10/2026 12:40:45

----------------------------------------
## FILE: apps/mobile/src/features/connect/useRemotePointer.ts
----------------------------------------

```
import { useState, useRef } from 'react';
import { LayoutChangeEvent, PanResponder } from 'react-native';

type FireAndForgetSender = (action: string, value?: unknown) => void;
const TARGET_FRAME_MS = 16;

export function useRemotePointer(sendRef: React.MutableRefObject<FireAndForgetSender>) {
  const cursorRef = useRef({ xRatio: 0.5, yRatio: 0.5 });
  const touchpadLayoutRef = useRef({ width: 320, height: 230 });
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const lastScrollY = useRef(0);
  const scrollAccum = useRef(0);
  const [pointerMode, setPointerMode] = useState<'relative' | 'absolute'>('relative');
  const pointerModeRef = useRef<'relative' | 'absolute'>('relative');
  pointerModeRef.current = pointerMode;

  const onTouchpadLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    touchpadLayoutRef.current = {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
      const px = touch?.pageX || 0;
      const py = touch?.pageY || 0;
      lastTouchPos.current = { x: px, y: py };
      lastScrollY.current = py;
      scrollAccum.current = 0;

      if (pointerModeRef.current === 'absolute') {
        const { locationX, locationY } = event.nativeEvent;
        const x = Math.max(0, Math.min(1, locationX / touchpadLayoutRef.current.width));
        const y = Math.max(0, Math.min(1, locationY / touchpadLayoutRef.current.height));
        cursorRef.current = { xRatio: x, yRatio: y };
        sendRef.current('cursor_move', { x, y });
      }
    },
    onPanResponderMove: (event, gesture) => {
      // â”€â”€ Two-finger scroll â”€â”€
      if (event.nativeEvent.touches && event.nativeEvent.touches.length >= 2) {
        const y = event.nativeEvent.touches[0]?.pageY || lastScrollY.current;
        const deltaY = y - lastScrollY.current;
        lastScrollY.current = y;
        scrollAccum.current += deltaY;
        if (Math.abs(scrollAccum.current) >= 1) {
          sendRef.current('scroll', { deltaY: -scrollAccum.current });
          scrollAccum.current = 0;
        }
        return;
      }

      // â”€â”€ Absolute pointer mode â”€â”€
      if (pointerModeRef.current === 'absolute') {
        const { locationX, locationY } = event.nativeEvent;
        const x = Math.max(0, Math.min(1, locationX / touchpadLayoutRef.current.width));
        const y = Math.max(0, Math.min(1, locationY / touchpadLayoutRef.current.height));
        cursorRef.current = { xRatio: x, yRatio: y };
        sendRef.current('cursor_move', { x, y });
        return;
      }

      // â”€â”€ Relative trackpad: direct step-delta physics â”€â”€
      const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
      const currentX = touch?.pageX || 0;
      const currentY = touch?.pageY || 0;

      let stepX = currentX - lastTouchPos.current.x;
      let stepY = currentY - lastTouchPos.current.y;
      lastTouchPos.current = { x: currentX, y: currentY };

      // Ignore position reset jumps
      if (Math.abs(stepX) > 100 || Math.abs(stepY) > 100) {
        stepX = 0;
        stepY = 0;
      }

      if (stepX === 0 && stepY === 0) return;

      const sensitivityX = 1.0 / touchpadLayoutRef.current.width;
      const sensitivityY = 1.0 / touchpadLayoutRef.current.height;

      const nextX = Math.max(0, Math.min(1, cursorRef.current.xRatio + stepX * sensitivityX));
      const nextY = Math.max(0, Math.min(1, cursorRef.current.yRatio + stepY * sensitivityY));

      cursorRef.current = { xRatio: nextX, yRatio: nextY };
      sendRef.current('cursor_move', { x: nextX, y: nextY });
    },
    onPanResponderRelease: (event, gesture) => {
      if ((!event.nativeEvent.touches || event.nativeEvent.touches.length < 2) && Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
        sendRef.current('cursor_click');
      }
    },
    onPanResponderTerminate: () => {},
  })).current;

  return {
    cursorRef,
    panResponder,
    onTouchpadLayout,
    pointerMode,
    setPointerMode,
  };
}

```

----------------------------------------
## FILE: apps/mobile/src/features/connect/UnifiedRemoteSurface.tsx
----------------------------------------

```
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MeasuredScrubber } from './MeasuredScrubber';

type Props = { controller: any; theme: any; isLandscape: boolean; legacyStyles: any };

export function UnifiedRemoteSurface({ controller, theme, isLandscape, legacyStyles }: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [text, setText] = useState('');
  const context = controller.remoteContext;
  const playback = controller.nowPlaying;
  const capabilities = context?.capabilities || {};

  const command = async (action: string, value?: unknown) => {
    setPendingActions((prev) => new Set(prev).add(action));
    try { await controller.sendRemoteCommand(action, value); } finally {
      setPendingActions((prev) => { const next = new Set(prev); next.delete(action); return next; });
    }
  };

  const Action = ({ action, icon, label, value, disabled = false }: any) => {
    const isActionPending = pendingActions.has(action);
    return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || isActionPending}
      onPress={() => command(action, value)}
      style={({ pressed }) => [styles.action, pressed && styles.pressed, (disabled || isActionPending) && styles.disabled]}
    >
      {isActionPending ? <ActivityIndicator color={theme.accent} /> : <Ionicons name={icon} size={21} color={theme.text} />}
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
    );
  };

  const PlaybackPanel = () => playback.hasMedia ? (
    <View style={styles.playbackCard}>
      <View style={styles.playbackHeading}>
        <View style={styles.playbackCopy}>
          <Text style={styles.eyebrow}>NOW PLAYING</Text>
          <Text style={styles.title} numberOfLines={1}>{playback.title}</Text>
          <Text style={styles.meta}>{playback.type} Â· {playback.progress}</Text>
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
        <Action action="previous" icon="play-skip-back" label="Previous" />
        <Action action="seek_-10" icon="play-back" label="10 sec" disabled={!capabilities.canSeek} />
        <Action action="toggle_play" icon={controller.isPlaying ? 'pause' : 'play'} label={controller.isPlaying ? 'Pause' : 'Play'} />
        <Action action="seek_+10" icon="play-forward" label="10 sec" disabled={!capabilities.canSeek} />
        <Action action="next" icon="play-skip-forward" label="Next" />
      </View>
    </View>
  ) : (
    <View style={styles.contextCard}>
      <Text style={styles.eyebrow}>DESKTOP CONTEXT</Text>
      <Text style={styles.title}>{context?.route ? `Browsing ${context.route}` : 'Desktop connected'}</Text>
      <Text style={styles.meta}>Touch, scroll and navigate without changing modes.</Text>
    </View>
  );

  const Touchpad = () => (
    <View style={styles.touchpadBlock}>
      <View style={styles.touchpadHeader}>
        <View>
          <Text style={styles.eyebrow}>TOUCHPAD ({controller.pointerMode === 'absolute' ? 'DIRECT 1:1 MIRROR' : 'TRACKPAD'})</Text>
          <Text style={styles.meta}>{controller.pointerMode === 'absolute' ? 'Touch area mirrors desktop 1:1 Â· tap selects' : 'One finger moves Â· tap selects Â· two fingers scroll'}</Text>
        </View>
        <Pressable
          style={styles.latency}
          onPress={() => controller.setPointerMode(controller.pointerMode === 'relative' ? 'absolute' : 'relative')}
        >
          <Text style={styles.latencyText}>{controller.pointerMode === 'relative' ? 'Trackpad' : '1:1 Direct'}</Text>
        </Pressable>
      </View>
      <View
        accessibilityLabel="Desktop touchpad"
        style={styles.touchpad}
        onLayout={controller.onTouchpadLayout}
        {...controller.panResponder.panHandlers}
      >
        <Ionicons name="hand-left-outline" size={38} color={theme.textMuted} />
        <Text style={styles.touchpadText}>Control Orion Desktop ({controller.pointerMode === 'relative' ? 'Trackpad Mode' : '1:1 Surface Mode'})</Text>
      </View>
    </View>
  );

  return (
    <ScrollView scrollEnabled={true} contentContainerStyle={[styles.root, isLandscape && styles.rootLandscape]} keyboardShouldPersistTaps="handled">
      <View style={isLandscape ? styles.leftPane : undefined}><PlaybackPanel /></View>
      <View style={isLandscape ? styles.rightPane : undefined}>
        <Touchpad />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {!playback.hasMedia && <Action action="home" icon="home-outline" label="Home" />}
          {!playback.hasMedia && <Action action="back" icon="arrow-back" label="Back" />}
          {capabilities.canToggleSubtitles && <Action action="toggle_subtitles" icon="chatbox-ellipses-outline" label="Subtitles" />}
          {capabilities.canFullscreen && <Action action="toggle_fullscreen" icon="expand-outline" label="Fullscreen" />}
          {capabilities.canPip && <Action action="toggle_pip" icon="duplicate-outline" label="PiP" />}
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
            <View style={styles.dpad}><Action action="up" icon="chevron-up" label="Up" /><View style={styles.dpadRow}><Action action="left" icon="chevron-back" label="Left" /><Action action="select" icon="radio-button-on" label="Select" /><Action action="right" icon="chevron-forward" label="Right" /></View><Action action="down" icon="chevron-down" label="Down" /></View>
            <View style={styles.rail}><Action action="toggle_mute" icon={controller.isMuted ? 'volume-mute' : 'volume-high'} label="Mute" /><Action action="volume_down" icon="remove" label="Volume" /><Action action="volume_up" icon="add" label="Volume" /><Action action="menu" icon="menu" label="Menu" /></View>
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
  touchpadBlock: { gap: 9 }, touchpadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, latency: { backgroundColor: theme.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, latencyText: { color: theme.textSecondary, fontSize: 11, fontWeight: '700' }, touchpad: { minHeight: 230, flex: 1, borderRadius: 28, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', gap: 10 }, touchpadText: { color: theme.textSecondary, fontWeight: '700' }, rail: { flexDirection: 'row', gap: 9, paddingVertical: 2 }, error: { color: theme.danger, padding: 12, backgroundColor: theme.dangerSoft || theme.accentSoft, borderRadius: 14 },
  scrim: { flex: 1, backgroundColor: theme.scrim || 'rgba(0, 0, 0, 0.72)', justifyContent: 'flex-end', padding: 16 }, sheet: { maxHeight: '82%', padding: 18, borderRadius: 28, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, gap: 16 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sheetTitle: { color: theme.text, fontSize: 22, fontWeight: '800' }, typeRow: { flexDirection: 'row', gap: 8 }, input: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: theme.border, color: theme.text, paddingHorizontal: 14, backgroundColor: theme.elevated }, send: { width: 50, height: 50, borderRadius: 15, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }, dpad: { alignItems: 'center', gap: 7 }, dpadRow: { flexDirection: 'row', gap: 8 },
}); }

```

----------------------------------------
## FILE: apps/mobile/src/features/connect/useConnectController.ts
----------------------------------------

```
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, TextInput } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { SMART_CONNECT_PROTOCOL_VERSION, type SmartConnectPlaybackTelemetryV1 } from '@orion/shared/types';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import { stopNativeSmartConnectDiscovery } from '../../services/nativeSmartConnectDiscovery';
import { reportMobileDiagnosticError, updateMobileDiagnostics } from '../../services/mobileDiagnostics';
import { discoverSmartConnectDesktops, inspectSmartConnectEndpoint, scanSmartConnectSubnet, type SmartConnectDiscoveryResult } from '../../services/smartConnectDiscovery';
import { createRemoteCommand } from './commandController';
import { formatConnectTime, IDLE_CONNECT_STATUS } from './connectStatus';
import { normalizeDesktopAddress, parsePairingPayload } from './pairingController';
import { clearPairingGuard, writePairingGuard } from './pairingGuardStore';
import { usePairingGuardState } from './usePairingGuardState';
import { useLiveTelemetry } from './useLiveTelemetry';
import { useRemotePointer } from './useRemotePointer';
import {
  authenticateSecureSocket, closeSecureSmartConnectSocket, confirmSecurePairing,
  rejectSecurePairing, sendRealtimeSecureEnvelope, sendSecureEnvelope, startSecurePairing, subscribeSecureSmartConnect,
  waitForDesktopConfirmation, type PairingTranscript, type SecureEndpoint,
} from './secureConnectClient';

type ConnectionState = 'idle' | 'discovering' | 'pairing' | 'connected' | 'reconnecting' | 'endpoint-lost' | 'token-rejected' | 'code-expired' | 'locked-out' | 'protocol-mismatch' | 'failed';
interface TrustedEndpoint extends SecureEndpoint { discoveryMethod?: string; lastVerifiedAt?: number }

const readJson = <T,>(key: string): T | null => {
  try { return JSON.parse(mmkvStorageAdapter.get(key) || 'null') as T; } catch { return null; }
};

export function useConnectController() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [desktopIp, setDesktopIp] = useState('');
  const [desktopPort, setDesktopPort] = useState(8924);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('Orion Mobile');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [pairError, setPairError] = useState('');
  const [remoteError, setRemoteError] = useState('');
  const [qrNotice, setQrNotice] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState<PairingTranscript | null>(null);
  const [pendingEndpoint, setPendingEndpoint] = useState<TrustedEndpoint | null>(null);
  const [discoveredDesktops, setDiscoveredDesktops] = useState<SmartConnectDiscoveryResult[]>([]);
  const [pinCode, setPinCode] = useState('');
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [pairingMethod, setPairingMethod] = useState<'pin' | 'qr' | 'ip'>('pin');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(IDLE_CONNECT_STATUS);
  const [activeTab, setActiveTab] = useState<'touchpad' | 'dpad' | 'playback' | 'keyboard'>('touchpad');
  const [navFocusMode, setNavFocusMode] = useState<'sidebar' | 'content'>('sidebar');
  const [searchTarget, setSearchTarget] = useState<'cinema' | 'constellation'>('cinema');
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeedIndex, setCurrentSpeedIndex] = useState(0);
  const [remoteText, setRemoteText] = useState('');
  const { attemptsRemaining, lockoutSeconds, lockoutUntil, setAttemptsRemaining, setLockoutUntil } = usePairingGuardState();
  const hiddenPinInputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const connectionRef = useRef({ endpoint: null as TrustedEndpoint | null, deviceId: '', connectionId: '', connected: false });
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const disconnectingRef = useRef(false);
  const appActiveRef = useRef(true);
  const sequenceRef = useRef(0);
  const pendingAcks = useRef(new Map<string, { resolve(value: any): void; timer: ReturnType<typeof setTimeout> }>());
  const sendCommandRef = useRef<(cmd: string, value?: any) => Promise<any>>(async () => ({ ok: false, error: 'Remote transport is not ready.' }));
  const fireAndForgetRef = useRef<(cmd: string, value?: any) => void>(() => {});
  const { cursorRef, panResponder, onTouchpadLayout, pointerMode, setPointerMode } = useRemotePointer(fireAndForgetRef);
  const { latency, remoteContext, setRemoteContext, telemetry, ingestTelemetry, isScrubbing, setIsScrubbing, markSent, recordAck } = useLiveTelemetry(setNowPlaying);

  const rejectAllPendingAcks = (reason: string) => {
    for (const pending of pendingAcks.current.values()) {
      clearTimeout(pending.timer);
      pending.resolve({ ok: false, error: reason });
    }
    pendingAcks.current.clear();
  };

  const closeTransport = async () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    rejectAllPendingAcks('Connection closed.');
    await closeSecureSmartConnectSocket().catch(() => {});
    connectionRef.current.connected = false;
  };

  const consumeSocketMessage = (raw: string) => {
    try {
      const envelope = JSON.parse(raw);
      if (envelope.type === 'ack') {
        const pending = pendingAcks.current.get(envelope.payload?.id);
        if (pending) { clearTimeout(pending.timer); pendingAcks.current.delete(envelope.payload.id); pending.resolve(envelope.payload); }
        if (envelope.payload?.id) recordAck(envelope.payload.id);
      }
      if (envelope.type === 'context') setRemoteContext(envelope.payload || null);
      if (envelope.type === 'telemetry') {
        const playback = envelope.payload as SmartConnectPlaybackTelemetryV1 | null;
        ingestTelemetry(playback);
        if (playback) { setIsPlaying(playback.state === 'playing'); setVolume(Math.round((playback.volume ?? 1) * 100)); setIsMuted(Boolean(playback.muted)); }
      }
      if (envelope.type === 'status') {
        setIsConnected(envelope.payload?.connected !== false);
        setConnectionState('connected');
        reconnectAttemptRef.current = 0;
        setRemoteError('');
        updateMobileDiagnostics({ smartConnectState: 'connected', smartConnectReconnectAttempt: 0, smartConnectLastAuthenticatedAt: Date.now() });
      }
      if (envelope.type === 'error') {
        const errorCommandId = envelope.payload?.commandId;
        if (errorCommandId) {
          const pending = pendingAcks.current.get(errorCommandId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingAcks.current.delete(errorCommandId);
            pending.resolve({ ok: false, error: String(envelope.payload?.error || 'Desktop rejected the command.') });
          }
        }
        setRemoteError(String(envelope.payload?.error || 'Desktop rejected the remote command.'));
      }
    } catch {}
  };

  const scheduleReconnect = () => {
    if (disconnectingRef.current || !appActiveRef.current || !connectionRef.current.endpoint) return;
    reconnectAttemptRef.current += 1;
    setConnectionState('reconnecting');
    const base = Math.min(15_000, 1000 * (2 ** Math.min(4, reconnectAttemptRef.current - 1)));
    reconnectTimerRef.current = setTimeout(() => void connectSecureSocket(connectionRef.current.endpoint!), base + Math.round(Math.random() * 350));
  };

  const connectSecureSocket = async (endpoint: TrustedEndpoint) => {
    const activeDeviceId = connectionRef.current.deviceId || deviceId;
    if (!activeDeviceId || !endpoint.fingerprint) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    await closeTransport();
    setConnectionState(reconnectAttemptRef.current ? 'reconnecting' : 'pairing');
    try {
      const authenticated = await authenticateSecureSocket(endpoint, activeDeviceId);
      connectionRef.current = { endpoint, deviceId: activeDeviceId, connectionId: authenticated.connectionId, connected: true };
      setDesktopIp(endpoint.host); setDesktopPort(endpoint.port);
      mmkvStorageAdapter.set('orion_desktop_ip', endpoint.host);
      mmkvStorageAdapter.set('orion_smart_connect_trusted_endpoint_v1', JSON.stringify({ ...endpoint, lastVerifiedAt: Date.now(), discoveryMethod: endpoint.discoveryMethod || 'saved' }));
      const heartbeat = () => void sendSecureEnvelope({ version: SMART_CONNECT_PROTOCOL_VERSION, type: 'heartbeat', deviceId: activeDeviceId, connectionId: authenticated.connectionId, sequence: ++sequenceRef.current, payload: { at: Date.now() } });
      heartbeat(); heartbeatRef.current = setInterval(heartbeat, 15_000);
    } catch (error: any) {
      setIsConnected(false);
      if (String(error?.code) === 'REPAIR_REQUIRED') { setConnectionState('token-rejected'); setPairError('This Desktop requires secure re-pairing. Enter a fresh code.'); }
      else { setRemoteError(error?.message || 'Secure Desktop connection failed.'); scheduleReconnect(); }
    }
  };

  useEffect(() => subscribeSecureSmartConnect({
    onMessage: consumeSocketMessage,
    onClose: () => { rejectAllPendingAcks('Socket connection closed.'); setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
    onFailure: (message) => { rejectAllPendingAcks(message); setRemoteError(message); setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
  }), [deviceId]);

  useEffect(() => {
    const trusted = readJson<TrustedEndpoint>('orion_smart_connect_trusted_endpoint_v1');
    const savedIp = mmkvStorageAdapter.get('orion_desktop_ip');
    if (trusted?.host) { setDesktopIp(trusted.host); setDesktopPort(Number(trusted.port || 8924)); connectionRef.current.endpoint = trusted; }
    else if (savedIp) setDesktopIp(savedIp);
    Promise.all([SecureStore.getItemAsync('orion_connect_device_name')]).then(async ([storedName]) => {
      const identity = await import('../../services/nativeSecureConnect').then((value) => value.getSecureDeviceIdentity());
      setDeviceId(identity.deviceId); connectionRef.current.deviceId = identity.deviceId;
      if (storedName) setDeviceName(storedName);
      if (trusted?.host && trusted.fingerprint) void connectSecureSocket(trusted);
    }).catch(() => setPairError('Secure device identity is unavailable. Reinstall or update Orion Mobile.'));
  }, []);

  useEffect(() => {
    connectionRef.current.deviceId = deviceId;
    updateMobileDiagnostics({ smartConnectState: connectionState });
    const message = remoteError || pairError;
    if (message) reportMobileDiagnosticError({ area: 'smart-connect', code: remoteError ? 'REMOTE_TRANSPORT_ERROR' : 'PAIRING_ERROR', message });
  }, [connectionState, deviceId, pairError, remoteError]);

  useEffect(() => {
    if (lockoutUntil && lockoutUntil > Date.now()) setConnectionState('locked-out');
    else if (connectionState === 'locked-out') { setConnectionState('idle'); setPairError('You can try pairing again now.'); }
  }, [lockoutUntil, connectionState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      appActiveRef.current = state === 'active';
      if (!appActiveRef.current) { stopNativeSmartConnectDiscovery(); if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); return; }
      const endpoint = connectionRef.current.endpoint;
      if (endpoint && !connectionRef.current.connected) { reconnectAttemptRef.current = 0; void connectSecureSocket(endpoint); }
    });
    return () => subscription.remove();
  }, [deviceId]);

  useEffect(() => () => {
    disconnectingRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    for (const pending of pendingAcks.current.values()) clearTimeout(pending.timer);
    pendingAcks.current.clear(); void closeTransport();
  }, []);

  const discoverDesktop = async () => {
    setIsDiscovering(true); setConnectionState('discovering'); setPairError('');
    try {
      const trusted = readJson<TrustedEndpoint>('orion_smart_connect_trusted_endpoint_v1');
      const discovery = await discoverSmartConnectDesktops([
        { host: trusted?.host, port: trusted?.port, certificateFingerprint: trusted?.fingerprint },
        { host: desktopIp, port: desktopPort },
      ], SMART_CONNECT_PROTOCOL_VERSION);
      setDiscoveredDesktops(discovery.results);
      return discovery.results;
    } finally { setIsDiscovering(false); }
  };

  const handleConnect = async (targetIp?: string, targetPin?: string, targetPort?: number, method?: any, expectedFingerprint?: string) => {
    setIsConnecting(true); setPairError('');
    try {
      let host = normalizeDesktopAddress(targetIp || desktopIp);
      let port = Number(targetPort || desktopPort || 8924);
      let fingerprint = expectedFingerprint || '';
      if (!host) {
        const found = await discoverDesktop();
        if (found.length !== 1) throw Object.assign(new Error(found.length ? 'Choose the Orion Desktop you want to pair.' : 'Orion Desktop was not found. Use QR or Direct IP.'), { code: 'ENDPOINT_LOST' });
        ({ host, port, certificateFingerprint: fingerprint } = found[0]);
      }
      const probe = await inspectSmartConnectEndpoint(host, port, SMART_CONNECT_PROTOCOL_VERSION, method || 'nsd', fingerprint || null);
      if (!probe.ok) throw Object.assign(new Error(probe.errorCode === 'protocol-mismatch' ? 'Update both Orion applications to use Smart Connect v3.' : 'Orion Desktop is unavailable on this address.'), { code: probe.errorCode });
      const endpoint: TrustedEndpoint = { host, port: probe.result.port, fingerprint: probe.result.certificateFingerprint, instanceId: probe.result.instanceId, discoveryMethod: method || probe.result.discoveryMethod };
      const started = await startSecurePairing(endpoint, targetPin || pinCode, deviceName);
      setDeviceId(started.identity.deviceId); setPendingEndpoint(endpoint); setPendingTranscript(started.transcript);
      setConnectionState('pairing'); setDesktopIp(host); setDesktopPort(endpoint.port);
      setAttemptsRemaining(null); setLockoutUntil(null); clearPairingGuard();
    } catch (error: any) {
      const remaining = error?.attemptsRemaining;
      if (remaining != null) { setAttemptsRemaining(remaining); writePairingGuard({ attemptsRemaining: remaining, lockoutUntil: error.code === 'LOCKED_OUT' ? Date.now() + Number(error.retryAfterMs || 0) : null }); }
      if (error?.code === 'LOCKED_OUT') { const until = Date.now() + Number(error.retryAfterMs || 0); setLockoutUntil(until); setConnectionState('locked-out'); }
      else if (/expired/i.test(String(error?.code))) { setConnectionState('code-expired'); setPinCode(''); }
      else if (error?.code === 'protocol-mismatch') setConnectionState('protocol-mismatch');
      else setConnectionState('failed');
      setPairError(remaining != null && error?.code === 'INVALID_CODE' ? `Incorrect pairing code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : error?.message || 'Secure pairing failed.');
    } finally { setIsConnecting(false); }
  };

  const confirmVerificationPhrase = async () => {
    if (!pendingEndpoint || !pendingTranscript) return;
    setIsConnecting(true); setPairError('Confirm the same phrase on Orion Desktop.');
    try {
      await confirmSecurePairing(pendingEndpoint, pendingTranscript);
      await waitForDesktopConfirmation(pendingEndpoint, pendingTranscript);
      connectionRef.current.endpoint = pendingEndpoint;
      mmkvStorageAdapter.set('orion_smart_connect_trusted_endpoint_v1', JSON.stringify({ ...pendingEndpoint, lastVerifiedAt: Date.now(), discoveryMethod: pendingEndpoint.discoveryMethod || 'saved' }));
      setPendingTranscript(null); setShowPairingModal(false); setPairError(''); disconnectingRef.current = false;
      await connectSecureSocket(pendingEndpoint);
    } catch (error: any) { setPairError(error?.message || 'Secure pairing confirmation failed.'); }
    finally { setIsConnecting(false); }
  };

  const rejectVerificationPhrase = async () => {
    if (pendingEndpoint && pendingTranscript) await rejectSecurePairing(pendingEndpoint, pendingTranscript);
    setPendingTranscript(null); setPairError('Pairing was cancelled. Generate a new code when ready.');
  };

  const prepareDirectIp = async () => {
    const host = normalizeDesktopAddress(desktopIp);
    if (!host) { setPairError('Enter the Desktop address shown in Orion Desktop.'); return; }
    setIsConnecting(true);
    const probe = await inspectSmartConnectEndpoint(host, desktopPort, SMART_CONNECT_PROTOCOL_VERSION, 'direct-ip');
    setIsConnecting(false);
    if (!probe.ok) { setPairError('No compatible Orion Desktop responded at this address.'); return; }
    setDesktopIp(probe.result.host); setDesktopPort(probe.result.port); setPairingMethod('pin'); setPinCode('');
    setPairError(`Desktop found. Enter the six-digit code shown on ${probe.result.displayName}.`);
  };

  const chooseDiscoveredDesktop = (desktop: SmartConnectDiscoveryResult) => {
    setDesktopIp(desktop.host); setDesktopPort(desktop.port); setDiscoveredDesktops([]);
    setPairError(`Desktop found. Enter the six-digit pairing code for ${desktop.displayName}.`);
  };

  const runSubnetFallback = async () => {
    setIsDiscovering(true); setPairError('Scanning the local network by requestâ€¦');
    const results = await scanSmartConnectSubnet(SMART_CONNECT_PROTOCOL_VERSION).catch(() => []);
    setDiscoveredDesktops(results); setIsDiscovering(false);
    setPairError(results.length ? 'Choose the Orion Desktop you want to pair.' : 'No compatible Orion Desktop was found on this subnet.');
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (hasScanned || isConnecting) return; setHasScanned(true);
    const parsed = parsePairingPayload(data);
    if (parsed.ip) {
      setDesktopIp(parsed.ip);
      if (parsed.port) setDesktopPort(parsed.port);
      if (parsed.pin) setPinCode(parsed.pin);
      setQrNotice('');
      void handleConnect(parsed.ip, parsed.pin || pinCode, parsed.port || desktopPort, 'qr', parsed.fingerprint || undefined);
    } else {
      setQrNotice('This QR code is not a valid Orion Connect code.');
    }
    setTimeout(() => setHasScanned(false), 3000);
  };

  const handlePinChange = (value: string) => setPinCode(value.replace(/\D/g, '').slice(0, 6));

  const FIRE_AND_FORGET_ACTIONS = new Set(['cursor_move', 'scroll']);

  const sendFireAndForget = (action: string, value?: any) => {
    if (!isConnected || !connectionRef.current.connected) return;
    const sequence = ++sequenceRef.current;
    const command = createRemoteCommand(action, value, deviceId, sequence);
    sendRealtimeSecureEnvelope({ version: SMART_CONNECT_PROTOCOL_VERSION, type: 'command', deviceId, connectionId: connectionRef.current.connectionId, sequence, commandId: command.id, payload: command });
  };
  fireAndForgetRef.current = sendFireAndForget;

  const sendRemoteCommand = async (action: string, value?: any) => {
    if (!isConnected || !connectionRef.current.connected) return { ok: false, error: 'Desktop is not live.' };
    if (FIRE_AND_FORGET_ACTIONS.has(action)) {
      sendFireAndForget(action, value);
      return { ok: true };
    }
    const sequence = ++sequenceRef.current;
    const command = createRemoteCommand(action, value, deviceId, sequence);
    markSent(command.id);
    const sent = await sendSecureEnvelope({ version: SMART_CONNECT_PROTOCOL_VERSION, type: 'command', deviceId, connectionId: connectionRef.current.connectionId, sequence, commandId: command.id, payload: command }).catch(() => false);
    if (!sent) return { ok: false, error: 'Secure Desktop connection is unavailable.' };
    const ack = await new Promise<any>((resolve) => {
      const timer = setTimeout(() => { pendingAcks.current.delete(command.id); resolve({ ok: false, error: 'Desktop acknowledgement timed out.' }); }, 2200);
      pendingAcks.current.set(command.id, { resolve, timer });
    });
    if (ack?.ok) { setRemoteError(''); if (ack.authoritativeTelemetry) ingestTelemetry(ack.authoritativeTelemetry); if (action === 'cursor_move' && ack.pointer) cursorRef.current = { xRatio: ack.pointer.x, yRatio: ack.pointer.y }; }
    else setRemoteError(ack?.error || 'Desktop did not acknowledge the command.');
    return ack;
  };
  sendCommandRef.current = sendRemoteCommand;

  const renameThisDevice = async (name: string) => {
    const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'Orion Mobile';
    setDeviceName(clean); await SecureStore.setItemAsync('orion_connect_device_name', clean).catch(() => {});
    return isConnected ? sendRemoteCommand('smart_connect_rename', clean) : { ok: true };
  };

  const handleDisconnect = async () => {
    disconnectingRef.current = true;
    if (isConnected) await sendRemoteCommand('smart_connect_unpair');
    setIsConnected(false); setShowDisconnectModal(false); setPinCode(''); setConnectionState('idle');
    connectionRef.current.endpoint = null; await closeTransport();
    mmkvStorageAdapter.set('orion_smart_connect_trusted_endpoint_v1', 'null');
    mmkvStorageAdapter.set('orion_pair_status', JSON.stringify({ paired: false, time: Date.now() }));
  };

  const useNativeDriver = Platform.OS !== 'web';
  useEffect(() => { const loop = Animated.loop(Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.12, duration: 1200, useNativeDriver }), Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver })])); loop.start(); return () => loop.stop(); }, []);
  useEffect(() => { if (!showPairingModal || pairingMethod !== 'qr') return; const loop = Animated.loop(Animated.sequence([Animated.timing(scanLineAnim, { toValue: 140, duration: 1400, useNativeDriver }), Animated.timing(scanLineAnim, { toValue: 0, duration: 1400, useNativeDriver })])); loop.start(); return () => loop.stop(); }, [showPairingModal, pairingMethod]);

  return {
    activeTab, cameraPermission, currentSpeedIndex, desktopIp, formatTime: formatConnectTime,
    handleBarCodeScanned, handleConnect, handleDisconnect, handlePinChange, hiddenPinInputRef,
    isConnected, isConnecting, isDiscovering, isMuted, isPlaying, navFocusMode, nowPlaying,
    pageShortcutItems: [
      { id: 'home', label: 'Home', icon: 'home-outline' }, { id: 'search', label: 'Search', icon: 'search-outline' },
      { id: 'discover', label: 'Discover', icon: 'compass-outline' }, { id: 'constellation', label: 'Constellation', icon: 'planet-outline' },
      { id: 'library', label: 'Library', icon: 'library-outline' }, { id: 'downloads', label: 'Downloads', icon: 'download-outline' },
      { id: 'music-home', label: 'Music', icon: 'musical-notes-outline' }, { id: 'settings', label: 'Settings', icon: 'settings-outline' },
    ],
    pairError, pairingMethod, panResponder, pinCode, pulseAnim, qrNotice, remoteError, remoteText,
    requestCameraPermission, scanLineAnim, searchTarget, sendRemoteCommand, setActiveTab,
    setCurrentSpeedIndex, setQrNotice, setDesktopIp, setNavFocusMode, setPairingMethod, setPinCode,
    setRemoteText, setSearchTarget, setShowDisconnectModal, setShowPairingModal, showDisconnectModal,
    showPairingModal, speeds: ['1.0x', '1.25x', '1.5x', '2.0x'], volume, connectionState,
    discoveredDesktops, chooseDiscoveredDesktop, discoverDesktop, runSubnetFallback, deviceName,
    renameThisDevice, desktopPort, lockoutSeconds, attemptsRemaining, prepareDirectIp, remoteContext,
    telemetry, latency, isScrubbing, setIsScrubbing, pendingTranscript,
    confirmVerificationPhrase, rejectVerificationPhrase,
    onTouchpadLayout, pointerMode, setPointerMode,
  };
}

export type ConnectController = ReturnType<typeof useConnectController>;

```

----------------------------------------
## FILE: apps/mobile/src/features/connect/secureConnectClient.ts
----------------------------------------

```
import {
  closeSecureSmartConnectSocket,
  getSecureDeviceIdentity,
  openSecureSmartConnectSocket,
  secureSmartConnectRequest,
  sendRealtimeSmartConnectSocket,
  sendSecureSmartConnectSocket,
  signSecureValue,
  subscribeSecureSmartConnect,
  verifySecureValue,
} from '../../services/nativeSecureConnect';

export interface SecureEndpoint {
  host: string;
  port: number;
  fingerprint: string;
  instanceId?: string;
}

export interface PairingTranscript {
  pairingId: string;
  desktopInstanceId: string;
  deviceId: string;
  deviceName: string;
  certificateFingerprint: string;
  phrase: { words: string[]; expiresAt: number };
}

interface SecureSocketTicket {
  ticketId: string;
  deviceId: string;
  connectionId: string;
  expiresAt: number;
}

interface SecureSocketTicketResponse {
  ok: boolean;
  ticket: SecureSocketTicket;
  connectionId: string;
}

export async function startSecurePairing(endpoint: SecureEndpoint, pin: string, deviceName: string) {
  const identity = await getSecureDeviceIdentity();
  const response = await secureSmartConnectRequest<any>(
    endpoint.host, endpoint.port, endpoint.fingerprint || null, '/api/pair/start', 'POST',
    { pin, deviceId: identity.deviceId, deviceName, publicKey: identity.publicKey },
  );
  if (!response.ok || !response.data?.transcript) throw pairingFailure(response.data, response.status);
  return { identity, transcript: response.data.transcript as PairingTranscript, fingerprint: response.fingerprint };
}

export async function confirmSecurePairing(endpoint: SecureEndpoint, transcript: PairingTranscript) {
  const response = await secureSmartConnectRequest<any>(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/pair/confirm', 'POST',
    { pairingId: transcript.pairingId, deviceId: transcript.deviceId },
  );
  if (!response.ok) throw pairingFailure(response.data, response.status);
  return response.data;
}

export async function rejectSecurePairing(endpoint: SecureEndpoint, transcript: PairingTranscript) {
  await secureSmartConnectRequest(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/pair/reject', 'POST',
    { pairingId: transcript.pairingId, deviceId: transcript.deviceId },
  ).catch(() => null);
}

export async function waitForDesktopConfirmation(endpoint: SecureEndpoint, transcript: PairingTranscript) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = await secureSmartConnectRequest<any>(
      endpoint.host, endpoint.port, endpoint.fingerprint, '/api/pair/result', 'POST',
      { pairingId: transcript.pairingId, deviceId: transcript.deviceId },
    );
    if (result.ok && result.data?.paired) return result.data;
    if (result.status === 410) throw pairingFailure(result.data, result.status);
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw Object.assign(new Error('Desktop confirmation timed out.'), { code: 'PAIRING_TIMEOUT' });
}

export async function authenticateSecureSocket(endpoint: SecureEndpoint, deviceId: string) {
  const challenge = await secureSmartConnectRequest<any>(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/auth/challenge', 'POST', { deviceId },
  );
  if (!challenge.ok) throw pairingFailure(challenge.data, challenge.status);
  const validDesktop = await verifySecureValue(
    String(challenge.data.desktopPublicKey || ''),
    String(challenge.data.nonce || ''),
    String(challenge.data.desktopSignature || ''),
  );
  if (!validDesktop) throw Object.assign(new Error('Desktop identity verification failed.'), { code: 'DESKTOP_IDENTITY_FAILED' });
  const signature = await signSecureValue(String(challenge.data.nonce));
  const ticket = await secureSmartConnectRequest<SecureSocketTicketResponse>(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/auth/ticket', 'POST',
    { deviceId, signature },
  );
  const ticketId = ticket.data?.ticket?.ticketId;
  if (!ticket.ok || typeof ticketId !== 'string' || !ticketId) {
    if (ticket.ok) {
      throw Object.assign(new Error('Desktop returned an invalid secure socket ticket.'), {
        code: 'SECURE_SOCKET_TICKET_INVALID',
      });
    }
    throw pairingFailure(ticket.data, ticket.status);
  }
  await openSecureSmartConnectSocket(endpoint.host, endpoint.port, endpoint.fingerprint, ticketId, deviceId);
  return { connectionId: String(ticket.data.connectionId || '') };
}

export const sendSecureEnvelope = (payload: unknown) => sendSecureSmartConnectSocket(JSON.stringify(payload));
export const sendRealtimeSecureEnvelope = (payload: unknown) => sendRealtimeSmartConnectSocket(JSON.stringify(payload));
export { closeSecureSmartConnectSocket, subscribeSecureSmartConnect };

function pairingFailure(data: any, status: number) {
  const detail = data?.error || data || {};
  return Object.assign(new Error(String(detail.message || 'Secure Smart Connect request failed.')), {
    code: String(detail.code || `HTTP_${status}`),
    attemptsRemaining: Number.isFinite(Number(detail.attemptsRemaining)) ? Number(detail.attemptsRemaining) : null,
    retryAfterMs: Number.isFinite(Number(detail.retryAfterMs)) ? Number(detail.retryAfterMs) : null,
  });
}

```

----------------------------------------
## FILE: apps/mobile/src/services/nativeSecureConnect.ts
----------------------------------------

```
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export interface SecureDeviceIdentity { deviceId: string; publicKey: string; algorithm: string }
export interface SecureResponse { status: number; body: string; fingerprint: string }

const module = NativeModules.OrionSecureConnect as undefined | {
  getIdentity(): Promise<SecureDeviceIdentity>;
  sign(value: string): Promise<string>;
  verify(publicKey: string, value: string, signature: string): Promise<boolean>;
  request(host: string, port: number, fingerprint: string | null, path: string, method: string, body: string | null): Promise<SecureResponse>;
  openSocket(host: string, port: number, fingerprint: string, ticket: string, deviceId: string): Promise<boolean>;
  sendSocket(payload: string): Promise<boolean>;
  sendRealtimeSocket?(payload: string): Promise<boolean>;
  sendRealtimeSocketFireAndForget?(payload: string): void;
  closeSocket(): Promise<void>;
  addListener(name: string): void;
  removeListeners(count: number): void;
};

function requireModule() {
  if (Platform.OS !== 'android' || !module) throw new Error('SECURE_SMART_CONNECT_UNAVAILABLE');
  return module;
}

export const getSecureDeviceIdentity = () => requireModule().getIdentity();
export const signSecureValue = (value: string) => requireModule().sign(value);
export const verifySecureValue = (publicKey: string, value: string, signature: string) =>
  requireModule().verify(publicKey, value, signature);

export async function secureSmartConnectRequest<T>(
  host: string,
  port: number,
  fingerprint: string | null,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T; fingerprint: string }> {
  const response = await requireModule().request(
    host, port, fingerprint, path, method, body === undefined ? null : JSON.stringify(body),
  );
  let data: T;
  try { data = JSON.parse(response.body || '{}') as T; } catch { data = {} as T; }
  return { ok: response.status >= 200 && response.status < 300, status: response.status, data, fingerprint: response.fingerprint };
}

export const openSecureSmartConnectSocket = (
  host: string, port: number, fingerprint: string, ticket: string, deviceId: string,
) => requireModule().openSocket(host, port, fingerprint, ticket, deviceId);
export const sendSecureSmartConnectSocket = (payload: string) => requireModule().sendSocket(payload);
export const sendRealtimeSmartConnectSocket = (payload: string) => {
  const mod = requireModule();
  if (mod.sendRealtimeSocketFireAndForget) {
    mod.sendRealtimeSocketFireAndForget(payload);
  } else if (mod.sendRealtimeSocket) {
    void mod.sendRealtimeSocket(payload);
  } else {
    void mod.sendSocket(payload);
  }
};
export const closeSecureSmartConnectSocket = () => module?.closeSocket() ?? Promise.resolve();

export function subscribeSecureSmartConnect(
  handlers: { onMessage(data: string): void; onClose(): void; onFailure(message: string): void },
) {
  if (!module) return () => {};
  const emitter = new NativeEventEmitter(module as any);
  const subscriptions = [
    emitter.addListener('orionSmartConnectMessage', (event) => handlers.onMessage(String(event?.data || ''))),
    emitter.addListener('orionSmartConnectClosed', handlers.onClose),
    emitter.addListener('orionSmartConnectFailure', (event) => handlers.onFailure(String(event?.message || 'Secure connection failed.'))),
  ];
  return () => subscriptions.forEach((subscription) => subscription.remove());
}

```

----------------------------------------
## FILE: apps/mobile/plugins/orion-nsd-native/OrionSecureConnectModule.kt
----------------------------------------

```
package com.okali.orion.smartconnect

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import okio.ByteString
import org.json.JSONObject
import java.net.InetAddress
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.KeyFactory
import java.security.spec.X509EncodedKeySpec
import java.security.cert.X509Certificate
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

/** Pinned HTTPS/WSS and Android-Keystore identity for Smart Connect v3. */
class OrionSecureConnectModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val preferences = context.getSharedPreferences("orion_smart_connect_v3", Context.MODE_PRIVATE)
  private var socket: WebSocket? = null
  private var socketFingerprint: String? = null
  private val alias = "orion_smart_connect_device_v3"

  override fun getName() = "OrionSecureConnect"

  @ReactMethod
  fun getIdentity(promise: Promise) {
    try {
      val pair = keyPair()
      var deviceId = preferences.getString("device_id", null)
      if (deviceId.isNullOrBlank()) {
        deviceId = "mobile-${UUID.randomUUID()}"
        preferences.edit().putString("device_id", deviceId).apply()
      }
      val result = Arguments.createMap()
      result.putString("deviceId", deviceId)
      result.putString("publicKey", Base64.encodeToString(pair.public.encoded, Base64.NO_WRAP))
      result.putString("algorithm", "ECDSA_P256_SHA256")
      promise.resolve(result)
    } catch (error: Exception) { promise.reject("IDENTITY_FAILED", error) }
  }

  @ReactMethod
  fun sign(value: String, promise: Promise) {
    try {
      val signature = Signature.getInstance("SHA256withECDSA")
      signature.initSign(keyPair().private)
      signature.update(value.toByteArray(Charsets.UTF_8))
      promise.resolve(Base64.encodeToString(signature.sign(), Base64.NO_WRAP))
    } catch (error: Exception) { promise.reject("SIGNING_FAILED", error) }
  }

  @ReactMethod
  fun verify(publicKey: String, value: String, signatureValue: String, promise: Promise) {
    try {
      val key = KeyFactory.getInstance("EC").generatePublic(
        X509EncodedKeySpec(Base64.decode(publicKey, Base64.DEFAULT))
      )
      val verifier = Signature.getInstance("SHA256withECDSA")
      verifier.initVerify(key)
      verifier.update(value.toByteArray(Charsets.UTF_8))
      promise.resolve(verifier.verify(Base64.decode(signatureValue, Base64.DEFAULT)))
    } catch (error: Exception) { promise.reject("VERIFY_FAILED", error) }
  }

  @ReactMethod
  fun request(host: String, port: Double, fingerprint: String?, path: String, method: String, body: String?, promise: Promise) {
    if (!privateHost(host)) { promise.reject("PUBLIC_ADDRESS_REJECTED", "Smart Connect requires a private LAN address."); return }
    val client = try { pinnedClient(fingerprint) } catch (error: Exception) { promise.reject("TLS_SETUP_FAILED", error); return }
    val url = "https://${host}:${port.toInt()}${if (path.startsWith('/')) path else "/$path"}"
    val media = "application/json; charset=utf-8".toMediaTypeOrNull()
    val requestBody = if (method.uppercase() == "GET") null else (body ?: "{}").toRequestBody(media)
    val request = Request.Builder().url(url).method(method.uppercase(), requestBody).build()
    client.newCall(request).enqueue(object : Callback {
      override fun onFailure(call: Call, error: java.io.IOException) { promise.reject("SECURE_REQUEST_FAILED", error) }
      override fun onResponse(call: Call, response: Response) {
        response.use {
          val map = Arguments.createMap()
          map.putInt("status", response.code)
          map.putString("body", response.body?.string() ?: "{}")
          map.putString("fingerprint", certificateFingerprint(response.handshake?.peerCertificates?.firstOrNull() as? X509Certificate))
          promise.resolve(map)
        }
      }
    })
  }

  @ReactMethod
  fun openSocket(host: String, port: Double, fingerprint: String, ticket: String, deviceId: String, promise: Promise) {
    if (!privateHost(host)) { promise.reject("PUBLIC_ADDRESS_REJECTED", "Smart Connect requires a private LAN address."); return }
    closeSocketInternal()
    socketFingerprint = normalizeFingerprint(fingerprint)
    val request = Request.Builder()
      .url("wss://${host}:${port.toInt()}/api/socket")
      .header("X-Orion-Ticket", ticket)
      .header("X-Orion-Device", deviceId)
      .build()
    socket = pinnedClient(fingerprint).newWebSocket(request, object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        emit("orionSmartConnectOpen", Arguments.createMap().apply { putBoolean("open", true) })
        promise.resolve(true)
      }
      override fun onMessage(webSocket: WebSocket, text: String) {
        emit("orionSmartConnectMessage", Arguments.createMap().apply { putString("data", text) })
      }
      override fun onMessage(webSocket: WebSocket, bytes: ByteString) = onMessage(webSocket, bytes.utf8())
      override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, reason) }
      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        socket = null
        emit("orionSmartConnectClosed", Arguments.createMap().apply { putInt("code", code); putString("reason", reason) })
      }
      override fun onFailure(webSocket: WebSocket, error: Throwable, response: Response?) {
        socket = null
        emit("orionSmartConnectFailure", Arguments.createMap().apply { putString("code", "WSS_FAILED"); putString("message", error.message ?: "Secure socket failed") })
        if (response == null) promise.reject("WSS_FAILED", error)
      }
    })
  }

  @ReactMethod fun sendSocket(payload: String, promise: Promise) { promise.resolve(socket?.send(payload) == true) }
  @ReactMethod fun sendRealtimeSocket(payload: String, promise: Promise) { promise.resolve(socket?.send(payload) == true) }
  @ReactMethod fun sendRealtimeSocketFireAndForget(payload: String) { socket?.send(payload) }
  @ReactMethod fun closeSocket(promise: Promise) { closeSocketInternal(); promise.resolve(null) }
  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Double) = Unit

  private fun closeSocketInternal() { socket?.close(1000, "Client closed"); socket = null }

  private fun keyPair(): java.security.KeyPair {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val privateKey = store.getKey(alias, null) as? java.security.PrivateKey
    val publicKey = store.getCertificate(alias)?.publicKey
    if (privateKey != null && publicKey != null) return java.security.KeyPair(publicKey, privateKey)
    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
    generator.initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
      .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
      .setDigests(KeyProperties.DIGEST_SHA256).build())
    return generator.generateKeyPair()
  }

  private fun pinnedClient(fingerprint: String?): OkHttpClient {
    val expected = normalizeFingerprint(fingerprint)
    val trust = object : X509TrustManager {
      override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
      override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit
      override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
        if (chain.isEmpty()) throw java.security.cert.CertificateException("Missing Desktop certificate")
        val observed = certificateFingerprint(chain[0])
        if (expected.isNotEmpty() && observed != expected) throw java.security.cert.CertificateException("Desktop certificate changed")
      }
    }
    val ssl = SSLContext.getInstance("TLS").apply { init(null, arrayOf<TrustManager>(trust), null) }
    return OkHttpClient.Builder()
      .sslSocketFactory(ssl.socketFactory, trust)
      .hostnameVerifier { _, session ->
        val certificate = session.peerCertificates.firstOrNull() as? X509Certificate
        expected.isEmpty() || certificateFingerprint(certificate) == expected
      }
      .connectTimeout(3, TimeUnit.SECONDS).readTimeout(5, TimeUnit.SECONDS).build()
  }

  private fun privateHost(host: String): Boolean = try {
    val address = InetAddress.getByName(host).address
    (address.size == 4 && ((address[0].toInt() and 255) == 10
      || ((address[0].toInt() and 255) == 172 && (address[1].toInt() and 255) in 16..31)
      || ((address[0].toInt() and 255) == 192 && (address[1].toInt() and 255) == 168)))
  } catch (_: Exception) { false }

  private fun normalizeFingerprint(value: String?): String = value.orEmpty().lowercase().replace(Regex("[^0-9a-f]"), "")
  private fun certificateFingerprint(certificate: X509Certificate?): String = certificate?.let {
    MessageDigest.getInstance("SHA-256").digest(it.encoded).joinToString("") { byte -> "%02x".format(byte) }
  } ?: ""
  private fun emit(name: String, payload: Any) {
    if (context.hasActiveReactInstance()) context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, payload)
  }
}

```

----------------------------------------
## FILE: apps/desktop/src/main/ipc/smartConnectIpc.js
----------------------------------------

```
// Orion Smart Connect v3 - encrypted, device-bound local remote-control transport.
const https = require("https");
const os = require("os");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app, ipcMain, safeStorage } = require("electron");
const { WebSocketServer } = require("ws");
const QRCode = require("qrcode");
const { Bonjour } = require("bonjour-service");
const { SMART_CONNECT_PROTOCOL_VERSION, normalizeSmartConnectCommand, normalizePlaybackTelemetry } = require("../../../../../packages/shared/src/smartConnectProtocol.cjs");
const { loadOrCreateSecureIdentity, signChallenge, verifyDeviceSignature } = require("../smartConnect/secureIdentity");
const { createTrustState, eligibleLanAddresses, privateAddress } = require("../smartConnect/secureTrust");

const PORT = 8924;
const PROTOCOL_VERSION = SMART_CONNECT_PROTOCOL_VERSION;
const PIN_TTL_MS = 5 * 60 * 1000;
const TOKEN_IDLE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 1800;
const MAX_PAIR_ATTEMPTS = 5;
// Failed attempts live for the displayed code's lifetime. Reopening either
// Connect surface must not silently restore all five attempts.
const ATTEMPT_WINDOW_MS = PIN_TTL_MS;
const LOCKOUT_MS = 2 * 60 * 1000;
const ALLOWED_REMOTE_ORIGIN = "orion://mobile";
const COMMAND_RATE_WINDOW_MS = 1000;

let server = null;
let socketServer = null;
let currentPin = "";
let pinExpiresAt = 0;
let getMainWindowRef = null;
let currentPlayback = null;
let currentContext = null;
let telemetrySequence = 0;
let pairAttempts = [];
let lockedUntil = 0;
let bonjour = null;
let advertisedService = null;
const pairedSessions = new Map();
const pendingCommands = new Map();
const connectedSockets = new Map();
const secureTrust = createTrustState();
const authChallenges = new Map();
let secureIdentity = null;

let activePairingId = null;
function completeSecurePairing(transcript) {
  if (!transcript?.desktopConfirmed || !transcript?.mobileConfirmed) return null;
  const session = {
    deviceId: transcript.deviceId,
    deviceName: sanitizeDeviceName(transcript.deviceName),
    publicKey: transcript.publicKey,
    protocolVersion: 3,
    certificateFingerprint: transcript.certificateFingerprint,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    rePairRequired: false,
  };
  for (const [key, saved] of pairedSessions) {
    if (saved.deviceId === session.deviceId) pairedSessions.delete(key);
  }
  pairedSessions.set(`v3:${session.deviceId}`, session);
  pairAttempts = [];
  lockedUntil = 0;
  savePairingGuard();
  saveSessions();
  activePairingId = null;
  createPin();
  notifyConnectionStatus();
  return session;
}
function socketIsOpen(socket) {
  return Boolean(socket && socket.readyState === 1);
}

function originAllowed(req) {
  return !req.headers.origin || req.headers.origin === ALLOWED_REMOTE_ORIGIN;
}
function acceptCommandRate(socket, droppable, action) {
  const now = Date.now();
  const policy = secureTrust.networkPolicy();
  const isRealtime = action === "cursor_move";

  if (isRealtime) {
    if (!socket.realtimeRateWindowAt || now - socket.realtimeRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
      socket.realtimeRateWindowAt = now; socket.realtimeRateCount = 0;
    }
    socket.realtimeRateCount += 1;
    const maxRealtime = Number(policy.realtimeCommandRatePerSecond || policy.commandRatePerSecond || 120);
    return socket.realtimeRateCount <= maxRealtime
      ? { ok: true }
      : { ok: false, droppable: true, reason: "REALTIME_RATE_LIMITED" };
  }

  if (!socket.reliableRateWindowAt || now - socket.reliableRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
    socket.reliableRateWindowAt = now; socket.reliableRateCount = 0;
  }
  socket.reliableRateCount += 1;
  const maxReliable = Number(policy.reliableCommandRatePerSecond || 60);
  return socket.reliableRateCount <= maxReliable
    ? { ok: true }
    : { ok: false, droppable: Boolean(droppable), reason: "COMMAND_RATE_LIMITED" };
}

function publicDevices() {
  return [...pairedSessions.values()].map(({ deviceId, deviceName, device, createdAt, lastSeenAt, rePairRequired }) => ({
    deviceId,
    deviceName: sanitizeDeviceName(deviceName || device),
    createdAt: Number(createdAt || lastSeenAt || Date.now()),
    lastSeenAt,
    rePairRequired: Boolean(rePairRequired),
    connected: socketIsOpen(connectedSockets.get(deviceId)),
  }));
}

function sanitizeDeviceName(value) {
  return String(value || "Orion Mobile").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) || "Orion Mobile";
}

function instanceIdFile() {
  return path.join(app.getPath("userData"), "smart-connect-instance-id");
}

function getDesktopInstanceId() {
  try {
    const file = instanceIdFile();
    if (fs.existsSync(file)) {
      const value = fs.readFileSync(file, "utf8").trim();
      if (/^[a-f0-9-]{16,64}$/i.test(value)) return value;
    }
    const value = crypto.randomUUID();
    fs.writeFileSync(file, value, { encoding: "utf8", mode: 0o600 });
    return value;
  } catch {
    return crypto.createHash("sha256").update(`${app.getPath("userData")}:${os.hostname()}`).digest("hex").slice(0, 32);
  }
}

let desktopInstanceId = "";

function ensureDesktopInstanceId() {
  if (!desktopInstanceId) desktopInstanceId = getDesktopInstanceId();
  return desktopInstanceId;
}

function pairingError(res, status, code, message, retryAfterMs, attemptsRemaining) {
  return json(res, status, {
    ok: false,
    error: {
      code,
      message,
      ...(Number.isFinite(retryAfterMs) ? { retryAfterMs } : {}),
      ...(Number.isFinite(attemptsRemaining) ? { attemptsRemaining } : {}),
    },
  });
}

function startServiceAdvertisement() {
  if (bonjour || advertisedService) return;
  try {
    bonjour = new Bonjour({}, (error) => {
      console.warn("[SmartConnect] NSD advertisement warning:", error?.message || error);
    });
    advertisedService = bonjour.publish({
      name: `Orion Desktop (${os.hostname()})`,
      type: "orion-connect",
      protocol: "tcp",
      port: PORT,
      txt: {
        app: "orion",
        version: String(PROTOCOL_VERSION),
        instanceId: ensureDesktopInstanceId(),
        fingerprint: secureIdentity?.certificateFingerprint || "",
      },
    });
  } catch (error) {
    console.warn("[SmartConnect] Could not advertise NSD service:", error.message);
  }
}

function stopServiceAdvertisement() {
  try { advertisedService?.stop?.(); } catch {}
  try { bonjour?.destroy?.(); } catch {}
  advertisedService = null;
  bonjour = null;
}

function createPin() {
  currentPin = crypto.randomInt(100000, 1000000).toString();
  pinExpiresAt = Date.now() + PIN_TTL_MS;
  return currentPin;
}

function ensureFreshPin() {
  if (!currentPin || Date.now() >= pinExpiresAt) createPin();
}

function tokenFile() {
  return path.join(app.getPath("userData"), "smart-connect-sessions.bin");
}

function pairingGuardFile() {
  return path.join(app.getPath("userData"), "smart-connect-pairing-guard.json");
}

function normalizePairingGuard(now = Date.now()) {
  pairAttempts = pairAttempts
    .map(Number)
    .filter((time) => Number.isFinite(time) && now - time < ATTEMPT_WINDOW_MS);
  if (!Number.isFinite(lockedUntil) || lockedUntil <= now) lockedUntil = 0;
}

function pairingGuardSnapshot(now = Date.now()) {
  normalizePairingGuard(now);
  return {
    attemptsRemaining: now < lockedUntil ? 0 : Math.max(0, MAX_PAIR_ATTEMPTS - pairAttempts.length),
    retryAfterMs: now < lockedUntil ? lockedUntil - now : 0,
    lockedUntil: now < lockedUntil ? lockedUntil : 0,
  };
}

function savePairingGuard() {
  try {
    normalizePairingGuard();
    fs.writeFileSync(pairingGuardFile(), JSON.stringify({ pairAttempts, lockedUntil }), {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch (error) {
    console.warn("[SmartConnect] Could not persist pairing guard:", error.message);
  }
}

function loadPairingGuard() {
  try {
    const file = pairingGuardFile();
    if (!fs.existsSync(file)) return;
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    pairAttempts = Array.isArray(saved.pairAttempts) ? saved.pairAttempts : [];
    lockedUntil = Number(saved.lockedUntil || 0);
    normalizePairingGuard();
  } catch (error) {
    pairAttempts = [];
    lockedUntil = 0;
    console.warn("[SmartConnect] Ignoring unreadable pairing guard:", error.message);
  }
}

function saveSessions() {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn("[SmartConnect] Secure storage is unavailable; paired devices will remain session-only.");
      return;
    }
    const data = JSON.stringify([...pairedSessions.entries()]);
    const payload = safeStorage.encryptString(data);
    fs.writeFileSync(tokenFile(), payload);
  } catch (error) {
    console.warn("[SmartConnect] Could not persist paired devices:", error.message);
  }
}

function loadSessions() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return;
    const file = tokenFile();
    if (!fs.existsSync(file)) return;
    const payload = fs.readFileSync(file);
    const decoded = safeStorage.decryptString(payload);
    const entries = JSON.parse(decoded);
    for (const [credentialId, session] of Array.isArray(entries) ? entries : []) {
      if (credentialId && session?.deviceId && Date.now() - Number(session.lastSeenAt || 0) < TOKEN_IDLE_TTL_MS) {
        pairedSessions.set(credentialId, {
          ...session,
          deviceName: sanitizeDeviceName(session.deviceName || session.device),
          createdAt: Number(session.createdAt || session.lastSeenAt || Date.now()),
          rePairRequired: session.protocolVersion !== 3 || !session.publicKey,
        });
      }
    }
  } catch (error) {
    console.warn("[SmartConnect] Ignoring unreadable pairing store:", error.message);
  }
}

function getAllLocalIpAddresses() {
  const addresses = [];
  for (const [name, networks] of Object.entries(os.networkInterfaces())) {
    for (const network of networks || []) {
      if (network.family === "IPv4" && !network.internal) {
        addresses.push({ name: name.toLowerCase(), address: network.address });
      }
    }
  }
  const isLan = (address) => /^192\.168\./.test(address) || /^10\./.test(address)
    || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(address);
  return addresses
    .sort((a, b) => Number(isLan(b.address)) - Number(isLan(a.address)))
    .map((entry) => entry.address);
}

function getLocalIpAddress() { return getAllLocalIpAddresses()[0] || "127.0.0.1"; }
function notifyDesktopRenderer(event, data) {
  const win = getMainWindowRef?.(); if (win && !win.isDestroyed()) win.webContents.send(event, data);
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function secureSession(deviceId) {
  const session = pairedSessions.get(`v3:${String(deviceId || "")}`);
  return !session || session.rePairRequired || session.revokedAt ? null : session;
}

function requireSecureRequest(req, body = {}) {
  const deviceId = String(req.headers["x-orion-device"] || body.deviceId || "");
  const signature = String(req.headers["x-orion-signature"] || body.signature || "");
  const timestamp = Number(req.headers["x-orion-timestamp"] || body.timestamp || 0);
  const session = secureSession(deviceId);
  if (!session || !signature || Math.abs(Date.now() - timestamp) > 30_000) return null;
  const message = `${req.method}\n${req.url}\n${timestamp}`;
  return verifyDeviceSignature(session.publicKey, message, signature) ? session : null;
}

function normalizeCommand(input = {}) { return normalizeSmartConnectCommand(input, () => crypto.randomUUID()); }

function dispatchCommand(command) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(command.id);
      resolve({
        id: command.id,
        sequence: command.sequence,
        ok: false,
        appliedAt: Date.now(),
        error: "Desktop did not acknowledge the command in time.",
      });
    }, COMMAND_TIMEOUT_MS);
    pendingCommands.set(command.id, { resolve, timer });
    notifyDesktopRenderer("orion:remote-command", command);
  });
}

function sendSocket(socket, type, deviceId, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.outgoingSequence = Number(socket.outgoingSequence || 0) + 1;
    socket.send(JSON.stringify({
      version: PROTOCOL_VERSION,
      type,
      deviceId,
      connectionId: socket.smartConnectConnectionId,
      sequence: socket.outgoingSequence,
      payload,
    }));
  }
}

function configureSockets() {
  socketServer = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    let parsed;
    try { parsed = new URL(req.url, `https://${req.headers.host || "localhost"}`); } catch { socket.destroy(); return; }
    if (parsed.pathname !== "/api/socket") { socket.destroy(); return; }
    const policy = secureTrust.networkPolicy();
    if (!policy.allowed || !originAllowed(req) || !privateAddress(req.socket.remoteAddress)) { socket.destroy(); return; }
    const ticket = secureTrust.consumeTicket(req.headers["x-orion-ticket"]);
    const session = ticket ? secureSession(ticket.deviceId) : null;
    const replacingExistingDevice = Boolean(session && connectedSockets.has(session.deviceId));
    if (!session || (!replacingExistingDevice && connectedSockets.size >= policy.maxConnections)) { socket.destroy(); return; }
    socketServer.handleUpgrade(req, socket, head, (ws) => {
      ws.smartConnectSession = session;
      ws.smartConnectConnectionId = ticket.connectionId;
      socketServer.emit("connection", ws);
    });
  });

  socketServer.on("connection", (socket) => {
    const session = socket.smartConnectSession;
    socket.lastSmartConnectHeartbeat = Date.now();
    const previousSocket = connectedSockets.get(session.deviceId);
    if (previousSocket && previousSocket !== socket) previousSocket.close();
    connectedSockets.set(session.deviceId, socket);
    session.lastSeenAt = Date.now();
    sendSocket(socket, "status", session.deviceId, { connected: true });
    if (currentContext) sendSocket(socket, "context", session.deviceId, currentContext);
    if (currentPlayback) sendSocket(socket, "telemetry", session.deviceId, currentPlayback);
    notifyConnectionStatus();
    socket.on("message", async (raw) => {
      try {
        socket.lastSmartConnectHeartbeat = Date.now();
        const envelope = JSON.parse(String(raw));
        if (envelope.version !== PROTOCOL_VERSION || envelope.deviceId !== session.deviceId) throw new Error("Unsupported Smart Connect envelope.");
        if (envelope.connectionId !== socket.smartConnectConnectionId) throw new Error("Connection identity mismatch.");
        if (envelope.type === "heartbeat") {
          session.lastSeenAt = Date.now();
          socket.lastSmartConnectHeartbeat = Date.now();
          sendSocket(socket, "heartbeat", session.deviceId, { at: Date.now() });
          return;
        }
        if (envelope.type !== "command") return;
        const action = envelope.payload?.action;
        const droppable = action === "cursor_move";
        const rate = acceptCommandRate(socket, droppable, action);
        if (!rate.ok) {
          if (!rate.droppable) sendSocket(socket, "error", session.deviceId, { error: rate.reason, commandId: String(envelope.commandId || envelope.payload?.id || "") });
          return;
        }
        const replay = secureTrust.acceptEnvelope(
          session.deviceId,
          socket.smartConnectConnectionId,
          Number(envelope.sequence),
          String(envelope.commandId || envelope.payload?.id || ""),
          droppable,
        );
        if (!replay.ok) {
          if (!replay.droppable) sendSocket(socket, "error", session.deviceId, { error: "Replay or duplicate command rejected.", commandId: String(envelope.commandId || envelope.payload?.id || "") });
          return;
        }
        if (envelope.payload?.action === "smart_connect_rename") {
          session.deviceName = sanitizeDeviceName(envelope.payload?.value);
          saveSessions();
          notifyConnectionStatus();
          sendSocket(socket, "ack", session.deviceId, {
            id: envelope.payload?.id, sequence: envelope.payload?.sequence, ok: true, appliedAt: Date.now(),
          });
          return;
        }
        if (envelope.payload?.action === "smart_connect_unpair") {
          pairedSessions.delete(`v3:${session.deviceId}`);
          saveSessions();
          sendSocket(socket, "ack", session.deviceId, {
            id: envelope.payload?.id, sequence: envelope.payload?.sequence, ok: true, appliedAt: Date.now(),
          });
          setTimeout(() => socket.close(), 30);
          notifyConnectionStatus();
          return;
        }
        if (action === 'cursor_move' || action === 'scroll') {
          const command = normalizeCommand(envelope.payload);
          notifyDesktopRenderer("orion:remote-command", command);
          return;
        }
        const command = normalizeCommand(envelope.payload);
        const ack = await dispatchCommand(command);
        sendSocket(socket, "ack", session.deviceId, ack);
      } catch (error) {
        sendSocket(socket, "error", session.deviceId, { error: error.message, commandId: String(envelope?.commandId || envelope?.payload?.id || "") });
      }
    });
    const watchdog = setInterval(() => {
      if (Date.now() - socket.lastSmartConnectHeartbeat > 45_000) socket.close();
    }, 15_000);
    socket.on("close", () => {
      clearInterval(watchdog);
      if (connectedSockets.get(session.deviceId) === socket) {
        connectedSockets.delete(session.deviceId);
        notifyConnectionStatus();
      }
    });
    socket.on("error", () => {
      clearInterval(watchdog);
      if (connectedSockets.get(session.deviceId) === socket) {
        connectedSockets.delete(session.deviceId);
        notifyConnectionStatus();
      }
    });
  });
}

function notifyConnectionStatus() {
  const devices = publicDevices();
  notifyDesktopRenderer("orion:smart-connect-status", {
    paired: devices.length > 0,
    connected: devices.some((device) => device.connected),
    devices,
    pin: currentPin,
    pinExpiresAt,
    pendingPairing: activePairingId ? secureTrust.transcript(activePairingId) : null,
    networkPolicy: secureTrust.networkPolicy(),
  });
}

async function startSmartConnectServer(getMainWindow) {
  getMainWindowRef = getMainWindow;
  if (server) return;
  ensureDesktopInstanceId();
  ensureFreshPin();
  loadSessions();
  loadPairingGuard();
  secureIdentity = await loadOrCreateSecureIdentity(app.getPath("userData"), desktopInstanceId);

  server = https.createServer({ cert: secureIdentity.certificatePem, key: secureIdentity.privateKeyPem }, async (req, res) => {
    if (!originAllowed(req)) return json(res, 403, { ok: false, error: "ORIGIN_REJECTED" });
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_REMOTE_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Orion-Device, X-Orion-Signature, X-Orion-Timestamp");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    if (!privateAddress(req.socket.remoteAddress)) return json(res, 403, { ok: false, error: "PRIVATE_LAN_REQUIRED" });
    const policy = secureTrust.networkPolicy();
    if (!policy.allowed) return json(res, 403, { ok: false, error: "PUBLIC_NETWORK_BLOCKED", networkPolicy: policy });

    if (req.method === "GET" && url.pathname === "/api/status") {
      const session = requireSecureRequest(req);
      return json(res, 200, session
        ? {
            ok: true,
            version: PROTOCOL_VERSION,
            instanceId: desktopInstanceId,
            displayName: `Orion Desktop (${os.hostname()})`,
            ip: getLocalIpAddress(),
            availableIps: getAllLocalIpAddresses(),
            port: PORT,
            paired: true,
            connected: socketIsOpen(connectedSockets.get(session.deviceId)),
            device: session.deviceName,
            playback: currentPlayback,
            pairingGuard: pairingGuardSnapshot(),
            certificateFingerprint: secureIdentity.certificateFingerprint,
            secureTransport: true,
          }
        : {
            ok: true,
            version: PROTOCOL_VERSION,
            instanceId: desktopInstanceId,
            displayName: `Orion Desktop (${os.hostname()})`,
            ip: getLocalIpAddress(),
            availableIps: getAllLocalIpAddresses(),
            port: PORT,
            paired: false,
            connected: false,
            pairingGuard: pairingGuardSnapshot(),
            certificateFingerprint: secureIdentity.certificateFingerprint,
            secureTransport: true,
            rePairRequired: publicDevices().some((device) => device.rePairRequired),
          });
    }

    if (req.method === "POST" && url.pathname === "/api/pair/start") {
      try {
        const data = await readJson(req);
        const now = Date.now();
        normalizePairingGuard(now);
        if (now < lockedUntil) return pairingError(res, 429, "LOCKED_OUT", "Pairing is temporarily locked.", lockedUntil - now, 0);
        if (!currentPin || now >= pinExpiresAt) {
          ensureFreshPin();
          return pairingError(res, 401, "CODE_EXPIRED", "The pairing code expired.", undefined, pairingGuardSnapshot(now).attemptsRemaining);
        }
        if (String(data.pin || "") !== currentPin) {
          pairAttempts.push(now);
          if (pairAttempts.length >= MAX_PAIR_ATTEMPTS) lockedUntil = now + LOCKOUT_MS;
          savePairingGuard();
          const guard = pairingGuardSnapshot(now);
          return pairingError(res, lockedUntil ? 429 : 401, lockedUntil ? "LOCKED_OUT" : "INVALID_CODE",
            lockedUntil ? "Pairing is temporarily locked." : "The pairing code is invalid.",
            guard.retryAfterMs || undefined, guard.attemptsRemaining);
        }
        if (!data.deviceId || !data.publicKey) return pairingError(res, 400, "INVALID_REQUEST", "A device-bound public identity is required.");
        const transcript = secureTrust.beginTranscript({
          desktopInstanceId,
          deviceId: String(data.deviceId),
          deviceName: sanitizeDeviceName(data.deviceName),
          publicKey: String(data.publicKey),
          fingerprint: secureIdentity.certificateFingerprint,
        });
        activePairingId = transcript.pairingId;
        notifyConnectionStatus();
        return json(res, 200, { ok: true, transcript });
      } catch (error) {
        return pairingError(res, 400, "INVALID_REQUEST", error.message);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/pair/confirm") {
      try {
        const data = await readJson(req);
        const transcript = secureTrust.confirmTranscript(data.pairingId, "mobile");
        if (!transcript || transcript.deviceId !== String(data.deviceId || "")) {
          return pairingError(res, 410, "PAIRING_EXPIRED", "The verification phrase expired.");
        }
        const session = completeSecurePairing(transcript);
        return json(res, 200, {
          ok: true,
          pendingDesktopConfirmation: !session,
          paired: Boolean(session),
          deviceId: transcript.deviceId,
          instanceId: desktopInstanceId,
          certificateFingerprint: secureIdentity.certificateFingerprint,
        });
      } catch (error) {
        return pairingError(res, 400, "INVALID_REQUEST", error.message);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/pair/result") {
      const data = await readJson(req).catch(() => ({}));
      const session = secureSession(data.deviceId);
      if (session) return json(res, 200, {
        ok: true, paired: true, deviceId: session.deviceId,
        instanceId: desktopInstanceId, certificateFingerprint: secureIdentity.certificateFingerprint,
      });
      const transcript = secureTrust.transcript(data.pairingId);
      if (!transcript || transcript.deviceId !== String(data.deviceId || "")) {
        return pairingError(res, 410, "PAIRING_EXPIRED", "The verification phrase expired.");
      }
      return json(res, 200, { ok: true, paired: false, pendingDesktopConfirmation: true });
    }

    if (req.method === "POST" && url.pathname === "/api/pair/reject") {
      const data = await readJson(req).catch(() => ({}));
      const rejected = secureTrust.rejectTranscript(data.pairingId, data.deviceId);
      if (rejected && activePairingId === String(data.pairingId || "")) activePairingId = null;
      notifyConnectionStatus();
      return json(res, rejected ? 200 : 410, rejected
        ? { ok: true }
        : { ok: false, error: { code: "PAIRING_EXPIRED", message: "The verification phrase expired." } });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/challenge") {
      const data = await readJson(req).catch(() => ({}));
      const session = secureSession(data.deviceId);
      if (!session) return pairingError(res, 401, "REPAIR_REQUIRED", "This device must be paired with protocol v3.");
      const nonce = crypto.randomBytes(32).toString("base64url");
      authChallenges.set(session.deviceId, { nonce, expiresAt: Date.now() + 30_000 });
      return json(res, 200, {
        ok: true,
        nonce,
        desktopPublicKey: secureIdentity.publicKey,
        desktopSignature: signChallenge(secureIdentity, nonce),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/ticket") {
      const data = await readJson(req).catch(() => ({}));
      const session = secureSession(data.deviceId);
      const challenge = authChallenges.get(String(data.deviceId || ""));
      authChallenges.delete(String(data.deviceId || ""));
      if (!session || !challenge || challenge.expiresAt <= Date.now()
        || !verifyDeviceSignature(session.publicKey, challenge.nonce, data.signature)) {
        return pairingError(res, 401, "DEVICE_AUTH_FAILED", "Device-bound authentication failed.");
      }
      const connectionId = crypto.randomUUID();
      const ticket = secureTrust.createTicket(session.deviceId, connectionId);
      return json(res, 200, { ok: true, ticket, connectionId });
    }

    if (["/api/pair", "/api/device", "/api/command", "/api/unpair"].includes(url.pathname)) {
      return json(res, 426, {
        ok: false,
        error: { code: "REPAIR_REQUIRED", message: "Secure Smart Connect v3 is required." },
      });
    }

    return json(res, 404, { ok: false, error: "Not Found" });
  });

  configureSockets();
  const listenAddress = eligibleLanAddresses()[0];
  if (!listenAddress) throw new Error("SMART_CONNECT_PRIVATE_LAN_UNAVAILABLE");
  server.listen(PORT, listenAddress, () => {
    console.log(`[SmartConnect] secure v${PROTOCOL_VERSION} listening at https://${listenAddress}:${PORT}`);
    startServiceAdvertisement();
  });
  server.on("error", (error) => console.error("[SmartConnect] Server error:", error.message));
  app.once("before-quit", stopServiceAdvertisement);
}

ipcMain.handle("smart-connect:get-info", async () => {
  ensureFreshPin();
  const ip = getLocalIpAddress();
  const qrPayload = `orion://connect?ip=${encodeURIComponent(ip)}&port=${PORT}&pin=${encodeURIComponent(currentPin)}&version=3`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: "M",
  }).catch(() => "");
  return {
    ok: true,
    version: PROTOCOL_VERSION,
    instanceId: desktopInstanceId,
    ip,
    availableIps: getAllLocalIpAddresses(),
    port: PORT,
    pin: currentPin,
    pinExpiresAt,
    qrDataUrl,
    paired: pairedSessions.size > 0,
    connected: publicDevices().some((device) => device.connected),
    devices: publicDevices(),
    pairingGuard: pairingGuardSnapshot(),
    certificateFingerprint: secureIdentity?.certificateFingerprint || "",
    secureTransport: true,
    pendingPairing: activePairingId ? secureTrust.transcript(activePairingId) : null,
    networkPolicy: secureTrust.networkPolicy(),
  };
});

ipcMain.handle("smart-connect:confirm-pairing", () => {
  if (!activePairingId) return { ok: false, error: "No pending secure pairing." };
  const transcript = secureTrust.confirmTranscript(activePairingId, "desktop");
  if (!transcript) return { ok: false, error: "The verification phrase expired." };
  const session = completeSecurePairing(transcript);
  notifyConnectionStatus();
  return { ok: true, paired: Boolean(session), pendingPairing: session ? null : transcript };
});

ipcMain.handle("smart-connect:reject-pairing", () => {
  activePairingId = null;
  createPin();
  notifyConnectionStatus();
  return { ok: true };
});

ipcMain.handle("smart-connect:allow-public-network", () => {
  secureTrust.allowPublicNetworkForSession();
  notifyConnectionStatus();
  return { ok: true, networkPolicy: secureTrust.networkPolicy() };
});

ipcMain.handle("smart-connect:set-pin", (_, pin) => {
  const value = String(pin || "");
  currentPin = /^\d{6}$/.test(value) ? value : createPin();
  pinExpiresAt = Date.now() + PIN_TTL_MS;
  pairAttempts = [];
  lockedUntil = 0;
  savePairingGuard();
  notifyConnectionStatus();
  return { ok: true, pin: currentPin, pinExpiresAt };
});

ipcMain.handle("smart-connect:update-playback", (_, data) => {
  currentPlayback = data ? normalizePlaybackTelemetry(data, telemetrySequence) : null;
  telemetrySequence = currentPlayback?.sequence || telemetrySequence;
  for (const [deviceId, socket] of connectedSockets) {
    sendSocket(socket, "telemetry", deviceId, currentPlayback);
  }
  return { ok: true };
});

ipcMain.handle("smart-connect:update-telemetry", (_, data) => {
  currentContext = data?.context && typeof data.context === "object" ? data.context : currentContext;
  currentPlayback = data?.telemetry ? normalizePlaybackTelemetry(data.telemetry, telemetrySequence) : null;
  telemetrySequence = currentPlayback?.sequence || telemetrySequence;
  for (const [deviceId, socket] of connectedSockets) {
    if (currentContext) sendSocket(socket, "context", deviceId, currentContext);
    sendSocket(socket, "telemetry", deviceId, currentPlayback);
  }
  return { ok: true, connected: connectedSockets.size > 0 };
});

ipcMain.handle("smart-connect:ack-command", (_, ack) => {
  const pending = pendingCommands.get(String(ack?.id || ""));
  if (!pending) return { ok: false, error: "Unknown command acknowledgement." };
  clearTimeout(pending.timer);
  pendingCommands.delete(String(ack.id));
  pending.resolve({
    id: String(ack.id),
    sequence: Number(ack.sequence) || 0,
    ok: ack.ok !== false,
    appliedAt: Date.now(),
    error: ack.error || undefined,
    pointer: ack.pointer || undefined,
    authoritativeTelemetry: currentPlayback || undefined,
  });
  return { ok: true };
});

ipcMain.handle("smart-connect:revoke-device", (_, deviceId) => {
  const target = String(deviceId || "");
  if (!target) return { ok: false, error: "A paired device ID is required." };
  let removed = false;
  for (const [token, session] of pairedSessions) {
    if (session.deviceId === target) {
      pairedSessions.delete(token);
      removed = true;
    }
  }
  connectedSockets.get(target)?.close();
  connectedSockets.delete(target);
  if (removed) saveSessions();
  notifyConnectionStatus();
  return { ok: removed, devices: [...pairedSessions.values()] };
});

ipcMain.handle("smart-connect:rename-device", (_, deviceId, deviceName) => {
  const target = String(deviceId || "");
  if (!target) return { ok: false, error: "A paired device ID is required." };
  const session = [...pairedSessions.values()].find((item) => item.deviceId === target);
  if (!session) return { ok: false, error: "The paired device was not found." };
  session.deviceName = sanitizeDeviceName(deviceName);
  saveSessions();
  notifyConnectionStatus();
  return { ok: true, device: publicDevices().find((item) => item.deviceId === target) };
});

ipcMain.handle("smart-connect:disconnect", () => {
  pairedSessions.clear();
  for (const socket of connectedSockets.values()) socket.close();
  connectedSockets.clear();
  saveSessions();
  createPin();
  notifyConnectionStatus();
  return { ok: true };
});

module.exports = { startSmartConnectServer, getLocalIpAddress };

```

----------------------------------------
## FILE: apps/desktop/src/main/smartConnect/secureTrust.js
----------------------------------------

```
"use strict";

const crypto = require("node:crypto");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const PHRASE_TTL_MS = 2 * 60 * 1000;
const TICKET_TTL_MS = 20 * 1000;
const REPLAY_TTL_MS = 5 * 60 * 1000;
const NETWORK_PROFILE_CACHE_MS = 5 * 1000;
const WORDS = [
  "amber", "atlas", "aurora", "comet", "cosmos", "eclipse", "ember", "lunar",
  "meteor", "nebula", "nova", "orbit", "pearl", "pulsar", "signal", "stellar",
];

function privateAddress(address) {
  const value = String(address || "").replace(/^::ffff:/, "");
  if (/^10\./.test(value) || /^192\.168\./.test(value) || /^127\./.test(value)) return true;
  const match = value.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return value === "::1" || /^f[cd][0-9a-f]{2}:/i.test(value) || /^fe80:/i.test(value);
}

function eligibleLanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((item) =>
    item && item.family === "IPv4" && !item.internal && privateAddress(item.address),
  ).map((item) => item.address);
}

let publicNetworkCache = { value: false, expiresAt: 0 };

function windowsPublicNetwork() {
  if (process.platform !== "win32") return false;
  if (publicNetworkCache.expiresAt > Date.now()) return publicNetworkCache.value;
  try {
    const result = execFileSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      "@(Get-NetConnectionProfile | Where-Object {$_.IPv4Connectivity -ne 'Disconnected'} | Select-Object -ExpandProperty NetworkCategory) -contains 'Public'",
    ], {
      encoding: "utf8",
      timeout: 2500,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    publicNetworkCache = {
      value: String(result).trim().toLowerCase() === "true",
      expiresAt: Date.now() + NETWORK_PROFILE_CACHE_MS,
    };
    return publicNetworkCache.value;
  } catch {
    // An unreadable Windows profile must not silently weaken the LAN policy.
    // Users can still opt in through the explicit, session-only override.
    publicNetworkCache = { value: true, expiresAt: Date.now() + NETWORK_PROFILE_CACHE_MS };
    return publicNetworkCache.value;
  }
}

function phraseForSecret(secret) {
  const bytes = crypto.createHash("sha256").update(secret).digest();
  return [0, 1, 2, 3].map((index) => WORDS[bytes[index] % WORDS.length]);
}

function createTrustState() {
  const transcripts = new Map();
  const tickets = new Map();
  const connectionSequences = new Map();
  const deviceCommandIds = new Map();
  let publicNetworkAllowedUntil = 0;

  function beginTranscript({ desktopInstanceId, deviceId, deviceName, publicKey, fingerprint }) {
    const pairingId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("base64url");
    const transcript = {
      pairingId, desktopInstanceId, deviceId, deviceName, publicKey,
      certificateFingerprint: fingerprint,
      phrase: { words: phraseForSecret(secret), expiresAt: Date.now() + PHRASE_TTL_MS },
      desktopConfirmed: false, mobileConfirmed: false, createdAt: Date.now(),
    };
    transcripts.set(pairingId, transcript);
    return { ...transcript, secret: undefined };
  }

  function transcript(pairingId) {
    const value = transcripts.get(String(pairingId));
    if (!value || value.phrase.expiresAt <= Date.now()) {
      if (value) transcripts.delete(value.pairingId);
      return null;
    }
    return value;
  }

  function confirmTranscript(pairingId, side) {
    const value = transcript(pairingId);
    if (!value) return null;
    if (side === "desktop") value.desktopConfirmed = true;
    if (side === "mobile") value.mobileConfirmed = true;
    return value;
  }

  function rejectTranscript(pairingId, deviceId) {
    const value = transcript(pairingId);
    if (!value || value.deviceId !== String(deviceId || "")) return false;
    transcripts.delete(value.pairingId);
    return true;
  }

  function createTicket(deviceId, connectionId) {
    const ticketId = crypto.randomBytes(32).toString("base64url");
    const value = { ticketId, deviceId, connectionId, expiresAt: Date.now() + TICKET_TTL_MS };
    tickets.set(ticketId, value);
    return value;
  }

  function consumeTicket(ticketId) {
    const value = tickets.get(String(ticketId));
    tickets.delete(String(ticketId));
    return value && value.expiresAt > Date.now() ? value : null;
  }

  function acceptEnvelope(deviceId, connectionId, sequence, commandId, droppable = false) {
    const normalizedDeviceId = String(deviceId || "");
    const normalizedConnectionId = String(connectionId || "");
    const normalizedCommandId = String(commandId || "");
    if (!normalizedDeviceId || !normalizedConnectionId || !normalizedCommandId) {
      return { ok: false, duplicate: false, droppable, reason: "INVALID_IDENTITY" };
    }
    const connectionKey = `${normalizedDeviceId}:${normalizedConnectionId}`;
    const lastSequence = connectionSequences.get(connectionKey) || 0;
    const ids = deviceCommandIds.get(normalizedDeviceId) || new Map();
    const now = Date.now();
    for (const [id, at] of ids) if (now - at > REPLAY_TTL_MS) ids.delete(id);
    if (!Number.isSafeInteger(sequence) || sequence <= lastSequence || ids.has(normalizedCommandId)) {
      return {
        ok: false,
        duplicate: ids.has(normalizedCommandId),
        droppable,
        reason: ids.has(normalizedCommandId) ? "DUPLICATE_COMMAND" : "STALE_SEQUENCE",
      };
    }
    connectionSequences.set(connectionKey, sequence);
    ids.set(normalizedCommandId, now);
    deviceCommandIds.set(normalizedDeviceId, ids);
    return { ok: true };
  }

  return {
    beginTranscript, confirmTranscript, rejectTranscript, transcript, createTicket, consumeTicket, acceptEnvelope,
    networkPolicy() {
      const publicNetwork = windowsPublicNetwork();
      return {
        privateLanOnly: true,
        publicNetwork,
        allowed: !publicNetwork || publicNetworkAllowedUntil > Date.now(),
        publicNetworkAllowedUntil: publicNetworkAllowedUntil || null,
        maxConnections: 4,
        commandRatePerSecond: 120,
        realtimeCommandRatePerSecond: 120,
        reliableCommandRatePerSecond: 60,
      };
    },
    allowPublicNetworkForSession(durationMs = 4 * 60 * 60 * 1000) {
      publicNetworkAllowedUntil = Date.now() + Math.max(60_000, durationMs);
      return publicNetworkAllowedUntil;
    },
  };
}

module.exports = { createTrustState, eligibleLanAddresses, privateAddress };

```

----------------------------------------
## FILE: apps/desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js
----------------------------------------

```
import { useEffect } from "react";

const REMOTE_CURSOR_INACTIVITY_MS = 4_000;
let lastCursorActivityAt = 0;
let latestCursorPayload = null;
let hoverCheckTimer = null;
let rafHandle = null;

const SIDEBAR_PAGES = [
  "home",
  "search",
  "discover",
  "constellation",
  "library",
  "downloads",
  "music-home",
  "settings",
];

function getScrollContainer() {
  return (
    document.querySelector(".app-content") ||
    document.querySelector(".music-planet-container") ||
    document.querySelector(".page-content") ||
    document.scrollingElement ||
    window
  );
}

function getOrCreateVirtualCursor() {
  let cursor = document.querySelector(".orion-virtual-cursor");
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.className = "orion-virtual-cursor";
    cursor.style.opacity = "0";
    document.body.appendChild(cursor);
  }
  return cursor;
}

function clearRemoteCursor() {
  latestCursorPayload = null;
  lastCursorActivityAt = 0;
  const cursor = document.querySelector(".orion-virtual-cursor");
  if (cursor) {
    cursor.style.opacity = "0";
  }
  document
    .querySelectorAll(".spatial-remote-focused")
    .forEach((node) => node.classList.remove("spatial-remote-focused"));
}

function scheduleRemoteCursorCleanup() {
  lastCursorActivityAt = performance.now();
  const cursor = getOrCreateVirtualCursor();
  cursor.style.opacity = "1";
}

function moveCursor(payload) {
  latestCursorPayload = payload;
  scheduleRemoteCursorCleanup();
}

function renderCursorFrame() {
  const now = performance.now();
  const cursor = getOrCreateVirtualCursor();

  if (lastCursorActivityAt > 0 && now - lastCursorActivityAt >= REMOTE_CURSOR_INACTIVITY_MS) {
    cursor.style.opacity = "0";
    document
      .querySelectorAll(".spatial-remote-focused")
      .forEach((node) => node.classList.remove("spatial-remote-focused"));
  }

  if (latestCursorPayload) {
    const payload = latestCursorPayload;
    latestCursorPayload = null;

    const pointer = payload?.pointer || payload?.value || payload || {};
    const x = Math.max(0, Math.min(1, Number(pointer.x ?? pointer.xRatio) || 0));
    const y = Math.max(0, Math.min(1, Number(pointer.y ?? pointer.yRatio) || 0));
    const clientX = Math.round(x * window.innerWidth);
    const clientY = Math.round(y * window.innerHeight);

    cursor.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
    cursor.style.opacity = "1";
    cursor.dataset.x = String(clientX);
    cursor.dataset.y = String(clientY);

    if (!hoverCheckTimer) {
      hoverCheckTimer = window.setTimeout(() => {
        hoverCheckTimer = null;
        const element = document.elementFromPoint(clientX, clientY);
        const interactive = element?.closest(
          ".media-card, button, a, [role='button'], [tabindex='0']",
        );
        document
          .querySelectorAll(".spatial-remote-focused")
          .forEach((node) => node.classList.remove("spatial-remote-focused"));
        interactive?.classList.add("spatial-remote-focused");
      }, 50);
    }
  }

  rafHandle = requestAnimationFrame(renderCursorFrame);
}

function clickCursor() {
  const cursor = document.querySelector(".orion-virtual-cursor");
  if (!cursor) return;
  scheduleRemoteCursorCleanup();
  const clientX = Number(cursor.dataset.x) || (cursor.getBoundingClientRect().left + 10);
  const clientY = Number(cursor.dataset.y) || (cursor.getBoundingClientRect().top + 10);
  const element = document.elementFromPoint(clientX, clientY);
  const clickable =
    element?.closest(".media-card, button, a, [role='button'], input") ||
    element;
  clickable?.click?.();
}

function moveSpatialFocus(action) {
  const selector =
    ".media-card, [role='button'], .poster-container, .card, .search-media-result";
  let cards = Array.from(document.querySelectorAll(selector));
  if (cards.length === 0) {
    cards = Array.from(document.querySelectorAll("button, [tabindex='0']"));
  }
  if (cards.length === 0) return;
  cards.forEach((element) => {
    if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
  });
  const focused = document.querySelector(".spatial-remote-focused");
  let index = focused ? cards.indexOf(focused) : cards.indexOf(document.activeElement);
  const nextIndex =
    action === "focus_card_next"
      ? index === -1
        ? 0
        : (index + 1) % cards.length
      : index === -1
        ? cards.length - 1
        : (index - 1 + cards.length) % cards.length;
  document
    .querySelectorAll(".spatial-remote-focused")
    .forEach((element) => element.classList.remove("spatial-remote-focused"));
  const target = cards[nextIndex];
  target?.classList.add("spatial-remote-focused");
  target?.focus?.();
  target?.scrollIntoView?.({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
}

export function useSmartConnectRemoteCommands({
  baseNavigate,
  baseNavigateBack,
  createMiniHandoff,
  handleSystemMediaCommand,
  pageRef,
  setShowSearch,
}) {
  useEffect(() => {
    rafHandle = requestAnimationFrame(renderCursorFrame);

    const handleRemoteCommand = async (payload) => {
      const { action, value } = payload || {};
      const targetScroll = getScrollContainer();
      let commandResult = { ok: true };

      if (action === "cursor_move") moveCursor(payload);
      if (action === "cursor_click") clickCursor();
      if (action === "scroll") {
        const deltaY = Math.max(-240, Math.min(240, Number(value?.deltaY) || 0));
        getScrollContainer()?.scrollBy?.({ top: deltaY, behavior: "auto" });
      }
      if (action === "navigate_page" && value) baseNavigate(value);
      if (action === "sidebar_next" || action === "sidebar_prev") {
        const current = SIDEBAR_PAGES.indexOf(pageRef.current || "home");
        const offset = action === "sidebar_next" ? 1 : -1;
        const next = (current + offset + SIDEBAR_PAGES.length) % SIDEBAR_PAGES.length;
        baseNavigate(SIDEBAR_PAGES[next]);
      }
      if (action === "focus_card_next" || action === "focus_card_prev") {
        moveSpatialFocus(action);
      }
      if (action === "seek_to") {
        const seconds = Number(value);
        commandResult = Number.isFinite(seconds)
          ? await handleSystemMediaCommand(`seek:${seconds}`)
          : { ok: false, error: "The requested seek position is invalid." };
      }
      if (action === "play_media") {
        const targetType = payload?.mediaType || payload?.type || "movie";
        const targetId = payload?.id || value;
        if (targetId) baseNavigate(targetType, targetId);
      }
      if (action === "constellation_search") {
        baseNavigate("constellation");
        window.dispatchEvent(
          new CustomEvent("orion:constellation-search", { detail: value }),
        );
      }
      if (action === "up" || action === "down") {
        const active = document.activeElement;
        if (active && active !== document.body) {
          active.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: action === "up" ? "ArrowUp" : "ArrowDown",
              bubbles: true,
            }),
          );
        } else {
          const top = action === "up" ? -280 : 280;
          if (typeof targetScroll.scrollBy === "function") {
            targetScroll.scrollBy({ top, behavior: "smooth" });
          } else {
            window.scrollBy({ top, behavior: "smooth" });
          }
        }
      }
      if (action === "left" || action === "right") {
        const active = document.activeElement;
        if (active && active !== document.body) {
          active.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: action === "left" ? "ArrowLeft" : "ArrowRight",
              bubbles: true,
            }),
          );
        } else {
          targetScroll.scrollBy({
            left: action === "left" ? -240 : 240,
            behavior: "smooth",
          });
        }
      }
      if (action === "select") {
        const focused = document.querySelector(".spatial-remote-focused");
        const active = document.activeElement;
        if (focused?.click) focused.click();
        else if (active && active !== document.body && active.click) active.click();
        else {
          window.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: "Enter",
              bubbles: true,
            }),
          );
        }
      }
      if (action === "back") baseNavigateBack();
      if (action === "home") baseNavigate("home");
      if (action === "menu") {
        window.dispatchEvent(new CustomEvent("orion:toggle-sidebar"));
      }
      if (action === "send_text") {
        setShowSearch(true);
        if (value) baseNavigate("search", value);
      }

      const mediaCommands = {
        toggle_play: "toggle",
        play_pause: "toggle",
        "seek_-10": "seekBackward",
        "seek_+10": "seekForward",
        previous: "previous",
        next: "next",
        toggle_mute: "toggleMute",
        volume_up: "volumeUp",
        volume_down: "volumeDown",
        toggle_subtitles: "toggleSubtitles",
      };
      if (mediaCommands[action]) {
        commandResult = await handleSystemMediaCommand(mediaCommands[action]);
      }
      if (action === "set_speed") {
        commandResult = await handleSystemMediaCommand(`speed:${Number(value)}`);
      }
      if (action === "toggle_fullscreen") {
        commandResult = (await window.electron?.toggleFullscreen?.()) || {
          ok: false,
          error: "Desktop fullscreen control is unavailable.",
        };
      }
      if (action === "toggle_pip") createMiniHandoff();

      if (payload?.id && window.electron?.acknowledgeSmartConnectCommand) {
        window.electron
          .acknowledgeSmartConnectCommand({
            id: payload.id,
            sequence: payload.sequence || 0,
            ok: commandResult?.ok !== false,
            error: commandResult?.error,
            pointer:
              action === "cursor_move"
                ? {
                    x: Math.max(
                      0,
                      Math.min(
                        1,
                        Number(
                          payload?.pointer?.x ??
                            payload?.value?.x ??
                            payload?.value?.xRatio,
                        ) || 0,
                      ),
                    ),
                    y: Math.max(
                      0,
                      Math.min(
                        1,
                        Number(
                          payload?.pointer?.y ??
                            payload?.value?.y ??
                            payload?.value?.yRatio,
                        ) || 0,
                      ),
                    ),
                  }
                : undefined,
          })
          .catch(() => {});
      }
    };

    const unsubscribe = window.electron?.onRemoteCommand?.(handleRemoteCommand);
    const handleSmartConnectStatus = (status) => {
      const devices = Array.isArray(status?.devices) ? status.devices : [];
      const connected = Boolean(
        status?.connected || devices.some((device) => device?.connected),
      );
      if (!connected) clearRemoteCursor();
    };
    const unsubscribeStatus = window.electron?.onSmartConnectStatus?.(
      handleSmartConnectStatus,
    );
    const initialStatus = window.electron?.getSmartConnectInfo?.();
    initialStatus
      ?.then(handleSmartConnectStatus)
      .catch(() => clearRemoteCursor());
    let channel;
    try {
      if (typeof window.BroadcastChannel !== "undefined") {
        channel = new window.BroadcastChannel("orion_smart_connect");
        channel.onmessage = (event) => {
          if (event.data?.type === "REMOTE_COMMAND") {
            handleRemoteCommand(event.data);
          }
        };
      }
    } catch {
      // BroadcastChannel is an optional browser fallback.
    }
    const handleCustomRemote = (event) => handleRemoteCommand(event.detail);
    window.addEventListener("orion:remote-command-custom", handleCustomRemote);
    return () => {
      if (rafHandle) cancelAnimationFrame(rafHandle);
      unsubscribe?.();
      unsubscribeStatus?.();
      clearRemoteCursor();
      try {
        channel?.close();
      } catch {
        // The channel may already be closed during renderer teardown.
      }
      window.removeEventListener(
        "orion:remote-command-custom",
        handleCustomRemote,
      );
    };
  }, [
    baseNavigate,
    baseNavigateBack,
    createMiniHandoff,
    handleSystemMediaCommand,
    pageRef,
    setShowSearch,
  ]);
}

```

## GIT STATUS
```
 M apps/desktop/package.json
 M apps/desktop/src/main/ipc/smartConnectIpc.js
 M apps/desktop/src/main/smartConnect/secureTrust.js
 M apps/desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js
 M apps/desktop/src/renderer/styles/global.css
 M apps/mobile/plugins/orion-nsd-native/OrionSecureConnectModule.kt
 M apps/mobile/src/features/connect/SmartConnectPairingModal.tsx
 M apps/mobile/src/features/connect/UnifiedRemoteSurface.tsx
 M apps/mobile/src/features/connect/connectStyles.ts
 M apps/mobile/src/features/connect/secureConnectClient.ts
 M apps/mobile/src/features/connect/useConnectController.ts
 M apps/mobile/src/features/connect/useLiveTelemetry.ts
 M apps/mobile/src/features/connect/useRemotePointer.ts
 M apps/mobile/src/services/nativeSecureConnect.ts
 M apps/mobile/tests/smartConnectTrustedPairing.test.cjs
 M apps/mobile/tests/smartConnectUnifiedRemote.test.cjs
?? docs/Orion_Connect_v3_Failure_Prediction_and_Recovery_Plan.md
?? docs/Orion_Connect_v3_Low_Latency_Implementation_Plan.md
?? docs/orion_connect_failure_diagnostic.md
?? docs/orion_connect_laser_architecture.md
?? orion_connect_CURRENT_REAL_CODE.md
```

## RECENT COMMITS
```
f850c98 docs: record Smart Connect checkpoint evidence
5d49264 feat: secure Smart Connect protocol v3
2305893 feat: unify Smart Connect remote surface
f9562f1 feat: add authoritative Smart Connect telemetry
f34b14d feat: complete trusted Smart Connect pairing checkpoint
22b1ca8 polish: animate Desktop Smart Connect signal
672604e fix: bundle standalone Android test builds
cc89800 docs: record Smart Connect checkpoint validation
43a3cbe fix: make Smart Connect pairing keyboard-safe
7aa3d73 feat: add trusted Smart Connect discovery
```

## CURRENT UNCOMMITTED DIFF
```diff
diff --git a/apps/desktop/src/main/ipc/smartConnectIpc.js b/apps/desktop/src/main/ipc/smartConnectIpc.js
index afecd30..ad3b206 100644
--- a/apps/desktop/src/main/ipc/smartConnectIpc.js
+++ b/apps/desktop/src/main/ipc/smartConnectIpc.js
@@ -43,6 +43,7 @@ const connectedSockets = new Map();
 const secureTrust = createTrustState();
 const authChallenges = new Map();
 let secureIdentity = null;
+
 let activePairingId = null;
 function completeSecurePairing(transcript) {
   if (!transcript?.desktopConfirmed || !transcript?.mobileConfirmed) return null;
@@ -76,15 +77,30 @@ function socketIsOpen(socket) {
 function originAllowed(req) {
   return !req.headers.origin || req.headers.origin === ALLOWED_REMOTE_ORIGIN;
 }
-function acceptCommandRate(socket, droppable) {
+function acceptCommandRate(socket, droppable, action) {
   const now = Date.now();
-  if (!socket.commandRateWindowAt || now - socket.commandRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
-    socket.commandRateWindowAt = now; socket.commandRateCount = 0;
+  const policy = secureTrust.networkPolicy();
+  const isRealtime = action === "cursor_move";
+
+  if (isRealtime) {
+    if (!socket.realtimeRateWindowAt || now - socket.realtimeRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
+      socket.realtimeRateWindowAt = now; socket.realtimeRateCount = 0;
+    }
+    socket.realtimeRateCount += 1;
+    const maxRealtime = Number(policy.realtimeCommandRatePerSecond || policy.commandRatePerSecond || 120);
+    return socket.realtimeRateCount <= maxRealtime
+      ? { ok: true }
+      : { ok: false, droppable: true, reason: "REALTIME_RATE_LIMITED" };
   }
-  socket.commandRateCount += 1;
-  return socket.commandRateCount <= secureTrust.networkPolicy().commandRatePerSecond
+
+  if (!socket.reliableRateWindowAt || now - socket.reliableRateWindowAt >= COMMAND_RATE_WINDOW_MS) {
+    socket.reliableRateWindowAt = now; socket.reliableRateCount = 0;
+  }
+  socket.reliableRateCount += 1;
+  const maxReliable = Number(policy.reliableCommandRatePerSecond || 60);
+  return socket.reliableRateCount <= maxReliable
     ? { ok: true }
-    : { ok: false, droppable, reason: "COMMAND_RATE_LIMITED" };
+    : { ok: false, droppable: Boolean(droppable), reason: "COMMAND_RATE_LIMITED" };
 }
 
 function publicDevices() {
@@ -397,10 +413,11 @@ function configureSockets() {
           return;
         }
         if (envelope.type !== "command") return;
-        const droppable = envelope.payload?.action === "cursor_move";
-        const rate = acceptCommandRate(socket, droppable);
+        const action = envelope.payload?.action;
+        const droppable = action === "cursor_move";
+        const rate = acceptCommandRate(socket, droppable, action);
         if (!rate.ok) {
-          if (!rate.droppable) sendSocket(socket, "error", session.deviceId, { error: rate.reason });
+          if (!rate.droppable) sendSocket(socket, "error", session.deviceId, { error: rate.reason, commandId: String(envelope.commandId || envelope.payload?.id || "") });
           return;
         }
         const replay = secureTrust.acceptEnvelope(
@@ -411,7 +428,7 @@ function configureSockets() {
           droppable,
         );
         if (!replay.ok) {
-          if (!replay.droppable) sendSocket(socket, "error", session.deviceId, { error: "Replay or duplicate command rejected." });
+          if (!replay.droppable) sendSocket(socket, "error", session.deviceId, { error: "Replay or duplicate command rejected.", commandId: String(envelope.commandId || envelope.payload?.id || "") });
           return;
         }
         if (envelope.payload?.action === "smart_connect_rename") {
@@ -433,11 +450,16 @@ function configureSockets() {
           notifyConnectionStatus();
           return;
         }
+        if (action === 'cursor_move' || action === 'scroll') {
+          const command = normalizeCommand(envelope.payload);
+          notifyDesktopRenderer("orion:remote-command", command);
+          return;
+        }
         const command = normalizeCommand(envelope.payload);
         const ack = await dispatchCommand(command);
         sendSocket(socket, "ack", session.deviceId, ack);
       } catch (error) {
-        sendSocket(socket, "error", session.deviceId, { error: error.message });
+        sendSocket(socket, "error", session.deviceId, { error: error.message, commandId: String(envelope?.commandId || envelope?.payload?.id || "") });
       }
     });
     const watchdog = setInterval(() => {
@@ -661,10 +683,10 @@ async function startSmartConnectServer(getMainWindow) {
 ipcMain.handle("smart-connect:get-info", async () => {
   ensureFreshPin();
   const ip = getLocalIpAddress();
-  const qrPayload = `orion://connect?ip=${encodeURIComponent(ip)}&port=${PORT}&pin=${encodeURIComponent(currentPin)}&version=3&instanceId=${encodeURIComponent(desktopInstanceId)}&fingerprint=${encodeURIComponent(secureIdentity?.certificateFingerprint || "")}`;
+  const qrPayload = `orion://connect?ip=${encodeURIComponent(ip)}&port=${PORT}&pin=${encodeURIComponent(currentPin)}&version=3`;
   const qrDataUrl = await QRCode.toDataURL(qrPayload, {
-    width: 248,
-    margin: 1,
+    width: 256,
+    margin: 2,
     errorCorrectionLevel: "M",
   }).catch(() => "");
   return {
diff --git a/apps/desktop/src/main/smartConnect/secureTrust.js b/apps/desktop/src/main/smartConnect/secureTrust.js
index 6c0a59c..4c06449 100644
--- a/apps/desktop/src/main/smartConnect/secureTrust.js
+++ b/apps/desktop/src/main/smartConnect/secureTrust.js
@@ -153,7 +153,9 @@ function createTrustState() {
         allowed: !publicNetwork || publicNetworkAllowedUntil > Date.now(),
         publicNetworkAllowedUntil: publicNetworkAllowedUntil || null,
         maxConnections: 4,
-        commandRatePerSecond: 60,
+        commandRatePerSecond: 120,
+        realtimeCommandRatePerSecond: 120,
+        reliableCommandRatePerSecond: 60,
       };
     },
     allowPublicNetworkForSession(durationMs = 4 * 60 * 60 * 1000) {
diff --git a/apps/desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js b/apps/desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js
index 64bb5d8..d5f1c6d 100644
--- a/apps/desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js
+++ b/apps/desktop/src/renderer/app/hooks/useSmartConnectRemoteCommands.js
@@ -1,7 +1,10 @@
 import { useEffect } from "react";
 
 const REMOTE_CURSOR_INACTIVITY_MS = 4_000;
-let remoteCursorInactivityTimer = null;
+let lastCursorActivityAt = 0;
+let latestCursorPayload = null;
+let hoverCheckTimer = null;
+let rafHandle = null;
 
 const SIDEBAR_PAGES = [
   "home",
@@ -24,62 +27,91 @@ function getScrollContainer() {
   );
 }
 
+function getOrCreateVirtualCursor() {
+  let cursor = document.querySelector(".orion-virtual-cursor");
+  if (!cursor) {
+    cursor = document.createElement("div");
+    cursor.className = "orion-virtual-cursor";
+    cursor.style.opacity = "0";
+    document.body.appendChild(cursor);
+  }
+  return cursor;
+}
+
 function clearRemoteCursor() {
-  if (remoteCursorInactivityTimer) {
-    window.clearTimeout(remoteCursorInactivityTimer);
-    remoteCursorInactivityTimer = null;
+  latestCursorPayload = null;
+  lastCursorActivityAt = 0;
+  const cursor = document.querySelector(".orion-virtual-cursor");
+  if (cursor) {
+    cursor.style.opacity = "0";
   }
-  document.querySelector(".orion-virtual-cursor")?.remove();
   document
     .querySelectorAll(".spatial-remote-focused")
     .forEach((node) => node.classList.remove("spatial-remote-focused"));
 }
 
 function scheduleRemoteCursorCleanup() {
-  if (remoteCursorInactivityTimer) {
-    window.clearTimeout(remoteCursorInactivityTimer);
-  }
-  remoteCursorInactivityTimer = window.setTimeout(() => {
-    clearRemoteCursor();
-  }, REMOTE_CURSOR_INACTIVITY_MS);
+  lastCursorActivityAt = performance.now();
+  const cursor = getOrCreateVirtualCursor();
+  cursor.style.opacity = "1";
 }
 
 function moveCursor(payload) {
-  let cursor = document.querySelector(".orion-virtual-cursor");
-  if (!cursor) {
-    cursor = document.createElement("div");
-    cursor.className = "orion-virtual-cursor";
-    document.body.appendChild(cursor);
+  latestCursorPayload = payload;
+  scheduleRemoteCursorCleanup();
+}
+
+function renderCursorFrame() {
+  const now = performance.now();
+  const cursor = getOrCreateVirtualCursor();
+
+  if (lastCursorActivityAt > 0 && now - lastCursorActivityAt >= REMOTE_CURSOR_INACTIVITY_MS) {
+    cursor.style.opacity = "0";
+    document
+      .querySelectorAll(".spatial-remote-focused")
+      .forEach((node) => node.classList.remove("spatial-remote-focused"));
   }
-  const pointer = payload?.pointer || payload?.value || payload || {};
-  const x = Math.max(0, Math.min(1, Number(pointer.x ?? pointer.xRatio) || 0));
-  const y = Math.max(0, Math.min(1, Number(pointer.y ?? pointer.yRatio) || 0));
-  const clientX = x * window.innerWidth;
-  const clientY = y * window.innerHeight;
-  cursor.style.left = `${clientX}px`;
-  cursor.style.top = `${clientY}px`;
-  cursor.style.display = "block";
 
-  const element = document.elementFromPoint(clientX, clientY);
-  const interactive = element?.closest(
-    ".media-card, button, a, [role='button'], [tabindex='0']",
-  );
-  document
-    .querySelectorAll(".spatial-remote-focused")
-    .forEach((node) => node.classList.remove("spatial-remote-focused"));
-  interactive?.classList.add("spatial-remote-focused");
-  scheduleRemoteCursorCleanup();
+  if (latestCursorPayload) {
+    const payload = latestCursorPayload;
+    latestCursorPayload = null;
+
+    const pointer = payload?.pointer || payload?.value || payload || {};
+    const x = Math.max(0, Math.min(1, Number(pointer.x ?? pointer.xRatio) || 0));
+    const y = Math.max(0, Math.min(1, Number(pointer.y ?? pointer.yRatio) || 0));
+    const clientX = Math.round(x * window.innerWidth);
+    const clientY = Math.round(y * window.innerHeight);
+
+    cursor.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
+    cursor.style.opacity = "1";
+    cursor.dataset.x = String(clientX);
+    cursor.dataset.y = String(clientY);
+
+    if (!hoverCheckTimer) {
+      hoverCheckTimer = window.setTimeout(() => {
+        hoverCheckTimer = null;
+        const element = document.elementFromPoint(clientX, clientY);
+        const interactive = element?.closest(
+          ".media-card, button, a, [role='button'], [tabindex='0']",
+        );
+        document
+          .querySelectorAll(".spatial-remote-focused")
+          .forEach((node) => node.classList.remove("spatial-remote-focused"));
+        interactive?.classList.add("spatial-remote-focused");
+      }, 50);
+    }
+  }
+
+  rafHandle = requestAnimationFrame(renderCursorFrame);
 }
 
 function clickCursor() {
   const cursor = document.querySelector(".orion-virtual-cursor");
   if (!cursor) return;
   scheduleRemoteCursorCleanup();
-  const rect = cursor.getBoundingClientRect();
-  const element = document.elementFromPoint(
-    rect.left + rect.width / 2,
-    rect.top + rect.height / 2,
-  );
+  const clientX = Number(cursor.dataset.x) || (cursor.getBoundingClientRect().left + 10);
+  const clientY = Number(cursor.dataset.y) || (cursor.getBoundingClientRect().top + 10);
+  const element = document.elementFromPoint(clientX, clientY);
   const clickable =
     element?.closest(".media-card, button, a, [role='button'], input") ||
     element;
@@ -129,6 +161,8 @@ export function useSmartConnectRemoteCommands({
   setShowSearch,
 }) {
   useEffect(() => {
+    rafHandle = requestAnimationFrame(renderCursorFrame);
+
     const handleRemoteCommand = async (payload) => {
       const { action, value } = payload || {};
       const targetScroll = getScrollContainer();
@@ -168,11 +202,21 @@ export function useSmartConnectRemoteCommands({
         );
       }
       if (action === "up" || action === "down") {
-        const top = action === "up" ? -280 : 280;
-        if (typeof targetScroll.scrollBy === "function") {
-          targetScroll.scrollBy({ top, behavior: "smooth" });
+        const active = document.activeElement;
+        if (active && active !== document.body) {
+          active.dispatchEvent(
+            new window.KeyboardEvent("keydown", {
+              key: action === "up" ? "ArrowUp" : "ArrowDown",
+              bubbles: true,
+            }),
+          );
         } else {
-          window.scrollBy({ top, behavior: "smooth" });
+          const top = action === "up" ? -280 : 280;
+          if (typeof targetScroll.scrollBy === "function") {
+            targetScroll.scrollBy({ top, behavior: "smooth" });
+          } else {
+            window.scrollBy({ top, behavior: "smooth" });
+          }
         }
       }
       if (action === "left" || action === "right") {
@@ -311,6 +355,7 @@ export function useSmartConnectRemoteCommands({
     const handleCustomRemote = (event) => handleRemoteCommand(event.detail);
     window.addEventListener("orion:remote-command-custom", handleCustomRemote);
     return () => {
+      if (rafHandle) cancelAnimationFrame(rafHandle);
       unsubscribe?.();
       unsubscribeStatus?.();
       clearRemoteCursor();
diff --git a/apps/mobile/plugins/orion-nsd-native/OrionSecureConnectModule.kt b/apps/mobile/plugins/orion-nsd-native/OrionSecureConnectModule.kt
index 739a6e3..217d872 100644
--- a/apps/mobile/plugins/orion-nsd-native/OrionSecureConnectModule.kt
+++ b/apps/mobile/plugins/orion-nsd-native/OrionSecureConnectModule.kt
@@ -133,6 +133,8 @@ class OrionSecureConnectModule(private val context: ReactApplicationContext) : R
   }
 
   @ReactMethod fun sendSocket(payload: String, promise: Promise) { promise.resolve(socket?.send(payload) == true) }
+  @ReactMethod fun sendRealtimeSocket(payload: String, promise: Promise) { promise.resolve(socket?.send(payload) == true) }
+  @ReactMethod fun sendRealtimeSocketFireAndForget(payload: String) { socket?.send(payload) }
   @ReactMethod fun closeSocket(promise: Promise) { closeSocketInternal(); promise.resolve(null) }
   @ReactMethod fun addListener(eventName: String) = Unit
   @ReactMethod fun removeListeners(count: Double) = Unit
diff --git a/apps/mobile/src/features/connect/UnifiedRemoteSurface.tsx b/apps/mobile/src/features/connect/UnifiedRemoteSurface.tsx
index 71f321e..98fd398 100644
--- a/apps/mobile/src/features/connect/UnifiedRemoteSurface.tsx
+++ b/apps/mobile/src/features/connect/UnifiedRemoteSurface.tsx
@@ -7,7 +7,7 @@ type Props = { controller: any; theme: any; isLandscape: boolean; legacyStyles:
 
 export function UnifiedRemoteSurface({ controller, theme, isLandscape, legacyStyles }: Props) {
   const styles = useMemo(() => createStyles(theme), [theme]);
-  const [pending, setPending] = useState<string | null>(null);
+  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
   const [showMore, setShowMore] = useState(false);
   const [text, setText] = useState('');
   const context = controller.remoteContext;
@@ -15,23 +15,27 @@ export function UnifiedRemoteSurface({ controller, theme, isLandscape, legacySty
   const capabilities = context?.capabilities || {};
 
   const command = async (action: string, value?: unknown) => {
-    if (pending) return;
-    setPending(action);
-    try { await controller.sendRemoteCommand(action, value); } finally { setPending(null); }
+    setPendingActions((prev) => new Set(prev).add(action));
+    try { await controller.sendRemoteCommand(action, value); } finally {
+      setPendingActions((prev) => { const next = new Set(prev); next.delete(action); return next; });
+    }
   };
 
-  const Action = ({ action, icon, label, value, disabled = false }: any) => (
+  const Action = ({ action, icon, label, value, disabled = false }: any) => {
+    const isActionPending = pendingActions.has(action);
+    return (
     <Pressable
       accessibilityRole="button"
       accessibilityLabel={label}
-      disabled={disabled || Boolean(pending)}
+      disabled={disabled || isActionPending}
       onPress={() => command(action, value)}
-      style={({ pressed }) => [styles.action, pressed && styles.pressed, (disabled || pending) && styles.disabled]}
+      style={({ pressed }) => [styles.action, pressed && styles.pressed, (disabled || isActionPending) && styles.disabled]}
     >
-      {pending === action ? <ActivityIndicator color={theme.accent} /> : <Ionicons name={icon} size={21} color={theme.text} />}
+      {isActionPending ? <ActivityIndicator color={theme.accent} /> : <Ionicons name={icon} size={21} color={theme.text} />}
       <Text style={styles.actionLabel}>{label}</Text>
     </Pressable>
-  );
+    );
+  };
 
   const PlaybackPanel = () => playback.hasMedia ? (
     <View style={styles.playbackCard}>
@@ -75,20 +79,30 @@ export function UnifiedRemoteSurface({ controller, theme, isLandscape, legacySty
     <View style={styles.touchpadBlock}>
       <View style={styles.touchpadHeader}>
         <View>
-          <Text style={styles.eyebrow}>TOUCHPAD</Text>
-          <Text style={styles.meta}>One finger moves -+ tap selects -+ two fingers scroll</Text>
+          <Text style={styles.eyebrow}>TOUCHPAD ({controller.pointerMode === 'absolute' ? 'DIRECT 1:1 MIRROR' : 'TRACKPAD'})</Text>
+          <Text style={styles.meta}>{controller.pointerMode === 'absolute' ? 'Touch area mirrors desktop 1:1 -+ tap selects' : 'One finger moves -+ tap selects -+ two fingers scroll'}</Text>
         </View>
-        <View style={styles.latency}><Text style={styles.latencyText}>{controller.latency?.medianRttMs ?? 'GÇö'} ms</Text></View>
+        <Pressable
+          style={styles.latency}
+          onPress={() => controller.setPointerMode(controller.pointerMode === 'relative' ? 'absolute' : 'relative')}
+        >
+          <Text style={styles.latencyText}>{controller.pointerMode === 'relative' ? 'Trackpad' : '1:1 Direct'}</Text>
+        </Pressable>
       </View>
-      <View accessibilityLabel="Desktop touchpad" style={styles.touchpad} {...controller.panResponder.panHandlers}>
+      <View
+        accessibilityLabel="Desktop touchpad"
+        style={styles.touchpad}
+        onLayout={controller.onTouchpadLayout}
+        {...controller.panResponder.panHandlers}
+      >
         <Ionicons name="hand-left-outline" size={38} color={theme.textMuted} />
-        <Text style={styles.touchpadText}>Control Orion Desktop</Text>
+        <Text style={styles.touchpadText}>Control Orion Desktop ({controller.pointerMode === 'relative' ? 'Trackpad Mode' : '1:1 Surface Mode'})</Text>
       </View>
     </View>
   );
 
   return (
-    <ScrollView contentContainerStyle={[styles.root, isLandscape && styles.rootLandscape]} keyboardShouldPersistTaps="handled">
+    <ScrollView scrollEnabled={true} contentContainerStyle={[styles.root, isLandscape && styles.rootLandscape]} keyboardShouldPersistTaps="handled">
       <View style={isLandscape ? styles.leftPane : undefined}><PlaybackPanel /></View>
       <View style={isLandscape ? styles.rightPane : undefined}>
         <Touchpad />
diff --git a/apps/mobile/src/features/connect/secureConnectClient.ts b/apps/mobile/src/features/connect/secureConnectClient.ts
index de7401c..19b423b 100644
--- a/apps/mobile/src/features/connect/secureConnectClient.ts
+++ b/apps/mobile/src/features/connect/secureConnectClient.ts
@@ -3,6 +3,7 @@ import {
   getSecureDeviceIdentity,
   openSecureSmartConnectSocket,
   secureSmartConnectRequest,
+  sendRealtimeSmartConnectSocket,
   sendSecureSmartConnectSocket,
   signSecureValue,
   subscribeSecureSmartConnect,
@@ -25,6 +26,19 @@ export interface PairingTranscript {
   phrase: { words: string[]; expiresAt: number };
 }
 
+interface SecureSocketTicket {
+  ticketId: string;
+  deviceId: string;
+  connectionId: string;
+  expiresAt: number;
+}
+
+interface SecureSocketTicketResponse {
+  ok: boolean;
+  ticket: SecureSocketTicket;
+  connectionId: string;
+}
+
 export async function startSecurePairing(endpoint: SecureEndpoint, pin: string, deviceName: string) {
   const identity = await getSecureDeviceIdentity();
   const response = await secureSmartConnectRequest<any>(
@@ -77,16 +91,25 @@ export async function authenticateSecureSocket(endpoint: SecureEndpoint, deviceI
   );
   if (!validDesktop) throw Object.assign(new Error('Desktop identity verification failed.'), { code: 'DESKTOP_IDENTITY_FAILED' });
   const signature = await signSecureValue(String(challenge.data.nonce));
-  const ticket = await secureSmartConnectRequest<any>(
+  const ticket = await secureSmartConnectRequest<SecureSocketTicketResponse>(
     endpoint.host, endpoint.port, endpoint.fingerprint, '/api/auth/ticket', 'POST',
     { deviceId, signature },
   );
-  if (!ticket.ok || !ticket.data?.ticket) throw pairingFailure(ticket.data, ticket.status);
-  await openSecureSmartConnectSocket(endpoint.host, endpoint.port, endpoint.fingerprint, ticket.data.ticket, deviceId);
+  const ticketId = ticket.data?.ticket?.ticketId;
+  if (!ticket.ok || typeof ticketId !== 'string' || !ticketId) {
+    if (ticket.ok) {
+      throw Object.assign(new Error('Desktop returned an invalid secure socket ticket.'), {
+        code: 'SECURE_SOCKET_TICKET_INVALID',
+      });
+    }
+    throw pairingFailure(ticket.data, ticket.status);
+  }
+  await openSecureSmartConnectSocket(endpoint.host, endpoint.port, endpoint.fingerprint, ticketId, deviceId);
   return { connectionId: String(ticket.data.connectionId || '') };
 }
 
 export const sendSecureEnvelope = (payload: unknown) => sendSecureSmartConnectSocket(JSON.stringify(payload));
+export const sendRealtimeSecureEnvelope = (payload: unknown) => sendRealtimeSmartConnectSocket(JSON.stringify(payload));
 export { closeSecureSmartConnectSocket, subscribeSecureSmartConnect };
 
 function pairingFailure(data: any, status: number) {
diff --git a/apps/mobile/src/features/connect/useConnectController.ts b/apps/mobile/src/features/connect/useConnectController.ts
index 9050019..dfab4ba 100644
--- a/apps/mobile/src/features/connect/useConnectController.ts
+++ b/apps/mobile/src/features/connect/useConnectController.ts
@@ -16,7 +16,7 @@ import { useLiveTelemetry } from './useLiveTelemetry';
 import { useRemotePointer } from './useRemotePointer';
 import {
   authenticateSecureSocket, closeSecureSmartConnectSocket, confirmSecurePairing,
-  rejectSecurePairing, sendSecureEnvelope, startSecurePairing, subscribeSecureSmartConnect,
+  rejectSecurePairing, sendRealtimeSecureEnvelope, sendSecureEnvelope, startSecurePairing, subscribeSecureSmartConnect,
   waitForDesktopConfirmation, type PairingTranscript, type SecureEndpoint,
 } from './secureConnectClient';
 
@@ -70,12 +70,22 @@ export function useConnectController() {
   const sequenceRef = useRef(0);
   const pendingAcks = useRef(new Map<string, { resolve(value: any): void; timer: ReturnType<typeof setTimeout> }>());
   const sendCommandRef = useRef<(cmd: string, value?: any) => Promise<any>>(async () => ({ ok: false, error: 'Remote transport is not ready.' }));
-  const { cursorRef, panResponder } = useRemotePointer(sendCommandRef);
+  const fireAndForgetRef = useRef<(cmd: string, value?: any) => void>(() => {});
+  const { cursorRef, panResponder, onTouchpadLayout, pointerMode, setPointerMode } = useRemotePointer(fireAndForgetRef);
   const { latency, remoteContext, setRemoteContext, telemetry, ingestTelemetry, isScrubbing, setIsScrubbing, markSent, recordAck } = useLiveTelemetry(setNowPlaying);
 
+  const rejectAllPendingAcks = (reason: string) => {
+    for (const pending of pendingAcks.current.values()) {
+      clearTimeout(pending.timer);
+      pending.resolve({ ok: false, error: reason });
+    }
+    pendingAcks.current.clear();
+  };
+
   const closeTransport = async () => {
     if (heartbeatRef.current) clearInterval(heartbeatRef.current);
     heartbeatRef.current = null;
+    rejectAllPendingAcks('Connection closed.');
     await closeSecureSmartConnectSocket().catch(() => {});
     connectionRef.current.connected = false;
   };
@@ -101,7 +111,18 @@ export function useConnectController() {
         setRemoteError('');
         updateMobileDiagnostics({ smartConnectState: 'connected', smartConnectReconnectAttempt: 0, smartConnectLastAuthenticatedAt: Date.now() });
       }
-      if (envelope.type === 'error') setRemoteError(String(envelope.payload?.error || 'Desktop rejected the remote command.'));
+      if (envelope.type === 'error') {
+        const errorCommandId = envelope.payload?.commandId;
+        if (errorCommandId) {
+          const pending = pendingAcks.current.get(errorCommandId);
+          if (pending) {
+            clearTimeout(pending.timer);
+            pendingAcks.current.delete(errorCommandId);
+            pending.resolve({ ok: false, error: String(envelope.payload?.error || 'Desktop rejected the command.') });
+          }
+        }
+        setRemoteError(String(envelope.payload?.error || 'Desktop rejected the remote command.'));
+      }
     } catch {}
   };
 
@@ -136,8 +157,8 @@ export function useConnectController() {
 
   useEffect(() => subscribeSecureSmartConnect({
     onMessage: consumeSocketMessage,
-    onClose: () => { setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
-    onFailure: (message) => { setRemoteError(message); setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
+    onClose: () => { rejectAllPendingAcks('Socket connection closed.'); setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
+    onFailure: (message) => { rejectAllPendingAcks(message); setRemoteError(message); setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
   }), [deviceId]);
 
   useEffect(() => {
@@ -269,17 +290,36 @@ export function useConnectController() {
   const handleBarCodeScanned = ({ data }: { data: string }) => {
     if (hasScanned || isConnecting) return; setHasScanned(true);
     const parsed = parsePairingPayload(data);
-    if (parsed.ip && parsed.fingerprint) {
-      setDesktopIp(parsed.ip); setDesktopPort(parsed.port); setPinCode(parsed.pin);
-      void handleConnect(parsed.ip, parsed.pin, parsed.port, 'qr', parsed.fingerprint);
-    } else setQrNotice('This QR code is not a secure Orion Connect v3 code. Generate a fresh code on Desktop.');
+    if (parsed.ip) {
+      setDesktopIp(parsed.ip);
+      if (parsed.port) setDesktopPort(parsed.port);
+      if (parsed.pin) setPinCode(parsed.pin);
+      setQrNotice('');
+      void handleConnect(parsed.ip, parsed.pin || pinCode, parsed.port || desktopPort, 'qr', parsed.fingerprint || undefined);
+    } else {
+      setQrNotice('This QR code is not a valid Orion Connect code.');
+    }
     setTimeout(() => setHasScanned(false), 3000);
   };
 
   const handlePinChange = (value: string) => setPinCode(value.replace(/\D/g, '').slice(0, 6));
 
+  const FIRE_AND_FORGET_ACTIONS = new Set(['cursor_move', 'scroll']);
+
+  const sendFireAndForget = (action: string, value?: any) => {
+    if (!isConnected || !connectionRef.current.connected) return;
+    const sequence = ++sequenceRef.current;
+    const command = createRemoteCommand(action, value, deviceId, sequence);
+    sendRealtimeSecureEnvelope({ version: SMART_CONNECT_PROTOCOL_VERSION, type: 'command', deviceId, connectionId: connectionRef.current.connectionId, sequence, commandId: command.id, payload: command });
+  };
+  fireAndForgetRef.current = sendFireAndForget;
+
   const sendRemoteCommand = async (action: string, value?: any) => {
     if (!isConnected || !connectionRef.current.connected) return { ok: false, error: 'Desktop is not live.' };
+    if (FIRE_AND_FORGET_ACTIONS.has(action)) {
+      sendFireAndForget(action, value);
+      return { ok: true };
+    }
     const sequence = ++sequenceRef.current;
     const command = createRemoteCommand(action, value, deviceId, sequence);
     markSent(command.id);
@@ -333,6 +373,7 @@ export function useConnectController() {
     renameThisDevice, desktopPort, lockoutSeconds, attemptsRemaining, prepareDirectIp, remoteContext,
     telemetry, latency, isScrubbing, setIsScrubbing, pendingTranscript,
     confirmVerificationPhrase, rejectVerificationPhrase,
+    onTouchpadLayout, pointerMode, setPointerMode,
   };
 }
 
diff --git a/apps/mobile/src/features/connect/useRemotePointer.ts b/apps/mobile/src/features/connect/useRemotePointer.ts
index 35af55a..d6e6883 100644
--- a/apps/mobile/src/features/connect/useRemotePointer.ts
+++ b/apps/mobile/src/features/connect/useRemotePointer.ts
@@ -1,43 +1,112 @@
-import { useRef } from 'react';
-import { PanResponder } from 'react-native';
+import { useState, useRef } from 'react';
+import { LayoutChangeEvent, PanResponder } from 'react-native';
 
-type CommandSender = (action: string, value?: unknown) => Promise<unknown>;
+type FireAndForgetSender = (action: string, value?: unknown) => void;
+const TARGET_FRAME_MS = 16;
 
-export function useRemotePointer(sendRef: React.MutableRefObject<CommandSender>) {
+export function useRemotePointer(sendRef: React.MutableRefObject<FireAndForgetSender>) {
   const cursorRef = useRef({ xRatio: 0.5, yRatio: 0.5 });
-  const gestureStart = useRef({ x: 0.5, y: 0.5 });
-  const lastSentAt = useRef(0);
+  const touchpadLayoutRef = useRef({ width: 320, height: 230 });
+  const lastTouchPos = useRef({ x: 0, y: 0 });
   const lastScrollY = useRef(0);
+  const scrollAccum = useRef(0);
+  const [pointerMode, setPointerMode] = useState<'relative' | 'absolute'>('relative');
+  const pointerModeRef = useRef<'relative' | 'absolute'>('relative');
+  pointerModeRef.current = pointerMode;
+
+  const onTouchpadLayout = (event: LayoutChangeEvent) => {
+    const { width, height } = event.nativeEvent.layout;
+    touchpadLayoutRef.current = {
+      width: Math.max(1, width),
+      height: Math.max(1, height),
+    };
+  };
 
   const panResponder = useRef(PanResponder.create({
     onStartShouldSetPanResponder: () => true,
+    onStartShouldSetPanResponderCapture: () => true,
     onMoveShouldSetPanResponder: () => true,
+    onMoveShouldSetPanResponderCapture: () => true,
+    onPanResponderTerminationRequest: () => false,
     onPanResponderGrant: (event) => {
-      gestureStart.current = { x: cursorRef.current.xRatio, y: cursorRef.current.yRatio };
-      lastScrollY.current = event.nativeEvent.touches[0]?.pageY || 0;
+      const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
+      const px = touch?.pageX || 0;
+      const py = touch?.pageY || 0;
+      lastTouchPos.current = { x: px, y: py };
+      lastScrollY.current = py;
+      scrollAccum.current = 0;
+
+      if (pointerModeRef.current === 'absolute') {
+        const { locationX, locationY } = event.nativeEvent;
+        const x = Math.max(0, Math.min(1, locationX / touchpadLayoutRef.current.width));
+        const y = Math.max(0, Math.min(1, locationY / touchpadLayoutRef.current.height));
+        cursorRef.current = { xRatio: x, yRatio: y };
+        sendRef.current('cursor_move', { x, y });
+      }
     },
     onPanResponderMove: (event, gesture) => {
-      const now = Date.now();
-      if (now - lastSentAt.current < 33) return;
-      lastSentAt.current = now;
-      if (event.nativeEvent.touches.length >= 2) {
+      // GöÇGöÇ Two-finger scroll GöÇGöÇ
+      if (event.nativeEvent.touches && event.nativeEvent.touches.length >= 2) {
         const y = event.nativeEvent.touches[0]?.pageY || lastScrollY.current;
         const deltaY = y - lastScrollY.current;
         lastScrollY.current = y;
-        if (Math.abs(deltaY) >= 1) void sendRef.current('scroll', { deltaY: -deltaY });
+        scrollAccum.current += deltaY;
+        if (Math.abs(scrollAccum.current) >= 1) {
+          sendRef.current('scroll', { deltaY: -scrollAccum.current });
+          scrollAccum.current = 0;
+        }
         return;
       }
-      const x = Math.max(0, Math.min(1, gestureStart.current.x + gesture.dx * 0.0015));
-      const y = Math.max(0, Math.min(1, gestureStart.current.y + gesture.dy * 0.0015));
-      cursorRef.current = { xRatio: x, yRatio: y };
-      void sendRef.current('cursor_move', { x, y });
+
+      // GöÇGöÇ Absolute pointer mode GöÇGöÇ
+      if (pointerModeRef.current === 'absolute') {
+        const { locationX, locationY } = event.nativeEvent;
+        const x = Math.max(0, Math.min(1, locationX / touchpadLayoutRef.current.width));
+        const y = Math.max(0, Math.min(1, locationY / touchpadLayoutRef.current.height));
+        cursorRef.current = { xRatio: x, yRatio: y };
+        sendRef.current('cursor_move', { x, y });
+        return;
+      }
+
+      // GöÇGöÇ Relative trackpad: direct step-delta physics GöÇGöÇ
+      const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
+      const currentX = touch?.pageX || 0;
+      const currentY = touch?.pageY || 0;
+
+      let stepX = currentX - lastTouchPos.current.x;
+      let stepY = currentY - lastTouchPos.current.y;
+      lastTouchPos.current = { x: currentX, y: currentY };
+
+      // Ignore position reset jumps
+      if (Math.abs(stepX) > 100 || Math.abs(stepY) > 100) {
+        stepX = 0;
+        stepY = 0;
+      }
+
+      if (stepX === 0 && stepY === 0) return;
+
+      const sensitivityX = 1.0 / touchpadLayoutRef.current.width;
+      const sensitivityY = 1.0 / touchpadLayoutRef.current.height;
+
+      const nextX = Math.max(0, Math.min(1, cursorRef.current.xRatio + stepX * sensitivityX));
+      const nextY = Math.max(0, Math.min(1, cursorRef.current.yRatio + stepY * sensitivityY));
+
+      cursorRef.current = { xRatio: nextX, yRatio: nextY };
+      sendRef.current('cursor_move', { x: nextX, y: nextY });
     },
     onPanResponderRelease: (event, gesture) => {
-      if (event.nativeEvent.touches.length < 2 && Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
-        void sendRef.current('cursor_click');
+      if ((!event.nativeEvent.touches || event.nativeEvent.touches.length < 2) && Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
+        sendRef.current('cursor_click');
       }
     },
+    onPanResponderTerminate: () => {},
   })).current;
 
-  return { cursorRef, panResponder };
+  return {
+    cursorRef,
+    panResponder,
+    onTouchpadLayout,
+    pointerMode,
+    setPointerMode,
+  };
 }
diff --git a/apps/mobile/src/services/nativeSecureConnect.ts b/apps/mobile/src/services/nativeSecureConnect.ts
index 5fa3329..5b7b488 100644
--- a/apps/mobile/src/services/nativeSecureConnect.ts
+++ b/apps/mobile/src/services/nativeSecureConnect.ts
@@ -10,6 +10,8 @@ const module = NativeModules.OrionSecureConnect as undefined | {
   request(host: string, port: number, fingerprint: string | null, path: string, method: string, body: string | null): Promise<SecureResponse>;
   openSocket(host: string, port: number, fingerprint: string, ticket: string, deviceId: string): Promise<boolean>;
   sendSocket(payload: string): Promise<boolean>;
+  sendRealtimeSocket?(payload: string): Promise<boolean>;
+  sendRealtimeSocketFireAndForget?(payload: string): void;
   closeSocket(): Promise<void>;
   addListener(name: string): void;
   removeListeners(count: number): void;
@@ -45,6 +47,16 @@ export const openSecureSmartConnectSocket = (
   host: string, port: number, fingerprint: string, ticket: string, deviceId: string,
 ) => requireModule().openSocket(host, port, fingerprint, ticket, deviceId);
 export const sendSecureSmartConnectSocket = (payload: string) => requireModule().sendSocket(payload);
+export const sendRealtimeSmartConnectSocket = (payload: string) => {
+  const mod = requireModule();
+  if (mod.sendRealtimeSocketFireAndForget) {
+    mod.sendRealtimeSocketFireAndForget(payload);
+  } else if (mod.sendRealtimeSocket) {
+    void mod.sendRealtimeSocket(payload);
+  } else {
+    void mod.sendSocket(payload);
+  }
+};
 export const closeSecureSmartConnectSocket = () => module?.closeSocket() ?? Promise.resolve();
 
 export function subscribeSecureSmartConnect(
```
