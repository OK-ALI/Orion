import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder } from 'react-native';

type FireAndForgetSender = (action: string, value?: unknown) => void;

type PointerHealth = { medianRttMs?: number | null; telemetryAgeMs?: number | null; backpressured?: boolean };
const POINTER_DIAGNOSTICS_ENABLED = Boolean(
  __DEV__ && (globalThis as typeof globalThis & { __ORION_SMART_CONNECT_DIAGNOSTICS__?: boolean })
    .__ORION_SMART_CONNECT_DIAGNOSTICS__,
);

export function useRemotePointer(sendRef: React.MutableRefObject<FireAndForgetSender>) {
  const cursorRef = useRef({ xRatio: 0.5, yRatio: 0.5 });
  const touchpadLayoutRef = useRef({ width: 320, height: 230 });
  const lastTouchPosRef = useRef({ x: 0, y: 0 });
  const lastScrollYRef = useRef(0);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const pendingScrollRef = useRef(0);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRealtimeSendAtRef = useRef(0);
  const frameIntervalRef = useRef(33);
  const policyRef = useRef({ activeRateHz: 30 as 24 | 30 | 40, rttClass: 'moderate', backpressure: 'clear', coalescedUpdates: 0, droppedUpdates: 0 });
  const gestureWasMultiTouchRef = useRef(false);
  const [pointerMode, setPointerMode] = useState<'relative' | 'absolute'>('relative');
  const [isPointerGestureActive, setIsPointerGestureActive] = useState(false);
  const pointerModeRef = useRef(pointerMode);
  pointerModeRef.current = pointerMode;

  const diagnosticsRef = useRef({ grants: 0, releases: 0, terminations: 0, moves: 0, cursorSends: 0, scrollSends: 0 });

  const flushRealtime = useCallback(() => {
    if (realtimeTimerRef.current !== null) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = null;
    const cursor = pendingCursorRef.current;
    const scrollDelta = pendingScrollRef.current;
    pendingCursorRef.current = null;
    pendingScrollRef.current = 0;

    if (cursor) {
      diagnosticsRef.current.cursorSends += 1;
      sendRef.current('cursor_move', cursor);
    }
    if (Math.abs(scrollDelta) >= 0.5) {
      diagnosticsRef.current.scrollSends += 1;
      sendRef.current('scroll', { deltaY: -scrollDelta });
    }
    if (cursor || Math.abs(scrollDelta) >= 0.5) lastRealtimeSendAtRef.current = Date.now();
  }, [sendRef]);

  const scheduleRealtime = useCallback(() => {
    if (realtimeTimerRef.current !== null) return;
    if (lastRealtimeSendAtRef.current === 0) {
      flushRealtime();
      return;
    }
    const elapsed = Date.now() - lastRealtimeSendAtRef.current;
    realtimeTimerRef.current = setTimeout(flushRealtime, Math.max(0, frameIntervalRef.current - elapsed));
  }, [flushRealtime]);

  const queueCursorMove = useCallback((x: number, y: number) => {
    if (pendingCursorRef.current) policyRef.current.coalescedUpdates += 1;
    pendingCursorRef.current = { x, y };
    scheduleRealtime();
  }, [scheduleRealtime]);

  const queueScroll = useCallback((deltaY: number) => {
    if (pendingScrollRef.current) policyRef.current.coalescedUpdates += 1;
    pendingScrollRef.current += deltaY;
    scheduleRealtime();
  }, [scheduleRealtime]);

  const clearPendingPointer = useCallback((reason = 'transport-reset') => {
    if (realtimeTimerRef.current !== null) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = null;
    pendingCursorRef.current = null;
    pendingScrollRef.current = 0;
    lastRealtimeSendAtRef.current = 0;
    gestureWasMultiTouchRef.current = false;
    setIsPointerGestureActive(false);
    if (POINTER_DIAGNOSTICS_ENABLED) console.debug(`[SmartConnect pointer] cleared: ${reason}`);
  }, []);

  const updatePointerHealth = useCallback((health: PointerHealth) => {
    const rtt = Number(health.medianRttMs);
    const age = Number(health.telemetryAgeMs);
    const constrained = health.backpressured || (Number.isFinite(rtt) && rtt > 180) || (Number.isFinite(age) && age > 1500);
    const healthy = !constrained && (!Number.isFinite(rtt) || rtt <= 80) && (!Number.isFinite(age) || age <= 900);
    const rate = constrained ? 24 : healthy ? 40 : 30;
    frameIntervalRef.current = Math.round(1000 / rate);
    policyRef.current.activeRateHz = rate;
    policyRef.current.rttClass = constrained ? 'constrained' : healthy ? 'healthy' : 'moderate';
    policyRef.current.backpressure = health.backpressured ? 'elevated' : 'clear';
  }, []);

  useEffect(() => clearPendingPointer, [clearPendingPointer]);

  useEffect(() => {
    if (!POINTER_DIAGNOSTICS_ENABLED) return undefined;
    const timer = setInterval(() => {
      const value = diagnosticsRef.current;
      console.debug('[SmartConnect pointer]', { ...value });
      diagnosticsRef.current = { grants: 0, releases: 0, terminations: 0, moves: 0, cursorSends: 0, scrollSends: 0 };
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const onTouchpadLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    touchpadLayoutRef.current = { width: Math.max(1, width), height: Math.max(1, height) };
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      diagnosticsRef.current.grants += 1;
      if (POINTER_DIAGNOSTICS_ENABLED) console.debug('[SmartConnect pointer] gesture granted');
      setIsPointerGestureActive(true);
      gestureWasMultiTouchRef.current = (event.nativeEvent.touches?.length || 0) >= 2;
      const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
      const x = touch?.pageX || 0;
      const y = touch?.pageY || 0;
      lastTouchPosRef.current = { x, y };
      lastScrollYRef.current = y;

      if (pointerModeRef.current === 'absolute') {
        const ratioX = Math.max(0, Math.min(1, event.nativeEvent.locationX / touchpadLayoutRef.current.width));
        const ratioY = Math.max(0, Math.min(1, event.nativeEvent.locationY / touchpadLayoutRef.current.height));
        cursorRef.current = { xRatio: ratioX, yRatio: ratioY };
        queueCursorMove(ratioX, ratioY);
      }
    },
    onPanResponderMove: (event) => {
      diagnosticsRef.current.moves += 1;
      const touches = event.nativeEvent.touches || [];
      if (touches.length >= 2) {
        gestureWasMultiTouchRef.current = true;
        const y = touches[0]?.pageY || lastScrollYRef.current;
        queueScroll(y - lastScrollYRef.current);
        lastScrollYRef.current = y;
        return;
      }

      if (pointerModeRef.current === 'absolute') {
        const ratioX = Math.max(0, Math.min(1, event.nativeEvent.locationX / touchpadLayoutRef.current.width));
        const ratioY = Math.max(0, Math.min(1, event.nativeEvent.locationY / touchpadLayoutRef.current.height));
        cursorRef.current = { xRatio: ratioX, yRatio: ratioY };
        queueCursorMove(ratioX, ratioY);
        return;
      }

      const touch = touches[0] || event.nativeEvent;
      const currentX = touch?.pageX || 0;
      const currentY = touch?.pageY || 0;
      let stepX = currentX - lastTouchPosRef.current.x;
      let stepY = currentY - lastTouchPosRef.current.y;
      lastTouchPosRef.current = { x: currentX, y: currentY };
      if (Math.abs(stepX) > 100 || Math.abs(stepY) > 100) { stepX = 0; stepY = 0; }
      if (!stepX && !stepY) return;

      const nextX = Math.max(0, Math.min(1, cursorRef.current.xRatio + stepX / touchpadLayoutRef.current.width));
      const nextY = Math.max(0, Math.min(1, cursorRef.current.yRatio + stepY / touchpadLayoutRef.current.height));
      cursorRef.current = { xRatio: nextX, yRatio: nextY };
      queueCursorMove(nextX, nextY);
    },
    onPanResponderRelease: (_event, gesture) => {
      diagnosticsRef.current.releases += 1;
      if (POINTER_DIAGNOSTICS_ENABLED) console.debug('[SmartConnect pointer] gesture released');
      flushRealtime();
      setIsPointerGestureActive(false);
      if (!gestureWasMultiTouchRef.current && Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
        sendRef.current('cursor_click');
      }
      gestureWasMultiTouchRef.current = false;
    },
    onPanResponderTerminate: () => {
      diagnosticsRef.current.terminations += 1;
      if (POINTER_DIAGNOSTICS_ENABLED) console.debug('[SmartConnect pointer] gesture terminated');
      clearPendingPointer('gesture-terminated');
    },
  })).current;

  return {
    clearPendingPointer,
    cursorRef,
    isPointerGestureActive,
    onTouchpadLayout,
    panResponder,
    pointerMode,
    setPointerMode,
    updatePointerHealth,
  };
}
