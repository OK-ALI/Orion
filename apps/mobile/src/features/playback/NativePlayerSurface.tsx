import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getNextHealthyNonAsyncSource } from '@orion/shared/sources';
import { PlayerHUD } from '../../components/player/PlayerHUD';
import { SourcesSheet } from '../../components/player/SourcesSheet';
import { WatchdogWarning } from '../../components/player/WatchdogWarning';
import { useLibrary } from '../../context/LibraryContext';
import { usePlaybackTelemetryController } from './usePlaybackTelemetryController';
import { playerStyles as styles } from './playerStyles';
import type { PlaybackSurfaceProps } from './playerTypes';

interface NativePlayerSurfaceProps extends PlaybackSurfaceProps {
  streamUrl: string;
}

export function NativePlayerSurface({
  streamUrl,
  title,
  sourceId,
  id,
  type,
  season,
  episode,
  initialResumeTime = 0,
  onSourceChange,
}: NativePlayerSurfaceProps) {
  const router = useRouter();
  const { recordPlayback } = useLibrary();
  const [showSources, setShowSources] = useState(false);
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);
  const priorTimeRef = useRef(initialResumeTime);
  const media = useMemo(() => ({
    id,
    mediaType: type,
    title: title || 'Playing Video',
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
    surface: 'native',
    recordPlayback,
  });

  const player = useVideoPlayer(streamUrl, (instance) => {
    instance.timeUpdateEventInterval = 1;
    if (initialResumeTime > 0) instance.currentTime = initialResumeTime;
    instance.play();
  });
  const statusEvent = useEvent(player, 'statusChange', { status: player.status });
  const playingEvent = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const timeEvent = useEvent(player, 'timeUpdate', {
    currentTime: Number(player.currentTime) || 0,
    bufferedPosition: Number(player.bufferedPosition) || 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });

  useEventListener(player, 'playToEnd', () => {
    telemetry.emitTelemetry({
      evidence: 'native-video-event',
      state: 'ended',
      currentTime: Number(player.duration) || Number(player.currentTime) || null,
      duration: Number(player.duration) || null,
      bufferedPosition: Number(player.bufferedPosition) || null,
    });
  });

  useEffect(() => {
    const currentTime = Number(timeEvent.currentTime) || 0;
    const jumped = Math.abs(currentTime - priorTimeRef.current) > 2;
    priorTimeRef.current = currentTime;
    telemetry.emitTelemetry({
      evidence: 'native-video-event',
      state: jumped ? 'seeking' : playingEvent.isPlaying ? 'playing' : 'paused',
      currentTime,
      duration: Number(player.duration) || null,
      bufferedPosition: Number(timeEvent.bufferedPosition) || null,
    });
  }, [timeEvent.currentTime, timeEvent.bufferedPosition, playingEvent.isPlaying, player.duration]);

  useEffect(() => {
    if (statusEvent.status === 'loading') {
      telemetry.emitTelemetry({ evidence: 'native-video-event', state: 'buffering' });
    } else if (statusEvent.status === 'error') {
      telemetry.emitTelemetry({ evidence: 'native-video-event', state: 'error' });
    }
  }, [statusEvent.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') telemetry.flush();
    });
    return () => {
      subscription.remove();
      telemetry.flush();
    };
  }, [telemetry.flush]);

  useEffect(() => setWatchdogDismissed(false), [sourceId]);

  const selectSource = (nextSourceId: string) => {
    telemetry.flush();
    onSourceChange(nextSourceId, telemetry.getVerifiedSnapshot());
  };
  const handleFailover = () => {
    const nextSource = getNextHealthyNonAsyncSource(sourceId, {
      mediaType: type,
      includeExperimental: true,
    });
    if (nextSource) selectSource(nextSource);
  };

  return (
    <View style={styles.container}>
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
      <PlayerHUD
        player={player}
        title={title || 'Playing Video'}
        onBack={() => router.back()}
        onOpenSources={() => setShowSources(true)}
      />
      {showSources && (
        <SourcesSheet
          currentSourceId={sourceId}
          onSelect={selectSource}
          mediaType={type}
          onClose={() => setShowSources(false)}
        />
      )}
      {!watchdogDismissed && (
        <WatchdogWarning
          isBuffering={statusEvent.status === 'loading'}
          onFailover={handleFailover}
          onSelectSource={() => setShowSources(true)}
          onDismiss={() => setWatchdogDismissed(true)}
        />
      )}
    </View>
  );
}
