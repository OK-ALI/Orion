import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import type { WebView as WebViewType } from 'react-native-webview';
import type {
  EmbeddedSubtitleTrackV1,
  MobileShieldEvidenceV1,
  MobilePlayerPresentation,
  MobilePlayerSurfaceAdapter,
  ShieldVerificationState,
  SubtitleDiscoveryState,
} from '@orion/shared/types';
import {
  ALL_CINEMA_SOURCES,
} from '@orion/shared/sources';
import { SourcesSheet } from '../../components/player/SourcesSheet';
import { WatchdogWarning } from '../../components/player/WatchdogWarning';
import { useLibraryPlaybackActions } from '../../context/LibraryContext';
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
  createWrapperDiagnosticScript,
  recordWrapperDiagnosticMessage,
} from './embeddedTelemetry';
import {
  createCineSrcResumeScript,
  createVerifiedResumeScript,
  mobileAdBlockerScript,
} from './mobileAdBlocker';
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
import { useMobilePlayerController } from './MobilePlayerController';
import { getEmbeddedPresentationModes, getPresentationPreference, savePresentationPreference } from './presentationPreferences';
import { usePlayerImmersiveSystemUi } from './immersiveSystemUi';
import { PresentationSheet } from '../../components/player/PresentationSheet';
import { EmbeddedPlayerHud } from './EmbeddedPlayerHud';
import { mergeShieldEvidence, parseShieldEvidenceEnvelope } from './shieldEvidenceEnvelope';
import { PlayerStateOverlay } from '../../components/player/PlayerStateOverlay';
import { createMobileDownloadTargetV1 } from '../downloads/downloadIdentity';
import { beginMobileDownloadCaptureSessionV1 } from '../downloads/downloadCandidateCapture';
import { useDownloadSourceAutoReturnV1 } from '../downloads/useDownloadSourceAutoReturn';
import type { PlaybackPurpose } from './viewingPersistence';
import { createProviderWebViewSource, getProviderShieldManifest, getProviderCapturePolicy, EMPTY_SHIELD_EVIDENCE, QUIET_CURRENT_SURFACE_SCRIPT } from './providerEmbedSupport';
import { ProviderControlsReturn } from './ProviderControlsReturn';
interface EmbedPlayerSurfaceProps extends PlaybackSurfaceProps {
  embedUrl: string;
  playbackPurpose?: PlaybackPurpose;
  onResumeAttempt: (handoffId: string, status: 'applied' | 'unavailable') => void;
}

