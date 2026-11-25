import { useCallback, useSyncExternalStore } from 'react';
import type { MusicTrack } from '../../domain/music';
import { NativeTrackObserver, trackRowState } from './trackPresentation';
import { wavenConnectivity } from '../../infrastructure/connectivity/connectivityService';
import { warmWavenStreamingSource, youtubeMusicStreaming, youtubePlaybackIdentity } from '../../infrastructure/music/providers/youtubeMusicStreaming';
import { getLocalLibrary } from '../library/libraryRuntime';
import { getPersistedPlaybackRecoveryState, nativePlayback, replaceNativeQueue, resolveNativeQueueItem, subscribeNativePlayback } from './native/WavenPlaybackNative';
import { TrackPlaybackHandoff, type TrackPlaybackStatus } from './trackPlayback';

// Begin one non-networked extractor warmup while the user browses, not on first Play.
warmWavenStreamingSource();
export const trackPlayback = new TrackPlaybackHandoff(youtubeMusicStreaming,
  { replace: items => replaceNativeQueue(items, { playWhenReady: true }), resume: async (queueId, source) => {
    if ((await nativePlayback.getSnapshot()).currentQueueId !== queueId) throw new Error('Queue changed.');
    await resolveNativeQueueItem(queueId, source);
    if ((await nativePlayback.getSnapshot()).currentQueueId !== queueId) throw new Error('Queue changed.');
    return nativePlayback.play();
  } }, ids => {
    try { getLocalLibrary().claimQueue(ids); } catch { getLocalLibrary().reportHistoryIssue(); }
  });
const idleStatus: TrackPlaybackStatus = { state: 'idle', trackKey: null, message: null };
export function useTrackPlaybackStatus(trackKey?: string) {
  const snapshot = useCallback(() => {
    const value = trackPlayback.getSnapshot();
    return trackKey === undefined || value.trackKey === trackKey ? value : idleStatus;
  }, [trackKey]);
  return useSyncExternalStore(trackPlayback.subscribe, snapshot, snapshot);
}
const nativeTrackObserver = new NativeTrackObserver({
  subscribe: listener => { const subscription = subscribeNativePlayback(listener); return () => subscription.remove(); },
  snapshot: nativePlayback.getSnapshot, key: trackPlayback.getQueueTrackKey,
  restoreKey: async id => { const item = (await getPersistedPlaybackRecoveryState())?.queue.find(item => item.queueId === id); return item ? JSON.stringify([item.track.source.provider,item.track.source.id]) : null; },
});
const subscribePresentation = (listener: () => void) => {
  const stopHandoff = trackPlayback.subscribe(listener);
  const stopNative = nativeTrackObserver.subscribe(listener);
  return () => { stopHandoff(); stopNative(); };
};
export function useWavenTrackPresentation(track: MusicTrack) {
  const key = JSON.stringify([track.source.provider,track.source.id]);
  // Select a primitive before React compares snapshots. Only rows whose state
  // actually changes commit; other rows never render on another song's events.
  const snapshot = useCallback(() => trackRowState(key, trackPlayback.getSnapshot(),
    nativeTrackObserver.getSnapshot(), trackPlayback.getFailure(key)), [key]);
  return useSyncExternalStore(subscribePresentation, snapshot, snapshot);
}
export async function resumeWavenNativeTrack() {
  // Offline resume only asks the existing native owner to use what it already has buffered.
  // A connectivity transition never re-resolves, replaces or auto-starts its queue.
  if (!wavenConnectivity.canRequest('ytmusic-streaming')) return nativePlayback.play();
  const snapshot = await nativePlayback.getSnapshot(), recovery = await getPersistedPlaybackRecoveryState();
  const item = recovery?.queue.find(item => item.queueId === snapshot.currentQueueId);
  if (item && youtubePlaybackIdentity(item.track)) {
    await trackPlayback.play(item.track, item.queueId);
    if (trackPlayback.getSnapshot().state === 'error') throw new Error('Audio source unavailable.');
    return nativePlayback.getSnapshot();
  }
  return nativePlayback.play();
}
