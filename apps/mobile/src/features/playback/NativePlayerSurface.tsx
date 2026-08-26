import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView, type SubtitleTrack, type VideoSource } from 'expo-video';
import { ALL_CINEMA_SOURCES } from '@orion/shared/sources';
import { PlayerHUD } from '../../components/player/PlayerHUD';
import { SourcesSheet } from '../../components/player/SourcesSheet';
import { PresentationSheet } from '../../components/player/PresentationSheet';
import { OfflineSubtitleSheet, offlineSubtitleTrackKey } from './OfflineSubtitleSheet';
import { PlayerStateOverlay } from '../../components/player/PlayerStateOverlay';
import { WatchdogWarning } from '../../components/player/WatchdogWarning';
import { useLibraryPlaybackActions } from '../../context/LibraryContext';
import { usePlaybackTelemetryController } from './usePlaybackTelemetryController';
import { playerStyles as styles } from './playerStyles';
import type { PlaybackSurfaceProps } from './playerTypes';
import { ResumePlaybackPrompt } from './ResumePlaybackPrompt';
import { resolveResumeChoiceTime, type ResumePlaybackChoice } from './resumeChoice';
import { getMobileSourceContinuityCapability } from './mobileSources';
import { useMobilePlayerController } from './MobilePlayerController';
import { getPresentationPreference, savePresentationPreference } from './presentationPreferences';
import { usePlayerImmersiveSystemUi } from './immersiveSystemUi';
import type { MobilePlayerPresentation, MobilePlayerSurfaceAdapter } from '@orion/shared/types';

interface NativePlayerSurfaceProps extends PlaybackSurfaceProps {
  streamUrl: string;
  streamContentType?: 'hls';
}

