import { useCallback, useEffect, useRef } from 'react';
import type {
  MediaIdentity,
  MobilePlaybackEvidence,
  MobilePlaybackSessionV2,
  MobilePlaybackState,
  MobilePlaybackTelemetryV1,
  MobilePlayerSurface,
} from '@orion/shared/types';
import {
  clearMobileDiagnosticError,
  reportMobileDiagnosticError,
  updateMobileDiagnostics,
} from '../../services/mobileDiagnostics';
import { recordRecentOpen, removeRecentOpen } from './playbackRepository';
import {
  createPlaybackTelemetryState,
  reducePlaybackTelemetry,
  type PlaybackTelemetryState,
} from './telemetryReducer';

interface PlaybackRecordWriter {
  (record: {
    item: any;
    mediaType: 'movie' | 'tv';
    currentTime: number;
    duration: number;
    sourceId?: string | null;
    season?: number | null;
    episode?: number | null;
    evidence?: MobilePlaybackEvidence | null;
    sessionId?: string | null;
  }): void;
}

interface ControllerOptions {
  item: any;
  media: MediaIdentity;
  sourceId: string;
  surface: MobilePlayerSurface;
  recordPlayback: PlaybackRecordWriter;
}

export interface PlaybackTelemetryInput {
  evidence: MobilePlaybackEvidence;
  state: MobilePlaybackState;
  currentTime?: number | null;
  duration?: number | null;
  bufferedPosition?: number | null;
  observedAt?: number;
}

function createSessionId(media: MediaIdentity, sourceId: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${media.mediaType}-${media.id}-${sourceId}-${Date.now()}-${suffix}`;
}

export function createMobilePlaybackSession(
  media: MediaIdentity,
  sourceId: string,
  surface: MobilePlayerSurface,
  now = Date.now(),
): MobilePlaybackSessionV2 {
  return {
    schemaVersion: 2,
    id: createSessionId(media, sourceId),
    media,
    sourceId,
    surface,
    state: 'loading',
    verified: false,
    lastVerifiedTime: null,
    startedAt: now,
    updatedAt: now,
  };
}

export function usePlaybackTelemetryController({
  item,
  media,
  sourceId,
  surface,
  recordPlayback,
}: ControllerOptions) {
  const stateRef = useRef<PlaybackTelemetryState>(
    createPlaybackTelemetryState(createMobilePlaybackSession(media, sourceId, surface)),
  );
  const sequenceRef = useRef(0);
  const lastPersistedAtRef = useRef(0);

  const persistState = useCallback((state = stateRef.current) => {
    if (!state.session.verified || state.session.lastVerifiedTime == null) return false;
    recordPlayback({
      item,
      mediaType: media.mediaType,
      currentTime: state.session.lastVerifiedTime,
      duration: state.duration || 0,
      sourceId,
      season: media.season ?? null,
      episode: media.episode ?? null,
      evidence: state.evidence,
      sessionId: state.session.id,
    });
    lastPersistedAtRef.current = Date.now();
    return true;
  }, [item, media, recordPlayback, sourceId]);

  const emitTelemetry = useCallback((input: PlaybackTelemetryInput) => {
    const event: MobilePlaybackTelemetryV1 = {
      schemaVersion: 1,
      sessionId: stateRef.current.session.id,
      sourceId,
      sequence: ++sequenceRef.current,
      evidence: input.evidence,
      state: input.state,
      currentTime: input.currentTime ?? null,
      duration: input.duration ?? null,
      bufferedPosition: input.bufferedPosition ?? null,
      observedAt: input.observedAt || Date.now(),
    };
    const decision = reducePlaybackTelemetry(stateRef.current, event);
    if (!decision.accepted) {
      if (!['stale-sequence', 'stale-observation-time'].includes(decision.reason)) {
        reportMobileDiagnosticError({
          area: 'playback-telemetry',
          code: decision.reason.toUpperCase().replace(/-/g, '_'),
          message: `Playback telemetry rejected: ${decision.reason}`,
        });
      }
      return decision;
    }
    const wasVerified = stateRef.current.session.verified;
    stateRef.current = decision.state;
    updateMobileDiagnostics({
      playbackState: decision.state.session.state,
      playbackSurface: decision.state.session.surface,
      playbackEvidence: decision.state.evidence,
      lastTelemetryAt: event.observedAt,
    });
    if (!wasVerified && decision.state.session.verified) {
      removeRecentOpen(decision.state.session.id);
      clearMobileDiagnosticError('playback-telemetry');
    }
    const terminal = ['paused', 'seeking', 'ended', 'error'].includes(input.state);
    if (decision.shouldPersist
      && (terminal || Date.now() - lastPersistedAtRef.current >= 5_000)) {
      persistState(decision.state);
    }
    return decision;
  }, [persistState, sourceId]);

  const markOpenedOnly = useCallback(() => {
    if (stateRef.current.session.verified) return;
    emitTelemetry({ evidence: 'opened-only', state: 'unobservable' });
    recordRecentOpen({
      schemaVersion: 1,
      sessionId: stateRef.current.session.id,
      media,
      sourceId,
      surface,
      openedAt: Date.now(),
      reason: 'telemetry-unavailable',
    });
  }, [emitTelemetry, media, sourceId, surface]);

  const getVerifiedSnapshot = useCallback(() => {
    const state = stateRef.current;
    return state.session.verified && state.session.lastVerifiedTime != null
      ? {
          currentTime: state.session.lastVerifiedTime,
          duration: state.duration,
          evidence: state.evidence,
          observedAt: state.session.updatedAt,
        }
      : null;
  }, []);

  useEffect(() => () => {
    persistState();
  }, [persistState]);

  return {
    emitTelemetry,
    flush: persistState,
    getSession: () => stateRef.current.session,
    getVerifiedSnapshot,
    markOpenedOnly,
  };
}
