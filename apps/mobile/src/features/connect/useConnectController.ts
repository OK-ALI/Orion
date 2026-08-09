import { useEffect, useRef, useState } from "react";
import { Animated, AppState, PanResponder, Platform, TextInput } from "react-native";
import { useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { mmkvStorageAdapter } from "../../services/storageAdapter";
import { SMART_CONNECT_PROTOCOL_VERSION } from "@orion/shared/types";
import {
  discoverSmartConnectDesktops,
  inspectSmartConnectEndpoint,
  scanSmartConnectSubnet,
  type SmartConnectDiscoveryResult,
} from "../../services/smartConnectDiscovery";
import { stopNativeSmartConnectDiscovery } from '../../services/nativeSmartConnectDiscovery';
import { reportMobileDiagnosticError, updateMobileDiagnostics } from "../../services/mobileDiagnostics";
import { createRemoteCommand } from "./commandController";
import { formatConnectTime, IDLE_CONNECT_STATUS } from "./connectStatus";
import { normalizeDesktopAddress, parsePairingPayload } from "./pairingController";
import { smartConnectHttpUrl, smartConnectSocketUrl } from "./sessionTransport";
import { clearPairingGuard, writePairingGuard } from './pairingGuardStore';
import { usePairingGuardState } from './usePairingGuardState';
export function useConnectController() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [desktopIp, setDesktopIp] = useState('');
  const [desktopPort, setDesktopPort] = useState(8924);
  const [pairToken, setPairToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [pairError, setPairError] = useState('');
  const [remoteError, setRemoteError] = useState('');
  const [qrNotice, setQrNotice] = useState('');
  const [connectionState, setConnectionState] = useState<'idle' | 'discovering' | 'pairing' | 'connected' | 'reconnecting' | 'endpoint-lost' | 'token-rejected' | 'code-expired' | 'locked-out' | 'protocol-mismatch' | 'failed'>('idle');
  const [discoveredDesktops, setDiscoveredDesktops] = useState<SmartConnectDiscoveryResult[]>([]);
  const [deviceName, setDeviceName] = useState('Orion Mobile');
  const { attemptsRemaining, lockoutSeconds, lockoutUntil, setAttemptsRemaining, setLockoutUntil } = usePairingGuardState();
  const socketRef = useRef<WebSocket | null>(null);
  const socketHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectingRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const appActiveRef = useRef(true);
  const connectionRef = useRef({ connected: false, ip: '', port: 8924, token: null as string | null, deviceId: '' });
  const sendCommandRef = useRef<(cmd: string, value?: any) => Promise<any>>(
    async () => ({ ok: false, error: 'Remote transport is not ready.' }),
  );
  const sequenceRef = useRef(0);
  const pendingAcks = useRef(new Map<string, { resolve: (value: any) => void; timer: ReturnType<typeof setTimeout> }>());
  const gestureStart = useRef({ x: 0.5, y: 0.5 });
  const lastPointerSentAt = useRef(0);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [pairingMethod, setPairingMethod] = useState<'pin' | 'qr' | 'ip'>('pin');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  useEffect(() => {
    connectionRef.current = { connected: isConnected, ip: desktopIp, port: desktopPort, token: pairToken, deviceId };
    updateMobileDiagnostics({
      smartConnectState: connectionState,
    });
  }, [isConnected, connectionState, desktopIp, desktopPort, pairToken, deviceId]);
  useEffect(() => {
    const message = remoteError || pairError;
    if (message) {
      reportMobileDiagnosticError({
        area: 'smart-connect',
        code: remoteError ? 'REMOTE_TRANSPORT_ERROR' : 'PAIRING_ERROR',
        message,
      });
    }
  }, [pairError, remoteError]);
  useEffect(() => {
    if (lockoutUntil && lockoutUntil > Date.now()) setConnectionState('locked-out');
    else if (connectionState === 'locked-out') {
      setConnectionState('idle');
      setPairError('You can try pairing again now.');
    }
  }, [lockoutUntil, connectionState]);
  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('orion_connect_token'),
      SecureStore.getItemAsync('orion_connect_device_id'),
      SecureStore.getItemAsync('orion_connect_device_name'),
    ]).then(async ([token, storedDeviceId, storedDeviceName]) => {
      const nextDeviceId = storedDeviceId || `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      if (!storedDeviceId) await SecureStore.setItemAsync('orion_connect_device_id', nextDeviceId).catch(() => {});
      setDeviceId(nextDeviceId);
      if (storedDeviceName) setDeviceName(storedDeviceName);
      if (token) setPairToken(token);
    }).catch(() => {});
  }, []);
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (hasScanned || isConnecting) return;
    setHasScanned(true);
    try {
      const { ip, pin } = parsePairingPayload(data);
      if (ip) {
        setDesktopIp(ip);
        if (pin) setPinCode(pin);
        handleConnect(ip, pin, undefined, 'qr');
      } else {
        setQrNotice('This QR code does not contain a valid Orion Connect address. Generate a fresh code on Orion Desktop and try again.');
      }
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setHasScanned(false), 3000);
  };
  const [pinCode, setPinCode] = useState('');
  const hiddenPinInputRef = useRef<TextInput>(null);
  const [activeTab, setActiveTab] = useState<'touchpad' | 'dpad' | 'playback' | 'keyboard'>('touchpad');
  const [navFocusMode, setNavFocusMode] = useState<'sidebar' | 'content'>('sidebar');
  const [searchTarget, setSearchTarget] = useState<'cinema' | 'constellation'>('cinema');
  const cursorRef = useRef({ xRatio: 0.5, yRatio: 0.5 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStart.current = { x: cursorRef.current.xRatio, y: cursorRef.current.yRatio };
      },
      onPanResponderMove: (evt, gestureState) => {
        const sensitivity = 0.0015;
        let newX = gestureStart.current.x + gestureState.dx * sensitivity;
        let newY = gestureStart.current.y + gestureState.dy * sensitivity;
        newX = Math.max(0, Math.min(1, newX));
        newY = Math.max(0, Math.min(1, newY));
        cursorRef.current.xRatio = newX;
        cursorRef.current.yRatio = newY;
        const now = Date.now();
        if (now - lastPointerSentAt.current >= 33) {
          lastPointerSentAt.current = now;
          void sendCommandRef.current('cursor_move', { x: newX, y: newY });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          void sendCommandRef.current('cursor_click');
        }
      },
    })
  ).current;
  const connectSocket = (ip: string, token: string, activeDeviceId: string, port = desktopPort) => {
    if (!ip || !token || !activeDeviceId) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketHeartbeatRef.current) {
      clearInterval(socketHeartbeatRef.current);
      socketHeartbeatRef.current = null;
    }
    try { socketRef.current?.close(); } catch {}
    setConnectionState(reconnectAttemptRef.current ? 'reconnecting' : 'pairing');
    const socket = new WebSocket(smartConnectSocketUrl(ip, token, port));
    socketRef.current = socket;
    socket.onmessage = (event) => {
      try {
        const envelope = JSON.parse(String(event.data));
        if (envelope.type === 'ack') {
          const pending = pendingAcks.current.get(envelope.payload?.id);
          if (pending) {
            clearTimeout(pending.timer);
            pendingAcks.current.delete(envelope.payload.id);
            pending.resolve(envelope.payload);
          }
        }
        if (envelope.type === 'status') {
          setIsConnected(envelope.payload?.connected !== false);
          setConnectionState('connected');
          updateMobileDiagnostics({
            smartConnectState: 'connected',
            smartConnectReconnectAttempt: 0,
            smartConnectLastAuthenticatedAt: Date.now(),
          });
          setRemoteError('');
          const p = envelope.payload?.playback;
          if (p) {
            setNowPlaying({
              title: p.title || 'Desktop Connected',
              type: p.mediaType || 'Movie',
              progress: p.duration ? `${formatConnectTime(p.currentTime)} / ${formatConnectTime(p.duration)}` : 'Streaming Live',
              currentTime: p.currentTime || 0,
              duration: p.duration || 0,
              paused: Boolean(p.paused),
              hasMedia: Boolean(p.title),
            });
            setIsPlaying(!p.paused);
          }
        }
      } catch {}
    };
    socket.onopen = () => {
      disconnectingRef.current = false;
      reconnectAttemptRef.current = 0;
      setConnectionState('pairing');
      setRemoteError('');
      mmkvStorageAdapter.set('orion_smart_connect_trusted_endpoint_v1', JSON.stringify({
        host: ip,
        port,
        lastVerifiedAt: Date.now(),
        discoveryMethod: 'saved',
      }));
      const sendHeartbeat = () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
          version: SMART_CONNECT_PROTOCOL_VERSION,
          type: 'heartbeat',
          deviceId: activeDeviceId,
          payload: { at: Date.now() },
        }));
      };
      sendHeartbeat();
      socketHeartbeatRef.current = setInterval(sendHeartbeat, 15000);
    };
    socket.onclose = () => {
      if (socketHeartbeatRef.current) {
        clearInterval(socketHeartbeatRef.current);
        socketHeartbeatRef.current = null;
      }
      if (socketRef.current === socket) {
        socketRef.current = null;
        setIsConnected(false);
        for (const [id, pending] of pendingAcks.current) {
          clearTimeout(pending.timer);
          pending.resolve({ id, ok: false, error: 'Desktop connection closed.' });
        }
        pendingAcks.current.clear();
        if (!disconnectingRef.current) {
          reconnectAttemptRef.current += 1;
          setConnectionState('reconnecting');
          updateMobileDiagnostics({ smartConnectReconnectAttempt: reconnectAttemptRef.current });
          const baseDelay = Math.min(15_000, 1_000 * (2 ** Math.min(4, reconnectAttemptRef.current - 1)));
          const delay = baseDelay + Math.round(Math.random() * 350);
          reconnectTimerRef.current = setTimeout(() => {
            const current = connectionRef.current;
            if (appActiveRef.current && current.token && current.deviceId && current.ip) {
              connectSocket(current.ip, current.token, current.deviceId, current.port);
            }
          }, delay);
        }
      }
    };
    socket.onerror = () => {
      setRemoteError('Desktop connection was interrupted. Orion will retry automatically.');
    };
  };
  useEffect(() => () => {
    disconnectingRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (socketHeartbeatRef.current) clearInterval(socketHeartbeatRef.current);
    for (const pending of pendingAcks.current.values()) clearTimeout(pending.timer);
    pendingAcks.current.clear();
    try { socketRef.current?.close(); } catch {}
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      appActiveRef.current = state === 'active';
      if (!appActiveRef.current) {
        stopNativeSmartConnectDiscovery();
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
        return;
      }
      const current = connectionRef.current;
      if (current.token && current.deviceId && current.ip && socketRef.current?.readyState !== WebSocket.OPEN) {
        reconnectAttemptRef.current = 0;
        connectSocket(current.ip, current.token, current.deviceId, current.port);
      }
    });
    return () => subscription.remove();
  }, []);
  const handleTouchpadClick = () => {
    sendRemoteCommand('cursor_click');
  };
  const pageShortcutItems = [
    { id: 'home', label: 'Home', icon: 'home-outline' },
    { id: 'search', label: 'Search', icon: 'search-outline' },
    { id: 'discover', label: 'Discover', icon: 'compass-outline' },
    { id: 'constellation', label: 'Constellation', icon: 'planet-outline' },
    { id: 'library', label: 'Library', icon: 'library-outline' },
    { id: 'downloads', label: 'Downloads', icon: 'download-outline' },
    { id: 'music-home', label: 'Music', icon: 'musical-notes-outline' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeedIndex, setCurrentSpeedIndex] = useState(0);
  const speeds = ['1.0x', '1.25x', '1.5x', '2.0x'];
  const [remoteText, setRemoteText] = useState('');
  const [nowPlaying, setNowPlaying] = useState(IDLE_CONNECT_STATUS);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const formatTime = formatConnectTime;
  useEffect(() => {
    let savedIp = desktopIp;
    let savedPort = desktopPort;
    try {
      if (typeof window !== 'undefined') {
        const storedIp = mmkvStorageAdapter.get('orion_desktop_ip');
        const storedEndpoint = JSON.parse(mmkvStorageAdapter.get('orion_smart_connect_trusted_endpoint_v1') || 'null');
        if (storedEndpoint?.host) {
          savedIp = storedEndpoint.host;
          savedPort = Number(storedEndpoint.port || 8924);
          setDesktopPort(savedPort);
        }
        if (storedIp) {
          savedIp = storedIp;
          setDesktopIp(storedIp);
        }
      }
    } catch (err) {}
    const checkServer = async () => {
      const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
      const targetIps = Array.from(new Set([savedIp, hostname, '127.0.0.1', 'localhost'])).filter(Boolean);
      let serverReachable = false;
      for (const ip of targetIps) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1200);
          const res = await fetch(smartConnectHttpUrl(ip, '/api/status', savedPort), {
            signal: controller.signal,
            headers: pairToken ? { Authorization: `Bearer ${pairToken}` } : undefined,
          });
          clearTimeout(timer);
          if (res.ok) {
            serverReachable = true;
            const data = await res.json();
            const guard = data.pairingGuard;
            if (guard) {
              const nextUntil = Number(guard.lockedUntil || 0);
              const remaining = Number(guard.attemptsRemaining);
              if (Number.isFinite(remaining)) setAttemptsRemaining(remaining);
              if (nextUntil > Date.now()) {
                setLockoutUntil(nextUntil);
                setConnectionState('locked-out');
              }
              writePairingGuard({
                attemptsRemaining: Number.isFinite(remaining) ? remaining : null,
                lockoutUntil: nextUntil || null,
              });
            }
            setDesktopIp(ip);
            setDesktopPort(Number(data.port || savedPort));
            mmkvStorageAdapter.set('orion_desktop_ip', ip);
            if (pairToken && data.paired === false) {
              setIsConnected(false);
              setConnectionState('token-rejected');
              setPairToken(null);
              await SecureStore.deleteItemAsync('orion_connect_token').catch(() => {});
              setPairError('This Desktop no longer trusts this device. Pair again to reconnect.');
              break;
            }
            if (data.paired && pairToken && deviceId && socketRef.current?.readyState !== WebSocket.OPEN) {
              connectSocket(ip, pairToken, deviceId, Number(data.port || savedPort));
            }
            if (data.playback && data.playback.title) {
              const p = data.playback;
              const cur = formatConnectTime(p.currentTime);
              const dur = formatConnectTime(p.duration);
              setNowPlaying({
                title: p.title,
                type: p.mediaType || 'Movie',
                progress: dur !== '0:00' ? `${cur} / ${dur}` : 'Streaming Live',
                currentTime: p.currentTime || 0,
                duration: p.duration || 0,
                paused: Boolean(p.paused),
                hasMedia: true,
              });
              setIsPlaying(!p.paused);
            } else {
              setNowPlaying(IDLE_CONNECT_STATUS);
            }
            break;
          }
        } catch (err) {}
      }
      if (!serverReachable && socketRef.current?.readyState !== WebSocket.OPEN) {
        setIsConnected(false);
        if (pairToken) setConnectionState('endpoint-lost');
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 4000);
    return () => clearInterval(interval);
  }, [pairToken, deviceId]);
  const useNativeDriver = Platform.OS !== 'web';
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1200, useNativeDriver }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver }),
      ])
    ).start();
  }, []);
  useEffect(() => {
    if (showPairingModal && pairingMethod === 'qr') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 140, duration: 1400, useNativeDriver }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1400, useNativeDriver }),
        ])
      ).start();
    }
  }, [showPairingModal, pairingMethod]);
  const discoverDesktop = async () => {
    setIsDiscovering(true);
    setConnectionState('discovering');
    setPairError('');
    try {
      const storedIp = mmkvStorageAdapter.get('orion_desktop_ip');
      const trusted = JSON.parse(mmkvStorageAdapter.get('orion_smart_connect_trusted_endpoint_v1') || 'null');
      const discovery = await discoverSmartConnectDesktops(
        [{ host: trusted?.host, port: trusted?.port }, { host: desktopIp, port: desktopPort }, { host: storedIp, port: 8924 }],
        SMART_CONNECT_PROTOCOL_VERSION,
      );
      setDiscoveredDesktops(discovery.results);
      updateMobileDiagnostics({
        smartConnectState: discovery.results.length ? 'desktop-found' : 'endpoint-lost',
        smartConnectDiscoveryMethod: discovery.results[0]?.discoveryMethod || 'nsd',
        smartConnectDiscoveryDurationMs: discovery.durationMs,
        smartConnectNsdResultCount: discovery.nsdResultCount,
      });
      return discovery.results;
    } finally {
      setIsDiscovering(false);
    }
  };
  const handleConnect = async (
    targetIp?: string,
    targetPin?: string,
    targetPort?: number,
    requestedMethod?: 'saved' | 'nsd' | 'qr' | 'direct-ip' | 'subnet-fallback',
  ) => {
    setIsConnecting(true);
    setPairError('');
    let pairedSuccess = false;
    let errorMessage = '';
    let resolvedPort = Number(targetPort || desktopPort || 8924);
    let rawIpInput = (targetIp || desktopIp || '').trim();
    if (!rawIpInput || (pairingMethod === 'pin' && !targetIp)) {
      const discovered = await discoverDesktop();
      if (!discovered.length) {
        const message = 'Orion Desktop was not found automatically. Keep both devices on the same Wi-Fi, open Smart Connect on Desktop, or use Direct IP.';
        setPairError(message);
        setIsConnecting(false);
        return;
      }
      if (discovered.length > 1) {
        setPairError('More than one Orion Desktop was found. Choose one below.');
        setIsConnecting(false);
        return;
      }
      rawIpInput = discovered[0].host;
      setDesktopIp(rawIpInput);
      resolvedPort = discovered[0].port;
      setDesktopPort(resolvedPort);
    }
    const cleanIp = normalizeDesktopAddress(rawIpInput);
    const sendPin = targetPin || pinCode;
    const hostname = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : '';
    const targetIps = Array.from(new Set([cleanIp, hostname])).filter(Boolean);
    for (const ip of targetIps) {
      try {
        const discoveryMethod = requestedMethod
          || (pairingMethod === 'qr' ? 'qr' : targetIp ? 'direct-ip' : 'nsd');
        const endpoint = await inspectSmartConnectEndpoint(
          ip,
          resolvedPort,
          SMART_CONNECT_PROTOCOL_VERSION,
          discoveryMethod,
        );
        if (!endpoint.ok) {
          if (endpoint.errorCode === 'protocol-mismatch') {
            setConnectionState('protocol-mismatch');
            errorMessage = 'This Orion Desktop uses an incompatible Smart Connect protocol. Update both applications and try again.';
            updateMobileDiagnostics({ smartConnectPairingFailure: 'PROTOCOL_MISMATCH' });
            break;
          }
          setConnectionState('endpoint-lost');
          errorMessage = 'Orion Desktop is not reachable at this address. Confirm both devices are on the same Wi-Fi and try again.';
          continue;
        }
        resolvedPort = endpoint.result.port;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        setConnectionState('pairing');
        const res = await fetch(smartConnectHttpUrl(ip, '/api/pair', resolvedPort), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: sendPin, token: pairToken, deviceId, deviceName }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (res.ok && data.ok) {
          pairedSuccess = true;
          setDesktopIp(ip);
          if (data.token) {
            disconnectingRef.current = false;
            setPairToken(data.token);
            await SecureStore.setItemAsync('orion_connect_token', data.token).catch(() => {});
            connectSocket(ip, data.token, data.deviceId || deviceId, resolvedPort);
          }
          mmkvStorageAdapter.set('orion_desktop_ip', ip);
          mmkvStorageAdapter.set('orion_smart_connect_trusted_endpoint_v1', JSON.stringify({
            instanceId: data.instanceId || '', host: ip, port: resolvedPort, lastVerifiedAt: Date.now(), discoveryMethod,
          }));
          mmkvStorageAdapter.set('orion_pair_status', JSON.stringify({ paired: true, time: Date.now() }));
          setAttemptsRemaining(null);
          setLockoutUntil(null);
          clearPairingGuard();
          break;
        } else if (data.error) {
          const error = typeof data.error === 'object' ? data.error : { code: 'FAILED', message: String(data.error) };
          errorMessage = error.message;
          if (Number.isFinite(Number(error.attemptsRemaining))) {
            const remaining = Number(error.attemptsRemaining);
            setAttemptsRemaining(remaining);
            writePairingGuard({
              attemptsRemaining: remaining,
              lockoutUntil: error.code === 'LOCKED_OUT' ? Date.now() + Math.max(0, Number(error.retryAfterMs || 0)) : null,
            });
            if (error.code === 'INVALID_CODE') {
              errorMessage = `Incorrect pairing code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`;
            }
          }
          if (error.code === 'CODE_EXPIRED') setConnectionState('code-expired');
          else if (error.code === 'LOCKED_OUT') {
            setConnectionState('locked-out');
            const retryAfterMs = Math.max(0, Number(error.retryAfterMs || 0));
            if (retryAfterMs) setLockoutUntil(Date.now() + retryAfterMs);
            updateMobileDiagnostics({
              smartConnectPairingFailure: 'LOCKED_OUT',
              smartConnectLockoutUntil: retryAfterMs ? Date.now() + retryAfterMs : null,
            });
            errorMessage = retryAfterMs
              ? `Too many pairing attempts. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`
              : error.message;
          }
          else if (error.code === 'TOKEN_REJECTED') {
            setConnectionState('token-rejected');
            setPairToken(null);
            await SecureStore.deleteItemAsync('orion_connect_token').catch(() => {});
          } else if (error.code === 'PROTOCOL_MISMATCH') setConnectionState('protocol-mismatch');
          else setConnectionState('failed');
          if (error.code !== 'LOCKED_OUT') {
            updateMobileDiagnostics({ smartConnectPairingFailure: String(error.code || 'FAILED') });
          }
        }
      } catch (e) {}
    }
    setIsConnecting(false);
    if (pairedSuccess) {
      setShowPairingModal(false);
      setPairError('');
    } else {
      setIsConnected(false);
      const message = errorMessage || `Could not pair with Orion Desktop at ${cleanIp}:${resolvedPort}. Check the code and network, then try again.`;
      if (/expired/i.test(message)) setPinCode('');
      setPairError(message);
    }
  };
  const prepareDirectIp = async () => {
    const cleanIp = normalizeDesktopAddress(desktopIp.trim());
    if (!cleanIp) {
      setPairError('Enter the Desktop address shown in Orion Desktop.');
      return;
    }
    setIsConnecting(true);
    setPairError('Checking this Desktop address…');
    const endpoint = await inspectSmartConnectEndpoint(
      cleanIp,
      desktopPort,
      SMART_CONNECT_PROTOCOL_VERSION,
      'direct-ip',
    ).catch(() => ({ ok: false as const, errorCode: 'endpoint-lost' as const }));
    setIsConnecting(false);
    if (!endpoint.ok) {
      setConnectionState(endpoint.errorCode === 'protocol-mismatch' ? 'protocol-mismatch' : 'endpoint-lost');
      setPairError(endpoint.errorCode === 'protocol-mismatch'
        ? 'This Desktop uses an incompatible Orion Connect version.'
        : 'No Orion Desktop responded at this address. Check the address and Wi-Fi connection.');
      return;
    }
    setDesktopIp(endpoint.result.host);
    setDesktopPort(endpoint.result.port);
    mmkvStorageAdapter.set('orion_desktop_ip', endpoint.result.host);
    if (pairToken) {
      void handleConnect(endpoint.result.host, undefined, endpoint.result.port, 'direct-ip');
      return;
    }
    setPairingMethod('pin');
    setPinCode('');
    setPairError(`Desktop found. Enter the six-digit code shown on ${endpoint.result.displayName}.`);
  };
  const chooseDiscoveredDesktop = (desktop: SmartConnectDiscoveryResult) => {
    setDesktopIp(desktop.host);
    setDesktopPort(desktop.port);
    setDiscoveredDesktops([]);
    setPairError('');
    void handleConnect(desktop.host, undefined, desktop.port, desktop.discoveryMethod);
  };
  const runSubnetFallback = async () => {
    setIsDiscovering(true);
    setPairError('Scanning the local network by request…');
    const results = await scanSmartConnectSubnet(SMART_CONNECT_PROTOCOL_VERSION).catch(() => []);
    setIsDiscovering(false);
    setDiscoveredDesktops(results);
    setPairError(results.length ? 'Choose the Orion Desktop you want to pair.' : 'No compatible Orion Desktop was found on this subnet.');
  };
  const renameThisDevice = async (name: string) => {
    const cleanName = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'Orion Mobile';
    setDeviceName(cleanName);
    await SecureStore.setItemAsync('orion_connect_device_name', cleanName).catch(() => {});
    if (!pairToken || !desktopIp) return { ok: true };
    const response = await fetch(smartConnectHttpUrl(desktopIp, '/api/device', desktopPort), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pairToken}` },
      body: JSON.stringify({ action: 'rename', deviceName: cleanName }),
    }).catch(() => null);
    const ok = Boolean(response?.ok);
    updateMobileDiagnostics({ smartConnectLastDeviceAck: ok ? 'rename-confirmed' : 'rename-failed' });
    return { ok };
  };
  const handlePinChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 6);
    setPinCode(clean);
    if (clean.length === 6) {
      handleConnect(undefined, clean);
    }
  };
  const handleDisconnect = async () => {
    disconnectingRef.current = true;
    setIsConnected(false);
    setShowDisconnectModal(false);
    setPinCode('');
    const token = pairToken;
    setPairToken(null);
    if (socketHeartbeatRef.current) {
      clearInterval(socketHeartbeatRef.current);
      socketHeartbeatRef.current = null;
    }
    try { socketRef.current?.close(); } catch {}
    socketRef.current = null;
    await SecureStore.deleteItemAsync('orion_connect_token').catch(() => {});
    const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
    const targetIps = Array.from(new Set([desktopIp, hostname, '127.0.0.1', 'localhost'])).filter(Boolean);
    for (const ip of targetIps) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1200);
        await fetch(smartConnectHttpUrl(ip, '/api/unpair', desktopPort), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ token }),
          signal: controller.signal
        });
        clearTimeout(timer);
      } catch (e) {}
    }
    try {
      if (typeof window !== 'undefined') {
        mmkvStorageAdapter.set('orion_pair_status', JSON.stringify({ paired: false, time: Date.now() }));
      }
    } catch (e) {}
  };
  const sendRemoteCommand = async (cmd: string, val?: any) => {
    if (!isConnected) {
      const failure = { ok: false, error: 'Desktop is not live. Reconnecting…' };
      setRemoteError(failure.error);
      return failure;
    }
    const sequence = ++sequenceRef.current;
    const command = createRemoteCommand(cmd, val, deviceId, sequence);
    const { id } = command;
    let ack: any = null;
    const socketWasOpen = socketRef.current?.readyState === WebSocket.OPEN;
    if (socketWasOpen) {
      ack = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingAcks.current.delete(id);
          resolve({ ok: false, error: 'Desktop acknowledgement timed out.' });
        }, 2200);
        pendingAcks.current.set(id, { resolve, timer });
        socketRef.current?.send(JSON.stringify({
          version: SMART_CONNECT_PROTOCOL_VERSION,
          type: 'command',
          deviceId,
          payload: command,
        }));
      });
    }
    const transportFailed = !socketWasOpen
      || (!ack?.ok && /timed out|connection closed/i.test(String(ack?.error || '')));
    if (transportFailed) {
      const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
      const targetIps = Array.from(new Set([desktopIp, hostname, '127.0.0.1', 'localhost'])).filter(Boolean);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (pairToken) headers.Authorization = `Bearer ${pairToken}`;
      for (const ip of targetIps) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(smartConnectHttpUrl(ip, '/api/command', desktopPort), {
            method: 'POST',
            headers,
            body: JSON.stringify({ command }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          const result = await res.json();
          if (res.ok && result.ack?.ok) {
            ack = result.ack;
            setDesktopIp(ip);
            break;
          }
        } catch {}
      }
    }
    if (ack?.ok) {
      setRemoteError('');
      if (cmd === 'toggle_play') setIsPlaying((value) => !value);
      if (cmd === 'volume_up') setVolume((value) => Math.min(100, value + 5));
      if (cmd === 'volume_down') setVolume((value) => Math.max(0, value - 5));
      if (cmd === 'toggle_mute') setIsMuted((value) => !value);
      if (cmd === 'cursor_move' && ack.pointer) {
        cursorRef.current = { xRatio: ack.pointer.x, yRatio: ack.pointer.y };
      }
    } else {
      setRemoteError(ack?.error || 'Desktop did not acknowledge the command.');
    }
    return ack || { ok: false, error: 'Desktop did not acknowledge the command.' };
  };
  sendCommandRef.current = sendRemoteCommand;
  return {
    activeTab,
    cameraPermission,
    currentSpeedIndex,
    desktopIp,
    formatTime,
    handleBarCodeScanned,
    handleConnect,
    handleDisconnect,
    handlePinChange,
    hiddenPinInputRef,
    isConnected,
    isConnecting,
    isDiscovering,
    isMuted,
    isPlaying,
    navFocusMode,
    nowPlaying,
    pageShortcutItems,
    pairError,
    pairingMethod,
    panResponder,
    pinCode,
    pulseAnim,
    qrNotice,
    remoteError,
    remoteText,
    requestCameraPermission,
    scanLineAnim,
    searchTarget,
    sendRemoteCommand,
    setActiveTab,
    setCurrentSpeedIndex,
    setQrNotice,
    setDesktopIp,
    setNavFocusMode,
    setPairingMethod,
    setPinCode,
    setRemoteText,
    setSearchTarget,
    setShowDisconnectModal,
    setShowPairingModal,
    showDisconnectModal,
    showPairingModal,
    speeds,
    volume,
    connectionState,
    discoveredDesktops,
    chooseDiscoveredDesktop,
    discoverDesktop,
    runSubnetFallback,
    deviceName,
    renameThisDevice,
    desktopPort,
    lockoutSeconds,
    attemptsRemaining,
    prepareDirectIp,
  };
}

export type ConnectController = ReturnType<typeof useConnectController>;