export function NativePlayerSurface({
  streamUrl,
  streamContentType,
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
  onVerifiedPlaybackCompletion,
}: NativePlayerSurfaceProps) {
  const router = useRouter();
  const { recordPlayback } = useLibraryPlaybackActions();
  const controller = useMobilePlayerController();
  const [watchdogDismissed, setWatchdogDismissed] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitleKey, setSelectedSubtitleKey] = useState<string | null>(null);
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
    onVerifiedCompletion: onVerifiedPlaybackCompletion,
  });
  const videoSource = useMemo<VideoSource>(
    () => streamContentType ? { uri: streamUrl, contentType: streamContentType } : streamUrl,
    [streamContentType, streamUrl],
  );

  const player = useVideoPlayer(videoSource, (instance) => {
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
  const presentation = controller.state.presentation;
  const contentFit = presentation === 'fill' ? 'cover' : presentation === 'stretch' ? 'fill' : 'contain';
  const controlsVisible = controller.state.hudState !== 'hidden';
  usePlayerImmersiveSystemUi(true, playingEvent.isPlaying, !controlsVisible);

  useEffect(() => {
    const next = (player.availableSubtitleTracks || []).slice(0, 8);
    const signature = next.map((track) => offlineSubtitleTrackKey(track) || '').join('||');
    setSubtitleTracks((current) => {
      const currentSignature = current.map((track) => offlineSubtitleTrackKey(track) || '').join('||');
      return currentSignature === signature ? current : [...next];
    });
    setSelectedSubtitleKey(offlineSubtitleTrackKey(player.subtitleTrack));
  }, [player, statusEvent.status, timeEvent.currentTime, streamUrl]);

  useEffect(() => {
    if (controller.state.overlay === 'subtitles' && subtitleTracks.length === 0) controller.closeOverlay();
  }, [controller.closeOverlay, controller.state.overlay, subtitleTracks.length]);

  useEffect(() => {
    const adapter: MobilePlayerSurfaceAdapter = {
      surface: 'native',
      sessionId: telemetry.getSession().id,
      getSnapshot: () => ({
        state: player.status === 'loading' ? 'buffering' : player.status === 'error' ? 'error' : player.playing ? 'playing' : 'paused',
        playing: Boolean(player.playing),
        currentTime: Number.isFinite(Number(player.currentTime)) ? Number(player.currentTime) : null,
        duration: Number(player.duration) > 0 ? Number(player.duration) : null,
        bufferedPosition: Number.isFinite(Number(player.bufferedPosition)) ? Number(player.bufferedPosition) : null,
        observable: true,
      }),
      play: () => player.play(),
      pause: () => player.pause(),
      seek: (seconds) => { player.currentTime = Math.max(0, seconds); },
      seekBy: (seconds) => player.seekBy(seconds),
      setPresentation: () => true,
    };
    return controller.registerSurface(adapter, {
      canPlay: true,
      canPause: true,
      canSeek: true,
      canSourceSwitch: true,
      canSubtitles: subtitleTracks.length > 0,
      canShield: false,
      canFullscreen: true,
      canPresentation: true,
    }, getPresentationPreference('native', sourceId));
  }, [player, sourceId, subtitleTracks.length]);

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
    controller.updatePlayback({
      state: jumped ? 'seeking' : playingEvent.isPlaying ? 'playing' : 'paused',
      playing: playingEvent.isPlaying,
      currentTime,
      duration: Number(player.duration) > 0 ? Number(player.duration) : null,
      bufferedPosition: Number(timeEvent.bufferedPosition) || null,
      observable: true,
    }, telemetry.getSession().id);
  }, [timeEvent.currentTime, timeEvent.bufferedPosition, playingEvent.isPlaying, player.duration]);

  useEffect(() => {
    if (statusEvent.status === 'loading') {
      controller.setLoading('buffering');
      telemetry.emitTelemetry({ evidence: 'native-video-event', state: 'buffering' });
    } else if (statusEvent.status === 'error') {
      controller.setLoading('failed');
      telemetry.emitTelemetry({ evidence: 'native-video-event', state: 'error' });
    } else {
      controller.setLoading(null);
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
    controller.closeOverlay();
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

  const selectSubtitleTrack = (track: SubtitleTrack | null) => {
    player.subtitleTrack = track;
    setSelectedSubtitleKey(offlineSubtitleTrackKey(track));
    controller.closeOverlay();
  };

  return (
    <View style={styles.container}>
      <VideoView player={player} style={styles.video} contentFit={contentFit} nativeControls={false} />
      <PlayerStateOverlay
        state={controller.state.loadingState}
        onRetry={() => player.play()}
        onSwitchSource={() => controller.openOverlay('sources')}
      />
      <PlayerHUD
        player={player}
        title={title || 'Playing Video'}
        onBack={() => router.back()}
        controlsVisible={controlsVisible}
        onReveal={controller.reveal}
        onDismiss={controller.dismiss}
        onToggle={controller.toggleChromeFromUserTap}
        onOpenSources={() => controller.openOverlay('sources')}
        onOpenSubtitles={subtitleTracks.length > 0 ? () => controller.openOverlay('subtitles') : undefined}
        onOpenPresentation={() => controller.openOverlay('presentation')}
      />
      {controller.state.overlay === 'sources' && (
        <SourcesSheet
          currentSourceId={sourceId}
          onSelect={selectSource}
          mediaType={type}
          section="sources"
          onClose={controller.closeOverlay}
        />
      )}
      <OfflineSubtitleSheet
        visible={controller.state.overlay === 'subtitles'}
        tracks={subtitleTracks}
        selectedKey={selectedSubtitleKey}
        onSelect={selectSubtitleTrack}
        onClose={controller.closeOverlay}
      />
      <PresentationSheet
        visible={controller.state.overlay === 'presentation'}
        value={presentation}
        capability={{ supported: ['fit', 'fill', 'stretch', 'provider'] }}
        onChange={(mode: MobilePlayerPresentation) => {
          savePresentationPreference('native', sourceId, mode);
          controller.setPresentation(mode);
        }}
        onClose={controller.closeOverlay}
      />
      {!watchdogDismissed && (
        <WatchdogWarning
          isBuffering={statusEvent.status === 'loading'}
          onFailover={handleFailover}
          onSelectSource={() => controller.openOverlay('sources')}
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
