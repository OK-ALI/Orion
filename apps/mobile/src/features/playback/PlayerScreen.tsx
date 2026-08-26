import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  DEFAULT_CINEMA_SOURCE_ID,
  getSourceResumeParams,
  getSourceUrl,
  sourceResumeStrategy,
} from '@orion/shared/sources';
import type { PlaybackHandoffV1 } from '@orion/shared/types';
import { tmdbFetch } from '@orion/shared/api';
import { useLibraryPlaybackActions } from '../../context/LibraryContext';
import {
  getMobileSourceHealth,
  hydrateMobileSourceHealth,
  markMobileSourceFailure,
} from '../../services/sourceHealth';
import { reportMobileDiagnosticError, updateMobileDiagnostics } from '../../services/mobileDiagnostics';
import { EmbedPlayerSurface } from './EmbedPlayerSurface';
import { NativePlayerSurface } from './NativePlayerSurface';
import { ResumePlaybackPrompt } from './ResumePlaybackPrompt';
import {
  resolveResumeChoiceTime,
  type ResumePlaybackChoice,
} from './resumeChoice';
import {
  HANDOFF_CONFIRMATION_TIMEOUT_MS,
  confirmPlaybackHandoff,
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
  getNextMobileContinuitySource,
  getPreferredMobileResumeSource,
  mobileSourceCanReceiveContinuity,
} from './mobileSources';
import { classifyCinemaSourceFailure } from './sourceFailure';
import type { VerifiedPlaybackSnapshot } from './playerTypes';
import { MobilePlayerControllerProvider } from './MobilePlayerController';
import { NextEpisodePrompt } from './NextEpisodePrompt';
import {
  getNextReleasedEpisode,
  type NextEpisodeCandidate,
} from './playbackCompletion';
import { resolvePlaybackRouteIdentity } from './routePlaybackIdentity';
import { resolveNativeOfflinePlaybackV1, type NativeOfflinePlaybackSourceV1 } from '../downloads/nativeDownloadEngine';

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
  offlineUri?: string;
  offlineAssetId?: string;
  isOffline?: string;
  nextSourceId?: string;
};

