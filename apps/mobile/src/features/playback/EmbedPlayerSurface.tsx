import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';
import type { MobilePlayerHudState, ShieldVerificationState } from '@orion/shared/types';
import {
  ALL_CINEMA_SOURCES,
} from '@orion/shared/sources';
import { SourcesSheet } from '../../components/player/SourcesSheet';
import { WatchdogWarning } from '../../components/player/WatchdogWarning';
import { useLibrary } from '../../context/LibraryContext';
import {
  clearMobileDiagnosticError,
  reportMobileDiagnosticError,
  updateMobileDiagnostics,
} from '../../services/mobileDiagnostics';
import {
  markMobileSourceFailure,
  updateMobileSourceHealth,
} from '../../services/sourceHealth';
import {
  createEmbeddedTelemetryScript,
  parseEmbeddedTelemetryMessage,
} from './embeddedTelemetry';
import { createVerifiedResumeScript, mobileAdBlockerScript } from './mobileAdBlocker';
import { playerStyles as styles } from './playerStyles';
import type { PlaybackSurfaceProps } from './playerTypes';
import { ResumePlaybackPrompt } from './ResumePlaybackPrompt';
import { resolveResumeChoiceTime, type ResumePlaybackChoice } from './resumeChoice';
import { usePlaybackTelemetryController } from './usePlaybackTelemetryController';

interface EmbedPlayerSurfaceProps extends PlaybackSurfaceProps {
  embedUrl: string;
  onResumeAttempt: (handoffId: string, status: 'applied' | 'unavailable') => void;
}

const WEBVIEW_AUDIO_RELEASE_MS = Platform.OS === 'android' ? 240 : 80;
const QUIET_CURRENT_SURFACE_SCRIPT = `
  (() => {
    document.querySelectorAll('video, audio').forEach((media) => {
      try { media.muted = true; media.pause(); } catch (_) {}
    });
    true;
  })();
`;

