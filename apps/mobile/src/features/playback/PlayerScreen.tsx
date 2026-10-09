import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getSourceResumeParams,
  getSourceUrl,
  getRegisteredSource,
  sourceResumeStrategy,
  isManualAnimeProvider,
} from '@orion/shared/sources';
import type { PlaybackHandoffV1 } from '@orion/shared/types';
import { tmdbFetch } from '@orion/shared/api';
import { useLibraryPlaybackActions } from '../../context/LibraryContext';
import {
  getMobileSourceHealth,
  hydrateMobileSourceHealth,
} from '../../services/sourceHealth';
import { reportMobileDiagnosticError, updateMobileDiagnostics, traceMobilePlayback } from '../../services/mobileDiagnostics';
import { EmbedPlayerSurface } from './EmbedPlayerSurface';
import { AnimeSourceChoices } from './AnimeSourceChoices';
import { useAnimeSource, type AnimeSourceSelection } from './useAnimeSource';
import { clearAnimeFlowChoice } from './animeSourceAffinity';
import { OrionFinalizedPlayerActivitySurface } from './OrionFinalizedPlayerActivitySurface';
import { OrionOfflinePlayerSurface } from './OrionOfflinePlayerSurface';
import {
  classifyNativeOfflinePlaybackV1,
  type NativeOfflinePlaybackRouteV1,
} from '../downloads/nativeDownloadEngine';
import { ResumePlaybackPrompt } from './ResumePlaybackPrompt';
import {
  resolveResumeChoiceTime,
  type ResumePlaybackChoice,
} from './resumeChoice';
import {
  HANDOFF_CONFIRMATION_TIMEOUT_MS,
  evaluatePlaybackHandoff,
  createPlaybackHandoff,
  getFreshVerifiedPosition,
  handoffCanCarryPosition,
  handoffIsPending,
  handoffTargetMissedPosition,
  updateHandoffStatus,
} from './handoffPolicy';
import {
  MOBILE_PLAYER_SOURCES,
  getMobileSourceContinuityCapability,
  MOBILE_DEFAULT_CINEMA_SOURCE_ID,
  getNextMobileContinuitySource,
  getPreferredMobileResumeSource,
  mobileSourceCanReceiveContinuity,
} from './mobileSources';
import { createMobileDownloadTargetV1 } from '../downloads/downloadIdentity';
import {
  getMobileDownloadSourceResolutionIntentV1,
} from '../downloads/downloadCandidateCapture';
import type { VerifiedPlaybackSnapshot } from './playerTypes';
import { MobilePlayerControllerProvider, useMobilePlayerController } from './MobilePlayerController';
import { NextEpisodePrompt } from './NextEpisodePrompt';
import { PlayerStateOverlay } from '../../components/player/PlayerStateOverlay';
import {
  getNextReleasedEpisode,
  type NextEpisodeCandidate,
} from './playbackCompletion';
import { resolvePlaybackRouteIdentity } from './routePlaybackIdentity';
import { usePlayerOrientation } from './usePlayerOrientation';
import { getMobileEmbedResumeParams } from './providerEmbedSupport';
import { getAniLinkResumeDiagnosticUrl } from './aniLinkResumeDiagnostic';
import { shouldPresentContinuityWarning } from './continuityWarningPresentation';

type PlayerRouteParams = {
  id: string;
  type: 'movie' | 'tv';
  title: string;
  season?: string;
  episode?: string;
  year?: string;
  seriesTitle?: string;
  posterPath?: string;
  backdropPath?: string;
  episodeTitle?: string;
  offlineAssetId?: string;
  isOffline?: string;
  nextSourceId?: string;
  nextAnimeVariant?: string;
};

function OfflinePlaybackPreparationSurface({
  error,
  onBack,
  onRetry,
}: {
  error: string | null;
  onBack: () => void;
  onRetry?: () => void;
}) {
  const { setLoading } = useMobilePlayerController();
  const state = error ? 'failed' : 'preparing';

  useEffect(() => {
    setLoading(state);
  }, [setLoading, state]);

  return (
    <View accessibilityLabel={error ? 'Offline playback needs attention' : 'Preparing offline playback'} style={{ flex: 1, backgroundColor: '#000' }}>
      <PlayerStateOverlay
        state={state}
        detail={error || 'Orion is validating the downloaded media for local playback.'}
        onBack={error ? onBack : undefined}
        onRetry={error && onRetry ? onRetry : undefined}
      />
    </View>
  );
}

