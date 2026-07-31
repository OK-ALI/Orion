import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Pressable, TextInput, Animated, Modal, Alert, PanResponder } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { text, backgrounds, spacing, fontSizes, fontFamilies, accent, radii } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { mmkvStorageAdapter } from '../../src/services/storageAdapter';
import { SMART_CONNECT_PROTOCOL_VERSION } from '@orion/shared/types';
import { discoverSmartConnectDesktop } from '../../src/services/smartConnectDiscovery';

export default function ConnectScreen() {
  const router = useRouter();

  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [desktopIp, setDesktopIp] = useState('');
  const [pairToken, setPairToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [pairError, setPairError] = useState('');
  const [remoteError, setRemoteError] = useState('');
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
  }, [isConnected, desktopIp, pairToken, deviceId]);

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
      let ip = '';
      let pin = '';

      // Match raw IPv4 address anywhere in scanned string
      const ipMatch = data.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
      if (ipMatch) {
        ip = ipMatch[1];
      }

      // Match the current six-digit pairing code.
      const pinMatch = data.match(/pin[=:\s"']*([0-9]{6})/i);
      if (pinMatch) {
        pin = pinMatch[1];
      } else if (data.includes('{')) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ip) ip = String(parsed.ip);
          if (parsed.pin) pin = String(parsed.pin);
        } catch (e) {}
      }

      if (ip) {
        setDesktopIp(ip);
        if (pin) setPinCode(pin);
        handleConnect(ip, pin);
      } else {
        alert(`Scanned QR code: ${data}, but no valid IP address found.`);
      }
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => setHasScanned(false), 3000);
  };
  
  // Continuous six-digit PIN state
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
        // Laptop trackpad logic: relative movement (dx, dy)
        // dx and dy are scaled down to match the ratio (0 to 1) screen scale
        const sensitivity = 0.0015;
        let newX = gestureStart.current.x + gestureState.dx * sensitivity;
        let newY = gestureStart.current.y + gestureState.dy * sensitivity;
        
        // Clamp to 0-1
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
        // Detect a tap (if movement was very small)
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
    const socket = new WebSocket(`ws://${ip}:8924/api/socket?token=${encodeURIComponent(token)}`);
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
              progress: p.duration ? `${formatTime(p.currentTime)} / ${formatTime(p.duration)}` : 'Streaming Live',
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

  // Remote Controls State
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeedIndex, setCurrentSpeedIndex] = useState(0);
  const speeds = ['1.0x', '1.25x', '1.5x', '2.0x'];
  const [remoteText, setRemoteText] = useState('');
  const [nowPlaying, setNowPlaying] = useState({
    title: 'Desktop Connected',
    type: 'System',
    progress: 'Idle / Browsing',
    currentTime: 0,
    duration: 0,
    paused: false,
    hasMedia: false,
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h}:${rm < 10 ? '0' : ''}${rm}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Load saved IP and Sync initial pairing state
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
          const res = await fetch(`http://${ip}:8924/api/status`, {
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
              const cur = formatTime(p.currentTime);
              const dur = formatTime(p.duration);
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
              setNowPlaying({
                title: 'Desktop Connected',
                type: 'System',
                progress: 'Idle / Browsing',
                currentTime: 0,
                duration: 0,
                paused: false,
                hasMedia: false,
              });
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
    let cleanIp = rawIpInput;
    const ipMatch = rawIpInput.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
    if (ipMatch) {
      cleanIp = ipMatch[1];
    } else {
      cleanIp = rawIpInput.replace(/^(https?:\/\/|orion:\/\/connect\?ip=)/i, '').replace(/:\d+.*$/, '');
    }

    const sendPin = targetPin || pinCode;
    const hostname = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : '';
    const targetIps = Array.from(new Set([cleanIp, hostname])).filter(Boolean);

    for (const ip of targetIps) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://${ip}:8924/api/pair`, {
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
        await fetch(`http://${ip}:8924/api/unpair`, {
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
    const id = `${deviceId || 'mobile'}-${Date.now()}-${sequence}`;
    const command = {
      id,
      sequence,
      action: cmd,
      value: cmd === 'cursor_move' ? undefined : val,
      pointer: cmd === 'cursor_move' ? {
        x: Math.max(0, Math.min(1, Number(val?.x ?? val?.xRatio) || 0)),
        y: Math.max(0, Math.min(1, Number(val?.y ?? val?.yRatio) || 0)),
      } : undefined,
      sentAt: Date.now(),
    };

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
          const res = await fetch(`http://${ip}:8924/api/command`, {
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

  return (
    <View style={styles.container}>
      {/* Orion Signature Crimson Gradient Backdrop */}
      <LinearGradient
        colors={['#250508', backgrounds.base, backgrounds.base, '#1a0407']}
        locations={[0, 0.35, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header — Padded past left floating sidebar trigger (≡) */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Orion Connect</Text>
        </View>

        <Pressable
          style={[
            styles.statusPill,
            isConnected ? styles.statusPillConnected : styles.statusPillDisconnected,
          ]}
          onPress={() => {
            if (isConnected) {
              setShowDisconnectModal(true);
            } else {
              setPairingMethod('pin');
              setShowPairingModal(true);
            }
          }}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#10b981' : '#f59e0b' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Live' : 'Pair Desktop'}
          </Text>
          {isConnected && <Ionicons name="power" size={12} color="#10b981" style={{ marginLeft: 2 }} />}
        </Pressable>
      </View>

      {!isConnected ? (
        /* Disconnected Hero Banner & Pairing Guide */
        <ScrollView contentContainerStyle={styles.pairingContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.iconInner}>
              <Ionicons name="wifi-outline" size={44} color="#f87171" />
            </View>
          </View>

          <Text style={styles.title}>Smart Remote & TV Pairing</Text>
          <Text style={styles.subtitle}>
            Control playback, browse your library, and cast streams to Orion Desktop directly from your phone.
          </Text>

          <View style={styles.stepsContainer}>
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Open Orion Desktop on your PC and click "Orion Connect"</Text>
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Ensure phone & PC are on the same Wi-Fi network</Text>
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Scan the QR code or enter the expiring six-digit code shown on Desktop</Text>
            </View>
          </View>

          {/* Action Row for Pairing Methods */}
          <View style={styles.pairingBtnGroup}>
            <Pressable
              style={({ pressed }) => [styles.primaryConnectBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setPairingMethod('pin');
                setPinCode('');
                setShowPairingModal(true);
              }}
            >
              <Ionicons name="keypad-outline" size={20} color="#fff" />
              <Text style={styles.primaryConnectBtnText}>Enter Pairing Code</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryConnectBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setPairingMethod('qr');
                setShowPairingModal(true);
              }}
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.secondaryConnectBtnText}>Scan QR Code</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        /* Connected Smart Remote Interface */
        <View style={styles.remoteLayout}>
          {/* Now Playing Mini Bar & Disconnect Trigger */}
          <View style={styles.nowPlayingBar}>
            <View style={styles.nowPlayingIconGlow}>
              <Ionicons name="tv-outline" size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                {nowPlaying.title}
              </Text>
              <Text style={styles.nowPlayingSub}>Live remote · {nowPlaying.progress}</Text>
            </View>
            
            <Pressable
              style={styles.disconnectRemoteBtn}
              onPress={() => setShowDisconnectModal(true)}
            >
              <Ionicons name="power-outline" size={14} color="#f87171" />
              <Text style={styles.disconnectRemoteText}>Disconnect</Text>
            </Pressable>
          </View>

          {remoteError ? (
            <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[3], padding: spacing[3], borderRadius: radii.lg, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' }}>
              <Text style={{ color: '#fca5a5', fontSize: 12, lineHeight: 18 }}>{remoteError}</Text>
            </View>
          ) : null}

          {/* Mode Switcher Tabs */}
          <View style={styles.modeTabs}>
            <Pressable
              style={[styles.modeTab, activeTab === 'touchpad' && styles.modeTabActive]}
              onPress={() => setActiveTab('touchpad')}
            >
              <Ionicons
                name="hand-left-outline"
                size={16}
                color={activeTab === 'touchpad' ? '#fff' : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'touchpad' && styles.modeTabTextActive]}>
                Touchpad
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, activeTab === 'dpad' && styles.modeTabActive]}
              onPress={() => setActiveTab('dpad')}
            >
              <Ionicons
                name="navigate-outline"
                size={16}
                color={activeTab === 'dpad' ? '#fff' : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'dpad' && styles.modeTabTextActive]}>
                D-Pad
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, activeTab === 'playback' && styles.modeTabActive]}
              onPress={() => setActiveTab('playback')}
            >
              <Ionicons
                name="play-circle-outline"
                size={16}
                color={activeTab === 'playback' ? '#fff' : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'playback' && styles.modeTabTextActive]}>
                HUD
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, activeTab === 'keyboard' && styles.modeTabActive]}
              onPress={() => setActiveTab('keyboard')}
            >
              <Ionicons
                name="keypad-outline"
                size={16}
                color={activeTab === 'keyboard' ? '#fff' : text.muted}
              />
              <Text style={[styles.modeTabText, activeTab === 'keyboard' && styles.modeTabTextActive]}>
                Keyboard
              </Text>
            </Pressable>
          </View>

          {/* Mode 0: Touchpad Trackpad Laser Surface */}
          {activeTab === 'touchpad' && (
            <View style={styles.touchpadSection}>
              <View
                style={styles.touchpadSurface}
                {...panResponder.panHandlers}
              >
                <Ionicons name="finger-print" size={36} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.touchpadPrompt}>Drag to move laser cursor on TV</Text>
                <Text style={styles.touchpadSubPrompt}>Tap anywhere to click target item</Text>
              </View>
            </View>
          )}

          {/* Mode 1: Tactile D-Pad Controller & Navigation Hub */}
          {activeTab === 'dpad' && (
            <View style={styles.dpadSection}>
              {/* Quick Launch Direct Page Navigation Rail */}
              <View style={styles.quickLaunchRailContainer}>
                <Text style={styles.quickLaunchTitle}>Quick Page Navigation</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLaunchRail}>
                  {pageShortcutItems.map((item) => (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.quickPageChip,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }
                      ]}
                      onPress={() => sendRemoteCommand('navigate_page', item.id)}
                    >
                      <Ionicons name={item.icon as any} size={15} color="#f87171" />
                      <Text style={styles.quickPageChipText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Target Focus Switcher: Sidebar vs Page Content */}
              <View style={styles.focusModeSwitchRow}>
                <Pressable
                  style={[styles.focusModeBtn, navFocusMode === 'sidebar' && styles.focusModeBtnActive]}
                  onPress={() => setNavFocusMode('sidebar')}
                >
                  <Ionicons name="list-outline" size={16} color={navFocusMode === 'sidebar' ? '#fff' : text.muted} />
                  <Text style={[styles.focusModeText, navFocusMode === 'sidebar' && styles.focusModeTextActive]}>
                    Sidebar Focus
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.focusModeBtn, navFocusMode === 'content' && styles.focusModeBtnActive]}
                  onPress={() => setNavFocusMode('content')}
                >
                  <Ionicons name="grid-outline" size={16} color={navFocusMode === 'content' ? '#fff' : text.muted} />
                  <Text style={[styles.focusModeText, navFocusMode === 'content' && styles.focusModeTextActive]}>
                    Content Focus
                  </Text>
                </Pressable>
              </View>

              {/* Top Navigation Row */}
              <View style={styles.navRow}>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('back')}>
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </Pressable>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('home')}>
                  <Ionicons name="home-outline" size={20} color="#fff" />
                </Pressable>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('menu')}>
                  <Ionicons name="menu-outline" size={20} color="#fff" />
                </Pressable>
              </View>

              {/* D-Pad Circle */}
              <View style={styles.dpadOuter}>
                <Pressable
                  style={styles.dpadUp}
                  onPress={() => {
                    if (navFocusMode === 'sidebar') sendRemoteCommand('sidebar_prev');
                    else sendRemoteCommand('up');
                  }}
                >
                  <Ionicons name="chevron-up" size={28} color="#fff" />
                </Pressable>

                <View style={styles.dpadMiddleRow}>
                  <Pressable
                    style={styles.dpadLeft}
                    onPress={() => {
                      if (navFocusMode === 'sidebar') sendRemoteCommand('left');
                      else sendRemoteCommand('focus_card_prev');
                    }}
                  >
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                  </Pressable>

                  <Pressable style={styles.dpadCenterOk} onPress={() => sendRemoteCommand('select')}>
                    <Text style={styles.okText}>OK</Text>
                  </Pressable>

                  <Pressable
                    style={styles.dpadRight}
                    onPress={() => {
                      if (navFocusMode === 'sidebar') sendRemoteCommand('right');
                      else sendRemoteCommand('focus_card_next');
                    }}
                  >
                    <Ionicons name="chevron-forward" size={28} color="#fff" />
                  </Pressable>
                </View>

                <Pressable
                  style={styles.dpadDown}
                  onPress={() => {
                    if (navFocusMode === 'sidebar') sendRemoteCommand('sidebar_next');
                    else sendRemoteCommand('down');
                  }}
                >
                  <Ionicons name="chevron-down" size={28} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}

          {/* Mode 2: Expanded Playback Control HUD */}
          {activeTab === 'playback' && (
            <View style={styles.playbackSection}>
              {/* Media Timeline Scrubber Bar */}
              <View style={styles.scrubberContainer}>
                <View style={styles.scrubberTimeRow}>
                  <Text style={styles.scrubberTimeText}>
                    {formatTime(nowPlaying.currentTime || 0)}
                  </Text>
                  <Text style={styles.scrubberTimeText}>
                    {formatTime(nowPlaying.duration || 0)}
                  </Text>
                </View>
                <Pressable
                  style={styles.scrubberTrack}
                  onPress={(e) => {
                    if (nowPlaying.duration && nowPlaying.duration > 0) {
                      const nativeEvent = e.nativeEvent as any;
                      const locationX = nativeEvent.locationX || 0;
                      const layoutWidth = 320;
                      const ratio = Math.max(0, Math.min(1, locationX / layoutWidth));
                      const targetSec = Math.floor(ratio * nowPlaying.duration);
                      sendRemoteCommand('seek_to', targetSec);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.scrubberFill,
                      {
                        width: `${
                          nowPlaying.duration && nowPlaying.duration > 0
                            ? Math.min(100, Math.max(0, ((nowPlaying.currentTime || 0) / nowPlaying.duration) * 100))
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </Pressable>
              </View>

              {/* Primary Transport Row */}
              <View style={styles.seekRow}>
                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('previous')}>
                  <Ionicons name="play-skip-back" size={18} color="#fff" />
                </Pressable>

                <Pressable style={styles.seekBtn} onPress={() => sendRemoteCommand('seek_-10')}>
                  <Ionicons name="play-back" size={20} color="#fff" />
                  <Text style={styles.seekText}>-10s</Text>
                </Pressable>

                <Pressable
                  style={styles.bigPlayBtn}
                  onPress={() => sendRemoteCommand('toggle_play')}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#fff" />
                </Pressable>

                <Pressable style={styles.seekBtn} onPress={() => sendRemoteCommand('seek_+10')}>
                  <Ionicons name="play-forward" size={20} color="#fff" />
                  <Text style={styles.seekText}>+10s</Text>
                </Pressable>

                <Pressable style={styles.smallNavBtn} onPress={() => sendRemoteCommand('next')}>
                  <Ionicons name="play-skip-forward" size={18} color="#fff" />
                </Pressable>
              </View>

              {/* Advanced HUD Feature Grid */}
              <View style={styles.hudFeatureGrid}>
                {/* Speed Toggle */}
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => {
                    const nextIdx = (currentSpeedIndex + 1) % speeds.length;
                    setCurrentSpeedIndex(nextIdx);
                    sendRemoteCommand('set_speed', parseFloat(speeds[nextIdx]));
                  }}
                >
                  <Ionicons name="speedometer-outline" size={18} color="#f87171" />
                  <Text style={styles.hudFeatureText}>{speeds[currentSpeedIndex]}</Text>
                </Pressable>

                {/* Subtitles Toggle */}
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => sendRemoteCommand('toggle_subtitles')}
                >
                  <Ionicons name="chatbox-ellipses-outline" size={18} color="#f87171" />
                  <Text style={styles.hudFeatureText}>CC</Text>
                </Pressable>

                {/* Fullscreen Toggle */}
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => sendRemoteCommand('toggle_fullscreen')}
                >
                  <Ionicons name="expand-outline" size={18} color="#f87171" />
                  <Text style={styles.hudFeatureText}>Screen</Text>
                </Pressable>

                {/* Mini Player / PiP */}
                <Pressable
                  style={styles.hudFeatureBtn}
                  onPress={() => sendRemoteCommand('toggle_pip')}
                >
                  <Ionicons name="duplicate-outline" size={18} color="#f87171" />
                  <Text style={styles.hudFeatureText}>PiP</Text>
                </Pressable>
              </View>

              {/* Volume Slider & Controls */}
              <View style={styles.volumeCard}>
                <Pressable onPress={() => sendRemoteCommand('toggle_mute')}>
                  <Ionicons
                    name={isMuted || volume === 0 ? 'volume-mute' : 'volume-high'}
                    size={22}
                    color={isMuted ? accent.primary : '#fff'}
                  />
                </Pressable>

                <View style={styles.volumeTrack}>
                  <View
                    style={[styles.volumeFill, { width: `${isMuted ? 0 : volume}%` }]}
                  />
                </View>

                <Text style={styles.volumeText}>{isMuted ? 'Muted' : `${volume}%`}</Text>
              </View>

              {/* Volume Stepper Row */}
              <View style={styles.volumePresetRow}>
                <Pressable
                  style={styles.volStepBtn}
                  onPress={() => sendRemoteCommand('volume_down')}
                >
                  <Ionicons name="remove" size={16} color="#fff" />
                  <Text style={styles.volStepText}>Vol -</Text>
                </Pressable>

                <Pressable
                  style={styles.volPresetBtn}
                  onPress={() => sendRemoteCommand('volume_up')}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.volStepText}>Vol +</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Mode 3: Remote Keyboard & Constellation Search */}
          {activeTab === 'keyboard' && (
            <View style={styles.keyboardSection}>
              {/* Search Target Mode Switcher */}
              <View style={styles.focusModeSwitchRow}>
                <Pressable
                  style={[styles.focusModeBtn, searchTarget === 'cinema' && styles.focusModeBtnActive]}
                  onPress={() => setSearchTarget('cinema')}
                >
                  <Ionicons name="film-outline" size={16} color={searchTarget === 'cinema' ? '#fff' : text.muted} />
                  <Text style={[styles.focusModeText, searchTarget === 'cinema' && styles.focusModeTextActive]}>
                    Cinema Search
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.focusModeBtn, searchTarget === 'constellation' && styles.focusModeBtnActive]}
                  onPress={() => setSearchTarget('constellation')}
                >
                  <Ionicons name="planet-outline" size={16} color={searchTarget === 'constellation' ? '#fff' : text.muted} />
                  <Text style={[styles.focusModeText, searchTarget === 'constellation' && styles.focusModeTextActive]}>
                    Constellation
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.keyboardPrompt}>
                {searchTarget === 'cinema' ? 'Send Text to Global Cinema Search' : 'Filter Constellation Star Graph'}
              </Text>

              <View style={styles.textInputRow}>
                <Ionicons name={searchTarget === 'cinema' ? 'search' : 'planet'} size={20} color={text.muted} />
                <TextInput
                  style={styles.textInput}
                  placeholder={searchTarget === 'cinema' ? 'Search movies, series, actors...' : 'Filter stars by actor/creator...'}
                  placeholderTextColor={text.muted}
                  value={remoteText}
                  onChangeText={setRemoteText}
                />
                {remoteText.length > 0 && (
                  <Pressable onPress={() => setRemoteText('')}>
                    <Ionicons name="close-circle" size={18} color={text.muted} />
                  </Pressable>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [styles.sendTextBtn, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  if (searchTarget === 'cinema') {
                    sendRemoteCommand('send_text', remoteText);
                  } else {
                    sendRemoteCommand('constellation_search', remoteText);
                  }
                  setRemoteText('');
                }}
              >
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.sendTextBtnText}>
                  {searchTarget === 'cinema' ? 'Send to Cinema Search' : 'Filter Constellation Graph'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Unified Pairing Modal */}
      <Modal visible={showPairingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalCard}>
            {/* Header Method Tabs */}
            <View style={styles.modalMethodTabs}>
              <Pressable
                style={[styles.modalMethodTab, pairingMethod === 'pin' && styles.modalMethodTabActive]}
                onPress={() => {
                  setPairingMethod('pin');
                  setTimeout(() => hiddenPinInputRef.current?.focus(), 150);
                }}
              >
                <Ionicons name="keypad-outline" size={14} color={pairingMethod === 'pin' ? '#fff' : text.muted} />
                <Text style={[styles.modalMethodTabText, pairingMethod === 'pin' && styles.modalMethodTabTextActive]}>
                  PIN Code
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modalMethodTab, pairingMethod === 'qr' && styles.modalMethodTabActive]}
                onPress={() => setPairingMethod('qr')}
              >
                <Ionicons name="qr-code-outline" size={14} color={pairingMethod === 'qr' ? '#fff' : text.muted} />
                <Text style={[styles.modalMethodTabText, pairingMethod === 'qr' && styles.modalMethodTabTextActive]}>
                  QR Scan
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modalMethodTab, pairingMethod === 'ip' && styles.modalMethodTabActive]}
                onPress={() => setPairingMethod('ip')}
              >
                <Ionicons name="wifi-outline" size={14} color={pairingMethod === 'ip' ? '#fff' : text.muted} />
                <Text style={[styles.modalMethodTabText, pairingMethod === 'ip' && styles.modalMethodTabTextActive]}>
                  Direct IP
                </Text>
              </Pressable>
            </View>

            {/* Method 1: Continuous six-digit PIN keypad */}
            {pairingMethod === 'pin' && (
              <View style={styles.pinSection}>
                <Text style={styles.modalTitle}>Enter Pairing Code</Text>
                <Text style={styles.modalSub}>
                  Enter the six-digit code from Orion Desktop. Mobile will find Orion automatically on the same Wi-Fi.
                </Text>

                {/* Single Invisible Input for Continuous Keyboard Capture */}
                <TextInput
                  ref={hiddenPinInputRef}
                  style={styles.hiddenPinInput}
                  value={pinCode}
                  onChangeText={handlePinChange}
                  keyboardType="numeric"
                  maxLength={6}
                  autoFocus
                />

                {/* Six visual digit boxes displaying typed characters */}
                <Pressable
                  style={styles.pinInputRow}
                  onPress={() => hiddenPinInputRef.current?.focus()}
                >
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const digit = pinCode[idx] || '';
                    const isFocused = pinCode.length === idx;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.pinBox,
                          digit !== '' && styles.pinBoxFilled,
                          isFocused && styles.pinBoxFocused,
                        ]}
                      >
                        <Text style={styles.pinBoxText}>{digit}</Text>
                      </View>
                    );
                  })}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => handleConnect()}
                  disabled={isConnecting}
                >
                  <Text style={styles.confirmBtnText}>
                    {isDiscovering ? 'Finding Orion Desktop…' : isConnecting ? 'Verifying & Pairing…' : 'Verify & Connect'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setPairingMethod('ip')} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: text.muted, fontSize: 12, fontWeight: '700' }}>Desktop not found? Use Direct IP</Text>
                </Pressable>
              </View>
            )}

            {/* Method 2: QR Code Camera Scanner Viewfinder */}
            {pairingMethod === 'qr' && (
              <View style={styles.qrSection}>
                <Text style={styles.modalTitle}>Scan Desktop QR Code</Text>
                <Text style={styles.modalSub}>Point camera at the QR code on Orion Desktop screen.</Text>

                {cameraPermission?.granted ? (
                  <View style={styles.cameraViewfinder}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
                      onBarcodeScanned={handleBarCodeScanned}
                    />
                    <Animated.View style={[styles.laserScanLine, { transform: [{ translateY: scanLineAnim }] }]} />
                  </View>
                ) : (
                  <View style={[styles.cameraViewfinder, { justifyContent: 'center', alignItems: 'center', gap: 10, padding: 16 }]}>
                    <Ionicons name="camera-outline" size={42} color="#f87171" />
                    <Text style={{ color: text.muted, fontSize: 12, textAlign: 'center' }}>
                      Camera access is required to scan the desktop QR code.
                    </Text>
                    <Pressable
                      style={({ pressed }) => [styles.confirmBtn, { paddingVertical: 10, paddingHorizontal: 20 }, pressed && { opacity: 0.85 }]}
                      onPress={requestCameraPermission}
                    >
                      <Text style={styles.confirmBtnText}>Grant Camera Permission</Text>
                    </Pressable>
                  </View>
                )}

                <Text style={{ color: text.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: spacing[3] }}>
                  Pairing begins automatically after Orion reads the QR code.
                </Text>
              </View>
            )}

            {/* Method 3: IP Direct */}
            {pairingMethod === 'ip' && (
              <View style={styles.ipSection}>
                <Text style={styles.modalTitle}>Manual IP & PIN Connect</Text>
                <Text style={styles.modalSub}>Enter your computer's local IP and the pairing PIN.</Text>

                <View style={styles.ipInputRow}>
                  <Ionicons name="desktop-outline" size={20} color="#f87171" />
                  <TextInput
                    style={styles.ipInput}
                    value={desktopIp}
                    onChangeText={setDesktopIp}
                    placeholder="Desktop IP (192.168...)"
                    placeholderTextColor={text.muted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.ipInputRow, { marginTop: 12 }]}>
                  <Ionicons name="keypad-outline" size={20} color="#f87171" />
                  <TextInput
                    style={styles.ipInput}
                    value={pinCode}
                    onChangeText={setPinCode}
                    placeholder="6-digit pairing code"
                    placeholderTextColor={text.muted}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }, { marginTop: 24 }]}
                  onPress={() => handleConnect()}
                  disabled={isConnecting}
                >
                  <Text style={styles.confirmBtnText}>
                    {isConnecting ? 'Connecting...' : 'Connect to Desktop'}
                  </Text>
                </Pressable>
              </View>
            )}

            {pairError ? (
              <View style={{ marginTop: spacing[3], padding: spacing[3], borderRadius: radii.lg, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' }}>
                <Text style={{ color: '#fca5a5', fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{pairError}</Text>
                {/expired/i.test(pairError) ? (
                  <Text style={{ color: text.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 }}>
                    Select New code in Orion Desktop, then enter the refreshed code here.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable style={styles.cancelBtnFull} onPress={() => setShowPairingModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Disconnect Confirmation Glass Modal */}
      <Modal visible={showDisconnectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalCard}>
            <View style={styles.disconnectIconGlow}>
              <Ionicons name="power" size={28} color="#f87171" />
            </View>

            <Text style={styles.modalTitle}>Disconnect Remote?</Text>
            <Text style={styles.modalSub}>
              This will unpair Mobile from Orion Desktop. You can reconnect anytime via PIN or QR code.
            </Text>

            <View style={styles.disconnectModalBtnRow}>
              <Pressable style={styles.cancelBtnModal} onPress={() => setShowDisconnectModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.disconnectConfirmBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectConfirmText}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: backgrounds.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 72,
    paddingRight: spacing[5],
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    paddingBottom: spacing[3],
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fontFamilies.heading,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusPillConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  statusPillDisconnected: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  pairingContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: 20,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  iconInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    color: text.secondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing[5],
  },
  stepsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: spacing[5],
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '900',
  },
  stepText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  pairingBtnGroup: {
    width: '100%',
    gap: 10,
  },
  primaryConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: accent.primary,
    paddingVertical: 14,
    borderRadius: radii.xl,
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  primaryConnectBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  secondaryConnectBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  remoteLayout: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
  },
  nowPlayingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginBottom: spacing[4],
  },
  nowPlayingIconGlow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nowPlayingTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  nowPlayingSub: {
    color: text.muted,
    fontSize: 11,
    marginTop: 1,
  },
  disconnectRemoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  disconnectRemoteText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '800',
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.xl,
    padding: 4,
    marginBottom: spacing[5],
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  modeTabActive: {
    backgroundColor: accent.primary,
  },
  modeTabText: {
    color: text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#fff',
    fontWeight: '900',
  },
  dpadSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingBottom: 20,
  },
  navRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: spacing[6],
  },
  smallNavBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dpadOuter: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 2,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  dpadUp: {
    padding: 10,
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  dpadLeft: {
    padding: 10,
  },
  dpadRight: {
    padding: 10,
  },
  dpadDown: {
    padding: 10,
  },
  dpadCenterOk: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  okText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  playbackSection: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing[6],
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  seekBtn: {
    alignItems: 'center',
    gap: 4,
  },
  seekText: {
    color: text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  bigPlayBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
  },
  volumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  volumeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: accent.primary,
  },
  volumeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'right',
  },
  keyboardSection: {
    flex: 1,
    paddingTop: spacing[4],
    gap: spacing[4],
  },
  keyboardPrompt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  sendTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: accent.primary,
    paddingVertical: 14,
    borderRadius: radii.xl,
  },
  sendTextBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
  },
  glassModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0c0c14',
    borderRadius: radii['2xl'],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
  },
  modalMethodTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.lg,
    padding: 3,
    marginBottom: 16,
    width: '100%',
  },
  modalMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  modalMethodTabActive: {
    backgroundColor: accent.primary,
  },
  modalMethodTabText: {
    color: text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  modalMethodTabTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSub: {
    color: text.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  hiddenPinInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  qrSection: {
    alignItems: 'center',
    width: '100%',
  },
  cameraViewfinder: {
    width: 180,
    height: 180,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 2,
    borderColor: accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 16,
  },
  laserScanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#f87171',
    shadowColor: '#f87171',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  pinSection: {
    alignItems: 'center',
    width: '100%',
  },
  pinInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingVertical: 8,
  },
  pinBox: {
    width: 52,
    height: 62,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBoxFilled: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  pinBoxFocused: {
    borderColor: accent.primary,
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  pinBoxText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  ipSection: {
    alignItems: 'center',
    width: '100%',
  },
  ipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 16,
    width: '100%',
  },
  ipInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: accent.primary,
    paddingVertical: 13,
    borderRadius: radii.xl,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtnFull: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: text.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  disconnectIconGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginBottom: 12,
  },
  disconnectModalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 12,
  },
  cancelBtnModal: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    borderRadius: radii.xl,
    alignItems: 'center',
  },
  disconnectConfirmBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingVertical: 12,
    borderRadius: radii.xl,
    alignItems: 'center',
  },
  disconnectConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  hudFeatureGrid: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginVertical: 12,
  },
  hudFeatureBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.xl,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hudFeatureText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  volumePresetRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  volStepBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  volPresetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
  },
  volStepText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  quickLaunchRailContainer: {
    width: '100%',
    marginBottom: 12,
  },
  quickLaunchTitle: {
    color: text.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  quickLaunchRail: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  quickPageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.xl,
  },
  quickPageChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  focusModeSwitchRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  focusModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    borderRadius: radii.lg,
  },
  focusModeBtnActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.18)',
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  focusModeText: {
    color: text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  focusModeTextActive: {
    color: '#fff',
  },
  scrubberContainer: {
    width: '100%',
    marginBottom: 16,
  },
  scrubberTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scrubberTimeText: {
    color: text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  scrubberTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: accent.primary,
    borderRadius: 4,
  },
  touchpadSection: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  touchpadSurface: {
    width: '100%',
    height: 240,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  touchpadPrompt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  touchpadSubPrompt: {
    color: text.muted,
    fontSize: 12,
  },
});
