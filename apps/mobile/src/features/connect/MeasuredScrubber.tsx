import { useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

export function MeasuredScrubber({ currentTime, duration, bufferedTime = 0, disabled, formatTime, onScrubbing, onSeek, styles }: any) {
  const widthRef = useRef(1);
  const [preview, setPreview] = useState<number | null>(null);
  const target = preview ?? currentTime;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (event) => {
      onScrubbing(true);
      setPreview(Math.max(0, Math.min(duration, (event.nativeEvent.locationX / widthRef.current) * duration)));
    },
    onPanResponderMove: (event) => setPreview(Math.max(0, Math.min(duration, (event.nativeEvent.locationX / widthRef.current) * duration))),
    onPanResponderRelease: () => {
      const value = preview;
      setPreview(null); onScrubbing(false);
      if (value != null) void onSeek(Math.round(value));
    },
    onPanResponderTerminate: () => { setPreview(null); onScrubbing(false); },
  }), [disabled, duration, onScrubbing, onSeek, preview]);
  const ratio = duration > 0 ? Math.min(1, Math.max(0, target / duration)) : 0;
  const buffered = duration > 0 ? Math.min(1, Math.max(0, bufferedTime / duration)) : 0;
  return <View style={styles.scrubberContainer}>
    <View style={styles.scrubberTimeRow}><Text style={styles.scrubberTimeText}>{formatTime(target)}</Text><Text style={styles.scrubberTimeText}>{formatTime(duration)}</Text></View>
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityState={{ disabled }}
      style={[styles.scrubberTrack, disabled && { opacity: 0.45 }]}
      onLayout={(event) => { widthRef.current = Math.max(1, event.nativeEvent.layout.width); }}
      {...pan.panHandlers}
    >
      <View style={[styles.scrubberFill, { opacity: 0.3, width: `${buffered * 100}%` }]} />
      <View style={[styles.scrubberFill, { width: `${ratio * 100}%` }]} />
      <View style={{ position: 'absolute', left: `${ratio * 100}%`, top: -5, width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: 'white' }} />
    </View>
  </View>;
}
