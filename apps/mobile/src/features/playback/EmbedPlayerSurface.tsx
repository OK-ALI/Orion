import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import type { WebView as WebViewType } from 'react-native-webview';
import type {
  EmbeddedSubtitleTrackV1,
  MobilePlayerHudState,
  ShieldVerificationState,
  SubtitleDiscoveryState,
} from '@orion/shared/types';
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
  markMobileSourceSuccess,
} from '../../services/sourceHealth';
import {
  createEmbeddedTelemetryScript,
  parseEmbeddedTelemetryMessage,
} from './embeddedTelemetry';
import { createVerifiedResumeScript, mobileAdBlockerScript } from './mobileAdBlocker';
import { OrionCinemaWebView } from './OrionCinemaWebView';
import { classifyCinemaSourceFailure } from './sourceFailure';
import {
  clearSubtitleSession,
  createObservedSubtitleTrack,
  discoverExternalSubtitleTracks,
  getInternalSubtitleTrack,
} from './subtitleDiscovery';
import { playerStyles as styles } from './playerStyles';
import type { PlaybackSurfaceProps } from './playerTypes';
import { ResumePlaybackPrompt } from './ResumePlaybackPrompt';
import { resolveResumeChoiceTime, type ResumePlaybackChoice } from './resumeChoice';
import {
  getMobileSourceContinuityCapability,
  mobileSourceCanReceiveContinuity,
  type MobileContinuityMode,
} from './mobileSources';
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
  seriesTitle,
  year,
  posterPath,
  backdropPath,
  episodeTitle,
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
  const [shieldState, setShieldState] = useState<ShieldVerificationState>(
    Platform.OS === 'android' ? 'limited' : 'unavailable',
  );
  const [blockedRequests, setBlockedRequests] = useState(0);
  const [allowedDependencies, setAllowedDependencies] = useState(0);
  const [subtitleState, setSubtitleState] = useState<SubtitleDiscoveryState>('idle');
  const [subtitleTracks, setSubtitleTracks] = useState<EmbeddedSubtitleTrackV1[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [surfaceReleased, setSurfaceReleased] = useState(false);
  const [surfaceRetryKey, setSurfaceRetryKey] = useState(0);
  const [pendingManualSource, setPendingManualSource] = useState<{
    id: string;
    label: string;
    savedTime: number;
    continuityMode: MobileContinuityMode;
  } | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadStartedAt = useRef(Date.now());
  const bridgeSequence = useRef(0);
  const resumeRequested = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceTransitionPending = useRef(false);
  const healthRecorded = useRef(false);
  const nativeBlockObserved = useRef(false);
  const shieldFailureObserved = useRef(false);
  const surfaceLoaded = useRef(false);
  const webViewRef = useRef<WebViewType>(null);
  const source = ALL_CINEMA_SOURCES.find((entry) => entry.id === sourceId);
  const sourceLabel = source?.label || 'VidEasy Direct';
  const expectedOrigins = source?.expectedOrigins || [];
  const sourceContinuity = getMobileSourceContinuityCapability(sourceId);
  const telemetryExpectedOrigins = sourceId === '111movies'
    ? Array.from(new Set([...expectedOrigins, 'https://player.vidlove.cc']))
    : expectedOrigins;
  const shieldManifest = source?.requestManifest;
  const selectedSubtitle = selectedSubtitleId ? getInternalSubtitleTrack(selectedSubtitleId) : null;
  const shieldedEmbedUrl = useMemo(() => {
    if (!selectedSubtitle?.url || !source?.externalSubtitleParam) return embedUrl;
    try {
      const url = new URL(embedUrl);
      url.searchParams.set(source.externalSubtitleParam, selectedSubtitle.url);
      if (source.externalSubtitleLabelParam) url.searchParams.set(source.externalSubtitleLabelParam, selectedSubtitle.label);
      return url.toString();
    } catch {
      return embedUrl;
    }
  }, [embedUrl, selectedSubtitle?.id, source?.externalSubtitleLabelParam, source?.externalSubtitleParam]);
  const media = useMemo(() => ({
    id,
    mediaType: type,
    title: seriesTitle || title || 'Orion Stream',
    year: Number(year) || null,
    season: Number(season) || null,
    episode: Number(episode) || null,
  } as const), [episode, id, season, seriesTitle, title, type, year]);
  const item = useMemo(
    () => ({
      id,
      title: media.title,
      name: type === 'tv' ? media.title : undefined,
      media_type: type,
      year,
      poster_path: posterPath || null,
      backdrop_path: backdropPath || null,
      series_title: seriesTitle || null,
      episode_title: episodeTitle || (type === 'tv' ? title : null),
    }),
    [backdropPath, episodeTitle, id, media.title, posterPath, seriesTitle, title, type, year],
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
    expectedOrigins: telemetryExpectedOrigins,
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
    setShieldState(Platform.OS === 'android' ? 'limited' : 'unavailable');
    setBlockedRequests(0);
    setAllowedDependencies(0);
    setSubtitleState('idle');
    setSubtitleTracks([]);
    setSelectedSubtitleId(null);
    healthRecorded.current = false;
    nativeBlockObserved.current = false;
    shieldFailureObserved.current = false;
    surfaceLoaded.current = false;
    setWatchdogDismissed(false);
    return () => {
      if (observationTimeout.current) clearTimeout(observationTimeout.current);
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      telemetry.flush();
      clearSubtitleSession(telemetry.getSession().id);
    };
  }, [embedUrl, sourceId, surfaceRetryKey]);

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
      const capability = getMobileSourceContinuityCapability(nextSourceId);
      setPendingManualSource({
        id: nextSourceId,
        label: target?.label || nextSourceId,
        savedTime,
        continuityMode: capability.mode,
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
    const requestedTime = mobileSourceCanReceiveContinuity(pending.id)
      ? resolveResumeChoiceTime(choice, pending.savedTime)
      : 0;
    setPendingManualSource(null);
    releaseSurfaceThen((snapshot) => (
      onSourceChange(pending.id, snapshot, 'manual', requestedTime)
    ));
  };
  const handleFailover = () => {
    releaseSurfaceThen(onAutomaticFailover);
  };

  const retryCurrentSource = () => {
    if (sourceTransitionPending.current || activeHandoffId) return;
    telemetry.flush();
    setShowSources(false);
    setSurfaceReleased(true);
    setHudState('buffering');
    setIsBuffering(true);
    setTimeout(() => {
      setSurfaceRetryKey((value) => value + 1);
      setSurfaceReleased(false);
    }, WEBVIEW_AUDIO_RELEASE_MS);
  };

  const findExternalSubtitles = async () => {
    const sessionId = telemetry.getSession().id;
    setSubtitleState('discovering');
    const result = await discoverExternalSubtitleTracks({
      sessionId,
      tmdbId: id,
      mediaType: type,
      season: Number(season) || undefined,
      episode: Number(episode) || undefined,
    });
    setSubtitleState(result.state);
    setSubtitleTracks((existing) => {
      const known = new Set(existing.map((track) => track.id));
      return [...existing, ...result.tracks.filter((track) => !known.has(track.id))];
    });
  };

  const handleShouldStartLoad = () => {
    return true;
  };

  const markSurfaceLoaded = () => {
    bridgeSequence.current = 0;
    webViewRef.current?.injectJavaScript(injectedScript);
    surfaceLoaded.current = true;
    setIsBuffering(false);
    setHudState('visible');
    resetHideTimer();
    if (source?.requestManifest?.mode === 'enforce'
      && nativeBlockObserved.current
      && !shieldFailureObserved.current) {
      setShieldState('verified');
    }
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
    telemetry.emitTelemetry({ evidence: 'provider-message', state: 'error' });
    const failure = classifyCinemaSourceFailure(message, {
      superseded: sourceTransitionPending.current || surfaceReleased,
    });
    if (failure === 'user-cancelled') return;
    const health = markMobileSourceFailure(sourceId, type, message, failure);
    updateMobileDiagnostics({ activeSourceId: sourceId, sourceHealth: health.state });
    reportMobileDiagnosticError({ area: 'playback', code: 'SOURCE_FAILED', message });
  };

  const handleMessage = (raw: string) => {
    let envelope: any = null;
    try { envelope = JSON.parse(raw); } catch {}
    if (envelope?.kind === 'orion-shield') {
      const decision = String(envelope.decision || 'unknown');
      const counts = envelope?.counts && typeof envelope.counts === 'object' ? envelope.counts : {};
      const blockedCount = Object.entries(counts)
        .filter(([key]) => key === 'blocked' || key.startsWith('blocked-'))
        .reduce((total, [, value]) => total + Math.max(0, Number(value) || 0), 0);
      const dependencyCount = Math.max(0, Number(counts['required-dependency']) || 0);
      if (blockedCount > 0) {
        nativeBlockObserved.current = true;
        setBlockedRequests((value) => value + blockedCount);
        const nativeProtectionVerified = source?.requestManifest?.mode === 'enforce'
          && surfaceLoaded.current
          && !shieldFailureObserved.current;
        setShieldState(nativeProtectionVerified ? 'verified' : 'limited');
      }
      if (dependencyCount > 0) {
        setAllowedDependencies((value) => value + dependencyCount);
        if (!nativeBlockObserved.current) setShieldState('dependency-allowed');
      }
      if (decision === 'rule-failure') {
        shieldFailureObserved.current = true;
        setShieldState('failed');
      } else if (decision === 'observed-subtitle') {
        const track = createObservedSubtitleTrack(telemetry.getSession().id, {
          provider: sourceId,
          method: 'request-capture',
        });
        setSubtitleTracks((existing) => existing.some((entry) => entry.id === track.id) ? existing : [...existing, track]);
        setSubtitleState('available');
      } else if (blockedCount === 0 && dependencyCount === 0) {
        setShieldState((current) => current === 'verified' ? current : 'limited');
      }
      return;
    }
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
      expectedOrigins: telemetryExpectedOrigins,
      lastSequence: bridgeSequence.current,
    });
    if (!parsed) {
      if (envelope?.type === 'ORION_PLAYBACK_TELEMETRY') {
        const sequence = Number(envelope.sequence);
        let rejectReason = 'parse-rejected';
        if (envelope.sessionId !== telemetry.getSession().id) rejectReason = 'session-mismatch';
        else if (envelope.sourceId !== sourceId) rejectReason = 'source-mismatch';
        else if (!Number.isInteger(sequence)) rejectReason = 'invalid-sequence';
        else if (sequence <= bridgeSequence.current) rejectReason = 'stale-bridge-sequence';
        else if (typeof envelope.origin !== 'string' || !telemetryExpectedOrigins.includes(envelope.origin)) rejectReason = 'unexpected-origin';
        else if (!['loading', 'playing', 'paused', 'buffering', 'seeking', 'ended', 'error'].includes(String(envelope.state || '').toLowerCase())) rejectReason = 'invalid-state';
        else if (!['provider-message', 'provider-video-event'].includes(envelope.evidence)) rejectReason = 'invalid-evidence';
        reportMobileDiagnosticError({
          area: 'playback-telemetry',
          code: 'TELEMETRY_REJECTED',
          message: `Provider telemetry rejected: ${rejectReason}.`,
        });
      }
      return;
    }
    bridgeSequence.current = parsed.bridgeSequence;
    const decision = telemetry.emitTelemetry(parsed.input);
    if (!decision.accepted) {
      return;
    }
    setIsBuffering(parsed.input.state === 'buffering');
    setHudState(parsed.input.state === 'buffering' ? 'buffering' : 'visible');
    if (decision.state.session.verified) {
      if (observationTimeout.current) clearTimeout(observationTimeout.current);
      const startupMs = Date.now() - loadStartedAt.current;
      const protectionVerified = source?.requestManifest?.mode === 'enforce'
        && nativeBlockObserved.current
        && !shieldFailureObserved.current;
      setShieldState(protectionVerified ? 'verified' : shieldFailureObserved.current ? 'failed' : 'limited');
      if (!healthRecorded.current) {
        healthRecorded.current = true;
        const health = markMobileSourceSuccess(sourceId, type, {
          startupMs,
          telemetrySupport: 'observable',
          subtitleSupport: subtitleTracks.length ? 'available' : source?.supportsExternalSubtitles ? 'limited' : 'unknown',
          blockedRequests,
          allowedDependencies,
          limited: !protectionVerified,
        });
        updateMobileDiagnostics({ activeSourceId: sourceId, sourceHealth: health.state });
      }
      clearMobileDiagnosticError('playback');
      clearMobileDiagnosticError('playback-telemetry');
      const snapshot = telemetry.getVerifiedSnapshot();
      if (snapshot) {
        onPlaybackSnapshot?.(snapshot);
      }
      const shouldUseTopLevelVerifiedSeek = sourceContinuity.canReceivePosition
        && (source?.resumeStrategy === 'verified-seek' || sourceId === 'vidlink');
      if (shouldUseTopLevelVerifiedSeek
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
          <OrionCinemaWebView
          key={`${sourceId}:${telemetry.getSession().id}:${surfaceRetryKey}`}
          ref={webViewRef}
          shieldManifest={shieldManifest || {
            schemaVersion: 1,
            sourceId,
            mode: 'observe',
            allowedNavigationOrigins: expectedOrigins,
            requiredOrigins: expectedOrigins,
            mediaOrigins: [],
            artworkOrigins: [],
            subtitleOrigins: [],
            popupPolicy: 'block',
            rules: [],
          }}
            source={{ uri: shieldedEmbedUrl }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScript={injectedScript}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            style={styles.webVideo}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            onLoadStart={() => {
              surfaceLoaded.current = false;
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
            <View style={[
              styles.shieldBadge,
              shieldState === 'verified'
                ? styles.shieldBadgeVerified
                : shieldState === 'failed'
                  ? styles.shieldBadgeFailed
                  : styles.shieldBadgeLimited,
            ]}>
              <Ionicons
                name={shieldState === 'failed' ? 'shield-outline' : 'shield-checkmark'}
                size={12}
                color={shieldState === 'verified' ? '#4ade80' : shieldState === 'failed' ? '#fb7185' : '#fbbf24'}
              />
              <Text style={[
                styles.shieldCounter,
                shieldState === 'verified'
                  ? styles.shieldCounterVerified
                  : shieldState === 'failed'
                    ? styles.shieldCounterFailed
                    : styles.shieldCounterLimited,
              ]}>
                {blockedRequests}
              </Text>
              {!compact && (
                <Text style={[styles.shieldText, shieldState !== 'verified' && styles.shieldTextLimited]}>
                  {shieldState === 'verified'
                    ? 'Protected'
                    : shieldState === 'failed'
                      ? 'Protection issue'
                      : shieldState === 'unavailable'
                        ? 'Protection unavailable'
                        : shieldState === 'dependency-allowed'
                          ? 'Protection active'
                          : 'Protection limited'}
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
          onRetry={retryCurrentSource}
          mediaType={type}
          shieldState={shieldState}
          blockedRequests={blockedRequests}
          allowedDependencies={allowedDependencies}
          subtitleState={subtitleState}
          subtitleCount={subtitleTracks.length}
          subtitleTracks={subtitleTracks}
          selectedSubtitleId={selectedSubtitleId}
          onSelectSubtitle={(trackId) => {
            if (!source?.externalSubtitleParam) return;
            setSelectedSubtitleId(trackId);
            setShowSources(false);
          }}
          onFindExternalSubtitles={source?.supportsExternalSubtitles ? findExternalSubtitles : undefined}
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
          continuityMode={pendingManualSource.continuityMode}
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
