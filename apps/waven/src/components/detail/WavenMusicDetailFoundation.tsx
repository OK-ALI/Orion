import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WavenArtworkFallback } from '../artwork/WavenArtworkFallback';
import { WavenPressable } from '../interaction/WavenPressable';
import { WavenEntityRevealAnchor } from '../navigation/WavenEntityRevealAnchor';
import {
  WAVEN_DETAIL_HERO_BLUR_OPACITY,
  WAVEN_DETAIL_HERO_BLUR_SCALE,
  WAVEN_DETAIL_HERO_COPY_MAX_WIDTH,
  WAVEN_DETAIL_HERO_SHARP_OPACITY,
  WavenDetailHeroGradients,
  wavenDetailHeroCopyBottom,
  wavenDetailHeroCopyStyles,
} from './WavenDetailHeroVisual';
import { WavenAppShell } from '../shell/WavenAppShell';
import { useWavenLayout } from '../../hooks/useWavenLayout';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import type { MusicAlbum, MusicTrack } from '../../domain/music';
import {
  beginWavenEntityRevealExit,
  getWavenEntityRevealTransition,
  subscribeWavenEntityReveal,
} from '../../features/navigation/wavenEntityReveal';
import {
  wavenColors,
  wavenLayout,
  wavenMotion,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../../theme/tokens';

type DetailStatus = 'loading' | 'ready' | 'error';
type DetailKind = 'Artist' | 'Album';

interface WavenMusicDetailFoundationProps {
  artworkUrl?: string | null;
  seedArtworkUrl?: string | null;
  entityKey: string;
  fallbackSeed: string;
  kindLabel: 'Artist' | 'Album';
  onBack: () => void;
  onRetry: () => void;
  status: DetailStatus;
  subtitle?: string | null;
  title: string;
  children?: ReactNode;
}

interface WavenDetailMotionContextValue {
  ready: boolean;
  reducedMotion: boolean;
}

const WavenDetailMotionContext = createContext<WavenDetailMotionContextValue>({
  ready: true,
  reducedMotion: true,
});

function useWavenDetailEntrance(delayMs: number, translateDistance = 12) {
  const { ready, reducedMotion } = useContext(WavenDetailMotionContext);
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;

    if (reducedMotion) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const entrance = Animated.timing(progress, {
      toValue: 1,
      delay: delayMs,
      duration: wavenMotion.standardMs + 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [delayMs, progress, ready, reducedMotion]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [translateDistance, 0],
        }),
      },
    ],
  };
}

function cleanMetadata(value?: string | null): string | null {
  const normalized = value?.trim() || '';
  if (!normalized) return null;
  if (/^unknown(?: artist| album)?$/i.test(normalized)) return null;
  return normalized;
}