const WEBVIEW_AUDIO_RELEASE_MS = Platform.OS === 'android' ? 240 : 80;
export function EmbedPlayerSurface({
  embedUrl,
  playbackPurpose = 'viewing',
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
  forceStartFromBeginning = false,
  onSourceChange,
  onAutomaticFailover,
  onPlaybackSnapshot,
  onVerifiedPlaybackCompletion,
  activeHandoffId,
  onResumeAttempt,
  onExit,
  isLandscape = true,
  onToggleOrientation,
}: EmbedPlayerSurfaceProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { recordPlayback } = useLibraryPlaybackActions();
  const controller = useMobilePlayerController();
  const [isBuffering, setIsBuffering] = useState(true);
  const [shieldState, setShieldState] = useState<ShieldVerificationState>(
    Platform.OS === 'android' ? 'limited' : 'unavailable',
  );
  const [blockedRequests, setBlockedRequests] = useState(0);
  const [allowedDependencies, setAllowedDependencies] = useState(0);
  const [shieldEvidence, setShieldEvidence] = useState<MobileShieldEvidenceV1>(EMPTY_SHIELD_EVIDENCE);
  const [subtitleState, setSubtitleState] = useState<SubtitleDiscoveryState>('idle');
  const [subtitleTracks, setSubtitleTracks] = useState<EmbeddedSubtitleTrackV1[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);
  const [surfaceReleased, setSurfaceReleased] = useState(false);
  const [surfaceRetryKey, setSurfaceRetryKey] = useState(0);
  const [providerControlsMode, setProviderControlsMode] = useState(false);
  const [pendingManualSource, setPendingManualSource] = useState<{
    id: string;
    label: string;
    savedTime: number;
    continuityMode: MobileContinuityMode;
  } | null>(null);
  const observationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadStartedAt = useRef(Date.now());
  const bridgeSequence = useRef(0);
  const wrapperDiagnosticSequence = useRef(0);
  const nativeShieldSequence = useRef(0);
  const resumeRequested = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceTransitionPending = useRef(false);
  const healthRecorded = useRef(false);
  const nativeShieldObserved = useRef(false);
  const nativeBlockObserved = useRef(false);
  const shieldFailureObserved = useRef(false);
  const surfaceLoaded = useRef(false);
  const webViewRef = useRef<WebViewType>(null);
  const source = ALL_CINEMA_SOURCES.find((entry) => entry.id === sourceId);
  const { captureEnabled: downloadQualificationCaptureEnabled, diagnosticOnly } = getProviderCapturePolicy(source);
  const sourceLabel = source?.label || 'VidEasy Direct';
  const expectedOrigins = source?.expectedOrigins || [];
  const sourceContinuity = getMobileSourceContinuityCapability(sourceId);
  const telemetryExpectedOrigins = expectedOrigins;

  const shieldManifest = useMemo(() => getProviderShieldManifest(sourceId, source), [sourceId, source]);
  const selectedSubtitle = selectedSubtitleId ? getInternalSubtitleTrack(selectedSubtitleId) : null;
  const shieldedEmbedUrl = useMemo(() => {
    if (!selectedSubtitle?.url || !source?.externalSubtitleParam) return embedUrl;
    try {
      const url = new URL(embedUrl);
      url.searchParams.set(source.externalSubtitleParam, selectedSubtitle.url);
      if (source.externalSubtitleLabelParam) url.searchParams.set(source.externalSubtitleLabelParam, selectedSubtitle.label);
      if (source.externalSubtitleLanguageParam) {
        url.searchParams.set(source.externalSubtitleLanguageParam, selectedSubtitle.language || 'en');
      }
      return url.toString();
    } catch {
      return embedUrl;
    }
  }, [embedUrl, selectedSubtitle?.id, source?.externalSubtitleLabelParam, source?.externalSubtitleLanguageParam, source?.externalSubtitleParam]);
  const webViewSource = useMemo(() => createProviderWebViewSource(shieldedEmbedUrl, source), [shieldedEmbedUrl, source]);
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
    onVerifiedCompletion: onVerifiedPlaybackCompletion,
    purpose: playbackPurpose,
  });
  const playbackSessionId = telemetry.getSession().id;
  const downloadTarget = useMemo(() => createMobileDownloadTargetV1({
    id,
    mediaType: type,
    title: type === 'tv' ? (seriesTitle || title || 'Series') : (title || 'Movie'),
    year,
    seriesTitle: type === 'tv' ? (seriesTitle || title || null) : null,
    season: type === 'tv' && Number.isFinite(Number(season)) ? Math.max(0, Math.trunc(Number(season))) : null,
    episode: type === 'tv' && Number.isFinite(Number(episode)) ? Math.max(0, Math.trunc(Number(episode))) : null,
    episodeTitle: type === 'tv' ? (episodeTitle || title || null) : null,
    posterPath: posterPath || null,
    backdropPath: backdropPath || null,
  }), [backdropPath, episode, episodeTitle, id, posterPath, season, seriesTitle, title, type, year]);
  useDownloadSourceAutoReturnV1(downloadTarget.itemKey);
  const sourceSheetOverlay = ['sources', 'subtitles', 'shield', 'diagnostics'].includes(controller.state.overlay);
  const showControls = controller.state.hudState !== 'hidden';
  const presentation = controller.state.presentation;
  const presentationModes = getEmbeddedPresentationModes(sourceId);
  const setShowSources = (visible: boolean) => {
    if (visible) controller.openOverlay('sources');
    else if (sourceSheetOverlay) controller.closeOverlay();
  };
  const telemetryScript = useMemo(() => createEmbeddedTelemetryScript({
    sessionId: playbackSessionId,
    sourceId,
    strategy: source?.progressStrategy || 'none',
    expectedOrigins: telemetryExpectedOrigins,
    playerEventContract: source?.playerEventContract,
    playerMessageHandshake: source?.playerMessageHandshake,
  }), [playbackSessionId, sourceId]);
  const wrapperDiagnosticScript = useMemo(() => createWrapperDiagnosticScript({
    sessionId: playbackSessionId, sourceId, expectedOrigins,
    requiresIframeWrapper: source?.requiresIframeWrapper === true,
  }), [playbackSessionId, sourceId]);
  const injectedScript = `${wrapperDiagnosticScript}${mobileAdBlockerScript}\n${telemetryScript}`;

  useEffect(() => {
    if (Platform.OS !== 'android' || !source || !downloadQualificationCaptureEnabled) return undefined;
    return beginMobileDownloadCaptureSessionV1({
      playbackSessionId,
      sourceId,
      providerClass: source.releaseStatus,
      itemKey: downloadTarget.itemKey,
      media: downloadTarget.media,
      diagnosticOnly,
    });
  }, [diagnosticOnly, downloadQualificationCaptureEnabled, downloadTarget, playbackSessionId, source?.releaseStatus, sourceId]);

  useEffect(() => {
    loadStartedAt.current = Date.now();
    bridgeSequence.current = 0;
    wrapperDiagnosticSequence.current = 0;
    nativeShieldSequence.current = 0;
    resumeRequested.current = false;
    setIsBuffering(true);
    controller.setLoading('preparing');
    setShieldState(Platform.OS === 'android' ? 'limited' : 'unavailable');
    setBlockedRequests(0);
    setAllowedDependencies(0);
    setShieldEvidence(EMPTY_SHIELD_EVIDENCE);
    setSubtitleState('idle');
    setSubtitleTracks([]);
    setSelectedSubtitleId(null);
    healthRecorded.current = false;
    nativeShieldObserved.current = false;
    nativeBlockObserved.current = false;
    shieldFailureObserved.current = false;
    surfaceLoaded.current = false;
    setWatchdogDismissed(false);
    setProviderControlsMode(false);
    return () => {
      if (observationTimeout.current) clearTimeout(observationTimeout.current);
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      telemetry.flush();
      clearSubtitleSession(telemetry.getSession().id);
    };
  }, [embedUrl, sourceId, surfaceRetryKey]);

  useEffect(() => {
    const command = (expression: string) => webViewRef.current?.injectJavaScript(`(() => { const media = document.querySelector('video'); if (media) { ${expression}; return true; } return false; })(); true;`);
    const adapter: MobilePlayerSurfaceAdapter = {
      surface: 'embed',
      sessionId: playbackSessionId,
      getSnapshot: () => controller.state.playback,
      play: () => command('media.play().catch(() => {})'),
      pause: () => command('media.pause()'),
      seek: (seconds) => command(`media.currentTime = ${Math.max(0, Number(seconds) || 0)}`),
      seekBy: (seconds) => command(`media.currentTime = Math.max(0, media.currentTime + ${Number(seconds) || 0})`),
      setPresentation: (mode) => presentationModes.includes(mode),
    };
    return controller.registerSurface(adapter, {
      canPlay: true,
      canPause: true,
      canSeek: source?.progressStrategy !== 'none',
      canSourceSwitch: true,
      canSubtitles: true,
      canShield: true,
      canFullscreen: true,
      canPresentation: presentationModes.length > 1,
    }, getPresentationPreference('embed', sourceId));
  }, [sourceId, surfaceRetryKey]);

  usePlayerImmersiveSystemUi(true, controller.state.playback.playing, !showControls);


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
    releaseSurfaceThen((snapshot) => onSourceChange(
      sourceId,
      snapshot,
      'automatic',
      snapshot ? undefined : Math.max(0, initialResumeTime),
    ));
  };

  const retryCurrentSource = () => {
    if (sourceTransitionPending.current || activeHandoffId) return;
    telemetry.flush();
    setShowSources(false);
    setSurfaceReleased(true);
    controller.setLoading('switching');
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

  const handleShouldStartLoad = (request: { url?: string; isTopFrame?: boolean }) => {
    if (Platform.OS !== 'ios' || request.isTopFrame === false) return true;
    const value = String(request.url || '');
    if (value === 'about:blank') return true;
    try {
      const requested = new URL(value);
      const allowed = new Set(shieldManifest?.allowedNavigationOrigins || expectedOrigins);
      const accepted = requested.protocol === 'https:' && allowed.has(requested.origin);
      if (!accepted) {
        nativeBlockObserved.current = true;
        setBlockedRequests((count) => count + 1);
        setShieldState('verified');
      }
      return accepted;
    } catch {
      return false;
    }
  };

  const markSurfaceLoaded = () => {
    bridgeSequence.current = 0;
    webViewRef.current?.injectJavaScript(injectedScript);
    surfaceLoaded.current = true;
    setIsBuffering(false);
    controller.setLoading(null);
    // A native session proves that interception is active. "Protected" is
    // reserved for a loaded session that actually blocked unwanted traffic.
    if (source?.requestManifest?.mode === 'enforce'
      && nativeShieldObserved.current
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
    controller.setLoading('failed');
    telemetry.emitTelemetry({ evidence: 'provider-message', state: 'error' });
    const failure = classifyCinemaSourceFailure(message, {
      superseded: sourceTransitionPending.current || surfaceReleased,
    });
    if (failure === 'user-cancelled') return;
    const health = markMobileSourceFailure(sourceId, type, message, failure);
    updateMobileDiagnostics({ activeSourceId: sourceId, sourceHealth: health.state });
    reportMobileDiagnosticError({ area: 'playback', code: 'SOURCE_FAILED', message });
  };

  const applyShieldEnvelope = useCallback((envelope: any) => {
      const parsed = parseShieldEvidenceEnvelope(envelope);
      if (!parsed) return;
      if (parsed.nativeEvidenceSeen) nativeShieldObserved.current = true;
      setShieldEvidence((current) => mergeShieldEvidence(current, parsed));
      if (parsed.blockedCount > 0) {
        nativeBlockObserved.current = true;
        setBlockedRequests((value) => value + parsed.blockedCount);
      }
      if (parsed.dependencyCount > 0) {
        setAllowedDependencies((value) => value + parsed.dependencyCount);
        if (!nativeShieldObserved.current) setShieldState('dependency-allowed');
      }
      if (parsed.decision === 'rule-failure') {
        shieldFailureObserved.current = true;
        setShieldState('failed');
      } else if (parsed.decision === 'observed-subtitle') {
        const track = createObservedSubtitleTrack(telemetry.getSession().id, {
          provider: sourceId,
          method: 'request-capture',
        });
        setSubtitleTracks((existing) => existing.some((entry) => entry.id === track.id) ? existing : [...existing, track]);
        setSubtitleState('available');
      } else {
        const nativeProtectionVerified = source?.requestManifest?.mode === 'enforce'
          && surfaceLoaded.current
          && nativeShieldObserved.current
          && nativeBlockObserved.current
          && !shieldFailureObserved.current;
        setShieldState(nativeProtectionVerified ? 'verified' : parsed.dependencyCount > 0 ? 'dependency-allowed' : 'limited');
      }
  }, [source?.requestManifest?.mode, sourceId, telemetry]);

  const handleNativeShieldEvidence = useCallback((raw: string) => {
    try {
      const envelope = JSON.parse(raw);
      const sequence = Number(envelope.sequence);
      if (!Number.isInteger(sequence) || sequence <= nativeShieldSequence.current) return;
      if (envelope.sessionId !== telemetry.getSession().id || envelope.sourceId !== sourceId) return;
      nativeShieldSequence.current = sequence;
      applyShieldEnvelope(envelope);
    } catch {}
  }, [applyShieldEnvelope, sourceId, telemetry]);

  const handleMessage = (raw: string) => {
    const diagnosticSequence = recordWrapperDiagnosticMessage(raw, source, telemetry.getSession().id, wrapperDiagnosticSequence.current);
    if (diagnosticSequence !== null) { wrapperDiagnosticSequence.current = diagnosticSequence; return; }
    let envelope: any = null;
    try { envelope = JSON.parse(raw); } catch {}
    if (envelope?.kind === 'orion-shield') {
      // Android shield truth arrives through the typed native-view event. The
      // page bridge remains for web/dev compatibility only.
      if (Platform.OS !== 'android') applyShieldEnvelope(envelope);
      return;
    }
    if (envelope?.type === 'ORION_COSMETIC_BLOCK') {
      const counts = envelope?.counts && typeof envelope.counts === 'object' ? envelope.counts : {};
      const popupCount = Math.min(100, Math.max(0, Math.floor(Number(counts.popup) || 0)));
      const navigationCount = Math.min(100, Math.max(0, Math.floor(Number(counts.navigation) || 0)));
      const advertisementCount = Math.min(100, Math.max(0, Math.floor(Number(counts.advertisement) || 0)));
      const cosmeticTotal = popupCount + navigationCount + advertisementCount;
      if (cosmeticTotal <= 0) return;
      nativeBlockObserved.current = true;
      setBlockedRequests((value) => value + cosmeticTotal);
      setShieldEvidence((current) => ({
        ...current,
        blockedRequests: current.blockedRequests + cosmeticTotal,
        blockedPopups: current.blockedPopups + popupCount,
        blockedNavigations: current.blockedNavigations + navigationCount,
        blockedAdvertisements: current.blockedAdvertisements + advertisementCount,
        lastRuleId: 'cosmetic-cleanup',
      }));
      const protectionVerified = source?.requestManifest?.mode === 'enforce'
        && surfaceLoaded.current
        && nativeShieldObserved.current
        && !shieldFailureObserved.current;
      setShieldState(protectionVerified ? 'verified' : 'limited');
      return;
    }
    if (envelope?.type === 'ORION_SUBTITLE_TRACK') {
      const language = typeof envelope.language === 'string'
        ? envelope.language.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'und'
        : 'und';
      const label = typeof envelope.label === 'string'
        ? envelope.label.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'Embedded subtitles'
        : 'Embedded subtitles';
      const track = createObservedSubtitleTrack(telemetry.getSession().id, {
        provider: sourceId,
        language,
        label,
        method: 'text-track',
        availability: 'available',
      });
      setSubtitleTracks((existing) => existing.some((entry) => entry.id === track.id) ? existing : [...existing, track]);
      setSubtitleState('available');
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
    controller.updatePlayback({
      state: parsed.input.state,
      playing: parsed.input.state === 'playing',
      currentTime: parsed.input.currentTime ?? null,
      duration: parsed.input.duration ?? null,
      bufferedPosition: parsed.input.bufferedPosition ?? null,
      observable: decision.state.session.verified,
    }, telemetry.getSession().id);
    if (decision.state.session.verified) {
      if (observationTimeout.current) clearTimeout(observationTimeout.current);
      const startupMs = Date.now() - loadStartedAt.current;
      const protectionVerified = source?.requestManifest?.mode === 'enforce'
        && nativeShieldObserved.current
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
      const shouldUseCineSrcCommandSeek = sourceId === 'cinesrc' && sourceContinuity.canReceivePosition;
      const shouldUseTopLevelVerifiedSeek = sourceContinuity.canReceivePosition
        && (source?.resumeStrategy === 'verified-seek' || sourceId === 'vidlink' || forceStartFromBeginning);
      if ((shouldUseCineSrcCommandSeek || shouldUseTopLevelVerifiedSeek)
        && (initialResumeTime > 0 || forceStartFromBeginning)
        && !resumeRequested.current) {
        resumeRequested.current = true;
        const handoffId = activeHandoffId || `initial-${telemetry.getSession().id}`;
        webViewRef.current?.injectJavaScript(
          shouldUseCineSrcCommandSeek
            ? createCineSrcResumeScript(initialResumeTime, handoffId)
            : createVerifiedResumeScript(initialResumeTime, handoffId),
        );
      }
    }
  };

  const compact = windowWidth < 480;
  const screenWiderThanVideo = windowWidth / Math.max(1, windowHeight) > 16 / 9;
  const presentationStyle = presentation === 'provider'
    ? { width: '100%' as const, height: '100%' as const, flex: 0, alignSelf: 'stretch' as const }
    : presentation === 'fit'
      ? (screenWiderThanVideo ? { height: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 } : { width: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 })
      : presentation === 'fill'
        ? (screenWiderThanVideo ? { width: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 } : { height: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 })
        : undefined;
  return (
    <View style={styles.container}>
      <View style={styles.videoBoxWrapper}>
        {surfaceReleased ? (
          <View style={styles.webVideo} accessibilityLabel="Releasing previous playback source" />
        ) : Platform.OS === 'web' ? (
          <iframe
            src={shieldedEmbedUrl}
            style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' }}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            onLoad={markSurfaceLoaded}
          />
        ) : (
          <OrionCinemaWebView
          key={`${sourceId}:${playbackSessionId}:${surfaceRetryKey}`}
          ref={webViewRef}
          shieldManifest={shieldManifest}
            shieldSessionId={playbackSessionId}
            downloadCaptureEnabled={downloadQualificationCaptureEnabled}
            downloadProviderClass={source?.releaseStatus || null}
            onNativeShieldEvidence={handleNativeShieldEvidence}
            onNativeSingleTap={providerControlsMode ? undefined : controller.toggleChromeFromUserTap}
            source={webViewSource}
            wrapperDiagnosticOrigins={source?.requiresIframeWrapper ? expectedOrigins : undefined}
            injectedJavaScriptBeforeContentLoaded={wrapperDiagnosticScript || undefined}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false} androidLayerType="none" presentationMode={presentation}
            injectedJavaScript={injectedScript}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            containerStyle={presentation === 'provider' ? presentationStyle : undefined}
            style={[styles.webVideo, presentationStyle]}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            onLoadStart={() => {
              surfaceLoaded.current = false;
              setIsBuffering(true);
              controller.setLoading('waiting');
            }}
            onLoadEnd={markSurfaceLoaded}
            onError={({ nativeEvent }) => markFailed(nativeEvent.description || 'This source failed to load')}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.statusCode >= 400) markFailed('This source is having trouble');
            }}
            onMessage={(event) => handleMessage(event.nativeEvent.data)}
          />
        )}
      </View>

      <PlayerStateOverlay
        state={controller.state.loadingState}
        onRetry={retryCurrentSource}
        onSwitchSource={() => controller.openOverlay('sources')}
      />

      {providerControlsMode ? (
        <ProviderControlsReturn onReturn={() => {
          setProviderControlsMode(false);
          controller.reveal();
        }} />
      ) : (
      <EmbeddedPlayerHud
        visible={showControls}
        compact={compact}
        title={title || 'Orion Stream'}
        sourceLabel={sourceLabel}
        shieldState={shieldState}
        blockedRequests={blockedRequests}
        nativeShieldObserved={nativeShieldObserved.current}
        landscape={isLandscape} presentation={presentation}
        onReveal={controller.reveal}
        onCollapse={controller.dismiss}
        onBack={onExit}
        onPresentation={() => controller.openOverlay('presentation')}
        onShield={() => controller.openOverlay('shield')}
        onSubtitles={() => controller.openOverlay('subtitles')}
        onRotate={() => onToggleOrientation?.()}
        onProviderControls={() => {
          controller.closeOverlay();
          controller.dismiss();
          setProviderControlsMode(true);
        }}
        onSources={() => setShowSources(true)}
      />
      )}

      {!watchdogDismissed && (
        <WatchdogWarning
          isBuffering={isBuffering}
          onFailover={handleFailover}
          onSelectSource={() => setShowSources(true)}
          onDismiss={() => setWatchdogDismissed(true)}
        />
      )}
      {sourceSheetOverlay && (
        <SourcesSheet
          currentSourceId={sourceId}
          onSelect={selectSource}
          onRetry={retryCurrentSource}
          mediaType={type}
          shieldState={shieldState}
          blockedRequests={blockedRequests}
          allowedDependencies={allowedDependencies}
          shieldEvidence={shieldEvidence}
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
          section={controller.state.overlay === 'subtitles' || controller.state.overlay === 'shield' || controller.state.overlay === 'diagnostics'
            ? controller.state.overlay
            : 'sources'}
          onClose={() => {
            setShowSources(false);
          }}
        />
      )}
      <PresentationSheet
        visible={controller.state.overlay === 'presentation'}
        value={presentation}
        capability={{
          supported: presentationModes,
          unsupportedReason: 'This picture mode is not available for embedded sources.',
        }}
        onChange={(mode: MobilePlayerPresentation) => {
          if (!presentationModes.includes(mode)) return;
          savePresentationPreference('embed', sourceId, mode);
          controller.setPresentation(mode);
        }}
        onClose={controller.closeOverlay}
      />
      {pendingManualSource && (
        <ResumePlaybackPrompt
          title={title || 'this title'}
          savedTime={pendingManualSource.savedTime}
          targetSourceLabel={pendingManualSource.label}
          continuityMode={pendingManualSource.continuityMode}
          onChoose={completeManualSourceChoice}
          onCancel={() => { setPendingManualSource(null); }}
        />
      )}
    </View>
  );
}
