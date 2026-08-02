import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  DEFAULT_CINEMA_SOURCE_ID,
  getSourceResumeParams,
  getSourceUrl,
  sourceResumeStrategy,
} from '@orion/shared/sources';
import type { PlaybackHandoffV1 } from '@orion/shared/types';
import { tmdbFetch } from '@orion/shared/api';
import { useLibrary } from '../../context/LibraryContext';
import {
  getMobileSourceHealth,
  hydrateMobileSourceHealth,
  markMobileSourceFailure,
} from '../../services/sourceHealth';
import { reportMobileDiagnosticError, updateMobileDiagnostics } from '../../services/mobileDiagnostics';
import { EmbedPlayerSurface } from './EmbedPlayerSurface';
import { NativePlayerSurface } from './NativePlayerSurface';
import { HandoffNotice } from './HandoffNotice';
import {
  HANDOFF_CONFIRMATION_TIMEOUT_MS,
  confirmPlaybackHandoff,
  createPlaybackHandoff,
  getFreshVerifiedPosition,
  handoffCanCarryPosition,
  handoffIsPending,
  updateHandoffStatus,
} from './handoffPolicy';
import { getNextMobileContinuitySource } from './mobileSources';
import type { VerifiedPlaybackSnapshot } from './playerTypes';

type PlayerRouteParams = {
  id: string;
  type: 'movie' | 'tv';
  title: string;
  season?: string;
  episode?: string;
  offlineUri?: string;
  isOffline?: string;
};

export default function PlayerScreen() {
  const { id, type, title, season, episode, offlineUri, isOffline } =
    useLocalSearchParams<PlayerRouteParams>();
  const { getPlaybackProgress } = useLibrary();
  const [sourceId, setSourceId] = useState(DEFAULT_CINEMA_SOURCE_ID);
  const [imdbId, setImdbId] = useState<string | null>(null);
  const [handoff, setHandoffState] = useState<PlaybackHandoffV1 | null>(null);
  const handoffRef = useRef<PlaybackHandoffV1 | null>(null);
  const existingProgress = getPlaybackProgress(type, id, Number(season) || null, Number(episode) || null);
  const [resumeTime, setResumeTime] = useState(() => (
    existingProgress?.completed ? 0 : Math.max(0, Number(existingProgress?.currentTime) || 0)
  ));

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

  useEffect(() => { hydrateMobileSourceHealth(); }, []);
  useEffect(() => {
    const health = getMobileSourceHealth(sourceId, type);
    updateMobileDiagnostics({
      activeSourceId: isOffline === 'true' ? 'local' : sourceId,
      sourceHealth: isOffline === 'true' ? 'ready' : (health?.state ?? 'unknown'),
      playbackState: 'loading',
      playbackSurface: isOffline === 'true' ? 'native' : 'embed',
      playbackEvidence: null,
      lastTelemetryAt: null,
    });
  }, [isOffline, sourceId, type]);

  useEffect(() => {
    let cancelled = false;
    tmdbFetch<any>(`/${type}/${id}/external_ids`)
      .then((result) => { if (!cancelled) setImdbId(result?.imdb_id || null); })
      .catch(() => { if (!cancelled) setImdbId(null); });
    return () => { cancelled = true; };
  }, [id, type]);

  const activeStreamUrl = useMemo(() => {
    if (isOffline === 'true' && offlineUri) return offlineUri;
    return getSourceUrl(
      sourceId,
      type,
      { tmdbId: id, imdbId: imdbId || undefined },
      Number(season) || 1,
      Number(episode) || 1,
      getSourceResumeParams(sourceId, resumeTime),
    );
  }, [episode, id, imdbId, isOffline, offlineUri, resumeTime, season, sourceId, type]);

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
      }
      return;
    }
    publishHandoff(next);
    setResumeTime(requestedTime || 0);
    setSourceId(targetSourceId);
  }, [publishHandoff]);

  const changeSource = useCallback((
    nextSourceId: string,
    snapshot: VerifiedPlaybackSnapshot | null,
    reason: 'manual' | 'automatic',
  ) => {
    if ((reason === 'manual' && nextSourceId === sourceId) || handoffIsPending(handoffRef.current)) return;
    const requestedTime = getFreshVerifiedPosition(snapshot);
    if (reason === 'automatic') {
      if (requestedTime == null) {
        reportMobileDiagnosticError({
          area: 'playback-handoff',
          code: 'NO_FRESH_POSITION',
          message: 'Automatic source failover was stopped because playback position was not verified.',
        });
        return;
      }
      const target = getNextMobileContinuitySource(sourceId, type, []);
      if (!target) return;
      launchHandoff({
        targetSourceId: target,
        requestedTime,
        reason,
        fromSourceId: sourceId,
        fromSessionId: snapshot?.sessionId ?? null,
      });
      return;
    }
    launchHandoff({
      targetSourceId: nextSourceId,
      requestedTime,
      reason,
      fromSourceId: sourceId,
      fromSessionId: snapshot?.sessionId ?? null,
    });
  }, [launchHandoff, sourceId, type]);

  const handlePlaybackSnapshot = useCallback((snapshot: VerifiedPlaybackSnapshot) => {
    const active = handoffRef.current;
    if (!active || active.targetSourceId !== sourceId) return;
    const confirmed = confirmPlaybackHandoff(active, snapshot);
    if (!confirmed) return;
    publishHandoff(confirmed);
  }, [publishHandoff, sourceId]);

  const retryAutomaticHandoff = useCallback((expired: PlaybackHandoffV1) => {
    markMobileSourceFailure(
      expired.targetSourceId,
      type,
      expired.failureCode || 'CONTINUITY_UNCONFIRMED',
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

  const returnToPreviousSource = useCallback(() => {
    const active = handoffRef.current;
    if (!active || active.fromSourceId === sourceId) {
      publishHandoff(null);
      return;
    }
    launchHandoff({
      targetSourceId: active.fromSourceId,
      requestedTime: active.requestedTime,
      reason: 'return',
      fromSourceId: sourceId,
      fromSessionId: null,
      attemptedSourceIds: active.attemptedSourceIds,
    });
  }, [launchHandoff, publishHandoff, sourceId]);

  const commonProps = {
    title,
    sourceId,
    onSourceChange: changeSource,
    onAutomaticFailover: (snapshot: VerifiedPlaybackSnapshot | null) => changeSource(sourceId, snapshot, 'automatic'),
    onPlaybackSnapshot: handlePlaybackSnapshot,
    activeHandoffId: handoffIsPending(handoff) ? handoff?.id : null,
    id,
    type,
    season,
    episode,
    initialResumeTime: resumeTime,
  };

  const surface = isOffline === 'true' && offlineUri ? (
    <NativePlayerSurface key={`local-${offlineUri}`} streamUrl={offlineUri} {...commonProps} sourceId="local" />
  ) : (
    <EmbedPlayerSurface
      key={`${sourceId}-${activeStreamUrl}`}
      embedUrl={activeStreamUrl}
      onResumeAttempt={handleResumeAttempt}
      {...commonProps}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      {surface}
      {handoff && handoff.status !== 'confirmed' && handoff.fromSourceId !== handoff.targetSourceId && (
        <HandoffNotice
          handoff={handoff}
          onContinue={() => publishHandoff(null)}
          onReturn={returnToPreviousSource}
          recoveredPrevious={handoff.reason === 'automatic' && sourceId === handoff.fromSourceId}
        />
      )}
    </View>
  );
}
