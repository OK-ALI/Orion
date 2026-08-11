import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemoteUiContextV1, SmartConnectPlaybackTelemetryV1 } from '@orion/shared/types';
import { formatConnectTime, IDLE_CONNECT_STATUS, type SmartConnectPlaybackStatus } from './connectStatus';
import { interpolateTelemetry, latencySnapshot } from './telemetryModel';

export function useLiveTelemetry(setNowPlaying: React.Dispatch<React.SetStateAction<SmartConnectPlaybackStatus>>) {
  const sentAtRef = useRef(new Map<string, number>());
  const samplesRef = useRef<number[]>([]);
  const [latency, setLatency] = useState(() => latencySnapshot([], null, null));
  const [remoteContext, setRemoteContext] = useState<RemoteUiContextV1 | null>(null);
  const [telemetry, setTelemetry] = useState<SmartConnectPlaybackTelemetryV1 | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const ingestTelemetry = useCallback((value: SmartConnectPlaybackTelemetryV1 | null) => {
    setTelemetry(value);
    if (!value) { setNowPlaying(IDLE_CONNECT_STATUS); return; }
    setNowPlaying({
      title: value.title || 'Desktop Connected', type: value.playbackKind || 'System',
      progress: value.duration ? `${formatConnectTime(value.currentTime || 0)} / ${formatConnectTime(value.duration)}` : value.state === 'unobservable' ? 'Playback timing unavailable' : 'Streaming Live',
      currentTime: value.currentTime || 0, duration: value.duration || 0, paused: value.state !== 'playing', hasMedia: value.playbackKind !== 'none',
      state: value.state, canSeek: value.canSeek, observedAt: value.observedAt, bufferedTime: value.bufferedTime || 0,
    });
  }, [setNowPlaying]);

  const markSent = useCallback((id: string) => sentAtRef.current.set(id, Date.now()), []);
  const recordAck = useCallback((id: string) => {
    const sentAt = sentAtRef.current.get(id); if (!sentAt) return;
    sentAtRef.current.delete(id);
    const samples = samplesRef.current;
    samples.push(Date.now() - sentAt);
    if (samples.length > 100) samples.splice(0, samples.length - 100);
    const snapshot = latencySnapshot(samples, telemetry ? Date.now() - telemetry.observedAt : null, null);
    setLatency((prev) => {
      if (prev.medianRttMs != null && snapshot.medianRttMs != null && Math.abs(prev.medianRttMs - snapshot.medianRttMs) < 1) return prev;
      return snapshot;
    });
  }, [telemetry]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!telemetry) return;
      const value = interpolateTelemetry(telemetry, Date.now(), isScrubbing);
      setNowPlaying((current) => ({ ...current, currentTime: value.currentTime }));
      setLatency(latencySnapshot(samplesRef.current, Number.isFinite(value.ageMs) ? value.ageMs : null, null));
    }, 250);
    return () => clearInterval(timer);
  }, [telemetry, isScrubbing, setNowPlaying]);

  return { latency, remoteContext, setRemoteContext, telemetry, ingestTelemetry, isScrubbing, setIsScrubbing, markSent, recordAck };
}
