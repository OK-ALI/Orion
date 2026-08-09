import { useRef } from 'react';
import { PanResponder } from 'react-native';

type CommandSender = (action: string, value?: unknown) => Promise<unknown>;

export function useRemotePointer(sendRef: React.MutableRefObject<CommandSender>) {
  const cursorRef = useRef({ xRatio: 0.5, yRatio: 0.5 });
  const gestureStart = useRef({ x: 0.5, y: 0.5 });
  const lastSentAt = useRef(0);
  const lastScrollY = useRef(0);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      gestureStart.current = { x: cursorRef.current.xRatio, y: cursorRef.current.yRatio };
      lastScrollY.current = event.nativeEvent.touches[0]?.pageY || 0;
    },
    onPanResponderMove: (event, gesture) => {
      const now = Date.now();
      if (now - lastSentAt.current < 33) return;
      lastSentAt.current = now;
      if (event.nativeEvent.touches.length >= 2) {
        const y = event.nativeEvent.touches[0]?.pageY || lastScrollY.current;
        const deltaY = y - lastScrollY.current;
        lastScrollY.current = y;
        if (Math.abs(deltaY) >= 1) void sendRef.current('scroll', { deltaY: -deltaY });
        return;
      }
      const x = Math.max(0, Math.min(1, gestureStart.current.x + gesture.dx * 0.0015));
      const y = Math.max(0, Math.min(1, gestureStart.current.y + gesture.dy * 0.0015));
      cursorRef.current = { xRatio: x, yRatio: y };
      void sendRef.current('cursor_move', { x, y });
    },
    onPanResponderRelease: (event, gesture) => {
      if (event.nativeEvent.touches.length < 2 && Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
        void sendRef.current('cursor_click');
      }
    },
  })).current;

  return { cursorRef, panResponder };
}
