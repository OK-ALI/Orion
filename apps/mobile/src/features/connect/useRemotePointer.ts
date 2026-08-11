import { useEffect, useState, useRef } from 'react';
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
    const pointerDiagnosticsRef = useRef({
    panMoves: 0,
    cursorSends: 0,
    scrollSends: 0,
    maxPanGapMs: 0,
    panGapsOver50Ms: 0,
    panGapsOver100Ms: 0,
    maxFlushGapMs: 0,
    flushGapsOver50Ms: 0,
    flushGapsOver100Ms: 0,
  });
  const pendingCursorMoveRef = useRef<{ x: number; y: number } | null>(null);
  const cursorFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorSendAtRef = useRef(0);
    const lastPanMoveAtRef = useRef(0);
  const lastFlushAtRef = useRef(0);
  const lastDiagnosticAtRef = useRef(Date.now());

    const flushCursorMove = () => {
    cursorFlushTimerRef.current = null;

    const latest = pendingCursorMoveRef.current;
    pendingCursorMoveRef.current = null;

    if (!latest) return;

    const now = Date.now();
    const previousFlushAt = lastFlushAtRef.current;

    if (previousFlushAt > 0) {
      const gap = now - previousFlushAt;
      const diagnostics = pointerDiagnosticsRef.current;

      diagnostics.maxFlushGapMs = Math.max(diagnostics.maxFlushGapMs, gap);

      if (gap > 50) diagnostics.flushGapsOver50Ms += 1;
      if (gap > 100) diagnostics.flushGapsOver100Ms += 1;
    }

    lastFlushAtRef.current = now;
    lastCursorSendAtRef.current = now;

    pointerDiagnosticsRef.current.cursorSends += 1;
    sendRef.current('cursor_move', latest);
  };

  const queueCursorMove = (x: number, y: number) => {
    pendingCursorMoveRef.current = { x, y };

    if (cursorFlushTimerRef.current !== null) return;

    const elapsed = Date.now() - lastCursorSendAtRef.current;
    const delay = Math.max(0, TARGET_FRAME_MS - elapsed);

    cursorFlushTimerRef.current = setTimeout(flushCursorMove, delay);
  };

  useEffect(() => () => {
    if (cursorFlushTimerRef.current !== null) {
      clearTimeout(cursorFlushTimerRef.current);
      cursorFlushTimerRef.current = null;
    }

    pendingCursorMoveRef.current = null;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const windowMs = now - lastDiagnosticAtRef.current;
      lastDiagnosticAtRef.current = now;

      const diagnostics = pointerDiagnosticsRef.current;

      console.log(
        `[SmartConnect mobile pointer] windowMs=${windowMs} panMoves=${diagnostics.panMoves} cursorSends=${diagnostics.cursorSends} scrollSends=${diagnostics.scrollSends} maxPanGapMs=${diagnostics.maxPanGapMs} panGap50=${diagnostics.panGapsOver50Ms} panGap100=${diagnostics.panGapsOver100Ms} maxFlushGapMs=${diagnostics.maxFlushGapMs} flushGap50=${diagnostics.flushGapsOver50Ms} flushGap100=${diagnostics.flushGapsOver100Ms}`,
      );

      diagnostics.panMoves = 0;
      diagnostics.cursorSends = 0;
      diagnostics.scrollSends = 0;
      diagnostics.maxPanGapMs = 0;
      diagnostics.panGapsOver50Ms = 0;
      diagnostics.panGapsOver100Ms = 0;
      diagnostics.maxFlushGapMs = 0;
      diagnostics.flushGapsOver50Ms = 0;
      diagnostics.flushGapsOver100Ms = 0;
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
            lastPanMoveAtRef.current = 0;
      lastFlushAtRef.current = 0;

      if (pointerModeRef.current === 'absolute') {
        const { locationX, locationY } = event.nativeEvent;
        const x = Math.max(0, Math.min(1, locationX / touchpadLayoutRef.current.width));
        const y = Math.max(0, Math.min(1, locationY / touchpadLayoutRef.current.height));
        cursorRef.current = { xRatio: x, yRatio: y };
  queueCursorMove(x, y);
      }
    },
        onPanResponderMove: (event, gesture) => {
      pointerDiagnosticsRef.current.panMoves += 1;

      const panNow = Date.now();
      const previousPanAt = lastPanMoveAtRef.current;

      if (previousPanAt > 0) {
        const gap = panNow - previousPanAt;
        const diagnostics = pointerDiagnosticsRef.current;

        diagnostics.maxPanGapMs = Math.max(diagnostics.maxPanGapMs, gap);

        if (gap > 50) diagnostics.panGapsOver50Ms += 1;
        if (gap > 100) diagnostics.panGapsOver100Ms += 1;
      }

      lastPanMoveAtRef.current = panNow;
      // ── Two-finger scroll ──
      if (event.nativeEvent.touches && event.nativeEvent.touches.length >= 2) {
        const y = event.nativeEvent.touches[0]?.pageY || lastScrollY.current;
        const deltaY = y - lastScrollY.current;
        lastScrollY.current = y;
        scrollAccum.current += deltaY;
        if (Math.abs(scrollAccum.current) >= 1) {
pointerDiagnosticsRef.current.scrollSends += 1;
          sendRef.current('scroll', { deltaY: -scrollAccum.current });
          scrollAccum.current = 0;
        }
        return;
      }

      // ── Absolute pointer mode ──
      if (pointerModeRef.current === 'absolute') {
  const { locationX, locationY } = event.nativeEvent;
  const x = Math.max(
    0,
    Math.min(1, locationX / touchpadLayoutRef.current.width),
  );
  const y = Math.max(
    0,
    Math.min(1, locationY / touchpadLayoutRef.current.height),
  );

  cursorRef.current = { xRatio: x, yRatio: y };
          queueCursorMove(x, y);
  return;
}

      // ── Relative trackpad: direct step-delta physics ──
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
      queueCursorMove(nextX, nextY);
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
