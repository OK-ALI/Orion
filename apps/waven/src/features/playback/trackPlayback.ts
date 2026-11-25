import type { MusicStreamCandidate, MusicStreamingProvider, MusicTrack } from '../../domain/music';
import { traceP8 } from '../../infrastructure/connectivity/phase8ValidationTrace';
import type { NativePlaybackQueueItem, PlaybackSnapshot, ResolvedPlaybackSource } from './contracts';

export interface TrackPlaybackStatus { state: 'idle' | 'resolving' | 'started' | 'error'; trackKey: string | null; message: string | null }
interface PlaybackBridge {
  replace: (items: readonly NativePlaybackQueueItem[]) => Promise<PlaybackSnapshot>;
  resume?: (queueId: string, source: ResolvedPlaybackSource) => Promise<PlaybackSnapshot>;
}
/** Owns one cancellable handoff request, never audio or the native queue's state. */
export class TrackPlaybackHandoff {
  private generation = 0;
  private active: AbortController | null = null;
  private nativeCommand: Promise<void> = Promise.resolve();
  private status: TrackPlaybackStatus = { state: 'idle', trackKey: null, message: null };
  private listeners = new Set<() => void>();
  private failures = new Map<string, string>();
  private queueTracks = new Map<string, string>();
  constructor(private provider: MusicStreamingProvider<MusicStreamCandidate, ResolvedPlaybackSource, AbortSignal>,
    private bridge: PlaybackBridge, private beforeHandoff: (queueIds: readonly string[]) => void = () => {}, private now = Date.now, private deadlineMs = 45_000) {}
  getFailure = (trackKey: string) => this.failures.get(trackKey) ?? null;
  getQueueTrackKey = (queueId: string) => this.queueTracks.get(queueId) ?? null;
  getSnapshot = () => this.status;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(status: TrackPlaybackStatus) { this.status = status; this.listeners.forEach(l => l()); }
  cancel() { this.generation++; this.active?.abort(); this.active = null; this.publish({ state: 'idle', trackKey: null, message: null }); }
  async play(track: MusicTrack, resumeQueueId?: string): Promise<void> {
    const trackKey = JSON.stringify([track.source.provider, track.source.id]);
    if (this.status.state === 'resolving' && this.status.trackKey === trackKey) return;
    this.active?.abort(); const controller = new AbortController(), generation = ++this.generation; this.active = controller;
    this.failures.delete(trackKey);
    this.publish({ state: 'resolving', trackKey, message: null });
    const tapStartedAt = this.now();
    traceP8('play', 'begin');
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let removeAbort: (() => void) | undefined;
    try {
      const work = async () => {
      const candidates = await this.provider.searchForTrack(track, { signal: controller.signal });
      if (controller.signal.aborted || generation !== this.generation) return;
      if (!candidates.length) throw new Error('No supported source.');
      const sourceStartedAt = this.now();
      const source = await this.provider.resolveCandidate(candidates[0], { signal: controller.signal });
      traceP8('play', 'source_ready', this.now() - sourceStartedAt);
      if (controller.signal.aborted || generation !== this.generation) return;
      if (!/^https:\/\//i.test(source.uri) || !Number.isFinite(source.expiresAtMs) || source.expiresAtMs! <= this.now() + 30_000) throw new Error('Expired source.');
      const queueId = `waven-track-${this.now().toString(36)}-${generation}`;
      const safeTrack: MusicTrack = { id: track.id, title: track.title, artistName: track.artistName, albumTitle: track.albumTitle,
        albumArtist: track.albumArtist, artworkUrl: track.artworkUrl, durationMs: track.durationMs,
        provider: track.provider, providerTrackId: track.providerTrackId, source: { ...track.source }, providerRefs: track.providerRefs?.map(r => ({ ...r })) };
      // Order native commands so a delayed earlier bridge call cannot finish after a later song.
      const command = this.nativeCommand.then(async () => {
        if (controller.signal.aborted || generation !== this.generation) return;
        if (source.expiresAtMs! <= this.now() + 30_000) throw new Error('Expired source.');
        // Claim before native playing can emit, on the original still-active account.
        this.queueTracks.set(resumeQueueId ?? queueId, trackKey);
        if (this.queueTracks.size > 64) this.queueTracks.delete(this.queueTracks.keys().next().value!);
        if (!resumeQueueId) this.beforeHandoff([queueId]);
        if (resumeQueueId && this.bridge.resume) await this.bridge.resume(resumeQueueId, source);
        else await this.bridge.replace([{ queueId, track: safeTrack, streamingProvider: { provider: this.provider.id, id: candidates[0].id }, resolvedSource: source }]);
      });
      this.nativeCommand = command.catch(() => {});
      await command;
      if (generation === this.generation && !controller.signal.aborted) {
        traceP8('handoff', 'complete', this.now() - tapStartedAt);
        this.publish({ state: 'started', trackKey, message: null });
      }
      };
      await Promise.race([work(), new Promise<never>((_, reject) => {
        const aborted = () => reject(new Error('Playback preparation cancelled.'));
        controller.signal.addEventListener('abort', aborted, { once: true });
        removeAbort = () => controller.signal.removeEventListener('abort', aborted);
        deadline = setTimeout(() => { reject(new Error('Playback preparation timed out.')); controller.abort(); }, this.deadlineMs);
      })]);
    } catch {
      if (generation === this.generation) {
        traceP8('play', 'failed', this.now() - tapStartedAt);
        const message = 'This song could not start. Tap to retry or choose another song.';
        this.failures.set(trackKey, message);
        if (this.failures.size > 64) this.failures.delete(this.failures.keys().next().value!);
        this.publish({ state: 'error', trackKey, message });
      }
    } finally { if (deadline) clearTimeout(deadline); removeAbort?.(); if (generation === this.generation) this.active = null; }
  }
}
