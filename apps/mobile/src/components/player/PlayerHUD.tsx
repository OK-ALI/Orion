import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import * as Brightness from 'expo-brightness';
import { VolumeManager } from 'react-native-volume-manager';
import { spacing, fontSizes } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerChromeHandle } from './PlayerChromeHandle';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PlayerHUDProps {
  player: any; // expo-video player instance
  title: string;
  onBack: () => void;
  onOpenSources?: () => void;
  onOpenSubtitles?: () => void;
  onOpenPresentation?: () => void;
  controlsVisible?: boolean;
  onReveal?: () => void;
  onDismiss?: () => void;
  onToggle?: () => void;
}

export function PlayerHUD({
  player,
  title,
  onBack,
  onOpenSources,
  onOpenSubtitles,
  onOpenPresentation,
  controlsVisible: controlledVisible,
  onReveal,
  onDismiss,
  onToggle,
}: PlayerHUDProps) {
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const [localControlsVisible, setLocalControlsVisible] = useState(true);
  const controlsVisible = controlledVisible ?? localControlsVisible;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubberWidth = useRef(1);
  
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;

  // Video State
  const status = useEvent(player, 'statusChange', { status: player.status });
  const playingEvent = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const progress = useEvent(player, 'timeUpdate', {
    currentTime: Number(player.currentTime) || 0,
    bufferedPosition: Number(player.bufferedPosition) || 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const isPlaying = playingEvent.isPlaying;
  const duration = Math.max(0, Number(player.duration) || 0);
  const currentTime = Math.max(0, Number(progress.currentTime) || 0);
  const bufferedRatio = duration > 0 ? Math.min(1, Math.max(0, Number(progress.bufferedPosition) / duration)) : 0;
  const playedRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  useEffect(() => {
    player.timeUpdateEventInterval = 0.5;
  }, [player]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remaining = total % 60;
    return `${minutes}:${String(remaining).padStart(2, '0')}`;
  };

  const seekToRatio = (ratio: number) => {
    if (duration <= 0) return;
    player.currentTime = Math.min(duration, Math.max(0, ratio * duration));
    resetHideTimer();
  };

  const handleScrubberLayout = (event: LayoutChangeEvent) => {
    scrubberWidth.current = Math.max(1, event.nativeEvent.layout.width);
  };
  
  // Interaction logic
  const resetHideTimer = () => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    if (onReveal) onReveal();
    else setLocalControlsVisible(true);
    if (isPlaying && status.status !== 'loading' && status.status !== 'error') {
      if (!onDismiss) hideTimeout.current = setTimeout(() => setLocalControlsVisible(false), 4000);
    }
  };

  const toggleControls = () => {
    if (onToggle) {
      onToggle();
      return;
    }
    if (controlsVisible) {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      if (onDismiss) onDismiss();
      else setLocalControlsVisible(false);
      return;
    }
    resetHideTimer();
  };

  useEffect(() => {
    // The shared player controller owns controlled chrome visibility. Native
    // status/playing events may update playback truth, but must not reopen it.
    if (controlledVisible === undefined) resetHideTimer();
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [controlledVisible, isPlaying, status.status]);

  // System Volume & Brightness integration
  const [hasPermissions, setHasPermissions] = useState(false);
  const currentBrightness = useRef(0.5);
  const currentVolume = useRef(0.5);
  const [hudIndicator, setHudIndicator] = useState<{ type: 'brightness'|'volume', value: number } | null>(null);

  useEffect(() => {
    async function init() {
      if (Platform.OS !== 'web') {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted') {
          setHasPermissions(true);
          const b = await Brightness.getBrightnessAsync();
          currentBrightness.current = b;
        }
        try {
          const { volume } = await VolumeManager.getVolume();
          if (typeof volume === 'number') {
            currentVolume.current = volume;
          }
        } catch (e) {
          console.log('VolumeManager not available in this client (needs native build).');
        }
      }
    }
    init();
  }, []);

  const updateBrightness = async (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    currentBrightness.current = clamped;
    setHudIndicator({ type: 'brightness', value: clamped });
    if (Platform.OS !== 'web' && hasPermissions) {
      await Brightness.setBrightnessAsync(clamped);
    }
  };

  const updateVolume = async (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    currentVolume.current = clamped;
    setHudIndicator({ type: 'volume', value: clamped });
    if (Platform.OS !== 'web') {
      try {
        await VolumeManager.setVolume(clamped);
      } catch (e) {
        console.log('VolumeManager not available.');
      }
    }
  };

  const clearIndicator = () => setHudIndicator(null);

  // Gestures
  const singleTap = Gesture.Tap().onEnd(() => {
    runOnJS(toggleControls)();
  });

  const doubleTapLeft = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    runOnJS(resetHideTimer)();
    if (player.currentTime) {
      player.seekBy(-10);
    }
  });

  const doubleTapRight = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    runOnJS(resetHideTimer)();
    if (player.currentTime) {
      player.seekBy(10);
    }
  });

  // Vertical Swipe for Brightness (Left Side)
  let startBrightness = 0;
  const panLeft = Gesture.Pan()
    .onStart(() => {
      startBrightness = currentBrightness.current;
    })
    .onUpdate((e) => {
      // Swipe down (positive Y) decreases, up (negative Y) increases
      const delta = -(e.translationY / (SCREEN_HEIGHT / 2)); 
      runOnJS(updateBrightness)(startBrightness + delta);
    })
    .onEnd(() => {
      runOnJS(clearIndicator)();
    });

  // Vertical Swipe for Volume (Right Side)
  let startVolume = 0;
  const panRight = Gesture.Pan()
    .onStart(() => {
      startVolume = currentVolume.current;
    })
    .onUpdate((e) => {
      const delta = -(e.translationY / (SCREEN_HEIGHT / 2)); 
      runOnJS(updateVolume)(startVolume + delta);
    })
    .onEnd(() => {
      runOnJS(clearIndicator)();
    });

  // Compose Gestures for Left/Right split screens
  const leftGestures = Gesture.Exclusive(panLeft, doubleTapLeft, singleTap);
  const rightGestures = Gesture.Exclusive(panRight, doubleTapRight, singleTap);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Gesture Areas */}
      <View style={styles.gestureContainer}>
        <GestureDetector gesture={leftGestures}>
          <View style={styles.halfScreen} />
        </GestureDetector>
        <GestureDetector gesture={rightGestures}>
          <View style={styles.halfScreen} />
        </GestureDetector>
      </View>

      {/* Floating Indicator (Volume/Brightness) */}
      {hudIndicator && (
        <View style={styles.indicatorContainer}>
          <BlurView intensity={80} tint="dark" style={styles.indicatorHud}>
            <Ionicons 
              name={hudIndicator.type === 'volume' ? 'volume-high' : 'sunny'} 
              size={24} 
              color={theme.onAccent}
            />
            <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.barFill, { width: `${hudIndicator.value * 100}%`, backgroundColor: theme.onAccent }]} />
            </View>
          </BlurView>
        </View>
      )}

      {/* Control Overlay */}
      <PlayerChromeHandle controlsVisible={controlsVisible} onPress={toggleControls} />
      {controlsVisible && (
        <View style={styles.controlsOverlay}>
          {/* Top Bar */}
          <BlurView intensity={50} tint="dark" style={[styles.topBar, isLandscape && styles.topBarLandscape, { paddingTop: Math.max(insets.top, isLandscape ? 8 : 12) + 44 }]}>
            <Pressable onPress={onBack} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={28} color={theme.onAccent} />
            </Pressable>
            <Text style={[styles.titleText, { color: theme.onAccent }]} numberOfLines={1}>{title}</Text>
            <View style={styles.iconButton}>
              <Ionicons name="tv-outline" size={24} color={theme.onAccent} />
            </View>
          </BlurView>

          {/* Center Play/Pause */}
          <View style={styles.centerControls} pointerEvents="box-none">
            {status.status === 'error' ? (
              <Ionicons name="warning" size={48} color={theme.accent} />
            ) : (
              <Pressable 
                style={styles.playPauseButton} 
                onPress={() => {
                  if (isPlaying) player.pause();
                  else player.play();
                  resetHideTimer();
                }}
              >
                <BlurView intensity={60} tint="dark" style={styles.playPauseBlur}>
                  <Ionicons name={isPlaying ? "pause" : "play"} size={48} color={theme.onAccent} />
                </BlurView>
              </Pressable>
            )}
          </View>

          {/* Bottom Bar (Scrubber) */}
          <BlurView intensity={60} tint="dark" style={[styles.bottomBar, isLandscape && styles.bottomBarLandscape, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.scrubberRow}>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>{formatTime(currentTime)}</Text>
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel="Playback position"
                accessibilityValue={{
                  min: 0,
                  max: Math.round(duration),
                  now: Math.round(currentTime),
                  text: `${formatTime(currentTime)} of ${formatTime(duration)}`,
                }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(event) => {
                  const delta = event.nativeEvent.actionName === 'increment' ? 10 : -10;
                  if (duration > 0) player.currentTime = Math.min(duration, Math.max(0, currentTime + delta));
                }}
                onLayout={handleScrubberLayout}
                onPress={(event) => seekToRatio(event.nativeEvent.locationX / scrubberWidth.current)}
                style={styles.scrubberHitArea}
              >
                <View style={[styles.scrubberTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.scrubberBuffered, { width: `${bufferedRatio * 100}%`, backgroundColor: theme.textMuted }]} />
                  <View style={[styles.scrubberFill, { width: `${playedRatio * 100}%`, backgroundColor: theme.accent }]} />
                  {duration > 0 && <View style={[styles.scrubberThumb, {
                    left: `${playedRatio * 100}%`,
                    backgroundColor: theme.onAccent,
                    borderColor: theme.accent,
                  }]} />}
                </View>
              </Pressable>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>{formatTime(duration)}</Text>
            </View>
            <View style={styles.bottomActions}>
              {onOpenPresentation && (
                <Pressable style={[styles.sourceButton, { backgroundColor: theme.surface }]} onPress={onOpenPresentation}>
                  <Ionicons name="scan-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.sourceText, { color: theme.textSecondary }]}>Display</Text>
                </Pressable>
              )}
              {onOpenSubtitles && (
                <Pressable style={[styles.sourceButton, { backgroundColor: theme.surface }]} onPress={onOpenSubtitles}>
                  <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.sourceText, { color: theme.textSecondary }]}>Subtitles</Text>
                </Pressable>
              )}
              <Pressable style={[styles.sourceButton, { backgroundColor: theme.surface }]} onPress={onOpenSources}>
                <Ionicons name="server-outline" size={18} color={theme.textSecondary} />
                <Text style={[styles.sourceText, { color: theme.textSecondary }]}>Source</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gestureContainer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  halfScreen: {
    flex: 1,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  topBarLandscape: {
    paddingTop: 16,
    paddingHorizontal: Platform.OS === 'ios' ? spacing[8] : spacing[4],
  },
  titleText: {
    color: '#fff',
    fontSize: fontSizes.md,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    padding: spacing[2],
  },
  centerControls: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  playPauseBlur: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4, // optical alignment for play icon
  },
  bottomBar: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  bottomBarLandscape: {
    paddingHorizontal: Platform.OS === 'ios' ? spacing[8] : spacing[5],
    paddingVertical: spacing[3],
    paddingBottom: spacing[3],
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  timeText: {
    fontSize: fontSizes.xs,
    fontVariant: ['tabular-nums'],
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'visible',
  },
  scrubberHitArea: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  scrubberBuffered: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 2,
  },
  scrubberFill: {
    position: 'absolute',
    height: '100%',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    top: -5,
    borderWidth: 2,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 16,
  },
  sourceText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 10,
  },
  indicatorHud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: 24,
    overflow: 'hidden',
  },
  barTrack: {
    width: 100,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
});