export default function PlayerScreen() {
  const router = useRouter();
  const {
    id, type, title, season, episode, year, seriesTitle,
    posterPath, backdropPath, episodeTitle, offlineUri, offlineAssetId, isOffline, nextSourceId,
  } =
    useLocalSearchParams<PlayerRouteParams>();
  const { getPlaybackProgress } = useLibraryPlaybackActions();
  const offlineRequested = isOffline === 'true';
  const [offlineSource, setOfflineSource] = useState<NativeOfflinePlaybackSourceV1 | null>(null);
  const [offlineResolveError, setOfflineResolveError] = useState<string | null>(null);
  const [offlineResolveAttempt, setOfflineResolveAttempt] = useState(0);
  const routePlaybackIdentity = resolvePlaybackRouteIdentity(type, season, episode);
  const resolvedSeason = routePlaybackIdentity.season;
  const resolvedEpisode = routePlaybackIdentity.episode;
  const existingProgress = getPlaybackProgress(type, id, resolvedSeason, resolvedEpisode);
  const routedNextSource = nextSourceId
    && MOBILE_PLAYER_SOURCES.some((source) => source.id === nextSourceId)
    ? nextSourceId
    : null;
  const [sourceId, setSourceId] = useState(() => routedNextSource || getPreferredMobileResumeSource(
    existingProgress?.sourceId || DEFAULT_CINEMA_SOURCE_ID,
    type,
  ));
  const [imdbId, setImdbId] = useState<string | null>(null);
  const [handoff, setHandoffState] = useState<PlaybackHandoffV1 | null>(null);
  const handoffRef = useRef<PlaybackHandoffV1 | null>(null);
  const initialSavedTime = existingProgress?.completed
    ? 0
    : Math.max(0, Number(existingProgress?.currentTime) || 0);
  const [initialChoicePending, setInitialChoicePending] = useState(initialSavedTime > 30);
  const [resumeTime, setResumeTime] = useState(initialSavedTime > 30 ? 0 : initialSavedTime);
  const [nextEpisodePrompt, setNextEpisodePrompt] = useState<NextEpisodeCandidate | null>(null);
  const completionHandledRef = useRef(new Set<string>());
  const nextEpisodeRequestRef = useRef(0);
  const playbackIdentity = `${type}:${id}:s${resolvedSeason || 0}:e${resolvedEpisode || 0}`;
  const playbackIdentityRef = useRef(playbackIdentity);

  const publishHandoff = useCallback((next: PlaybackHandoffV1 | null) => {
    handoffRef.current = next;
    setHandoffState(next);
    updateMobileDiagnostics({
      handoffState: next?.status ?? null,
      handoffStrategy: next?.strategy ?? null,
      handoffRequestedTime: next?.requestedTime ?? null,
      handoffConfirmedTime: next?.confirmedTime ?? null,
      handoffFailureCode: next?.failureCode ?? null,
    });
  }, []);

  useEffect(() => {
    if (playbackIdentityRef.current === playbackIdentity) return;
    playbackIdentityRef.current = playbackIdentity;
    nextEpisodeRequestRef.current += 1;
    setNextEpisodePrompt(null);
    publishHandoff(null);
    const routeProgress = getPlaybackProgress(
      type,
      id,
      resolvedSeason,
      resolvedEpisode,
    );
    const savedTime = routeProgress?.completed
      ? 0
      : Math.max(0, Number(routeProgress?.currentTime) || 0);
    setInitialChoicePending(savedTime > 30);
    setResumeTime(savedTime > 30 ? 0 : savedTime);
  }, [getPlaybackProgress, id, playbackIdentity, publishHandoff, resolvedEpisode, resolvedSeason, type]);

  useEffect(() => { hydrateMobileSourceHealth(); }, []);
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
    if (!offlineRequested) {
      setOfflineSource(null);
      setOfflineResolveError(null);
      return undefined;
    }
    if (!offlineAssetId) {
      setOfflineSource(null);
      setOfflineResolveError(offlineUri ? null : 'Offline download identity is missing.');
      return undefined;
    }
    let cancelled = false;
    setOfflineSource(null);
    setOfflineResolveError(null);
    resolveNativeOfflinePlaybackV1(offlineAssetId)
      .then((source) => {
        if (!cancelled) setOfflineSource(source);
      })
      .catch((error) => {
        if (cancelled) return;
        setOfflineResolveError(error instanceof Error ? error.message : 'Orion could not prepare this offline download for playback.');
      });
    return () => { cancelled = true; };
  }, [offlineAssetId, offlineRequested, offlineResolveAttempt, offlineUri]);

  useEffect(() => {
    if (offlineRequested) {
      setImdbId(null);
      return undefined;
    }
    let cancelled = false;
    tmdbFetch<any>(`/${type}/${id}/external_ids`)
      .then((result) => { if (!cancelled) setImdbId(result?.imdb_id || null); })
      .catch(() => { if (!cancelled) setImdbId(null); });
    return () => { cancelled = true; };
  }, [id, offlineRequested, type]);

  const resolvedOfflineUri = offlineSource?.uri || (offlineRequested && !offlineAssetId ? offlineUri : undefined);

  const activeStreamUrl = useMemo(() => {
    if (offlineRequested) return resolvedOfflineUri || '';
    const resumeParams: Record<string, string | number> = {
      ...getSourceResumeParams(sourceId, resumeTime),
    };
    // URL resume params are emitted only when the registered source contract
    // exposes one. Sources that cannot receive continuity are given resumeTime=0.
    return getSourceUrl(
      sourceId,
      type,
      { tmdbId: id, imdbId: imdbId || undefined },
      resolvedSeason || 1,
      resolvedEpisode || 1,
      resumeParams,
    );
  }, [id, imdbId, offlineRequested, resolvedEpisode, resolvedOfflineUri, resolvedSeason, resumeTime, sourceId, type]);

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
    if ((requestedTime || 0) > 0 && !mobileSourceCanReceiveContinuity(targetSourceId)) {
      // Truthful Mobile capability boundary: outgoing-only sources may report
      // verified progress, but Orion never fabricates an incoming seek for them.
      publishHandoff(null);
      setResumeTime(0);
      setSourceId(targetSourceId);
      return true;
    }
    const strategy = sourceResumeStrategy(targetSourceId);
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
    publishHandoff(next);
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
    if ((reason === 'manual' && nextSourceId === sourceId) || handoffIsPending(handoffRef.current)) return false;
    const requestedTime = requestedTimeOverride !== undefined
      ? requestedTimeOverride
      : getFreshVerifiedPosition(snapshot);
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
    if (requestedTime === 0) {
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
  }, [launchHandoff, publishHandoff, sourceId, type]);

  const retryAutomaticHandoff = useCallback((expired: PlaybackHandoffV1) => {
    markMobileSourceFailure(
      expired.targetSourceId,
      type,
      expired.failureCode || 'CONTINUITY_UNCONFIRMED',
      classifyCinemaSourceFailure(expired.failureCode || 'continuity unconfirmed'),
    );
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

  const handlePlaybackSnapshot = useCallback((snapshot: VerifiedPlaybackSnapshot) => {
    const active = handoffRef.current;
    if (!active || active.targetSourceId !== sourceId) return;
    const confirmed = confirmPlaybackHandoff(active, snapshot);
    if (confirmed) {
      publishHandoff(confirmed);
      return;
    }
    if (!handoffTargetMissedPosition(active, snapshot)) return;
    const missed = updateHandoffStatus(active, 'unconfirmed', 'POSITION_NOT_RESTORED');
    if (active.reason === 'automatic') retryAutomaticHandoff(missed);
    else publishHandoff(missed);
  }, [publishHandoff, retryAutomaticHandoff, sourceId]);

  useEffect(() => {
    if (!handoff || !handoffIsPending(handoff)) return undefined;
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
  }, [handoff, publishHandoff, retryAutomaticHandoff]);

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
    setInitialChoicePending(false);
  }, [initialSavedTime, sourceId]);

  const handleVerifiedPlaybackCompletion = useCallback((_snapshot: VerifiedPlaybackSnapshot) => {
    if (type !== 'tv' || offlineRequested
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
  }, [id, offlineRequested, resolvedEpisode, resolvedSeason, type]);

  const playNextEpisode = useCallback(() => {
    const next = nextEpisodePrompt;
    if (!next) return;
    nextEpisodeRequestRef.current += 1;
    setNextEpisodePrompt(null);
    publishHandoff(null);
    setResumeTime(0);
    setInitialChoicePending(false);
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
      },
    });
  }, [
    backdropPath,
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
    onAutomaticFailover: (snapshot: VerifiedPlaybackSnapshot | null) => changeSource(sourceId, snapshot, 'automatic'),
    onPlaybackSnapshot: handlePlaybackSnapshot,
    onVerifiedPlaybackCompletion: handleVerifiedPlaybackCompletion,
    activeHandoffId: handoffIsPending(handoff) ? handoff?.id : null,
    id,
    type,
    season: resolvedSeason == null ? undefined : String(resolvedSeason),
    episode: resolvedEpisode == null ? undefined : String(resolvedEpisode),
    initialResumeTime: resumeTime,
  };

  const surface = initialChoicePending ? null : offlineRequested ? (
    resolvedOfflineUri ? (
      <NativePlayerSurface
        key={`local-${offlineAssetId || resolvedOfflineUri}`}
        streamUrl={resolvedOfflineUri}
        streamContentType={offlineSource?.contentType}
        {...commonProps}
        sourceId="local"
      />
    ) : offlineResolveError ? (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' }}>Offline playback unavailable</Text>
        <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 }}>{offlineResolveError}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ minHeight: 42, paddingHorizontal: 18, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Back</Text>
          </Pressable>
          {offlineAssetId ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Retry offline playback" onPress={() => setOfflineResolveAttempt((value) => value + 1)} style={{ minHeight: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#000', fontWeight: '900' }}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    ) : (
      <View accessibilityLabel="Preparing offline playback" style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '700' }}>Preparing offline playback…</Text>
      </View>
    )
  ) : (
    <EmbedPlayerSurface
      key={`${sourceId}-${activeStreamUrl}`}
      embedUrl={activeStreamUrl}
      onResumeAttempt={handleResumeAttempt}
      {...commonProps}
    />
  );

  return (
    <MobilePlayerControllerProvider>
    <View style={{ flex: 1 }}>
      {surface}
      {initialChoicePending && (
        <ResumePlaybackPrompt
          title={title || 'this title'}
          savedTime={initialSavedTime}
          continuityMode={getMobileSourceContinuityCapability(sourceId).mode}
          onChoose={chooseInitialPosition}
          onCancel={() => router.back()}
        />
      )}
      {nextEpisodePrompt && !initialChoicePending && (
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
