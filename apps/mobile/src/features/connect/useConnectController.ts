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
type ControllerRole = 'active' | 'passive' | 'vacant';
interface ControllerAccessState {
  revision: number;
  role: ControllerRole;
  hasActiveController: boolean;
  isActiveController: boolean;
  canTakeControl: boolean;
  activeControllerName: string;
}
interface TrustedEndpoint extends SecureEndpoint { discoveryMethod?: string; lastVerifiedAt?: number }

const DEFAULT_CONTROLLER_ACCESS: ControllerAccessState = {
  revision: 0, role: 'vacant', hasActiveController: false, isActiveController: false,
  canTakeControl: false, activeControllerName: '',
};
const CONTROLLER_MANAGEMENT_ACTIONS = new Set(['smart_connect_take_control', 'smart_connect_rename', 'smart_connect_unpair']);

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
  const [socketBackpressured, setSocketBackpressured] = useState(false);
  const [controllerAccess, setControllerAccess] = useState<ControllerAccessState>(DEFAULT_CONTROLLER_ACCESS);
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
  const [systemVolume, setSystemVolume] = useState(50);
  const [systemMuted, setSystemMuted] = useState(false);
  const [displayBrightness, setDisplayBrightness] = useState(100);
  const [brightnessSupported, setBrightnessSupported] = useState(false);
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
  const pendingAcks = useRef(new Map<string, {
    resolve(value: any): void;
    timer: ReturnType<typeof setTimeout>;
    sequence: number;
    deviceId: string;
    connectionId: string;
    controllerRevision: number | null;
  }>());
  const sendCommandRef = useRef<(cmd: string, value?: any) => Promise<any>>(async () => ({ ok: false, error: 'Remote transport is not ready.' }));
  const fireAndForgetRef = useRef<(cmd: string, value?: any) => void>(() => {});
  const { clearPendingPointer, cursorRef, isPointerGestureActive, panResponder, onTouchpadLayout, pointerMode, setPointerMode, updatePointerHealth } = useRemotePointer(fireAndForgetRef, sendCommandRef);
  const { latency, remoteContext, setRemoteContext, telemetry, ingestTelemetry, isScrubbing, setIsScrubbing, markSent, forgetSent, recordAck } = useLiveTelemetry(setNowPlaying);

  useEffect(() => {
    updatePointerHealth({
      medianRttMs: latency.medianRttMs,
      telemetryAgeMs: latency.telemetryAgeMs,
      backpressured: socketBackpressured,
    });
  }, [latency.medianRttMs, latency.telemetryAgeMs, socketBackpressured, updatePointerHealth]);

  const rejectAllPendingAcks = (reason: string) => {
    for (const [commandId, pending] of pendingAcks.current.entries()) {
      clearTimeout(pending.timer);
      forgetSent(commandId);
      pending.resolve({ ok: false, error: reason });
    }
    pendingAcks.current.clear();
  };

  const closeTransport = async () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    clearPendingPointer('transport-closed');
    rejectAllPendingAcks('Connection closed.');
    await closeSecureSmartConnectSocket().catch(() => {});
    connectionRef.current.connected = false;
    setControllerAccess(DEFAULT_CONTROLLER_ACCESS);
  };

  const applyControllerAccess = (value: any) => {
    if (!value || typeof value !== 'object') return;
    const role: ControllerRole = value.role === 'active' || value.role === 'passive' || value.role === 'vacant'
      ? value.role
      : value.isActiveController ? 'active' : value.hasActiveController ? 'passive' : 'vacant';
    setControllerAccess({
      revision: Math.max(0, Number(value.revision) || 0),
      role,
      hasActiveController: Boolean(value.hasActiveController),
      isActiveController: Boolean(value.isActiveController),
      canTakeControl: Boolean(value.canTakeControl),
      activeControllerName: String(value.activeControllerName || '').slice(0, 80),
    });
  };

  const consumeSocketMessage = (raw: string) => {
    try {
      const envelope = JSON.parse(raw);
      if (envelope.type === 'ack') {
        const ackId = String(envelope.payload?.id || '');
        const pending = pendingAcks.current.get(ackId);
        const ackRevision = envelope.payload?.controllerRevision;
        const revisionMatches = !pending
          || pending.controllerRevision == null
          || ackRevision == null
          || pending.controllerRevision === Number(ackRevision);
        const identityMatches = pending
          && pending.sequence === Number(envelope.payload?.sequence)
          && pending.deviceId === String(envelope.deviceId || '')
          && pending.connectionId === String(envelope.connectionId || '')
          && revisionMatches;
        if (pending && identityMatches) {
          clearTimeout(pending.timer);
          pendingAcks.current.delete(ackId);
          recordAck(ackId);
          pending.resolve(envelope.payload);
        }
      }
      if (envelope.type === 'context') setRemoteContext(envelope.payload || null);
      if (envelope.type === 'telemetry') {
        const playback = envelope.payload as SmartConnectPlaybackTelemetryV1 | null;
        ingestTelemetry(playback);
        if (playback) { setIsPlaying(playback.state === 'playing'); setVolume(Math.round((playback.volume ?? 1) * 100)); setIsMuted(Boolean(playback.muted)); }
      }
      if (envelope.type === 'system_status') {
        const status = envelope.payload;
        if (status && typeof status === 'object') {
          if (typeof status.volume === 'number' && Number.isFinite(status.volume)) setSystemVolume(Math.round(status.volume));
          if (typeof status.muted === 'boolean') setSystemMuted(status.muted);
          if (typeof status.brightness === 'number' && Number.isFinite(status.brightness)) setDisplayBrightness(Math.round(status.brightness));
          if (typeof status.brightnessSupported === 'boolean') setBrightnessSupported(status.brightnessSupported);
        }
      }
      if (envelope.type === 'status') {
        applyControllerAccess(envelope.payload?.controller);
        setIsConnected(envelope.payload?.connected !== false);
        setConnectionState('connected');
        reconnectAttemptRef.current = 0;
        setRemoteError('');
        updateMobileDiagnostics({ smartConnectState: 'connected', smartConnectReconnectAttempt: 0, smartConnectLastAuthenticatedAt: Date.now() });
      }
      if (envelope.type === 'error') {
        applyControllerAccess(envelope.payload?.controller);
        const errorCommandId = envelope.payload?.commandId;
        if (errorCommandId) {
          const pending = pendingAcks.current.get(errorCommandId);
          const identityMatches = pending
            && pending.sequence === Number(envelope.payload?.sequence)
            && pending.deviceId === String(envelope.deviceId || '')
            && pending.connectionId === String(envelope.connectionId || '');
          if (pending && identityMatches) {
            clearTimeout(pending.timer);
            pendingAcks.current.delete(errorCommandId);
            forgetSent(errorCommandId);
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
    onClose: () => { clearPendingPointer('socket-closed'); setSocketBackpressured(false); rejectAllPendingAcks('Socket connection closed.'); setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
    onFailure: (message) => { clearPendingPointer('socket-failed'); setSocketBackpressured(false); rejectAllPendingAcks(message); setRemoteError(message); setIsConnected(false); connectionRef.current.connected = false; scheduleReconnect(); },
    onPressure: (pressure) => setSocketBackpressured(Boolean(pressure.backpressured)),
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
    setIsDiscovering(true); setPairError('Scanning the local network by request…');
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
    if (!isConnected || !connectionRef.current.connected || !controllerAccess.isActiveController) return;
    const sequence = ++sequenceRef.current;
    const command = createRemoteCommand(action, value, deviceId, sequence, controllerAccess.revision);
    sendRealtimeSecureEnvelope({ version: SMART_CONNECT_PROTOCOL_VERSION, type: 'command', deviceId, connectionId: connectionRef.current.connectionId, sequence, commandId: command.id, payload: command });
  };
  fireAndForgetRef.current = sendFireAndForget;

  const sendRemoteCommand = async (action: string, value?: any) => {
    if (!isConnected || !connectionRef.current.connected) return { ok: false, error: 'Desktop is not live.' };
    if (!controllerAccess.isActiveController && !CONTROLLER_MANAGEMENT_ACTIONS.has(action)) {
      return {
        ok: false,
        error: controllerAccess.hasActiveController
          ? `${controllerAccess.activeControllerName || 'Another trusted phone'} is controlling Orion Desktop.`
          : 'Take control of Orion Desktop before sending remote commands.',
      };
    }
    if (FIRE_AND_FORGET_ACTIONS.has(action)) {
      sendFireAndForget(action, value);
      return { ok: true };
    }
    const sequence = ++sequenceRef.current;
    const command = createRemoteCommand(action, value, deviceId, sequence, controllerAccess.revision);
    markSent(command.id);
    if (remoteContext?.playbackProtocolVersion === 1) {
      command.playbackProtocolVersion = 1;
      command.ownerRevision = remoteContext.controlTarget?.ownerRevision;
    }
    const connectionId = connectionRef.current.connectionId;
    const expectedControllerRevision = CONTROLLER_MANAGEMENT_ACTIONS.has(action) ? null : controllerAccess.revision;
    const ackPromise = new Promise<any>((resolve) => {
      const timer = setTimeout(() => {
        pendingAcks.current.delete(command.id);
        forgetSent(command.id);
        resolve({ ok: false, error: 'Desktop acknowledgement timed out.' });
      }, action === 'play' && command.playbackProtocolVersion === 1 ? 7000 : 2200);
      pendingAcks.current.set(command.id, { resolve, timer, sequence, deviceId, connectionId, controllerRevision: expectedControllerRevision });
    });
    const sent = await sendSecureEnvelope({ version: SMART_CONNECT_PROTOCOL_VERSION, type: 'command', deviceId, connectionId, sequence, commandId: command.id, payload: command }).catch(() => false);
    if (!sent) {
      const pending = pendingAcks.current.get(command.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingAcks.current.delete(command.id);
        forgetSent(command.id);
        pending.resolve({ ok: false, error: 'Secure Desktop connection is unavailable.' });
      }
    }
    const ack = await ackPromise;
    if (ack?.controller) applyControllerAccess(ack.controller);
    const controlResult = ack?.commandResult;
    if (controlResult && typeof controlResult === 'object') {
      if (typeof controlResult.volume === 'number' && Number.isFinite(controlResult.volume)) setSystemVolume(Math.round(controlResult.volume));
      if (typeof controlResult.muted === 'boolean') setSystemMuted(controlResult.muted);
      if (typeof controlResult.brightness === 'number' && Number.isFinite(controlResult.brightness)) setDisplayBrightness(Math.round(controlResult.brightness));
      if (typeof controlResult.brightnessSupported === 'boolean') setBrightnessSupported(controlResult.brightnessSupported);
    }
    if (ack?.authoritativeTelemetry) ingestTelemetry(ack.authoritativeTelemetry);
    const applied = !controlResult || controlResult.applied !== false;
    const normalizedAck = ack?.ok && !applied
      ? { ...ack, ok: false, error: controlResult.failureCode || 'The active provider did not accept that control.' }
      : ack;
    if (normalizedAck?.ok) {
      setRemoteError('');
      if (action === 'cursor_move' && normalizedAck.pointer) cursorRef.current = { xRatio: normalizedAck.pointer.x, yRatio: normalizedAck.pointer.y };
    } else setRemoteError(normalizedAck?.error || 'Desktop did not acknowledge the command.');
    return normalizedAck;
  };
  sendCommandRef.current = sendRemoteCommand;

  const setSysVolume = async (v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setSystemVolume(clamped);
    return sendRemoteCommand('system.volume.set', clamped);
  };
  const toggleSysMute = async () => {
    const next = !systemMuted;
    setSystemMuted(next);
    return sendRemoteCommand('system.volume.mute', next);
  };
  const setDispBrightness = async (b: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(b)));
    setDisplayBrightness(clamped);
    return sendRemoteCommand('display.brightness.set', clamped);
  };

  const takeControl = async () => sendRemoteCommand('smart_connect_take_control');

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
    controllerAccess, controllerRole: controllerAccess.role, isActiveController: controllerAccess.isActiveController,
    activeControllerName: controllerAccess.activeControllerName, canTakeControl: controllerAccess.canTakeControl, takeControl,
    telemetry, latency, isScrubbing, setIsScrubbing, pendingTranscript,
    confirmVerificationPhrase, rejectVerificationPhrase,
    isPointerGestureActive, onTouchpadLayout, pointerMode, setPointerMode,
    systemVolume, systemMuted, displayBrightness, brightnessSupported,
    setSystemVolume: setSysVolume, toggleSystemMute: toggleSysMute, setDisplayBrightness: setDispBrightness,
  };
}

export type ConnectController = ReturnType<typeof useConnectController>;
