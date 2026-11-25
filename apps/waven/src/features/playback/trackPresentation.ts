import type { PlaybackSnapshot } from './contracts';
import type { TrackPlaybackStatus } from './trackPlayback';

export type TrackRowState = 'available' | 'preparing' | 'buffering' | 'playing' | 'paused' | 'failed';
export interface NativeTrackPresentation { trackKey: string | null; snapshot: PlaybackSnapshot | null }
export function trackRowState(key: string, handoff: TrackPlaybackStatus, native: NativeTrackPresentation, failure: string | null): TrackRowState {
  if (handoff.trackKey === key && handoff.state === 'resolving') return 'preparing';
  if (native.trackKey === key && native.snapshot) {
    const state = native.snapshot;
    if (state.error || state.state === 'error') return 'failed';
    if ((state.buffering || state.state === 'buffering') && state.playWhenReady) return 'buffering';
    if (state.playing) return 'playing';
    if (state.state === 'paused' || state.state === 'ready' || state.state === 'buffering') return 'paused';
  }
  return failure || handoff.trackKey === key && handoff.state === 'error' ? 'failed' : 'available';
}

/** One read-only native presentation subscription. Position ticks do not rerender every row. */
export class NativeTrackObserver {
  private value: NativeTrackPresentation = { trackKey: null, snapshot: null };
  private listeners = new Set<() => void>();
  private stop: (() => void) | null = null;
  private generation = 0;
  private resolvingQueue: string | null = null;
  constructor(private bridge: {
    subscribe: (listener: (snapshot: PlaybackSnapshot) => void) => () => void;
    snapshot: () => Promise<PlaybackSnapshot>;
    key: (queueId: string) => string | null;
    restoreKey: (queueId: string) => Promise<string | null>;
  }) {}
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      const generation = ++this.generation;
      const accept = (s: PlaybackSnapshot) => { if (generation === this.generation) this.accept(s); };
      try { this.stop = this.bridge.subscribe(accept); void this.bridge.snapshot().then(s => { if (!this.value.snapshot) accept(s); }).catch(() => {}); } catch { /* Native build may be unavailable. */ }
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.generation++; this.stop?.(); this.stop = null; this.value = {trackKey:null,snapshot:null}; this.resolvingQueue = null; } };
  };
  private publish(next: NativeTrackPresentation) {
    const signature = (v: NativeTrackPresentation) => [v.trackKey,v.snapshot?.currentQueueId,v.snapshot?.state,v.snapshot?.playing,v.snapshot?.playWhenReady,v.snapshot?.buffering,v.snapshot?.error?.code].join('|');
    if (signature(next) === signature(this.value)) return;
    this.value = next; this.listeners.forEach(listener => listener());
  }
  private accept(snapshot: PlaybackSnapshot) {
    const id = snapshot.currentQueueId;
    const key = id ? this.bridge.key(id) ?? (this.value.snapshot?.currentQueueId === id ? this.value.trackKey : null) : null;
    this.publish({ trackKey: key, snapshot });
    if (!id || key || this.resolvingQueue === id) return;
    this.resolvingQueue = id; const generation = this.generation;
    void this.bridge.restoreKey(id).then(trackKey => {
      if (generation === this.generation && this.value.snapshot?.currentQueueId === id) this.publish({trackKey,snapshot:this.value.snapshot});
    }).catch(() => {}).finally(() => { if (this.resolvingQueue === id) this.resolvingQueue = null; });
  }
}
