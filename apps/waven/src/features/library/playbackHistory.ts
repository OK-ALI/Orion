import type { PlaybackRecoveryState, PlaybackSnapshot } from '../playback/contracts';
import type { LocalLibraryRepository } from './localLibrary';

/** Observes the existing native owner; never starts, resolves or controls playback. */
export class PlaybackHistoryObserver {
  private lastOccurrence = '';
  private recordedOccurrence = '';
  private generation = 0;
  private disposed = false;
  constructor(private repository: LocalLibraryRepository, private recovery: () => Promise<PlaybackRecoveryState | null>) {}
  accountChanged() { this.generation++; this.lastOccurrence = ''; this.recordedOccurrence = ''; }
  dispose() { this.disposed = true; this.generation++; }
  async observe(snapshot: PlaybackSnapshot): Promise<void> {
    if (this.disposed || !snapshot.queueIds.length || !snapshot.currentQueueId) return;
    const occurrence = JSON.stringify([snapshot.queueIds, snapshot.currentQueueId]);
    if (occurrence !== this.lastOccurrence) { this.lastOccurrence = occurrence; this.recordedOccurrence = ''; this.generation++; }
    const scope = this.repository.getSnapshot().state.scope;
    // An unowned legacy/recovered queue cannot be attributed to the current account.
    const owner = this.repository.queueOwner(snapshot.queueIds);
    if (owner !== scope || !snapshot.playing || snapshot.state !== 'playing' || snapshot.buffering || snapshot.error || this.recordedOccurrence === occurrence) return;
    // Reserve before awaiting: frequent Media3 progress events must not duplicate writes.
    this.recordedOccurrence = occurrence;
    const generation = this.generation;
    try {
      const intent = await this.recovery();
      if (this.disposed || generation !== this.generation || scope !== this.repository.getSnapshot().state.scope) return;
      if (!intent || JSON.stringify(intent.queue.map(item => item.queueId)) !== JSON.stringify(snapshot.queueIds)) { this.recordedOccurrence = ''; return; }
      const item = intent.queue.find(item => item.queueId === snapshot.currentQueueId);
      if (item) this.repository.recordPlayed(item.track, owner, occurrence);
      else this.recordedOccurrence = '';
    } catch (error) { this.recordedOccurrence = ''; throw error; }
  }
}
