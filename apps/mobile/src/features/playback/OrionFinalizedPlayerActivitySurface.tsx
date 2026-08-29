import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlayerStateOverlay } from '../../components/player/PlayerStateOverlay';
import { useLibraryPlaybackActions } from '../../context/LibraryContext';
import {
  launchNativeFinalizedPlayerV1,
  subscribeNativeFinalizedPlayerProgressV1,
  type NativeFinalizedPlayerProgressV1,
  type NativeFinalizedPlayerResultV1,
} from '../downloads/nativeDownloadEngine';
import { getPresentationPreference, savePresentationPreference } from './presentationPreferences';
import { usePlaybackTelemetryController } from './usePlaybackTelemetryController';
import type { PlaybackSurfaceProps, VerifiedPlaybackSnapshot } from './playerTypes';

export interface OrionFinalizedPlayerActivitySurfaceProps extends PlaybackSurfaceProps {
  assetId: string;
}

export function OrionFinalizedPlayerActivitySurface({
  assetId,
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
  onPlaybackSnapshot,
  onVerifiedPlaybackCompletion,
}: OrionFinalizedPlayerActivitySurfaceProps) {
  const router = useRouter();
  const { recordPlayback } = useLibraryPlaybackActions();
  const [launchAttempt, setLaunchAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const media = useMemo(() => ({
    id,
    mediaType: type,
    title: seriesTitle || title || 'Playing Video',
    year: Number(year) || null,
    season: Number(season) || null,
    episode: Number(episode) || null,
  } as const), [episode, id, season, seriesTitle, title, type, year]);
  const item = useMemo(() => ({
    id,
    title: media.title,
    name: type === 'tv' ? media.title : undefined,
    media_type: type,
    year,
    poster_path: posterPath || null,
    backdrop_path: backdropPath || null,
    series_title: seriesTitle || null,
    episode_title: episodeTitle || (type === 'tv' ? title : null),
  }), [backdropPath, episodeTitle, id, media.title, posterPath, seriesTitle, title, type, year]);
  const telemetry = usePlaybackTelemetryController({
    item,
    media,
    sourceId,
    surface: 'native',
    recordPlayback,
    onVerifiedCompletion: onVerifiedPlaybackCompletion,
  });

  const emitPlayerEvidence = useCallback((event: Pick<
    NativeFinalizedPlayerProgressV1,
    'state' | 'currentTime' | 'duration' | 'presentation'
  >) => {
    savePresentationPreference('native', sourceId, event.presentation);
    const state = event.state === 'preparing' ? 'buffering'
      : event.state === 'failed' ? 'error'
        : event.state;
    const decision = telemetry.emitTelemetry({
      evidence: 'native-video-event',
      state,
      currentTime: event.currentTime,
      duration: event.duration,
      bufferedPosition: event.currentTime,
    });
    if (decision.accepted && decision.state.session.verified) {
      const snapshot = telemetry.getVerifiedSnapshot();
      if (snapshot) onPlaybackSnapshot?.(snapshot);
    }
  }, [onPlaybackSnapshot, sourceId, telemetry.emitTelemetry, telemetry.getVerifiedSnapshot]);

  useEffect(() => {
    let disposed = false;
    setError(null);
    const unsubscribe = subscribeNativeFinalizedPlayerProgressV1((event) => {
      if (disposed || event.assetId !== assetId) return;
      emitPlayerEvidence(event);
    });
    const savedPresentation = getPresentationPreference('native', sourceId);
    const presentation = savedPresentation === 'fill' || savedPresentation === 'stretch'
      ? savedPresentation
      : 'fit';

    launchNativeFinalizedPlayerV1({
      assetId,
      initialPositionSeconds: Math.max(0, Number(initialResumeTime) || 0),
      title: episodeTitle || title || seriesTitle || 'Orion Player',
      presentation,
    })
      .then((result: NativeFinalizedPlayerResultV1) => {
        if (disposed) return;
        savePresentationPreference('native', sourceId, result.presentation);
        if (!result.ok) {
          const message = result.message?.trim()
            || `Orion could not play this verified download${result.code ? ` (${result.code})` : ''}.`;
          setError(message);
          return;
        }
        emitPlayerEvidence({
          state: result.completed ? 'ended' : 'paused',
          currentTime: result.currentTime,
          duration: result.duration,
          presentation: result.presentation,
        });
        telemetry.flush();
        router.back();
      })
      .catch((launchError: unknown) => {
        if (disposed) return;
        const message = launchError instanceof Error && launchError.message.trim()
          ? launchError.message
          : 'Orion could not launch its native player.';
        setError(message);
      });

    return () => {
      disposed = true;
      unsubscribe();
      telemetry.flush();
    };
  }, [
    assetId,
    emitPlayerEvidence,
    episodeTitle,
    initialResumeTime,
    launchAttempt,
    router,
    seriesTitle,
    sourceId,
    telemetry.flush,
    title,
  ]);

  return (
    <View accessibilityLabel={error ? 'Orion Player needs attention' : 'Opening Orion Player'} style={{ flex: 1, backgroundColor: '#000' }}>
      <PlayerStateOverlay
        state={error ? 'failed' : 'preparing'}
        detail={error || 'Opening the verified download in Orion Player.'}
        onBack={error ? () => router.back() : undefined}
        onRetry={error ? () => setLaunchAttempt((attempt) => attempt + 1) : undefined}
      />
    </View>
  );
}