export function EmbedPlayerSurface({
  embedUrl,
  title,
  sourceId,
  id,
  type,
  season,
  episode,
  initialResumeTime = 0,
  onSourceChange,
  onAutomaticFailover,
  onPlaybackSnapshot,
  activeHandoffId,
  onResumeAttempt,
}: EmbedPlayerSurfaceProps) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { recordPlayback } = useLibrary();
  const [showSources, setShowSources] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hudState, setHudState] = useState<MobilePlayerHudState>('buffering');
  const [shieldState, setShieldState] = useState<ShieldVerificationState>('limited');
  const [blockedRequests, setBlockedRequests] = useState(0);
  const [allowedDependencies, setAllowedDependencies] = useState(0);
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [surfaceReleased, setSurfaceReleased] = useState(false);
  const [pendingManualSource, setPendingManualSource] = useState<{
    id: string;
    label: string;
    savedTime: number;
  } | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadStartedAt = useRef(Date.now());
  const bridgeSequence = useRef(0);
  const resumeRequested = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceTransitionPending = useRef(false);
  const webViewRef = useRef<WebViewType>(null);
  const source = ALL_CINEMA_SOURCES.find((entry) => entry.id === sourceId);
  const sourceLabel = source?.label || 'VidEasy Direct';
  const expectedOrigins = source?.expectedOrigins || [];
  const media = useMemo(() => ({
    id,
    mediaType: type,
    title: title || 'Orion Stream',
    season: Number(season) || null,
    episode: Number(episode) || null,
  } as const), [episode, id, season, title, type]);
  const item = useMemo(
    () => ({ id, title: media.title, media_type: type }),
    [id, media.title, type],
  );
  const telemetry = usePlaybackTelemetryController({
    item,
    media,
    sourceId,
    surface: 'embed',
    recordPlayback,
  });
  const telemetryScript = useMemo(() => createEmbeddedTelemetryScript({
    sessionId: telemetry.getSession().id,
    sourceId,
    strategy: source?.progressStrategy || 'none',
    expectedOrigins,
  }), [sourceId]);
  const injectedScript = `${mobileAdBlockerScript}\n${telemetryScript}`;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    }
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    loadStartedAt.current = Date.now();
    bridgeSequence.current = 0;
    resumeRequested.current = false;
    setIsBuffering(true);
    setHudState('buffering');
    setShowControls(true);
    setShieldState('limited');
    setBlockedRequests(0);
    setAllowedDependencies(0);
    setWatchdogDismissed(false);
    return () => {
      if (observationTimeout.current) clearTimeout(observationTimeout.current);
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      telemetry.flush();
    };
  }, [embedUrl, sourceId]);

  const toggleOrientation = async () => {
    if (Platform.OS === 'web') return;
    const next = isLandscape
      ? ScreenOrientation.OrientationLock.PORTRAIT_UP
      : ScreenOrientation.OrientationLock.LANDSCAPE;
    try {
      await ScreenOrientation.lockAsync(next);
      setIsLandscape(!isLandscape);
    } catch {}
  };

  const resetHideTimer = () => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setShowControls(true);
    if (!isBuffering && !showSources && hudState !== 'error') {
      hideTimeout.current = setTimeout(() => {
        setShowControls(false);
        setHudState('hidden');
      }, 4000);
    }
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [isBuffering, showSources, hudState]);

  const handleScreenTap = () => {
    if (!showControls) {
      setHudState('visible');
      resetHideTimer();
    } else {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      setShowControls(false);
      setHudState('hidden');
    }
  };

  const releaseSurfaceThen = (
    switchSource: (snapshot: ReturnType<typeof telemetry.getVerifiedSnapshot>) => boolean,
  ) => {
    if (sourceTransitionPending.current || activeHandoffId) return;
    telemetry.flush();
    const snapshot = telemetry.getVerifiedSnapshot();
    sourceTransitionPending.current = true;
    webViewRef.current?.injectJavaScript(QUIET_CURRENT_SURFACE_SCRIPT);
    setSurfaceReleased(true);
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null;
      const accepted = switchSource(snapshot);
      if (!accepted) {
        sourceTransitionPending.current = false;
        setSurfaceReleased(false);
      }
    }, WEBVIEW_AUDIO_RELEASE_MS);
  };

  const selectSource = (nextSourceId: string) => {
    if (nextSourceId === sourceId) return;
    setShowSources(false);
    telemetry.flush();
    const snapshot = telemetry.getVerifiedSnapshot();
    const savedTime = Math.max(0, Number(snapshot?.currentTime) || 0);
    if (savedTime > 30) {
      const target = ALL_CINEMA_SOURCES.find((entry) => entry.id === nextSourceId);
      setPendingManualSource({
        id: nextSourceId,
        label: target?.label || nextSourceId,
        savedTime,
      });
      setHudState('sheet-open');
      setShowControls(true);
      return;
    }
    releaseSurfaceThen((latestSnapshot) => (
      onSourceChange(nextSourceId, latestSnapshot, 'manual')
    ));
  };
  const completeManualSourceChoice = (choice: ResumePlaybackChoice) => {
    const pending = pendingManualSource;
    if (!pending) return;
    const requestedTime = resolveResumeChoiceTime(choice, pending.savedTime);
    setPendingManualSource(null);
    releaseSurfaceThen((snapshot) => (
      onSourceChange(pending.id, snapshot, 'manual', requestedTime)
    ));
  };
  const handleFailover = () => {
    releaseSurfaceThen(onAutomaticFailover);
  };

  const requiredOrigins = new Set([
    ...(source?.expectedOrigins || []),
    ...(source?.allowedNavigationOrigins || []),
    ...(source?.requiredRequestOrigins || []),
  ]);
  const handleShouldStartLoad = (request: any) => {
    const url = request?.url || '';
    if (!url) return true;
    let origin = '';
    try { origin = new URL(url).origin; } catch {}
    const required = requiredOrigins.has(origin)
      || /\.(m3u8|mpd|vtt|srt|m4s|ts)(\?|$)/i.test(url)
      || /subtitle|caption|manifest|playlist/i.test(url);
    if (required) {
      setAllowedDependencies((value) => value + 1);
      setShieldState('dependency-allowed');
      return true;
    }
    if (/doubleclick|popcash|adsterra|profitableratecpm|adexchangeclear|bet365|exoclick|googlesyndication/i.test(url)) {
      setBlockedRequests((value) => value + 1);
      setShieldState('verified');
      return false;
    }
    return true;
  };

  const markSurfaceLoaded = () => {
    setIsBuffering(false);
    setHudState('visible');
    resetHideTimer();
    if (observationTimeout.current) clearTimeout(observationTimeout.current);
    observationTimeout.current = setTimeout(() => {
      if (!telemetry.getSession().verified) {
        telemetry.markOpenedOnly();
        updateMobileDiagnostics({ playbackState: 'unobservable', playbackEvidence: 'opened-only' });
      }
    }, 8000);
  };

  const markFailed = (message: string) => {
    setIsBuffering(false);
    setHudState('error');
    setShowControls(true);
    setShieldState('failed');
    telemetry.emitTelemetry({ evidence: 'provider-message', state: 'error' });
    const health = markMobileSourceFailure(sourceId, type, message);
    updateMobileDiagnostics({ activeSourceId: sourceId, sourceHealth: health.state });
    reportMobileDiagnosticError({ area: 'playback', code: 'SOURCE_FAILED', message });
  };

  const handleMessage = (raw: string) => {
    let envelope: any = null;
    try { envelope = JSON.parse(raw); } catch {}
    if (envelope?.type === 'TAP') {
      handleScreenTap();
      return;
    }
    if (envelope?.type === 'ORION_RESUME_RESULT') {
      if (envelope.handoffId === activeHandoffId
        && ['applied', 'unavailable'].includes(envelope.status)) {
        onResumeAttempt(envelope.handoffId, envelope.status);
      }
      return;
    }
    const parsed = parseEmbeddedTelemetryMessage(raw, {
      sessionId: telemetry.getSession().id,
      sourceId,
      expectedOrigins,
      lastSequence: bridgeSequence.current,
    });
    if (!parsed) {
      if (envelope?.type === 'ORION_PLAYBACK_TELEMETRY') {
        reportMobileDiagnosticError({
          area: 'playback-telemetry',
          code: 'TELEMETRY_REJECTED',
          message: 'Provider telemetry did not match the active playback session.',
        });
      }
      return;
    }
    bridgeSequence.current = parsed.bridgeSequence;
    const decision = telemetry.emitTelemetry(parsed.input);
    if (!decision.accepted) return;
    setIsBuffering(parsed.input.state === 'buffering');
    setHudState(parsed.input.state === 'buffering' ? 'buffering' : 'visible');
    if (decision.state.session.verified) {
      if (observationTimeout.current) clearTimeout(observationTimeout.current);
      const startupMs = Date.now() - loadStartedAt.current;
      const health = updateMobileSourceHealth(sourceId, type, {
        state: startupMs > 12_000 ? 'slow' : 'ready',
        startupMs,
        failureCount: 0,
        cooldownUntil: 0,
        blockedRequests,
        allowedDependencies,
        lastError: null,
      });
      updateMobileDiagnostics({ activeSourceId: sourceId, sourceHealth: health.state });
      clearMobileDiagnosticError('playback');
      clearMobileDiagnosticError('playback-telemetry');
      const snapshot = telemetry.getVerifiedSnapshot();
      if (snapshot) onPlaybackSnapshot?.(snapshot);
      if (source?.resumeStrategy === 'verified-seek'
        && initialResumeTime > 0
        && !resumeRequested.current) {
        resumeRequested.current = true;
        webViewRef.current?.injectJavaScript(createVerifiedResumeScript(
          initialResumeTime,
          activeHandoffId || `initial-${telemetry.getSession().id}`,
        ));
      }
    }
  };

  const compact = windowWidth < 480;
  return (
    <View style={styles.container}>
      <View style={styles.videoBoxWrapper}>
        {surfaceReleased ? (
          <View style={styles.webVideo} accessibilityLabel="Releasing previous playback source" />
        ) : Platform.OS === 'web' ? (
          <iframe
            src={embedUrl}
            style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' }}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            onLoad={markSurfaceLoaded}
          />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: embedUrl }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScript={injectedScript}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            style={styles.webVideo}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            onLoadStart={() => {
              setIsBuffering(true);
              setHudState('buffering');
            }}
            onLoadEnd={markSurfaceLoaded}
            onError={({ nativeEvent }) => markFailed(nativeEvent.description || 'Provider failed to load')}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.statusCode >= 400) markFailed(`Provider returned HTTP ${nativeEvent.statusCode}`);
            }}
            onMessage={(event) => handleMessage(event.nativeEvent.data)}
          />
        )}
      </View>

      {!showControls && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show player controls"
          onPress={() => {
            setHudState('visible');
            resetHideTimer();
          }}
          style={styles.embedRevealHandle}
        >
          <View style={styles.embedRevealBar} />
        </Pressable>
      )}

      {showControls && (
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.65)', 'transparent']}
          style={styles.fullWidthHeaderGradient}
          pointerEvents="box-none"
        >
          <Pressable onPress={() => router.back()} style={styles.floatingGlassBackBtn}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </Pressable>
          <View style={styles.headerTitleWrapper}>
            <Text style={styles.framelessTitle} numberOfLines={1}>{title || 'Orion Stream'}</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.shieldBadge}>
              <Ionicons
                name={shieldState === 'failed' ? 'shield-outline' : 'shield-checkmark'}
                size={12}
                color={shieldState === 'verified' ? '#4ade80' : '#fbbf24'}
              />
              {!compact && (
                <Text style={[styles.shieldText, shieldState !== 'verified' && styles.shieldTextLimited]}>
                  {shieldState === 'verified' ? `Shield ${blockedRequests}` : shieldState === 'failed' ? 'Shield failed' : 'Shield limited'}
                </Text>
              )}
            </View>
            <Pressable onPress={toggleOrientation} style={styles.floatingGlassBackBtn}>
              <Ionicons name={isLandscape ? 'refresh-outline' : 'expand-outline'} size={16} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => {
                setShowSources(true);
                setHudState('sheet-open');
                setShowControls(true);
              }}
              style={styles.floatingGlassSourceChip}
            >
              <Ionicons name="hardware-chip-outline" size={14} color="#f87171" />
              {!compact && <Text style={styles.sourceChipText} numberOfLines={1}>{sourceLabel}</Text>}
            </Pressable>
          </View>
        </LinearGradient>
      )}

      {!watchdogDismissed && (
        <WatchdogWarning
          isBuffering={isBuffering}
          onFailover={handleFailover}
          onSelectSource={() => setShowSources(true)}
          onDismiss={() => setWatchdogDismissed(true)}
        />
      )}
      {showSources && (
        <SourcesSheet
          currentSourceId={sourceId}
          onSelect={selectSource}
          mediaType={type}
          onClose={() => {
            setShowSources(false);
            setHudState('visible');
            resetHideTimer();
          }}
        />
      )}
      {pendingManualSource && (
        <ResumePlaybackPrompt
          title={title || 'this title'}
          savedTime={pendingManualSource.savedTime}
          targetSourceLabel={pendingManualSource.label}
          opensPaused={pendingManualSource.id === 'vidking'}
          onChoose={completeManualSourceChoice}
          onCancel={() => {
            setPendingManualSource(null);
            setHudState('visible');
            resetHideTimer();
          }}
        />
      )}
    </View>
  );
}
