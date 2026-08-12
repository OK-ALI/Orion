import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ALL_CINEMA_SOURCES } from '@orion/shared/sources';
import { PlayerHUD } from '../../components/player/PlayerHUD';
import { SourcesSheet } from '../../components/player/SourcesSheet';
import { WatchdogWarning } from '../../components/player/WatchdogWarning';
import { useLibrary } from '../../context/LibraryContext';
import { usePlaybackTelemetryController } from './usePlaybackTelemetryController';
import { playerStyles as styles } from './playerStyles';
import type { PlaybackSurfaceProps } from './playerTypes';
import { ResumePlaybackPrompt } from './ResumePlaybackPrompt';
import { resolveResumeChoiceTime, type ResumePlaybackChoice } from './resumeChoice';
import { getMobileSourceContinuityCapability } from './mobileSources';

interface NativePlayerSurfaceProps extends PlaybackSurfaceProps {
  streamUrl: string;
}

export function NativePlayerSurface({
  streamUrl,
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
}: NativePlayerSurfaceProps) {
  const router = useRouter();
  const { recordPlayback } = useLibrary();
  const [showSources, setShowSources] = useState(false);
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);
  const [pendingManualSource, setPendingManualSource] = useState<{
    id: string;
    label: string;
    savedTime: number;
  } | null>(null);
  const priorTimeRef = useRef(initialResumeTime);
  const resumeAfterPromptRef = useRef(false);
  const media = useMemo(() => ({
    id,
    mediaType: type,
    title: seriesTitle || title || 'Playing Video',
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
    const decision = telemetry.emitTelemetry({
      evidence: 'native-video-event',
      state: jumped ? 'seeking' : playingEvent.isPlaying ? 'playing' : 'paused',
      currentTime,
      duration: Number(player.duration) || null,
      bufferedPosition: Number(timeEvent.bufferedPosition) || null,
    });
    if (decision.accepted && decision.state.session.verified) {
      const snapshot = telemetry.getVerifiedSnapshot();
      if (snapshot) onPlaybackSnapshot?.(snapshot);
    }
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
    const snapshot = telemetry.getVerifiedSnapshot();
    const savedTime = Math.max(0, Number(snapshot?.currentTime) || 0);
    setShowSources(false);
    if (savedTime > 30) {
      resumeAfterPromptRef.current = player.playing;
      player.pause();
      const target = ALL_CINEMA_SOURCES.find((entry) => entry.id === nextSourceId);
      setPendingManualSource({
        id: nextSourceId,
        label: target?.label || nextSourceId,
        savedTime,
      });
      return;
    }
    onSourceChange(nextSourceId, snapshot, 'manual');
  };
  const completeManualSourceChoice = (choice: ResumePlaybackChoice) => {
    const pending = pendingManualSource;
    if (!pending) return;
    const snapshot = telemetry.getVerifiedSnapshot();
    const requestedTime = resolveResumeChoiceTime(choice, pending.savedTime);
    setPendingManualSource(null);
    onSourceChange(pending.id, snapshot, 'manual', requestedTime);
  };
  const handleFailover = () => {
    telemetry.flush();
    onAutomaticFailover(telemetry.getVerifiedSnapshot());
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
      {pendingManualSource && (
        <ResumePlaybackPrompt
          title={title || 'this title'}
          savedTime={pendingManualSource.savedTime}
          targetSourceLabel={pendingManualSource.label}
          continuityMode={getMobileSourceContinuityCapability(pendingManualSource.id).mode}
          onChoose={completeManualSourceChoice}
          onCancel={() => {
            setPendingManualSource(null);
            if (resumeAfterPromptRef.current) player.play();
            resumeAfterPromptRef.current = false;
          }}
        />
      )}
    </View>
  );
}
