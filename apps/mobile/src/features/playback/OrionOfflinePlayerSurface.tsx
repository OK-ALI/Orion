import { EventEmitter } from 'expo';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  AppState,
  findNodeHandle,
  requireNativeComponent,
  UIManager,
  View,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { SubtitleTrack } from 'expo-video';
import type { MobilePlayerPresentation, MobilePlayerSurfaceAdapter } from '@orion/shared/types';
import { PlayerHUD } from '../../components/player/PlayerHUD';
import { PlayerStateOverlay } from '../../components/player/PlayerStateOverlay';
import { PresentationSheet } from '../../components/player/PresentationSheet';
import { useLibraryPlaybackActions } from '../../context/LibraryContext';
import { OfflineSubtitleSheet, offlineSubtitleTrackKey } from './OfflineSubtitleSheet';
import { useMobilePlayerController } from './MobilePlayerController';
import { usePlaybackTelemetryController } from './usePlaybackTelemetryController';
import { usePlayerImmersiveSystemUi } from './immersiveSystemUi';
import { getPresentationPreference, savePresentationPreference } from './presentationPreferences';
import { playerStyles as styles } from './playerStyles';
import type { PlaybackSurfaceProps } from './playerTypes';

type OfflineNativeState = 'preparing' | 'buffering' | 'ready' | 'playing' | 'paused' | 'ended' | 'failed';

interface OfflinePlaybackEvent {
  state: OfflineNativeState;
  playing: boolean;
  positionSeconds: number;
  durationSeconds: number | null;
  bufferedPositionSeconds: number;
  code?: string | null;
  message?: string | null;
  stage?: string | null;
  failedFragmentIndex?: number | null;
  errorCategory?: string | null;
}

interface OfflineSubtitleEvent {
  tracks: Array<{
    id: string;
    language?: string;
    label?: string;
    selected?: boolean;
  }>;
}

interface NativeOfflinePlayerProps extends ViewProps {
  assetId: string;
  initialPositionSeconds: number;
  presentation: MobilePlayerPresentation;
  onPlaybackStateChange(event: NativeSyntheticEvent<OfflinePlaybackEvent>): void;
  onSubtitleTracksChange(event: NativeSyntheticEvent<OfflineSubtitleEvent>): void;
}

const NativeOfflinePlayer = requireNativeComponent<NativeOfflinePlayerProps>('OrionOfflinePlayerView');

type FacadeEvents = {
  statusChange(event: { status: 'loading' | 'readyToPlay' | 'error' }): void;
  playingChange(event: { isPlaying: boolean }): void;
  timeUpdate(event: {
    currentTime: number;
    bufferedPosition: number;
    currentLiveTimestamp: null;
    currentOffsetFromLive: null;
  }): void;
};

class OrionOfflinePlayerFacade extends EventEmitter<FacadeEvents> {
  status: 'loading' | 'readyToPlay' | 'error' = 'loading';
  playing = false;
  duration = 0;
  bufferedPosition = 0;
  timeUpdateEventInterval = 0.5;
  private position = 0;

  constructor(private readonly command: (name: string, args?: unknown[]) => void) {
    super();
  }

  get currentTime() { return this.position; }
  set currentTime(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    this.position = Math.max(0, seconds);
    this.command('seek', [this.position]);
  }

  play() { this.command('play'); }
  pause() { this.command('pause'); }
  seekBy(seconds: number) { this.currentTime = this.position + seconds; }
  retry() { this.command('retry'); }
  selectSubtitle(id: string | null) { this.command('selectSubtitle', [id]); }

  update(event: OfflinePlaybackEvent) {
    const nextStatus = event.state === 'failed'
      ? 'error'
      : event.state === 'preparing' || event.state === 'buffering'
        ? 'loading'
        : 'readyToPlay';
    const statusChanged = nextStatus !== this.status;
    const playingChanged = event.playing !== this.playing;
    this.status = nextStatus;
    this.playing = event.playing;
    this.position = Math.max(0, Number(event.positionSeconds) || 0);
    this.duration = Math.max(0, Number(event.durationSeconds) || 0);
    this.bufferedPosition = Math.max(0, Number(event.bufferedPositionSeconds) || 0);
    if (statusChanged) this.emit('statusChange', { status: this.status });
    if (playingChanged) this.emit('playingChange', { isPlaying: this.playing });
    this.emit('timeUpdate', {
      currentTime: this.position,
      bufferedPosition: this.bufferedPosition,
      currentLiveTimestamp: null,
      currentOffsetFromLive: null,
    });
  }
}

interface OrionOfflinePlayerSurfaceProps extends PlaybackSurfaceProps {
  assetId: string;
}