export default function PlayerScreen() {
  const router = useRouter();
  const { isLandscape, toggleOrientation, releaseOrientation } = usePlayerOrientation();
  const exitPlayer = useCallback(async () => {
    clearAnimeFlowChoice(String(routeIdRef.current));
    await releaseOrientation();
    router.back();
  }, [releaseOrientation, router]);
  const {
    id, type, title, season, episode, year, seriesTitle,
    posterPath, backdropPath, episodeTitle, offlineAssetId, isOffline, nextSourceId, nextAnimeVariant,
  } =
    useLocalSearchParams<PlayerRouteParams>();
  const routeIdRef = useRef(id); routeIdRef.current = id;
  const { getPlaybackProgress, getPlaybackSourcePreference } = useLibraryPlaybackActions();
  const offlineRequested = isOffline === 'true';
  const [offlineResolutionAttempt, setOfflineResolutionAttempt] = useState(0);
  const [offlineSource, setOfflineSource] = useState<NativeOfflinePlaybackRouteV1 | null>(null);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const routePlaybackIdentity = resolvePlaybackRouteIdentity(type, season, episode);
  const resolvedSeason = routePlaybackIdentity.season;
  const resolvedEpisode = routePlaybackIdentity.episode;
  const downloadItemKey = createMobileDownloadTargetV1({
    id, mediaType: type, title: type === 'tv' ? (seriesTitle || title || 'Series') : (title || 'Movie'),
    seriesTitle: type === 'tv' ? (seriesTitle || title || null) : null,
    season: resolvedSeason, episode: resolvedEpisode,
  }).itemKey;
  const downloadIntentAtOpen = Boolean(getMobileDownloadSourceResolutionIntentV1(downloadItemKey));
  const [downloadResolutionLatched, setDownloadResolutionLatched] = useState(downloadIntentAtOpen);
  const downloadResolutionOnly = downloadIntentAtOpen || downloadResolutionLatched;
  const existingProgress = getPlaybackProgress(type, id, resolvedSeason, resolvedEpisode);
  const routedNextSource = nextSourceId
    && MOBILE_PLAYER_SOURCES.some((source) => source.id === nextSourceId)
    ? nextSourceId
    : null;
  const sourcePreference = getPlaybackSourcePreference(type, id);
  const [sourceId, setSourceId] = useState(() => routedNextSource || getPreferredMobileResumeSource(
    sourcePreference?.sourceId || existingProgress?.sourceId || MOBILE_DEFAULT_CINEMA_SOURCE_ID,
    type,
  ));
  const catalogIdentity = `${type}:${id}`;
  const [externalIdentity, setExternalIdentity] = useState<{ key: string; imdbId: string | null } | null>(null);
  const imdbId = externalIdentity?.key === catalogIdentity ? externalIdentity.imdbId : null;
  const needsExternalIdentity = getRegisteredSource(sourceId)?.idPolicy[type].startsWith('imdb');
  const waitingExternalIdentity = !offlineRequested && needsExternalIdentity && externalIdentity?.key !== catalogIdentity;
  const [animeAttempt, setAnimeAttempt] = useState(0);
  const pendingAnimeSelection = useRef<AnimeSourceSelection | null>(null);
  const anime = useAnimeSource({ id, type, season: resolvedSeason, episode: resolvedEpisode,
    enabled: !offlineRequested && !downloadResolutionOnly, preference: sourcePreference,
    routedSource: isManualAnimeProvider(nextSourceId) ? nextSourceId : routedNextSource || undefined, routedVariant: nextAnimeVariant,
    onPreferred: (selection) => setSourceId(selection.providerId || 'aniembed') });
  const activeAnimeTest = anime.selection;
  useEffect(() => { if (anime.phase === 'failed') setSourceId(anime.providerId || 'aniembed'); }, [anime.phase, anime.providerId]);
  const [handoff, setHandoffState] = useState<PlaybackHandoffV1 | null>(null);
  const handoffRef = useRef<PlaybackHandoffV1 | null>(null);
  const initialSavedTime = existingProgress?.completed
    ? 0
    : Math.max(0, Number(existingProgress?.currentTime) || 0);
  const [initialChoicePending, setInitialChoicePending] = useState(initialSavedTime > 30 && !downloadIntentAtOpen);
  const [resumeTime, setResumeTime] = useState(downloadIntentAtOpen || initialSavedTime > 30 ? 0 : initialSavedTime);
  const [forceStartFromBeginning, setForceStartFromBeginning] = useState(false);
  const [nextEpisodePrompt, setNextEpisodePrompt] = useState<NextEpisodeCandidate | null>(null);
  const completionHandledRef = useRef(new Set<string>());
  const nextEpisodeRequestRef = useRef(0);
  const playbackIdentity = `${type}:${id}:s${resolvedSeason || 0}:e${resolvedEpisode || 0}`;
  const playbackIdentityRef = useRef(playbackIdentity);
  const currentIdentityRef = useRef(playbackIdentity); currentIdentityRef.current = playbackIdentity;
  const [episodeTransition, setEpisodeTransition] = useState<string | null>(null);
  const episodeTransitionRef = useRef<string | null>(null);
  const [readyPlaybackIdentity, setReadyPlaybackIdentity] = useState(playbackIdentity);

  const publishHandoff = useCallback((next: PlaybackHandoffV1 | null) => {
    const previous = handoffRef.current;
    handoffRef.current = next;
    setHandoffState(next);
    updateMobileDiagnostics({
      handoffState: next?.status ?? null,
      handoffStrategy: next?.strategy ?? null,
      handoffRequestedTime: next?.requestedTime ?? null,
      handoffConfirmedTime: next?.confirmedTime ?? null,
      handoffFailureCode: next?.failureCode ?? null,
    });
    if (next) traceMobilePlayback?.('handoff', { sourceId: next.targetSourceId, attemptId: next.id,
      sessionId: next.targetSessionId, routeIdentity: playbackIdentityRef.current, strategy: next.strategy, state: next.status,
      target: next.requestedTime, position: next.confirmedTime, reason: next.failureCode,
      warningVisible: shouldPresentContinuityWarning(next.targetSourceId, next), handoffState: next.status });
    if (previous && (!next || next.status === 'confirmed')) traceMobilePlayback?.('warning-clear', {
      sourceId: previous.targetSourceId, attemptId: previous.id, sessionId: previous.targetSessionId,
      routeIdentity: playbackIdentityRef.current, reason: next ? 'settled' : 'released',
      persistenceEligible: next?.status === 'confirmed' || previous.status === 'confirmed' });
  }, []);

  // Download source resolution is intentionally current-source only.
  // A download intent returns automatically only when the active provider
  // produces a genuinely ready candidate through useDownloadSourceAutoReturnV1.
  // Orion never changes providers on a timer; source choice remains explicit
  // user action through the player or Download Options.


  useEffect(() => {
    if (playbackIdentityRef.current === playbackIdentity) return;
    playbackIdentityRef.current = playbackIdentity;
    episodeTransitionRef.current = null;
    setEpisodeTransition(null);
    setReadyPlaybackIdentity(playbackIdentity);
    setDownloadResolutionLatched(downloadIntentAtOpen);
    nextEpisodeRequestRef.current += 1;
    setNextEpisodePrompt(null);
    publishHandoff(null);
    pendingAnimeSelection.current = null;
    setSourceId(routedNextSource || getPreferredMobileResumeSource(
      getPlaybackSourcePreference(type, id)?.sourceId || getPlaybackProgress(type, id, resolvedSeason, resolvedEpisode)?.sourceId, type));
    const routeProgress = getPlaybackProgress(
      type,
      id,
      resolvedSeason,
      resolvedEpisode,
    );
    const savedTime = routeProgress?.completed
      ? 0
      : Math.max(0, Number(routeProgress?.currentTime) || 0);
    setInitialChoicePending(savedTime > 30 && !downloadIntentAtOpen);
    setResumeTime(downloadIntentAtOpen || savedTime > 30 ? 0 : savedTime);
    setForceStartFromBeginning(false);
  }, [downloadIntentAtOpen, getPlaybackProgress, getPlaybackSourcePreference, routedNextSource, id, playbackIdentity, publishHandoff, resolvedEpisode, resolvedSeason, type]);

  useEffect(() => { hydrateMobileSourceHealth(); }, []);
  useEffect(() => {
    if (!offlineRequested || !offlineAssetId) {
      setOfflineSource(null);
      setOfflineError(offlineRequested ? 'Offline download identity is missing.' : null);
      return undefined;
    }
    let disposed = false;
    setOfflineSource(null);
    setOfflineError(null);
    classifyNativeOfflinePlaybackV1(offlineAssetId)
      .then((source) => {
        if (disposed) return;
        setOfflineSource(source);
        updateMobileDiagnostics({ playbackState: 'ready', playbackSurface: 'native' });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : 'Orion could not prepare this offline download for playback.';
        setOfflineError(message);
        updateMobileDiagnostics({ playbackState: 'error', playbackSurface: 'native' });
        reportMobileDiagnosticError({
          area: 'offline-playback',
          code: 'PREPARATION_FAILED',
          message,
        });
      });
    return () => { disposed = true; };
  }, [offlineAssetId, offlineRequested, offlineResolutionAttempt]);

  useEffect(() => {
    const health = getMobileSourceHealth(sourceId, type);
    updateMobileDiagnostics({
      activeSourceId: offlineRequested ? 'local' : sourceId,
      sourceHealth: offlineRequested ? 'ready' : (health?.state ?? 'unknown'),
      playbackState: 'loading',
      playbackSurface: offlineRequested ? 'native' : 'embed',
      playbackEvidence: null,
      lastTelemetryAt: null,
    });
  }, [offlineRequested, sourceId, type]);

  useEffect(() => {
    if (offlineRequested) {
      setExternalIdentity(null);
      return undefined;
    }
    let cancelled = false;
    const scope = new AbortController();
    const finish = (imdb: string | null) => { if (!cancelled) setExternalIdentity({ key: catalogIdentity, imdbId: imdb }); };
    const timer = setTimeout(() => { finish(null); cancelled = true; scope.abort(); }, 20_000);
    tmdbFetch<any>(`/${type}/${id}/external_ids`, { signal: scope.signal })
      .then((result) => finish(result?.imdb_id || null)).catch(() => finish(null))
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); scope.abort(); };
  }, [catalogIdentity, id, offlineRequested, type]);

  const activeStreamUrl = useMemo(() => {
    if (offlineRequested) return '';
    if (anime.phase === 'failed') return '';
    if (isManualAnimeProvider(sourceId)) return activeAnimeTest ? getAniLinkResumeDiagnosticUrl(sourceId, getSourceUrl(sourceId, type,
      { tmdbId: id, anilistId: activeAnimeTest.identity.anilistId }, resolvedSeason || 1, resolvedEpisode || 1,
      { ...getMobileEmbedResumeParams(sourceId, resumeTime, type, forceStartFromBeginning),
        [getRegisteredSource(sourceId)!.animeProvider!.variantParam]: activeAnimeTest.variant })) : '';
    const resumeParams: Record<string, string | number> = {
      ...getMobileEmbedResumeParams(sourceId, resumeTime, type, forceStartFromBeginning),
    };
    // URL resume params are emitted only when the registered source contract
    // exposes one. Sources that cannot receive continuity are given resumeTime=0.
    traceMobilePlayback?.('url-build', { sourceId, attemptId: handoffRef.current?.id, routeIdentity: playbackIdentity });
    return getSourceUrl(
      sourceId,
      type,
      { tmdbId: id, imdbId: imdbId || undefined },
      resolvedSeason || 1,
      resolvedEpisode || 1,
      resumeParams,
    );
  }, [activeAnimeTest, anime.phase, forceStartFromBeginning, id, imdbId, offlineRequested, resolvedEpisode, resolvedSeason, resumeTime, sourceId, type]);

  const launchHandoff = useCallback(({
    targetSourceId,
    requestedTime,
    reason,
    fromSourceId,
    fromSessionId,
    attemptedSourceIds = [],
  }: {
    targetSourceId: string;
    requestedTime: number | null;
    reason: PlaybackHandoffV1['reason'];
    fromSourceId: string;
    fromSessionId: string | null;
    attemptedSourceIds?: string[];
  }) => {
    setForceStartFromBeginning(false);
    if ((requestedTime || 0) > 0 && !mobileSourceCanReceiveContinuity(targetSourceId)) {
      // Truthful Mobile capability boundary: outgoing-only sources may report
      // verified progress, but Orion never fabricates an incoming seek for them.
      publishHandoff(null);
      setResumeTime(0);
      setSourceId(targetSourceId);
      return true;
    }
    // These sources already use Orion's verified/command seek in the surface.
    // Do not classify loading position as a missed URL target before that seek.
    const strategy = ['vidlink', 'cinesrc'].includes(targetSourceId) ? 'verified-seek' : sourceResumeStrategy(targetSourceId);
    const next = createPlaybackHandoff({
      reason,
      fromSessionId,
      fromSourceId,
      targetSourceId,
      requestedTime,
      strategy,
      attemptedSourceIds,
    });
    if (!handoffCanCarryPosition(strategy, requestedTime)) {
      publishHandoff(reason === 'manual'
        ? updateHandoffStatus(next, 'unconfirmed', 'POSITION_UNAVAILABLE')
        : updateHandoffStatus(next, 'failed', 'POSITION_UNAVAILABLE'));
      if (reason !== 'automatic') {
        setResumeTime(0);
        setSourceId(targetSourceId);
        return true;
      }
      return false;
    }
    publishHandoff(updateHandoffStatus(next, 'preparing'));
    setResumeTime(requestedTime || 0);
    setSourceId(targetSourceId);
    return true;
  }, [publishHandoff]);

  const changeSource = useCallback((
    nextSourceId: string,
    snapshot: VerifiedPlaybackSnapshot | null,
    reason: 'manual' | 'automatic',
    requestedTimeOverride?: number | null,
  ) => {
    const selection = isManualAnimeProvider(nextSourceId) ? pendingAnimeSelection.current : null;
    if (reason === 'automatic' && isManualAnimeProvider(sourceId)) return false;
    if ((reason === 'manual' && nextSourceId === sourceId && !selection) || handoffIsPending(handoffRef.current)) return false;
    if (reason === 'manual') {
      if (selection) {
        if (!anime.activate(selection)) return false;
        pendingAnimeSelection.current = null;
        setAnimeAttempt((attempt) => attempt + 1);
      } else { pendingAnimeSelection.current = null; anime.manualGeneral(nextSourceId); }
    }
    const requestedTime = requestedTimeOverride !== undefined
      ? requestedTimeOverride
      : getFreshVerifiedPosition(snapshot);
    setForceStartFromBeginning(reason === 'manual' && requestedTimeOverride === 0);
    if (reason === 'automatic') {
      if (requestedTime == null) {
        reportMobileDiagnosticError({
          area: 'playback-handoff',
          code: 'NO_FRESH_POSITION',
          message: 'Automatic source failover was stopped because playback position was not verified.',
        });
        return false;
      }
      const target = getNextMobileContinuitySource(sourceId, type, []);
      if (!target) return false;
      return launchHandoff({
        targetSourceId: target,
        requestedTime,
        reason,
        fromSourceId: sourceId,
        fromSessionId: snapshot?.sessionId ?? null,
      });
    }
    if (requestedTime === 0 || (reason === 'manual' && requestedTime == null)) {
      publishHandoff(null);
      setResumeTime(0);
      setSourceId(nextSourceId);
      return true;
    }
    return launchHandoff({
      targetSourceId: nextSourceId,
      requestedTime,
      reason,
      fromSourceId: sourceId,
      fromSessionId: snapshot?.sessionId ?? null,
    });
  }, [anime.activate, anime.manualGeneral, launchHandoff, publishHandoff, sourceId, type]);

  const retryAutomaticHandoff = useCallback((expired: PlaybackHandoffV1) => {
    reportMobileDiagnosticError({ area: 'playback-handoff', code: expired.failureCode || 'CONTINUITY_UNCONFIRMED',
      message: 'Playback position could not be confirmed.' });
    const nextTarget = getNextMobileContinuitySource(
      expired.targetSourceId,
      type,
      [...expired.attemptedSourceIds, expired.fromSourceId],
    );
    if (!nextTarget) {
      setResumeTime(expired.requestedTime || 0);
      setSourceId(expired.fromSourceId);
      publishHandoff(updateHandoffStatus(expired, 'failed', 'NO_CONFIRMED_TARGET'));
      return;
    }
    launchHandoff({
      targetSourceId: nextTarget,
      requestedTime: expired.requestedTime,
      reason: 'automatic',
      fromSourceId: expired.fromSourceId,
      fromSessionId: expired.fromSessionId,
      attemptedSourceIds: expired.attemptedSourceIds,
    });
  }, [launchHandoff, publishHandoff, type]);

  const handlePlaybackSnapshot = useCallback((snapshot: VerifiedPlaybackSnapshot, attemptId?: string) => {
    if (currentIdentityRef.current !== playbackIdentity || episodeTransitionRef.current) return;
    const active = handoffRef.current;
    if (active && active.id !== attemptId) {
      traceMobilePlayback?.('settlement', { sourceId, attemptId, sessionId: snapshot.sessionId, reason: 'attempt-mismatch' });
      return;
    }
    anime.recordSuccess(snapshot.sourceId);
    if (!active || active.targetSourceId !== sourceId) return;
    const decision = evaluatePlaybackHandoff(active, snapshot);
    traceMobilePlayback?.('settlement', { sourceId, attemptId: active.id, sessionId: snapshot.sessionId,
      routeIdentity: playbackIdentity, state: snapshot.state, position: snapshot.currentTime, reason: decision.reason,
      target: active.requestedTime, boundSessionId: active.targetSessionId, targetAttemptId: snapshot.targetObservation?.attemptId,
      targetSessionId: snapshot.targetObservation?.sessionId, targetPosition: snapshot.targetObservation?.currentTime,
      targetObservedAt: snapshot.targetObservation?.observedAt, targetReachedAt: active.targetReachedAt,
      confirmedTime: active.confirmedTime, handoffState: active.status, verified: true,
      warningVisible: shouldPresentContinuityWarning(sourceId, active) && decision.handoff?.status !== 'confirmed' });
    const confirmed = decision.handoff;
    if (confirmed) {
      publishHandoff(confirmed);
      return;
    }
    if (!handoffTargetMissedPosition(active, snapshot)) return;
    const missed = { ...updateHandoffStatus(active, 'unconfirmed', 'POSITION_NOT_RESTORED'), targetSessionId: snapshot.sessionId };
    if (active.reason === 'automatic') retryAutomaticHandoff(missed);
    else publishHandoff(missed);
  }, [anime.recordSuccess, playbackIdentity, publishHandoff, retryAutomaticHandoff, sourceId]);

  const bindContinuitySession = useCallback((attemptId: string, providerId: string, sessionId: string) => {
    const active = handoffRef.current;
    if (currentIdentityRef.current !== playbackIdentity || episodeTransitionRef.current || !active
      || active.id !== attemptId || active.targetSourceId !== providerId || sourceId !== providerId) return;
    if (!active.targetSessionId) publishHandoff({ ...active, targetSessionId: sessionId });
    else if (active.targetSessionId !== sessionId) traceMobilePlayback?.('settlement', {
      sourceId, attemptId, sessionId, reason: 'session-mismatch' });
  }, [playbackIdentity, publishHandoff, sourceId]);

  useEffect(() => {
    if (!handoff || !handoffIsPending(handoff) || episodeTransition || waitingExternalIdentity
      || readyPlaybackIdentity !== playbackIdentity || anime.phase === 'checking'
      || initialChoicePending || !activeStreamUrl) return undefined;
    if (handoff.status === 'preparing') {
      const now = Date.now();
      publishHandoff({ ...handoff, status: 'loading', startedAt: now, updatedAt: now });
      return undefined;
    }
    const remaining = Math.max(0, handoff.startedAt + HANDOFF_CONFIRMATION_TIMEOUT_MS - Date.now());
    const timer = setTimeout(() => {
      const active = handoffRef.current;
      if (!active || active.id !== handoff.id || !handoffIsPending(active)) return;
      if (active.reason === 'automatic') {
        retryAutomaticHandoff(updateHandoffStatus(active, 'failed', 'TARGET_NOT_CONFIRMED'));
      }
      else publishHandoff(updateHandoffStatus(active, 'unconfirmed', 'TARGET_NOT_CONFIRMED'));
    }, remaining);
    return () => clearTimeout(timer);
  }, [activeStreamUrl, anime.phase, episodeTransition, handoff, initialChoicePending, playbackIdentity,
    publishHandoff, readyPlaybackIdentity, retryAutomaticHandoff, waitingExternalIdentity]);

  useEffect(() => {
    if (handoff?.status !== 'confirmed') return undefined;
    const timer = setTimeout(() => publishHandoff(null), 900);
    return () => clearTimeout(timer);
  }, [handoff, publishHandoff]);

  const handleResumeAttempt = useCallback((handoffId: string, status: 'applied' | 'unavailable') => {
    const active = handoffRef.current;
    if (!active || active.id !== handoffId || !handoffIsPending(active)) return;
    if (status === 'applied') {
      publishHandoff(updateHandoffStatus(active, 'seeking'));
    } else if (active.reason === 'automatic') {
      retryAutomaticHandoff(updateHandoffStatus(active, 'failed', 'SEEK_UNAVAILABLE'));
    } else {
      publishHandoff(updateHandoffStatus(active, 'unconfirmed', 'SEEK_UNAVAILABLE'));
    }
  }, [publishHandoff, retryAutomaticHandoff]);

  const chooseInitialPosition = useCallback((choice: ResumePlaybackChoice) => {
    const chosenTime = mobileSourceCanReceiveContinuity(sourceId)
      ? resolveResumeChoiceTime(choice, initialSavedTime)
      : 0;
    setResumeTime(chosenTime);
    setForceStartFromBeginning(choice === 'start-over');
    setInitialChoicePending(false);
    if (!offlineRequested && chosenTime > 0) launchHandoff({
      targetSourceId: sourceId, requestedTime: chosenTime, reason: 'return',
      fromSourceId: sourceId, fromSessionId: null,
    });
  }, [initialSavedTime, launchHandoff, offlineRequested, sourceId]);

  const handleVerifiedPlaybackCompletion = useCallback((_snapshot: VerifiedPlaybackSnapshot) => {
    if (currentIdentityRef.current !== playbackIdentity || episodeTransitionRef.current) return;
    if (type !== 'tv' || offlineRequested || downloadResolutionOnly
      || resolvedSeason == null || resolvedEpisode == null) return;
    const seasonNumber = resolvedSeason;
    const episodeNumber = resolvedEpisode;
    const completionKey = `tv:${id}:s${seasonNumber}:e${episodeNumber}`;
    if (completionHandledRef.current.has(completionKey)) return;
    completionHandledRef.current.add(completionKey);
    const requestId = ++nextEpisodeRequestRef.current;
    tmdbFetch<any>(`/tv/${id}/season/${seasonNumber}`)
      .then((seasonData) => {
        if (requestId !== nextEpisodeRequestRef.current) return;
        const next = getNextReleasedEpisode(
          seasonData?.episodes,
          seasonNumber,
          episodeNumber,
        );
        if (next) setNextEpisodePrompt(next);
      })
      .catch(() => {});
  }, [downloadResolutionOnly, id, offlineRequested, playbackIdentity, resolvedEpisode, resolvedSeason, type]);

  const playNextEpisode = useCallback(() => {
    const next = nextEpisodePrompt;
    if (!next) return;
    nextEpisodeRequestRef.current += 1;
    const targetIdentity = `tv:${id}:s${next.seasonNumber}:e${next.episodeNumber}`;
    episodeTransitionRef.current = targetIdentity;
    setEpisodeTransition(targetIdentity);
    setNextEpisodePrompt(null);
    publishHandoff(null);
    router.replace({
      pathname: '/player/[id]',
      params: {
        id,
        type: 'tv',
        title: next.name,
        year,
        seriesTitle: seriesTitle || title,
        season: String(next.seasonNumber),
        episode: String(next.episodeNumber),
        episodeTitle: next.name,
        posterPath: posterPath || undefined,
        backdropPath: next.stillPath || backdropPath || undefined,
        nextSourceId: sourceId,
        nextAnimeVariant: isManualAnimeProvider(sourceId) ? activeAnimeTest?.variant : undefined,
      },
    });
  }, [
    backdropPath,
    activeAnimeTest?.variant,
    id,
    nextEpisodePrompt,
    posterPath,
    publishHandoff,
    router,
    seriesTitle,
    sourceId,
    title,
    year,
  ]);

  const commonProps = {
    title,
    seriesTitle,
    year,
    posterPath,
    backdropPath,
    episodeTitle,
    sourceId,
    onSourceChange: changeSource,
    canAutomaticFailover: (snapshot: VerifiedPlaybackSnapshot | null) => !isManualAnimeProvider(sourceId)
      && !getMobileDownloadSourceResolutionIntentV1(downloadItemKey) && !handoffIsPending(handoffRef.current)
      && getFreshVerifiedPosition(snapshot) != null && getNextMobileContinuitySource(sourceId, type, []) != null,
    onAutomaticFailover: (snapshot: VerifiedPlaybackSnapshot | null) => isManualAnimeProvider(sourceId) || getMobileDownloadSourceResolutionIntentV1(downloadItemKey)
      ? false : changeSource(sourceId, snapshot, 'automatic'),
    onPlaybackSnapshot: (snapshot: VerifiedPlaybackSnapshot) => handlePlaybackSnapshot(snapshot, handoff?.id),
    onVerifiedPlaybackCompletion: handleVerifiedPlaybackCompletion,
    activeHandoffId: handoffIsPending(handoff) ? handoff?.id : null,
    continuityAttemptId: handoff?.id,
    onContinuitySession: bindContinuitySession,
    id,
    type,
    season: resolvedSeason == null ? undefined : String(resolvedSeason),
    episode: resolvedEpisode == null ? undefined : String(resolvedEpisode),
    initialResumeTime: resumeTime,
    forceStartFromBeginning,
    onExit: exitPlayer,
    isLandscape,
    onToggleOrientation: toggleOrientation,
  };

  const surface = episodeTransition || waitingExternalIdentity || readyPlaybackIdentity !== playbackIdentity || anime.phase === 'checking' ? (
    <PlayerStateOverlay state="preparing" onBack={exitPlayer} />
  ) : initialChoicePending ? null : offlineRequested ? (
    offlineAssetId && offlineSource ? (
      offlineSource.sourceKind === 'file' ? (
        <OrionFinalizedPlayerActivitySurface
          key={`orion-finalized-activity-${offlineAssetId}-${offlineResolutionAttempt}`}
          assetId={offlineAssetId}
          {...commonProps}
          sourceId="local"
        />
      ) : (
        <OrionOfflinePlayerSurface
          key={`orion-fragments-${offlineAssetId}-${offlineResolutionAttempt}`}
          assetId={offlineAssetId}
          {...commonProps}
          sourceId="local"
        />
      )
    ) : (
      <OfflinePlaybackPreparationSurface
        error={offlineError}
        onBack={exitPlayer}
        onRetry={offlineAssetId ? () => setOfflineResolutionAttempt((attempt) => attempt + 1) : undefined}
      />
    )
  ) : (
    <EmbedPlayerSurface
      key={`${sourceId}-${activeStreamUrl}${isManualAnimeProvider(sourceId) ? `-${animeAttempt}` : ''}`}
      embedUrl={activeStreamUrl}
      sourceError={anime.error}
      continuityError={handoff && ['failed', 'unconfirmed'].includes(handoff.status)
        ? 'Playback could not continue from the saved position. Retry or choose another source.' : undefined}
      showContinuityWarning={shouldPresentContinuityWarning(sourceId, handoff)}
      onContinuityRetry={() => launchHandoff({ targetSourceId: sourceId, requestedTime: handoff?.requestedTime ?? resumeTime,
        reason: 'return', fromSourceId: sourceId, fromSessionId: null })}
      animeAvailable={Boolean(anime.detail)}
      animeVariant={isManualAnimeProvider(sourceId) ? activeAnimeTest?.variant : undefined}
      onExperimentalRetry={() => { if (anime.error) anime.retry(); else setAnimeAttempt((attempt) => attempt + 1); }}
      sourceExtras={(select) => !downloadResolutionOnly && !handoffIsPending(handoff) && anime.detail && <AnimeSourceChoices
        currentSourceId={sourceId} variant={activeAnimeTest?.variant} prepare={anime.prepare}
        onSelect={(selection) => { pendingAnimeSelection.current = selection; select(selection.providerId || 'aniembed', true); }} />}
      playbackPurpose={downloadResolutionOnly ? 'download-resolution' : 'viewing'}
      onResumeAttempt={handleResumeAttempt}
      {...commonProps}
    />
  );

  return (
    <MobilePlayerControllerProvider key={offlineRequested ? 'offline' : playbackIdentity}>
    <View style={{ flex: 1 }}>
      {surface}
      {initialChoicePending && !episodeTransition && anime.phase !== 'checking' && (
        <ResumePlaybackPrompt
          title={title || 'this title'}
          savedTime={initialSavedTime}
          continuityMode={getMobileSourceContinuityCapability(sourceId).mode}
          onChoose={chooseInitialPosition}
          onCancel={exitPlayer}
        />
      )}
      {nextEpisodePrompt && !initialChoicePending && !downloadResolutionOnly && (
        <NextEpisodePrompt
          episode={nextEpisodePrompt}
          onPlayNow={playNextEpisode}
          onCancel={() => setNextEpisodePrompt(null)}
        />
      )}
    </View>
    </MobilePlayerControllerProvider>
  );
}
