import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemoteUiContextV1, SmartConnectPlaybackTelemetryV1 } from '@orion/shared/types';
import { formatConnectTime, IDLE_CONNECT_STATUS, type SmartConnectPlaybackStatus } from './connectStatus';
import { interpolateTelemetry, latencySnapshot } from './telemetryModel';

export function useLiveTelemetry(setNowPlaying: React.Dispatch<React.SetStateAction<SmartConnectPlaybackStatus>>) {
  const sentAtRef = useRef(new Map<string, number>());
  const samplesRef = useRef<number[]>([]);
  const [latency, setLatency] = useState(() => latencySnapshot([], null, null));
  const [remoteContext, setRemoteContext] = useState<RemoteUiContextV1 | null>(null);
  const remoteContextRef = useRef<RemoteUiContextV1 | null>(null);
  const [telemetry, setTelemetry] = useState<SmartConnectPlaybackTelemetryV1 | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const latestRef = useRef<{ sessionId: string; sequence: number; observedAt: number } | null>(null);

  const ingestTelemetry = useCallback((value: SmartConnectPlaybackTelemetryV1 | null) => {
    if (value) {
      const latest = latestRef.current;
      if (latest && value.sessionId === latest.sessionId && Number(value.sequence) <= latest.sequence) return;
      if (latest && value.sessionId !== latest.sessionId && Number(value.observedAt) < latest.observedAt) return;
      latestRef.current = { sessionId: value.sessionId, sequence: Number(value.sequence) || 0, observedAt: Number(value.observedAt) || Date.now() };
    } else latestRef.current = null;
    setTelemetry(value);
    if (!value) { setNowPlaying(IDLE_CONNECT_STATUS); return; }
    setNowPlaying({
      title: value.title || 'Desktop Connected', type: value.playbackKind || 'System',
      progress: value.duration ? `${formatConnectTime(value.currentTime || 0)} / ${formatConnectTime(value.duration)}` : value.state === 'unobservable' ? 'Playback timing unavailable' : 'Streaming Live',
      currentTime: value.currentTime || 0, duration: value.duration || 0, paused: value.state !== 'playing', hasMedia: value.playbackKind !== 'none',
      state: value.state, canSeek: value.canSeek, observedAt: value.observedAt, bufferedTime: value.bufferedTime || 0,
      sessionId: value.sessionId, sourceId: value.sourceId, sourceLabel: value.sourceLabel || 'Orion Player',
      controlState: value.controlState || (value.state === 'unobservable' ? 'unobservable' : 'unavailable'),
      controlStrategy: value.controlStrategy || 'unavailable',
      canPlay: remoteContextRef.current?.capabilities?.canPlay,
      canPause: remoteContextRef.current?.capabilities?.canPause,
      canSkipPrevious: remoteContextRef.current?.capabilities?.canSkipPrevious,
      canSkipNext: remoteContextRef.current?.capabilities?.canSkipNext,
    });
  }, [setNowPlaying]);

  const applyRemoteContext = useCallback((value: RemoteUiContextV1 | null) => {
    remoteContextRef.current = value;
    setRemoteContext(value);
    if (!value) return;
    setNowPlaying((current) => ({
      ...current,
      canPlay: value.capabilities?.canPlay,
      canPause: value.capabilities?.canPause,
      canSkipPrevious: value.capabilities?.canSkipPrevious,
      canSkipNext: value.capabilities?.canSkipNext,
    }));
  }, [setNowPlaying]);

  const markSent = useCallback((id: string) => sentAtRef.current.set(id, Date.now()), []);
  const forgetSent = useCallback((id: string) => sentAtRef.current.delete(id), []);
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
    }, 500);
    return () => clearInterval(timer);
  }, [telemetry, isScrubbing, setNowPlaying]);

  return { latency, remoteContext, setRemoteContext: applyRemoteContext, telemetry, ingestTelemetry, isScrubbing, setIsScrubbing, markSent, forgetSent, recordAck };
}
