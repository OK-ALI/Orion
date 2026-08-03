import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Platform, TextInput } from "react-native";
import { useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { mmkvStorageAdapter } from "../../services/storageAdapter";
import { SMART_CONNECT_PROTOCOL_VERSION } from "@orion/shared/types";
import { discoverSmartConnectDesktop } from "../../services/smartConnectDiscovery";
import {
  reportMobileDiagnosticError,
  updateMobileDiagnostics,
} from "../../services/mobileDiagnostics";
import { createRemoteCommand } from "./commandController";
import { formatConnectTime, IDLE_CONNECT_STATUS } from "./connectStatus";
import { normalizeDesktopAddress, parsePairingPayload } from "./pairingController";
import { smartConnectHttpUrl, smartConnectSocketUrl } from "./sessionTransport";
export function useConnectController() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [desktopIp, setDesktopIp] = useState('');
  const [pairToken, setPairToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [pairError, setPairError] = useState('');
  const [remoteError, setRemoteError] = useState('');
  const [qrNotice, setQrNotice] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const socketHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectingRef = useRef(false);
  const connectionRef = useRef({ connected: false, ip: '', token: null as string | null, deviceId: '' });
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
    connectionRef.current = { connected: isConnected, ip: desktopIp, token: pairToken, deviceId };
    updateMobileDiagnostics({
      smartConnectState: isConnected ? 'connected' : (isConnecting ? 'connecting' : 'disconnected'),
    });
  }, [isConnected, isConnecting, desktopIp, pairToken, deviceId]);
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
    Promise.all([
      SecureStore.getItemAsync('orion_connect_token'),
      SecureStore.getItemAsync('orion_connect_device_id'),
    ]).then(async ([token, storedDeviceId]) => {
      const nextDeviceId = storedDeviceId || `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      if (!storedDeviceId) await SecureStore.setItemAsync('orion_connect_device_id', nextDeviceId).catch(() => {});
      setDeviceId(nextDeviceId);
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
        handleConnect(ip, pin);
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
  const connectSocket = (ip: string, token: string, activeDeviceId: string) => {
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
    const socket = new WebSocket(smartConnectSocketUrl(ip, token));
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
      setIsConnected(true);
      setRemoteError('');
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
          reconnectTimerRef.current = setTimeout(() => {
            const current = connectionRef.current;
            if (current.token && current.deviceId && current.ip) {
              connectSocket(current.ip, current.token, current.deviceId);
            }
          }, 1800);
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
    try {
      if (typeof window !== 'undefined') {
        const storedIp = mmkvStorageAdapter.get('orion_desktop_ip');
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
          const res = await fetch(smartConnectHttpUrl(ip, '/api/status'), {
            signal: controller.signal,
            headers: pairToken ? { Authorization: `Bearer ${pairToken}` } : undefined,
          });
          clearTimeout(timer);
          if (res.ok) {
            serverReachable = true;
            const data = await res.json();
            setDesktopIp(ip);
            mmkvStorageAdapter.set('orion_desktop_ip', ip);
            setIsConnected(Boolean(data.connected));
            if (data.paired && pairToken && deviceId && socketRef.current?.readyState !== WebSocket.OPEN) {
              connectSocket(ip, pairToken, deviceId);
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
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 1500);
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
    setPairError('');
    try {
      const storedIp = mmkvStorageAdapter.get('orion_desktop_ip');
      return discoverSmartConnectDesktop(
        [desktopIp, storedIp],
        SMART_CONNECT_PROTOCOL_VERSION,
      );
    } finally {
      setIsDiscovering(false);
    }
  };
  const handleConnect = async (targetIp?: string, targetPin?: string) => {
    setIsConnecting(true);
    setPairError('');
    let pairedSuccess = false;
    let errorMessage = '';
    let rawIpInput = (targetIp || desktopIp || '').trim();
    if (!rawIpInput || (pairingMethod === 'pin' && !targetIp)) {
      const discovered = await discoverDesktop();
      if (!discovered) {
        const message = 'Orion Desktop was not found automatically. Keep both devices on the same Wi-Fi, open Smart Connect on Desktop, or use Direct IP.';
        setPairError(message);
        setIsConnecting(false);
        return;
      }
      rawIpInput = discovered;
      setDesktopIp(discovered);
    }
    const cleanIp = normalizeDesktopAddress(rawIpInput);
    const sendPin = targetPin || pinCode;
    const hostname = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : '';
    const targetIps = Array.from(new Set([cleanIp, hostname])).filter(Boolean);
    for (const ip of targetIps) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(smartConnectHttpUrl(ip, '/api/pair'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: sendPin, token: pairToken, deviceId, deviceName: 'Orion Mobile' }),
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
            connectSocket(ip, data.token, data.deviceId || deviceId);
          }
          mmkvStorageAdapter.set('orion_desktop_ip', ip);
          mmkvStorageAdapter.set('orion_pair_status', JSON.stringify({ paired: true, time: Date.now() }));
          break;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } catch (e) {}
    }
    setIsConnecting(false);
    if (pairedSuccess) {
      setShowPairingModal(false);
      setPairError('');
    } else {
      setIsConnected(false);
      const message = errorMessage || `Could not pair with Orion Desktop at ${cleanIp}:8924. Check the code and network, then try again.`;
      if (/expired/i.test(message)) setPinCode('');
      setPairError(message);
    }
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
        await fetch(smartConnectHttpUrl(ip, '/api/unpair'), {
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
          const res = await fetch(smartConnectHttpUrl(ip, '/api/command'), {
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
    volume
  };
}