function formatDuration(durationMs?: number | null): string | null {
  if (!durationMs || durationMs <= 0) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function WavenFullBleedArtwork({
  allowQualityUpgrade,
  artworkUrl,
  seedArtworkUrl,
  fallbackSeed,
  kindLabel,
  title,
  heroHeight,
  heroWidth,
  hideSharpArtwork = false,
  scrollY,
}: {
  allowQualityUpgrade: boolean;
  artworkUrl?: string | null;
  seedArtworkUrl?: string | null;
  fallbackSeed: string;
  kindLabel: DetailKind;
  title: string;
  heroHeight: number;
  heroWidth: number;
  hideSharpArtwork?: boolean;
  scrollY: Animated.Value;
}) {
  const normalizedArtworkUrl = artworkUrl?.trim() || null;
  const normalizedSeedArtworkUrl = seedArtworkUrl?.trim() || null;
  const baseArtworkUrl = normalizedSeedArtworkUrl || normalizedArtworkUrl;
  const qualityArtworkUrl =
    normalizedArtworkUrl && normalizedArtworkUrl !== baseArtworkUrl
      ? normalizedArtworkUrl
      : null;
  const [baseFailed, setBaseFailed] = useState(false);
  const [qualityReady, setQualityReady] = useState(false);
  const [qualityFailed, setQualityFailed] = useState(false);
  const qualityOpacity = useRef(new Animated.Value(0)).current;
  const parallax = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0, Math.min(92, heroHeight * 0.17)],
    extrapolate: 'clamp',
  });
  const scale = scrollY.interpolate({
    inputRange: [-120, 0, heroHeight],
    outputRange: [1.1, 1, 1.06],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    setBaseFailed(false);
  }, [baseArtworkUrl]);

  useEffect(() => {
    let cancelled = false;
    qualityOpacity.stopAnimation();
    qualityOpacity.setValue(0);
    setQualityReady(false);
    setQualityFailed(false);

    if (!qualityArtworkUrl) return;

    void Image.prefetch(qualityArtworkUrl)
      .then((loaded) => {
        if (!cancelled && loaded) setQualityReady(true);
      })
      .catch(() => {
        if (!cancelled) setQualityFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [qualityArtworkUrl, qualityOpacity]);

  useEffect(() => {
    qualityOpacity.stopAnimation();

    if (
      !allowQualityUpgrade ||
      !qualityArtworkUrl ||
      !qualityReady ||
      qualityFailed
    ) {
      qualityOpacity.setValue(0);
      return;
    }

    const crossfade = Animated.timing(qualityOpacity, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    crossfade.start();
    return () => crossfade.stop();
  }, [
    allowQualityUpgrade,
    qualityArtworkUrl,
    qualityFailed,
    qualityOpacity,
    qualityReady,
  ]);

  if ((!baseArtworkUrl || baseFailed) && !(qualityArtworkUrl && qualityReady)) {
    const fallbackSize = Math.min(heroWidth, heroHeight);
    return (
      <View style={[styles.fallbackHero, hideSharpArtwork ? styles.hiddenSharpArtwork : null]}>
        <WavenArtworkFallback
          accessibilityLabel={`${title} artwork`}
          seed={fallbackSeed}
          size={fallbackSize}
        />
      </View>
    );
  }

  const renderArtworkPair = (
    uri: string,
    onError: () => void,
    wrapperOpacity?: Animated.Value,
  ) => {
    const pair = (
      <>
        <Animated.Image
          blurRadius={kindLabel === 'Artist' ? 36 : 30}
          fadeDuration={0}
          onError={onError}
          resizeMode="cover"
          source={{ uri }}
          style={[
            styles.heroBlur,
            {
              opacity: WAVEN_DETAIL_HERO_BLUR_OPACITY,
              transform: [
                { translateY: parallax },
                { scale: WAVEN_DETAIL_HERO_BLUR_SCALE },
              ],
            },
          ]}
        />
        <Animated.Image
          accessibilityLabel={`${title} artwork`}
          fadeDuration={0}
          onError={onError}
          resizeMode="cover"
          source={{ uri }}
          style={[
            styles.heroSharp,
            {
              opacity: hideSharpArtwork ? 0 : WAVEN_DETAIL_HERO_SHARP_OPACITY,
              transform: [{ translateY: parallax }, { scale }],
            },
          ]}
        />
      </>
    );

    return wrapperOpacity ? (
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: wrapperOpacity }]}>
        {pair}
      </Animated.View>
    ) : (
      pair
    );
  };

  return (
    <View accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {baseArtworkUrl && !baseFailed
        ? renderArtworkPair(baseArtworkUrl, () => setBaseFailed(true))
        : null}
      {qualityArtworkUrl && qualityReady && !qualityFailed
        ? renderArtworkPair(
            qualityArtworkUrl,
            () => setQualityFailed(true),
            qualityOpacity,
          )
        : null}
      <WavenDetailHeroGradients />
    </View>
  );
}

