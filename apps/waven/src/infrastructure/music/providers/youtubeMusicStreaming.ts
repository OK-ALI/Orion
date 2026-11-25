import { NativeModules, Platform } from 'react-native';
import { wavenConnectivity } from '../../connectivity/connectivityService';
import type { MusicStreamCandidate, MusicStreamingProvider, MusicTrack } from '../../../domain/music';
import type { ResolvedPlaybackSource } from '../../../features/playback/contracts';

let requestCounter = 0;
export function youtubePlaybackIdentity(track: MusicTrack): string | null {
  const refs = [track.source, ...(track.providerRefs ?? [])];
  const ref = refs.find(r => /^(?:ytmusic-metadata|ytmusic-streaming|youtube|ytmusic)$/.test(r.provider) && /^[A-Za-z0-9_-]{11}$/.test(r.id));
  return ref?.id ?? null;
}
/** Network-free native extractor warmup. A source lease is still resolved freshly per play. */
export function warmWavenStreamingSource(): void {
  if (Platform.OS !== 'android') return;
  const native = NativeModules.WavenStreamingSource as { warmUp?: () => Promise<unknown> } | undefined;
  try { void native?.warmUp?.().catch(() => undefined); } catch { /* Playback remains retryable. */ }
}
export const youtubeMusicStreaming: MusicStreamingProvider<MusicStreamCandidate, ResolvedPlaybackSource, AbortSignal> = {
  id: 'ytmusic-streaming', name: 'YouTube Music', kind: 'streaming',
  capabilities: ['candidateSearch', 'justInTimeResolution', 'streamRefresh'], supportsLocalFiles: false,
  async searchForTrack(track, context) {
    if (context?.signal?.aborted) throw new Error('Source resolution cancelled.');
    const id = youtubePlaybackIdentity(track);
    return id ? [{ id, providerId: 'ytmusic-streaming', providerTrackId: id, title: track.title, artistName: track.artistName, durationMs: track.durationMs }] : [];
  },
  async resolveCandidate(candidate, context) {
    wavenConnectivity.assertRemote('ytmusic-streaming');
    const bridge = NativeModules.WavenStreamingSource as { resolve: (id: string, requestId: string) => Promise<ResolvedPlaybackSource>; cancel: (requestId: string) => void } | undefined;
    if (Platform.OS !== 'android' || !bridge) throw new Error('Audio source resolution requires a WAVEN native build.');
    if (candidate.providerId !== 'ytmusic-streaming' || !/^[A-Za-z0-9_-]{11}$/.test(candidate.id)) throw new Error('Unsupported song identity.');
    const signal = context?.signal, requestId = `waven-source-${Date.now().toString(36)}-${++requestCounter}`;
    if (signal?.aborted) throw new Error('Source resolution cancelled.');
    const cancel = () => bridge.cancel(requestId);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const source = await wavenConnectivity.runRemote('ytmusic-streaming', async connectionSignal => {
        connectionSignal.addEventListener('abort', cancel, { once: true });
        try { return await bridge.resolve(candidate.id, requestId); }
        finally { connectionSignal.removeEventListener('abort', cancel); }
      }, signal);
      if (signal?.aborted) throw new Error('Source resolution cancelled.');
      return source;
    } catch (error) {
      // A rejected source belongs to this track; it cannot establish a provider outage.
      throw error;
    } finally { signal?.removeEventListener('abort', cancel); }
  },
};
