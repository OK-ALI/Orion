import { useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

export function MeasuredScrubber({ currentTime, duration, bufferedTime = 0, disabled, formatTime, onScrubbing, onSeek, styles }: any) {
  const widthRef = useRef(1);
  const previewRef = useRef<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const target = preview ?? currentTime;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (event) => {
      onScrubbing(true);
      const value = Math.max(0, Math.min(duration, (event.nativeEvent.locationX / widthRef.current) * duration));
      previewRef.current = value; setPreview(value);
    },
    onPanResponderMove: (event) => {
      const value = Math.max(0, Math.min(duration, (event.nativeEvent.locationX / widthRef.current) * duration));
      previewRef.current = value; setPreview(value);
    },
    onPanResponderRelease: () => {
      const value = previewRef.current;
      previewRef.current = null; setPreview(null); onScrubbing(false);
      if (value != null) void onSeek(Math.round(value));
    },
    onPanResponderTerminate: () => { previewRef.current = null; setPreview(null); onScrubbing(false); },
  }), [disabled, duration, onScrubbing, onSeek]);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, target / duration)) : 0;
  const buffered = duration > 0 ? Math.min(1, Math.max(0, bufferedTime / duration)) : 0;
  return <View style={styles.scrubberContainer}>
    <View style={styles.scrubberTimeRow}><Text style={styles.scrubberTimeText}>{formatTime(target)}</Text><Text style={styles.scrubberTimeText}>-{formatTime(Math.max(0, duration - target))}</Text></View>
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityState={{ disabled }}
      style={[styles.scrubberHitTarget, disabled && { opacity: 0.45 }]}
      onLayout={(event) => { widthRef.current = Math.max(1, event.nativeEvent.layout.width); }}
      {...pan.panHandlers}
    >
      <View style={styles.scrubberTrack}>
        <View style={[styles.scrubberBuffered, { width: `${buffered * 100}%` }]} />
        <View style={[styles.scrubberFill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={[styles.scrubberThumb, { left: `${ratio * 100}%` }]} />
    </View>
  </View>;
}