function WavenDetailLoadingPulse({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const pulse = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    pulse.stopAnimation();

    if (reducedMotion) {
      pulse.setValue(0.55);
      return;
    }

    pulse.setValue(0.24);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.72,
          duration: 640,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.24,
          duration: 640,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  const pulseScale = pulse.interpolate({
    inputRange: [0.24, 0.72],
    outputRange: [0.56, 1],
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.loadingPulseTrack}
    >
      <Animated.View
        style={[
          styles.loadingPulse,
          {
            opacity: pulse,
            transform: [{ scaleX: pulseScale }],
          },
        ]}
      />
    </View>
  );
}

export function WavenMusicDetailFoundation({
  artworkUrl,
  seedArtworkUrl,
  entityKey,
  fallbackSeed,
  kindLabel,
  onBack,
  onRetry,
  status,
  subtitle,
  title,
  children,
}: WavenMusicDetailFoundationProps) {
  const layout = useWavenLayout();
  const reducedMotion = useWavenReducedMotion();
  const isArtist = kindLabel === 'Artist';
  const heroWidth = Math.max(
    280,
    Math.min(layout.width, layout.contentMaxWidth + layout.gutter * 2),
  );
  const heroHeight = isArtist
    ? Math.max(layout.isCompact ? 500 : 548, Math.min(650, heroWidth * 1.28))
    : Math.max(layout.isCompact ? 420 : 456, Math.min(560, heroWidth * 1.04));
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const copyReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const contentReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const controlsReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const subtitleReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const lastSubtitle = useRef<string | null>(null);
  const directRevealStarted = useRef(false);
  const exitInFlight = useRef(false);
  const onBackRef = useRef(onBack);
  const [revealTransition, setRevealTransition] = useState(
    getWavenEntityRevealTransition(),
  );
  const [showLoadingState, setShowLoadingState] = useState(false);
  const enteringThisEntity =
    revealTransition?.phase === 'enter' &&
    revealTransition.entityKey === entityKey;
  const enterHandoffReady = Boolean(
    enteringThisEntity && revealTransition?.handoffReady,
  );
  const exitingThisEntity =
    revealTransition?.phase === 'exit' &&
    revealTransition.entityKey === entityKey;
  const enteredThroughReveal = useRef(enteringThisEntity);

  useEffect(() => {
    if (status !== 'loading' || enteringThisEntity) {
      setShowLoadingState(false);
      return;
    }

    const timer = setTimeout(() => setShowLoadingState(true), 720);
    return () => clearTimeout(timer);
  }, [enteringThisEntity, status]);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(
    () =>
      subscribeWavenEntityReveal(() => {
        setRevealTransition(getWavenEntityRevealTransition());
      }),
    [],
  );

  useEffect(() => {
    if (enteringThisEntity) {
      subtitleReveal.stopAnimation();
      subtitleReveal.setValue(0);
      return;
    }

    const normalizedSubtitle = subtitle?.trim() || null;
    if (!normalizedSubtitle) {
      lastSubtitle.current = null;
      subtitleReveal.setValue(0);
      return;
    }
    if (lastSubtitle.current === normalizedSubtitle) return;

    lastSubtitle.current = normalizedSubtitle;
    subtitleReveal.stopAnimation();
    if (reducedMotion) {
      subtitleReveal.setValue(1);
      return;
    }

    subtitleReveal.setValue(0);
    const reveal = Animated.timing(subtitleReveal, {
      toValue: 1,
      duration: wavenMotion.standardMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    reveal.start();
    return () => reveal.stop();
  }, [enteringThisEntity, reducedMotion, subtitle, subtitleReveal]);

  useLayoutEffect(() => {
    if (exitingThisEntity) {
      copyReveal.stopAnimation();
      contentReveal.stopAnimation();
      controlsReveal.stopAnimation();

      const exitCopyFade = Animated.parallel([
        Animated.timing(copyReveal, {
          toValue: 0,
          duration: wavenMotion.quickMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentReveal, {
          toValue: 0,
          duration: wavenMotion.quickMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(controlsReveal, {
          toValue: 0,
          duration: wavenMotion.quickMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      exitCopyFade.start();
      return () => exitCopyFade.stop();
    }

    heroReveal.stopAnimation();
    copyReveal.stopAnimation();
    contentReveal.stopAnimation();
    controlsReveal.stopAnimation();

    if (reducedMotion) {
      enteredThroughReveal.current = false;
      directRevealStarted.current = true;
      heroReveal.setValue(1);
      copyReveal.setValue(1);
      contentReveal.setValue(1);
      controlsReveal.setValue(1);
      return;
    }

    if (enteringThisEntity) {
      enteredThroughReveal.current = true;
      heroReveal.setValue(1);
      contentReveal.setValue(0);
      controlsReveal.setValue(0);

      // The Transition Scene already owns the hero image, kind and title. Keep
      // the real destination copy hidden until the scene begins its invisible
      // handoff, then make the underlying copy identical before the scene fades.
      copyReveal.setValue(enterHandoffReady ? 1 : 0);
      return;
    }

    if (enteredThroughReveal.current) {
      enteredThroughReveal.current = false;
      directRevealStarted.current = true;
      heroReveal.setValue(1);
      copyReveal.setValue(1);
      contentReveal.setValue(0);
      controlsReveal.setValue(0);

      const bodyHandoff = Animated.parallel([
        Animated.timing(controlsReveal, {
          toValue: 1,
          duration: wavenMotion.quickMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentReveal, {
          toValue: 1,
          delay: 36,
          duration: wavenMotion.standardMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      bodyHandoff.start();
      return () => bodyHandoff.stop();
    }

    if (directRevealStarted.current) return;
    directRevealStarted.current = true;

    heroReveal.setValue(0);
    copyReveal.setValue(0);
    contentReveal.setValue(0);
    controlsReveal.setValue(0);

    const directSequence = Animated.stagger(76, [
      Animated.timing(heroReveal, {
        toValue: 1,
        duration: wavenMotion.deliberateMs + 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(copyReveal, {
        toValue: 1,
        duration: wavenMotion.deliberateMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(controlsReveal, {
        toValue: 1,
        duration: wavenMotion.quickMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentReveal, {
        toValue: 1,
        duration: wavenMotion.standardMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    directSequence.start();
    return () => directSequence.stop();
  }, [
    contentReveal,
    controlsReveal,
    copyReveal,
    enterHandoffReady,
    enteringThisEntity,
    exitingThisEntity,
    heroReveal,
    reducedMotion,
  ]);

  const requestEntityBack = useCallback(async () => {
    if (exitInFlight.current || getWavenEntityRevealTransition()) return;

    exitInFlight.current = true;
    if (!reducedMotion) {
      const started = await beginWavenEntityRevealExit(
        entityKey,
        () => onBackRef.current(),
        artworkUrl,
      );
      if (started) return;
    }

    exitInFlight.current = false;
    onBackRef.current();
  }, [artworkUrl, entityKey, reducedMotion]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void requestEntityBack();
      return true;
    });

    return () => subscription.remove();
  }, [requestEntityBack]);

  const heroScale = heroReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [1.035, 1],
  });
  const kindOpacity = copyReveal.interpolate({
    inputRange: [0, 0.34, 1],
    outputRange: [0, 1, 1],
  });
  const kindTranslate = copyReveal.interpolate({
    inputRange: [0, 0.34, 1],
    outputRange: [12, 0, 0],
  });
  const titleOpacity = copyReveal.interpolate({
    inputRange: [0, 0.16, 0.72, 1],
    outputRange: [0, 0, 1, 1],
  });
  const titleTranslate = copyReveal.interpolate({
    inputRange: [0, 0.16, 0.72, 1],
    outputRange: [24, 24, 0, 0],
  });
  const subtitleCopyOpacity = copyReveal.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [0, 0, 1],
  });
  const subtitleTranslate = copyReveal.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [16, 16, 0],
  });
  const subtitleOpacity = Animated.multiply(subtitleCopyOpacity, subtitleReveal);
  const controlsScale = controlsReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const contentTranslate = contentReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 0],
  });
  const hideSharpArtwork =
    exitingThisEntity || (enteringThisEntity && !enterHandoffReady);
  const allowQualityUpgrade =
    !enteringThisEntity && !exitingThisEntity && !revealTransition;
  const detailMotionContext = useMemo<WavenDetailMotionContextValue>(
    () => ({
      ready: status === 'ready' && !enteringThisEntity && !exitingThisEntity,
      reducedMotion,
    }),
    [enteringThisEntity, exitingThisEntity, reducedMotion, status],
  );

  return (
    <WavenAppShell
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
      )}
      scrollEventThrottle={16}
    >
      <View style={styles.page}>
        <WavenEntityRevealAnchor
          borderRadius={0}
          entityKey={entityKey}
          role="destination"
          style={[
            styles.heroScene,
            {
              height: heroHeight,
              marginHorizontal: -layout.gutter,
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: heroReveal,
                transform: [{ scale: heroScale }],
              },
            ]}
          >
            <WavenFullBleedArtwork
              allowQualityUpgrade={allowQualityUpgrade}
              artworkUrl={artworkUrl}
              seedArtworkUrl={seedArtworkUrl}
              fallbackSeed={fallbackSeed}
              heroHeight={heroHeight}
              heroWidth={heroWidth}
              hideSharpArtwork={hideSharpArtwork}
              kindLabel={kindLabel}
              scrollY={scrollY}
              title={title}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.heroTopRow,
              {
                opacity: controlsReveal,
                paddingHorizontal: layout.gutter,
                transform: [{ scale: controlsScale }],
              },
            ]}
          >
            <WavenPressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              containerStyle={styles.backTouchTarget}
              onPress={() => void requestEntityBack()}
            >
              <View style={styles.backButton}>
                <View style={styles.backChevron} />
              </View>
            </WavenPressable>
          </Animated.View>

          <View
            style={[
              styles.heroCopy,
              {
                bottom: wavenDetailHeroCopyBottom(kindLabel),
                left: layout.gutter,
                right: layout.gutter,
              },
            ]}
          >
            <Animated.Text
              style={[
                wavenDetailHeroCopyStyles.kindLabel,
                { opacity: kindOpacity, transform: [{ translateY: kindTranslate }] },
              ]}
            >
              {kindLabel.toUpperCase()}
            </Animated.Text>
            <Animated.Text
              numberOfLines={isArtist ? 2 : 3}
              style={[
                wavenDetailHeroCopyStyles.heroTitle,
                isArtist ? wavenDetailHeroCopyStyles.artistHeroTitle : null,
                { opacity: titleOpacity, transform: [{ translateY: titleTranslate }] },
              ]}
            >
              {title}
            </Animated.Text>
            <View style={wavenDetailHeroCopyStyles.heroSubtitleSlot}>
              {subtitle ? (
                <Animated.Text
                  numberOfLines={1}
                  style={[
                    wavenDetailHeroCopyStyles.heroSubtitle,
                    {
                      opacity: subtitleOpacity,
                      transform: [{ translateY: subtitleTranslate }],
                    },
                  ]}
                >
                  {subtitle}
                </Animated.Text>
              ) : null}
            </View>
          </View>
        </WavenEntityRevealAnchor>

        <Animated.View
          style={{
            opacity: contentReveal,
            transform: [{ translateY: contentTranslate }],
          }}
        >
          {status === 'loading' && showLoadingState ? (
            <View
              accessible
              accessibilityLabel={`Loading ${kindLabel.toLowerCase()} details`}
              accessibilityLiveRegion="polite"
              style={styles.loadingFocus}
            >
              <WavenDetailLoadingPulse reducedMotion={reducedMotion} />
            </View>
          ) : null}

          {status === 'error' ? (
            <View accessibilityLiveRegion="polite" style={styles.stateCard}>
              <Text style={styles.stateTitle}>Details are taking a break</Text>
              <Text style={styles.stateText}>
                WAVEN could not load this music detail right now.
              </Text>
              <WavenPressable
                accessibilityLabel={`Retry ${kindLabel.toLowerCase()} details`}
                accessibilityRole="button"
                containerStyle={styles.retryTouchTarget}
                onPress={onRetry}
              >
                <View style={styles.retryAction}>
                  <Text style={styles.retryText}>Try Again</Text>
                </View>
              </WavenPressable>
            </View>
          ) : null}

          <WavenDetailMotionContext.Provider value={detailMotionContext}>
            {status === 'ready' ? children : null}
          </WavenDetailMotionContext.Provider>
        </Animated.View>
      </View>
    </WavenAppShell>
  );
}

export function WavenDetailSection({
  title,
  children,
  revealIndex = 0,
}: {
  title: string;
  children: ReactNode;
  revealIndex?: number;
}) {
  const entranceStyle = useWavenDetailEntrance(48 + revealIndex * 44, 6);

  return (
    <Animated.View style={[styles.section, entranceStyle]}>
      <View style={styles.sectionHeadingRow}>
        <View accessible={false} style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}

function WavenTrackArtwork({ track }: { track: MusicTrack }) {
  const [failed, setFailed] = useState(false);
  const artworkUrl = track.artworkUrl || null;

  useEffect(() => {
    setFailed(false);
  }, [artworkUrl]);

  if (!artworkUrl || failed) {
    return (
      <WavenArtworkFallback
        accessibilityLabel={`${track.title} artwork`}
        seed={`detail-track-${track.source.provider}-${track.source.id}`}
        size={50}
      />
    );
  }

  return (
    <Image
      accessibilityLabel={`${track.title} artwork`}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: artworkUrl }}
      style={styles.trackArtwork}
    />
  );
}

export function WavenDetailTrackRow({
  fallbackArtistName,
  index,
  revealIndex = 0,
  showArtwork = false,
  track,
}: {
  fallbackArtistName?: string | null;
  index?: number;
  revealIndex?: number;
  showArtwork?: boolean;
  track: MusicTrack;
}) {
  const actualArtist = cleanMetadata(track.artistName);
  const contextArtist = cleanMetadata(fallbackArtistName);
  const artistForAccessibility = actualArtist || contextArtist;
  const duration = formatDuration(track.durationMs);
  const albumTitle = cleanMetadata(track.albumTitle);
  const displayArtist =
    actualArtist && actualArtist !== contextArtist ? actualArtist : null;
  const secondaryParts = showArtwork
    ? [albumTitle, duration]
    : [displayArtist, duration];
  const secondary = secondaryParts.filter(Boolean).join(' · ');
  const entranceStyle = useWavenDetailEntrance(
    76 + Math.min(revealIndex, 8) * 24,
    4,
  );

  return (
    <Animated.View
      accessibilityLabel={[
        typeof index === 'number' ? `${index}.` : null,
        track.title,
        artistForAccessibility,
      ]
        .filter(Boolean)
        .join(' ')}
      style={[
        styles.musicRow,
        showArtwork ? styles.musicRowWithArtwork : null,
        entranceStyle,
      ]}
    >
      {typeof index === 'number' ? <Text style={styles.rowIndex}>{index}</Text> : null}
      {showArtwork ? <WavenTrackArtwork track={track} /> : null}
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>
          {track.title}
        </Text>
        {secondary ? (
          <Text numberOfLines={1} style={styles.rowSubtitle}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function ReleaseArtwork({ album, size }: { album: MusicAlbum; size: number }) {
  const [failed, setFailed] = useState(false);
  const artworkUrl = album.artworkUrl || null;

  useEffect(() => setFailed(false), [artworkUrl]);

  if (!artworkUrl || failed) {
    return (
      <WavenArtworkFallback
        accessibilityLabel={`${album.title} artwork`}
        seed={`detail-release-${album.source.provider}-${album.source.id}`}
        size={size}
      />
    );
  }

  return (
    <Image
      accessibilityLabel={`${album.title} artwork`}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: artworkUrl }}
      style={{ borderRadius: 20, height: size, width: size }}
    />
  );
}

function WavenAnimatedReleaseCard({
  children,
  revealIndex,
}: {
  children: ReactNode;
  revealIndex: number;
}) {
  const entranceStyle = useWavenDetailEntrance(
    88 + Math.min(revealIndex, 7) * 26,
    4,
  );
  return <Animated.View style={entranceStyle}>{children}</Animated.View>;
}

export function WavenDetailReleaseRail({
  albums,
  onAlbumPress,
}: {
  albums: readonly MusicAlbum[];
  onAlbumPress?: (album: MusicAlbum) => void;
}) {
  const layout = useWavenLayout();
  const artworkSize = layout.isCompact ? 136 : layout.isTabletLike ? 176 : 154;
  const cardWidth = artworkSize + 10;

  return (
    <ScrollView
      contentContainerStyle={styles.releaseRailContent}
      decelerationRate="fast"
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={cardWidth + 12}
    >
      {albums.map((album, index) => {
        const releaseYear = album.releaseDate?.match(/^\d{4}/)?.[0] || null;
        const meta = [releaseYear, cleanMetadata(album.primaryType)]
          .filter(Boolean)
          .join(' · ');
        const content = (
          <View style={[styles.releaseCard, { width: cardWidth }]}>
            <WavenEntityRevealAnchor
              borderRadius={20}
              entityKey={`album:${album.source.provider}:${album.source.id}`}
              role="origin"
              style={{ height: artworkSize, width: artworkSize }}
            >
              <ReleaseArtwork album={album} size={artworkSize} />
            </WavenEntityRevealAnchor>
            <Text numberOfLines={2} style={styles.releaseTitle}>
              {album.title}
            </Text>
            {meta ? (
              <Text numberOfLines={1} style={styles.releaseMeta}>
                {meta}
              </Text>
            ) : null}
          </View>
        );

        const card = onAlbumPress ? (
          <WavenPressable
            accessibilityLabel={`Open ${album.title} album details`}
            accessibilityRole="button"
            onPress={() => onAlbumPress(album)}
          >
            {content}
          </WavenPressable>
        ) : (
          content
        );

        return (
          <WavenAnimatedReleaseCard key={album.id} revealIndex={index}>
            {card}
          </WavenAnimatedReleaseCard>
        );
      })}
    </ScrollView>
  );
}

export function WavenDetailAlbumRow({
  album,
  revealIndex = 0,
}: {
  album: MusicAlbum;
  revealIndex?: number;
}) {
  const releaseYear = album.releaseDate?.match(/^\d{4}/)?.[0] || null;
  const releaseMeta = [cleanMetadata(album.artistName), releaseYear, cleanMetadata(album.primaryType)]
    .filter(Boolean)
    .join(' · ');
  const entranceStyle = useWavenDetailEntrance(
    76 + Math.min(revealIndex, 8) * 24,
    4,
  );

  return (
    <Animated.View
      accessibilityLabel={`${album.title}${releaseMeta ? `, ${releaseMeta}` : ''}`}
      style={[styles.releaseRow, entranceStyle]}
    >
      <View style={styles.releaseArtworkFrame}>
        <ReleaseArtwork album={album} size={72} />
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>
          {album.title}
        </Text>
        {releaseMeta ? (
          <Text numberOfLines={1} style={styles.rowSubtitle}>
            {releaseMeta}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingBottom: wavenSpacing.xl,
  },
  heroScene: {
    backgroundColor: wavenColors.canvas,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBlur: {
    bottom: -40,
    left: -40,
    opacity: 0.5,
    position: 'absolute',
    right: -40,
    top: -40,
  },
  heroSharp: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hiddenSharpArtwork: {
    opacity: 0,
  },
  fallbackHero: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,10,16,0.9)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroTopRow: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 8,
    zIndex: 5,
  },
  backTouchTarget: {
    minHeight: wavenLayout.minimumTouchTarget,
    minWidth: wavenLayout.minimumTouchTarget,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 7, 11, 0.46)',
    borderColor: 'rgba(222, 231, 238, 0.16)',
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backChevron: {
    borderBottomColor: wavenColors.coolWhite,
    borderBottomWidth: 2.5,
    borderLeftColor: wavenColors.coolWhite,
    borderLeftWidth: 2.5,
    height: 11,
    marginLeft: 5,
    transform: [{ rotate: '45deg' }],
    width: 11,
  },
  heroCopy: {
    maxWidth: WAVEN_DETAIL_HERO_COPY_MAX_WIDTH,
    position: 'absolute',
    zIndex: 4,
  },
  loadingFocus: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: wavenSpacing.md,
  },
  loadingPulseTrack: {
    alignItems: 'center',
    backgroundColor: 'rgba(57, 169, 255, 0.10)',
    borderRadius: wavenRadii.pill,
    height: 2,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  loadingPulse: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: wavenRadii.pill,
    height: 2,
    width: 42,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 14, 20, 0.70)',
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: wavenSpacing.sm,
    marginTop: wavenSpacing.lg,
    padding: wavenSpacing.lg,
  },
  stateTitle: {
    color: wavenColors.textPrimary,
    ...wavenTypography.section,
    textAlign: 'center',
  },
  stateText: {
    color: wavenColors.textSecondary,
    ...wavenTypography.body,
    textAlign: 'center',
  },
  retryTouchTarget: {
    minHeight: wavenLayout.minimumTouchTarget,
    marginTop: wavenSpacing.xs,
  },
  retryAction: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
    paddingHorizontal: 20,
  },
  retryText: {
    color: wavenColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginTop: 30,
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionAccent: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: wavenRadii.pill,
    height: 18,
    width: 3,
  },
  sectionTitle: {
    color: wavenColors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  sectionBody: {
    marginTop: 10,
  },
  musicRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(197, 202, 209, 0.10)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 2,
    paddingVertical: 11,
  },
  musicRowWithArtwork: {
    gap: 12,
    minHeight: 76,
  },
  trackArtwork: {
    borderRadius: 14,
    height: 50,
    width: 50,
  },
  releaseRailContent: {
    gap: 12,
    paddingRight: 38,
  },
  releaseCard: {
    gap: 6,
  },
  releaseTitle: {
    color: wavenColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  releaseMeta: {
    color: wavenColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  releaseRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(197, 202, 209, 0.10)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    minHeight: 94,
    paddingHorizontal: 2,
    paddingVertical: 10,
  },
  releaseArtworkFrame: {
    borderColor: 'rgba(197,202,209,0.12)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 72,
    overflow: 'hidden',
    width: 72,
  },
  rowIndex: {
    color: wavenColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 14,
    textAlign: 'center',
    width: 24,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: wavenColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  rowSubtitle: {
    color: wavenColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
});