export function OrionOfflinePlayerSurface({
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
}: OrionOfflinePlayerSurfaceProps) {
  const router = useRouter();
  const { recordPlayback } = useLibraryPlaybackActions();
  const controller = useMobilePlayerController();
  const nativeRef = useRef<ComponentRef<typeof NativeOfflinePlayer>>(null);
  const [nativeState, setNativeState] = useState<OfflinePlaybackEvent>({
    state: 'preparing',
    playing: false,
    positionSeconds: 0,
    durationSeconds: null,
    bufferedPositionSeconds: 0,
  });
  const nativeStateRef = useRef(nativeState);
  nativeStateRef.current = nativeState;
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitleKey, setSelectedSubtitleKey] = useState<string | null>(null);
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

  const dispatch = useMemo(() => (name: string, args: unknown[] = []) => {
    const handle = findNodeHandle(nativeRef.current);
    const command = UIManager.getViewManagerConfig('OrionOfflinePlayerView')?.Commands?.[name];
    if (handle == null || command == null) return;
    UIManager.dispatchViewManagerCommand(handle, command, args);
  }, []);
  const facade = useMemo(() => new OrionOfflinePlayerFacade(dispatch), [dispatch]);
  const presentation = controller.state.presentation;
  const controlsVisible = controller.state.hudState !== 'hidden';
  usePlayerImmersiveSystemUi(true, nativeState.playing, !controlsVisible);

  useEffect(() => {
    const adapter: MobilePlayerSurfaceAdapter = {
      surface: 'native',
      sessionId: telemetry.getSession().id,
      getSnapshot: () => {
        const current = nativeStateRef.current;
        return {
          state: current.state === 'failed' ? 'error'
            : current.state === 'preparing' ? 'loading'
              : current.state === 'buffering' ? 'buffering'
                : current.playing ? 'playing' : 'paused',
          playing: current.playing,
          currentTime: current.positionSeconds,
          duration: current.durationSeconds,
          bufferedPosition: current.bufferedPositionSeconds,
          observable: true,
        };
      },
      play: () => facade.play(),
      pause: () => facade.pause(),
      seek: (seconds) => { facade.currentTime = seconds; },
      seekBy: (seconds) => facade.seekBy(seconds),
      setPresentation: () => true,
    };
    return controller.registerSurface(adapter, {
      canPlay: true,
      canPause: true,
      canSeek: true,
      canSourceSwitch: false,
      canSubtitles: subtitleTracks.length > 0,
      canShield: false,
      canFullscreen: true,
      canPresentation: true,
    }, getPresentationPreference('native', sourceId));
  }, [facade, sourceId, subtitleTracks.length]);

  const handlePlaybackState = (event: NativeSyntheticEvent<OfflinePlaybackEvent>) => {
    const next = event.nativeEvent;
    setNativeState(next);
    facade.update(next);
    controller.setLoading(next.state === 'failed' ? 'failed'
      : next.state === 'preparing' ? 'preparing'
        : next.state === 'buffering' ? 'buffering' : null);
    const telemetryState = next.state === 'failed' ? 'error'
      : next.state === 'ended' ? 'ended'
        : next.state === 'buffering' || next.state === 'preparing' ? 'buffering'
          : next.playing ? 'playing' : 'paused';
    const decision = telemetry.emitTelemetry({
      evidence: 'native-video-event',
      state: telemetryState,
      currentTime: next.positionSeconds,
      duration: next.durationSeconds,
      bufferedPosition: next.bufferedPositionSeconds,
    });
    controller.updatePlayback({
      state: next.state === 'failed' ? 'error'
        : next.state === 'preparing' ? 'loading'
          : next.state === 'buffering' ? 'buffering'
          : next.state === 'ended' ? 'ended'
            : next.playing ? 'playing' : 'paused',
      playing: next.playing,
      currentTime: next.positionSeconds,
      duration: next.durationSeconds,
      bufferedPosition: next.bufferedPositionSeconds,
      observable: true,
    }, telemetry.getSession().id);
    if (decision.accepted && decision.state.session.verified) {
      const snapshot = telemetry.getVerifiedSnapshot();
      if (snapshot) onPlaybackSnapshot?.(snapshot);
    }
  };

  const handleSubtitleTracks = (event: NativeSyntheticEvent<OfflineSubtitleEvent>) => {
    const tracks = event.nativeEvent.tracks.map((track) => ({
      id: track.id,
      language: track.language,
      label: track.label,
      name: track.label,
    })) as SubtitleTrack[];
    setSubtitleTracks(tracks);
    const selected = event.nativeEvent.tracks.find((track) => track.selected);
    setSelectedSubtitleKey(selected
      ? offlineSubtitleTrackKey({ id: selected.id, language: selected.language, label: selected.label } as SubtitleTrack)
      : null);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') telemetry.flush();
    });
    return () => {
      subscription.remove();
      telemetry.flush();
    };
  }, [telemetry.flush]);

  const selectSubtitle = (track: SubtitleTrack | null) => {
    facade.selectSubtitle(track?.id || null);
    setSelectedSubtitleKey(offlineSubtitleTrackKey(track));
    controller.closeOverlay();
  };

  return (
    <View style={styles.container}>
      <NativeOfflinePlayer
        ref={nativeRef}
        style={styles.video}
        assetId={assetId}
        initialPositionSeconds={initialResumeTime}
        presentation={presentation}
        onPlaybackStateChange={handlePlaybackState}
        onSubtitleTracksChange={handleSubtitleTracks}
      />
      <PlayerStateOverlay
        state={controller.state.loadingState}
        detail={nativeState.state === 'failed' ? nativeState.message || 'This offline download could not be played.' : undefined}
        onBack={nativeState.state === 'failed' ? () => router.back() : undefined}
        onRetry={nativeState.state === 'failed' ? () => facade.retry() : undefined}
      />
      <PlayerHUD
        player={facade}
        title={title || 'Playing Video'}
        onBack={() => router.back()}
        controlsVisible={controlsVisible}
        onReveal={controller.reveal}
        onDismiss={controller.dismiss}
        onToggle={controller.toggleChromeFromUserTap}
        onOpenSubtitles={subtitleTracks.length > 0 ? () => controller.openOverlay('subtitles') : undefined}
        onOpenPresentation={() => controller.openOverlay('presentation')}
      />
      <OfflineSubtitleSheet
        visible={controller.state.overlay === 'subtitles'}
        tracks={subtitleTracks}
        selectedKey={selectedSubtitleKey}
        onSelect={selectSubtitle}
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
    </View>
  );
}
