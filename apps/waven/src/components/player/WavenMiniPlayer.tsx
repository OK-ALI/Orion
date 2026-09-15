import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WavenArtworkFallback } from '../artwork/WavenArtworkFallback';
import { WavenPressable } from '../interaction/WavenPressable';
import type { PlaybackSnapshot } from '../../features/playback/contracts';
import {
  nativePlayback,
  subscribeNativePlayback,
} from '../../features/playback/native/WavenPlaybackNative';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import {
  wavenColors,
  wavenLayout,
  wavenMotion,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../../theme/tokens';

const PROGRESS_HEIGHTS = [
  3, 5, 8, 6, 10, 5, 7, 4, 9, 6, 11, 7, 4, 8, 5, 10, 6, 8, 4,
  7, 3, 6, 9, 5, 8, 4, 10, 6, 7, 3, 9, 5, 8, 6, 10, 4, 7,
] as const;

const WAVE_BAR_WIDTH = 3;

const TITLE_MARQUEE_OVERFLOW_TOLERANCE = 8;
const TITLE_MARQUEE_GAP = 28;
const TITLE_MARQUEE_PIXELS_PER_SECOND = 32;
const COMPACT_TEXT_MAX_SCALE = 1.4;

const ACTIVE_PULSE_RANGES = [
  [0.94, 1.08, 0.98],
  [1.02, 0.95, 1.06],
  [0.98, 1.05, 0.93],
] as const;

function progressRatio(snapshot: PlaybackSnapshot) {
  if (
    snapshot.durationMs == null ||
    snapshot.durationMs <= 0
  ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(0, snapshot.positionMs / snapshot.durationMs),
  );
}

function PlayIcon() {
  return <View accessible={false} style={styles.playIcon} />;
}

function PauseIcon() {
  return (
    <View accessible={false} style={styles.pauseIcon}>
      <View style={styles.pauseBar} />
      <View style={styles.pauseBar} />
    </View>
  );
}

export function WavenMiniPlayer() {
  const reducedMotion = useWavenReducedMotion();
  const [snapshot, setSnapshot] =
    useState<PlaybackSnapshot | null>(null);
  const [artworkFailed, setArtworkFailed] =
    useState(false);
  const [commandPending, setCommandPending] =
    useState(false);
  const [waveWidth, setWaveWidth] =
    useState(0);
  const [titleViewportWidth, setTitleViewportWidth] =
    useState(0);
  const [titleMarqueeUnitWidth, setTitleMarqueeUnitWidth] =
    useState(0);

  const metadataOpacity =
    useRef(new Animated.Value(1)).current;
  const visualProgress =
    useRef(new Animated.Value(0)).current;
  const activePulse =
    useRef(new Animated.Value(0)).current;
  const bufferTravel =
    useRef(new Animated.Value(0)).current;
  const controlMotion =
    useRef(new Animated.Value(1)).current;
  const titleMarquee =
    useRef(new Animated.Value(0)).current;

  const previousQueueId =
    useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let subscription:
      | ReturnType<typeof subscribeNativePlayback>
      | null = null;

    try {
      subscription = subscribeNativePlayback((nextSnapshot) => {
        if (mounted) {
          setSnapshot(nextSnapshot);
        }
      });

      nativePlayback
        .getSnapshot()
        .then((nextSnapshot) => {
          if (mounted) {
            setSnapshot(nextSnapshot);
          }
        })
        .catch(() => {
          // A transient controller read must not crash product UI.
          // Native playback events may still provide state later.
        });
    } catch {
      // Expo Go and builds without WAVEN's native playback bridge
      // must keep the ordinary Phase 5 shell usable.
      setSnapshot(null);
    }

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!snapshot?.playing) {
      return;
    }

    let mounted = true;

    const interval = setInterval(() => {
      nativePlayback
        .getSnapshot()
        .then((nextSnapshot) => {
          if (mounted) {
            setSnapshot(nextSnapshot);
          }
        })
        .catch(() => {
          // Position refresh is presentation-only. Playback remains native-owned.
        });
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [
    snapshot?.currentQueueId,
    snapshot?.playing,
  ]);

  const item = snapshot?.currentItem ?? null;

  const title =
    item?.title?.trim() || 'Unknown track';

  const artist =
    item?.artistName?.trim() ||
    item?.albumTitle?.trim() ||
    'WAVEN';

  const pauseIntent =
    snapshot?.playing === true ||
    (snapshot?.buffering === true && snapshot?.playWhenReady === true);

  useEffect(() => {
    setArtworkFailed(false);
  }, [
    item?.artworkUrl,
    item?.queueId,
  ]);

  useEffect(() => {
    const nextQueueId = item?.queueId ?? null;

    if (nextQueueId == null) {
      previousQueueId.current = null;
      return;
    }

    if (previousQueueId.current == null) {
      previousQueueId.current = nextQueueId;
      return;
    }

    if (previousQueueId.current === nextQueueId) {
      return;
    }

    previousQueueId.current = nextQueueId;

    metadataOpacity.stopAnimation();

    if (reducedMotion) {
      metadataOpacity.setValue(1);
      return;
    }

    metadataOpacity.setValue(0.42);

    Animated.timing(metadataOpacity, {
      duration: wavenMotion.standardMs,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [
    item?.queueId,
    metadataOpacity,
    reducedMotion,
  ]);

  useEffect(() => {
    visualProgress.stopAnimation();

    if (snapshot == null || snapshot.durationMs == null || snapshot.durationMs <= 0) {
      visualProgress.setValue(0);
      return;
    }

    const ratio = progressRatio(snapshot);

    // Media3 remains authoritative. This animation only interpolates the
    // presentation between native snapshots so progress never advances in
    // block-sized jumps. Every native refresh re-anchors the visual value.
    visualProgress.setValue(ratio);

    if (
      reducedMotion ||
      !snapshot.playing ||
      snapshot.buffering ||
      ratio >= 1
    ) {
      return;
    }

    const nextRatio = Math.min(
      1,
      ratio + 1000 / snapshot.durationMs,
    );

    Animated.timing(visualProgress, {
      duration: 1000,
      easing: Easing.linear,
      toValue: nextRatio,
      useNativeDriver: false,
    }).start();

    return () => {
      visualProgress.stopAnimation();
    };
  }, [
    reducedMotion,
    snapshot?.buffering,
    snapshot?.currentQueueId,
    snapshot?.durationMs,
    snapshot?.playing,
    snapshot?.positionMs,
    visualProgress,
  ]);

  useEffect(() => {
    activePulse.stopAnimation();
    activePulse.setValue(0);

    if (
      reducedMotion ||
      snapshot?.playing !== true ||
      snapshot?.buffering === true
    ) {
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(activePulse, {
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(activePulse, {
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [
    activePulse,
    reducedMotion,
    snapshot?.buffering,
    snapshot?.playing,
  ]);

  useEffect(() => {
    bufferTravel.stopAnimation();
    bufferTravel.setValue(0);

    if (
      reducedMotion ||
      snapshot?.buffering !== true ||
      snapshot?.playWhenReady !== true
    ) {
      return;
    }

    const sweep = Animated.loop(
      Animated.timing(bufferTravel, {
        duration: 1050,
        easing: Easing.inOut(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    sweep.start();

    return () => {
      sweep.stop();
    };
  }, [
    bufferTravel,
    reducedMotion,
    snapshot?.buffering,
    snapshot?.playWhenReady,
  ]);

  useEffect(() => {
    controlMotion.stopAnimation();

    if (reducedMotion) {
      controlMotion.setValue(1);
      return;
    }

    controlMotion.setValue(0);

    Animated.timing(controlMotion, {
      duration: wavenMotion.quickMs,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [
    controlMotion,
    pauseIntent,
    reducedMotion,
  ]);


  const marqueeEnabled =
    !reducedMotion &&
    titleViewportWidth > 0 &&
    titleMarqueeUnitWidth > 0 &&
    titleMarqueeUnitWidth - TITLE_MARQUEE_GAP >
      titleViewportWidth + TITLE_MARQUEE_OVERFLOW_TOLERANCE;

  useEffect(() => {
    titleMarquee.stopAnimation();
    titleMarquee.setValue(0);

    if (!marqueeEnabled) {
      return;
    }

    const travelDuration =
      Math.max(
        2600,
        Math.round(
          (titleMarqueeUnitWidth / TITLE_MARQUEE_PIXELS_PER_SECOND) * 1000,
        ),
      );

    const marqueeCycle = Animated.loop(
      Animated.timing(titleMarquee, {
        duration: travelDuration,
        easing: Easing.linear,
        toValue: -titleMarqueeUnitWidth,
        useNativeDriver: true,
      }),
      {
        resetBeforeIteration: true,
      },
    );

    marqueeCycle.start();

    return () => {
      marqueeCycle.stop();
      titleMarquee.stopAnimation();
      titleMarquee.setValue(0);
    };
  }, [
    item?.queueId,
    marqueeEnabled,
    title,
    titleMarquee,
    titleMarqueeUnitWidth,
  ]);

  if (
    snapshot == null ||
    item == null ||
    snapshot.queueIds.length === 0
  ) {
    return null;
  }

  const ratio = progressRatio(snapshot);

  const progressPercent =
    Math.round(ratio * 100);

  const animatedProgressWidth = visualProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, waveWidth],
  });

  const activeWaveOpacity = activePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });


  const bufferingTranslateX = bufferTravel.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, Math.max(18, waveWidth)],
  });

  const controlOpacity = controlMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  const controlScale = controlMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  const bufferingActive =
    snapshot.buffering && snapshot.playWhenReady;

  const secondaryText = snapshot.error
    ? `${artist} · Playback needs attention`
    : snapshot.buffering && snapshot.playWhenReady
      ? `Buffering · ${artist}`
      : artist;

  const controlLabel =
    pauseIntent
      ? `Pause ${title}`
      : `Play ${title}`;

  const handlePlaybackPress = async () => {
    if (commandPending) {
      return;
    }

    setCommandPending(true);

    try {
      const nextSnapshot = pauseIntent
        ? await nativePlayback.pause()
        : await nativePlayback.play();

      setSnapshot(nextSnapshot);
    } catch {
      try {
        const nextSnapshot =
          await nativePlayback.getSnapshot();

        setSnapshot(nextSnapshot);
      } catch {
        // Keep the current native-derived presentation state.
      }
    } finally {
      setCommandPending(false);
    }
  };

  return (
    <View
      accessibilityLabel="Now playing"
      style={styles.outer}
    >
      <View style={styles.panel}>
        <View
          accessible={false}
          pointerEvents="none"
          style={styles.topHighlight}
        />

        <View style={styles.row}>
          <Animated.View
            style={[
              styles.metadataTransition,
              {
                opacity: metadataOpacity,
              },
            ]}
          >
            <View style={styles.artworkFrame}>
              {item.artworkUrl && !artworkFailed ? (
                <Image
                  accessibilityLabel={`${title} artwork`}
                  onError={() => setArtworkFailed(true)}
                  source={{ uri: item.artworkUrl }}
                  style={styles.artworkImage}
                />
              ) : (
                <WavenArtworkFallback
                  accessibilityLabel={`${title} artwork`}
                  seed={item.queueId}
                  size={48}
                />
              )}
            </View>

            <View style={styles.copy}>
              <View
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={styles.titleMeasurePlane}
              >
                <Text
                  accessible={false}
                  maxFontSizeMultiplier={COMPACT_TEXT_MAX_SCALE}
                  numberOfLines={1}
                  onLayout={(event) => {
                    setTitleMarqueeUnitWidth(
                      event.nativeEvent.layout.width + TITLE_MARQUEE_GAP,
                    );
                  }}
                  style={[styles.title, styles.titleMeasureText]}
                >
                  {title}
                </Text>
              </View>

              <View
                onLayout={(event) => {
                  setTitleViewportWidth(event.nativeEvent.layout.width);
                }}
                style={styles.titleViewport}
              >
                <Animated.View
                  style={[
                    styles.titleMarqueeTrack,
                    {
                      transform: [{ translateX: titleMarquee }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.titleMarqueeUnit,
                      titleMarqueeUnitWidth > 0
                        ? { width: titleMarqueeUnitWidth }
                        : null,
                    ]}
                  >
                    <Text
                      accessibilityRole="text"
                      maxFontSizeMultiplier={COMPACT_TEXT_MAX_SCALE}
                      numberOfLines={1}
                      style={[
                        styles.title,
                        styles.titleMarqueeText,
                        titleMarqueeUnitWidth > 0
                          ? {
                              width:
                                titleMarqueeUnitWidth -
                                TITLE_MARQUEE_GAP,
                            }
                          : null,
                      ]}
                    >
                      {title}
                    </Text>
                    <View
                      accessible={false}
                      style={styles.titleMarqueeGap}
                    />
                  </View>

                  {marqueeEnabled ? (
                    <View
                      accessible={false}
                      style={[
                        styles.titleMarqueeUnit,
                        { width: titleMarqueeUnitWidth },
                      ]}
                    >
                      <Text
                        accessible={false}
                        maxFontSizeMultiplier={COMPACT_TEXT_MAX_SCALE}
                        numberOfLines={1}
                        style={[
                          styles.title,
                          styles.titleMarqueeText,
                          {
                            width:
                              titleMarqueeUnitWidth -
                              TITLE_MARQUEE_GAP,
                          },
                        ]}
                      >
                        {title}
                      </Text>
                      <View
                        accessible={false}
                        style={styles.titleMarqueeGap}
                      />
                    </View>
                  ) : null}
                </Animated.View>
              </View>

              <Text
                maxFontSizeMultiplier={COMPACT_TEXT_MAX_SCALE}
                numberOfLines={1}
                style={[
                  styles.artist,
                  snapshot.error
                    ? styles.artistAttention
                    : null,
                ]}
              >
                {secondaryText}
              </Text>
            </View>
          </Animated.View>

          <WavenPressable
            accessibilityLabel={controlLabel}
            accessibilityRole="button"
            accessibilityState={{
              disabled: commandPending,
            }}
            containerStyle={styles.controlContainer}
            disabled={commandPending}
            onPress={() => {
              void handlePlaybackPress();
            }}
            style={[
              styles.control,
              commandPending
                ? styles.controlPending
                : null,
            ]}
          >
            <Animated.View
              style={{
                opacity: controlOpacity,
                transform: [{ scale: controlScale }],
              }}
            >
              {pauseIntent
                ? <PauseIcon />
                : <PlayIcon />}
            </Animated.View>
          </WavenPressable>
        </View>

        <View
          accessibilityLabel={`Playback progress ${progressPercent} percent`}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: progressPercent,
          }}
          style={styles.waveform}
        >
          <View
            accessible={false}
            onLayout={(event) => {
              setWaveWidth(event.nativeEvent.layout.width);
            }}
            style={styles.waveViewport}
          >
            <View style={styles.waveBarsLayer}>
              {PROGRESS_HEIGHTS.map((height, index) => (
                <View
                  key={`base-${index}-${height}`}
                  style={[
                    styles.waveBar,
                    styles.waveBarRemaining,
                    { height },
                  ]}
                />
              ))}
            </View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.playedClip,
                { width: animatedProgressWidth },
              ]}
            >
              <Animated.View
                style={[
                  styles.playedBarsLayer,
                  {
                    opacity: activeWaveOpacity,
                    width: waveWidth,
                  },
                ]}
              >
                {PROGRESS_HEIGHTS.map((height, index) => {
                  const pulseRange =
                    ACTIVE_PULSE_RANGES[index % ACTIVE_PULSE_RANGES.length];

                  const scaleY =
                    reducedMotion || snapshot.buffering
                      ? 1
                      : activePulse.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [
                            pulseRange[0],
                            pulseRange[1],
                            pulseRange[2],
                          ],
                        });

                  return (
                    <Animated.View
                      key={`played-${index}-${height}`}
                      style={[
                        styles.waveBar,
                        styles.waveBarPlayed,
                        {
                          height,
                          transform: [{ scaleY }],
                        },
                      ]}
                    />
                  );
                })}
              </Animated.View>
            </Animated.View>

            {bufferingActive && !reducedMotion ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.bufferingSignal,
                  {
                    transform: [
                      { translateX: bufferingTranslateX },
                    ],
                  },
                ]}
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    maxWidth: wavenLayout.navCompactMaxWidth,
    paddingHorizontal: wavenSpacing.md,
    paddingTop: 4,
    width: '100%',
  },
  panel: {
    backgroundColor: 'rgba(7, 11, 16, 0.88)',
    borderColor: wavenColors.borderStrong,
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 84,
    overflow: 'hidden',
    position: 'relative',
  },
  topHighlight: {
    backgroundColor: 'rgba(235, 242, 247, 0.055)',
    height: StyleSheet.hairlineWidth,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 66,
    paddingBottom: 2,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  metadataTransition: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minHeight: 48,
    minWidth: 0,
  },
  artworkFrame: {
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    overflow: 'hidden',
    width: 48,
  },
  artworkImage: {
    height: '100%',
    width: '100%',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 0,
    paddingRight: 4,
  },
  titleMeasurePlane: {
    height: 20,
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 10000,
  },
  titleMeasureText: {
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  titleViewport: {
    overflow: 'hidden',
    width: '100%',
  },
  titleMarqueeTrack: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexShrink: 0,
  },
  titleMarqueeUnit: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
  },
  titleMarqueeGap: {
    width: TITLE_MARQUEE_GAP,
  },
  titleMarqueeText: {
    flexShrink: 0,
  },
  title: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: '800',
    lineHeight: 18,
  },
  artist: {
    color: wavenColors.textMuted,
    fontSize: wavenTypography.caption.fontSize,
    fontWeight: wavenTypography.caption.fontWeight,
    lineHeight: wavenTypography.caption.lineHeight,
    marginTop: 2,
  },
  artistAttention: {
    color: wavenColors.textSecondary,
  },
  controlContainer: {
    flexShrink: 0,
    marginLeft: 8,
  },
  control: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: wavenLayout.minimumTouchTarget,
    justifyContent: 'center',
    width: wavenLayout.minimumTouchTarget,
  },
  controlPending: {
    opacity: 0.56,
  },
  playIcon: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 7,
    borderLeftColor: wavenColors.textPrimary,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderTopWidth: 7,
    height: 0,
    marginLeft: 3,
    width: 0,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 5,
  },
  pauseBar: {
    backgroundColor: wavenColors.textPrimary,
    borderRadius: 2,
    height: 16,
    width: 4,
  },
  waveform: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    paddingBottom: 4,
  },
  waveViewport: {
    height: 11,
    overflow: 'hidden',
    position: 'relative',
    width: '84%',
  },
  waveBarsLayer: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  playedClip: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  playedBarsLayer: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 11,
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    top: 0,
  },
  waveBar: {
    borderRadius: 999,
    width: WAVE_BAR_WIDTH,
  },
  waveBarRemaining: {
    backgroundColor: wavenColors.textMuted,
    opacity: 0.3,
  },
  waveBarPlayed: {
    backgroundColor: wavenColors.interactionBlue,
  },
  bufferingSignal: {
    backgroundColor: wavenColors.skyBlue,
    borderRadius: 999,
    height: 3,
    left: 0,
    opacity: 0.82,
    position: 'absolute',
    top: 4,
    width: 16,
  },
});