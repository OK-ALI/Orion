import { useEffect, useRef } from "react";
import { claimPlayback, getPlaybackOwner } from "../../../app/playback/PlaybackCoordinator";
import { createMusicAnalyser } from "../visual/musicVisualEngine";

export function replayGainMultiplier(decibels, enabled = true) {
  if (!enabled || !Number.isFinite(Number(decibels))) return 1;
  return Math.min(2, Math.max(0.25, 10 ** (Number(decibels) / 20)));
}

export default function AudioEngine({ controller }) {
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const recoveryAttemptsRef = useRef(0);
  const transitionRef = useRef({ trackId: null, fadeOut: false });
  const attachedStreamRef = useRef("");
  const { current, stream, playing, setPlaying, volume, muted, setProgress, setBuffered,
    playbackStatus, setPlaybackStatus, playNext, playPrevious, retryStream, engineRef, visualBus,
    visualPreferences, setAnalyserState = () => {}, setAnalyserDiagnostics = () => {}, artwork } = controller;
  const visualPreferencesRef = useRef(visualPreferences);
  const outputGain = replayGainMultiplier(current?.replayGain, visualPreferences.replayGain);

  visualPreferencesRef.current = visualPreferences;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current) return undefined;
    analyserRef.current = createMusicAnalyser(audio, visualBus,
      () => visualPreferencesRef.current, (state, diagnostics) => {
        setAnalyserState(state);
        setAnalyserDiagnostics(diagnostics || { state });
        document.documentElement.dataset.musicAnalyserState = state;
        document.documentElement.dataset.musicAnalyserContextState = diagnostics?.contextState || "unavailable";
        document.documentElement.dataset.musicAnalyserFrames = String(diagnostics?.frameCount || 0);
        document.documentElement.dataset.musicAnalyserSignalFrames = String(diagnostics?.nonZeroFrameCount || 0);
        document.documentElement.dataset.musicAnalyserSourceConnected = String(diagnostics?.sourceConnected === true);
        window.dispatchEvent(new CustomEvent("orion:music-analyser-state", { detail: { state, diagnostics } }));
      });
    return () => {
      analyserRef.current?.destroy?.();
      analyserRef.current = null;
    };
  }, [setAnalyserDiagnostics, setAnalyserState, visualBus]);
  useEffect(() => { recoveryAttemptsRef.current = 0; }, [current?.id]);
  useEffect(() => {
    transitionRef.current = { trackId: current?.id || null, fadeOut: false };
    analyserRef.current?.beginTrack?.();
    analyserRef.current?.setOutputGain?.(outputGain);
  }, [current?.id, outputGain]);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const batteryPaused = visualPreferences.batterySaver && document.documentElement.dataset.performanceOnBattery === "true";
    const shouldRun = playing && playbackStatus === "playing" && document.visibilityState === "visible" && !reduced && !batteryPaused;
    if (shouldRun) analyserRef.current?.start?.();
    else analyserRef.current?.pause?.();
  }, [playing, playbackStatus, visualPreferences.adaptPerformance, visualPreferences.batterySaver]);

  useEffect(() => {
    const sync = () => {
      const blocked = visualPreferencesRef.current.batterySaver && document.documentElement.dataset.performanceOnBattery === "true";
      if (blocked) analyserRef.current?.pause?.();
      else if (playing && playbackStatus === "playing") analyserRef.current?.start?.();
    };
    window.addEventListener("orion:performance-tier-changed", sync);
    return () => window.removeEventListener("orion:performance-tier-changed", sync);
  }, [playing, playbackStatus]);

  useEffect(() => {
    const handleVisibility = () => document.visibilityState === "visible" && playing && playbackStatus === "playing"
      ? analyserRef.current?.start?.() : analyserRef.current?.pause?.();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [playing, playbackStatus]);

  useEffect(() => {
    engineRef.current = {
      seekTo(seconds) {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.min(audio.duration, Math.max(0, Number(seconds) || 0));
      },
      seekBy(seconds) {
        const audio = audioRef.current;
        if (!audio) return;
        this.seekTo((audio.currentTime || 0) + Number(seconds || 0));
      },
      stop() {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause(); audio.currentTime = 0;
      },
      unlockAudio() {
        document.documentElement.dataset.musicAnalyserUnlocks = String((Number(document.documentElement.dataset.musicAnalyserUnlocks) || 0) + 1);
        return analyserRef.current?.unlock?.() || Promise.resolve(false);
      },
      getAnalyserDiagnostics() { return analyserRef.current?.getDiagnostics?.() || null; },
    };
    return () => { engineRef.current = null; };
  }, [engineRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextUrl = stream?.url || "";
    if (!nextUrl) {
      if (!attachedStreamRef.current) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      attachedStreamRef.current = "";
      return;
    }
    if (attachedStreamRef.current === nextUrl) return;
    audio.pause();
    audio.src = stream.url;
    audio.load();
    attachedStreamRef.current = nextUrl;
  }, [stream?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.muted = muted;
    if (playing && stream?.url) {
      setPlaybackStatus("loading");
      audio.play().catch(() => { setPlaying(false); setPlaybackStatus("error"); });
    } else {
      audio.pause();
      if (current && stream?.url) setPlaybackStatus("paused");
    }
  }, [current, muted, playing, setPlaybackStatus, setPlaying, stream?.url, volume]);

  useEffect(() => {
    if (!current || !navigator.mediaSession || !window.MediaMetadata) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({ title: current.title,
      artist: current.artistName || "Unknown artist", album: current.albumTitle || "Orion Music",
      artwork: artwork?.url ? [{ src: artwork.url, sizes: "512x512", type: "image/png" }] : [] });
    navigator.mediaSession.setActionHandler("play", () => setPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => setPlaying(false));
    navigator.mediaSession.setActionHandler("stop", () => engineRef.current?.stop?.());
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
    navigator.mediaSession.setActionHandler("seekbackward", (detail) => engineRef.current?.seekBy?.(-(detail.seekOffset || 10)));
    navigator.mediaSession.setActionHandler("seekforward", (detail) => engineRef.current?.seekBy?.(detail.seekOffset || 10));
    navigator.mediaSession.setActionHandler("seekto", (detail) => engineRef.current?.seekTo?.(detail.seekTime));
  }, [artwork?.url, current, engineRef, playNext, playPrevious, setPlaying]);

  useEffect(() => {
    if (!window.electron?.onSystemMediaCommand) return undefined;
    const handler = window.electron.onSystemMediaCommand((command) => {
      if (getPlaybackOwner() !== "music") return;
      if (command === "play") setPlaying(true);
      if (command === "toggle") setPlaying((value) => !value);
      if (command === "pause") setPlaying(false);
      if (command === "stop") { engineRef.current?.stop?.(); setPlaying(false); }
      if (command === "next") playNext();
      if (command === "previous") playPrevious();
      if (command === "restart") engineRef.current?.seekTo?.(0);
    });
    return () => window.electron.offSystemMediaCommand?.(handler);
  }, [engineRef, playNext, playPrevious, setPlaying]);

  useEffect(() => {
    if (!current) return;
    if (playing) claimPlayback("music");
    window.electron?.updateSystemMediaSession?.({ active: true, mediaSessionAvailable: !!navigator.mediaSession,
      mediaType: "music", title: current.title, artist: current.artistName, album: current.albumTitle });
  }, [current, playing]);

  const updateProgress = (audio) => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    setProgress({ currentTime: audio.currentTime || 0, duration });
    let bufferedEnd = 0;
    try { if (audio.buffered.length) bufferedEnd = audio.buffered.end(audio.buffered.length - 1); } catch {}
    setBuffered(duration ? Math.min(1, bufferedEnd / duration) : 0);
    const transitionSeconds = Math.min(8, Math.max(0, Number(visualPreferencesRef.current.crossfadeDuration) || 0));
    const remaining = duration - (audio.currentTime || 0);
    if (transitionSeconds > 0 && remaining > 0 && remaining <= transitionSeconds && !transitionRef.current.fadeOut) {
      transitionRef.current.fadeOut = true;
      analyserRef.current?.setOutputGain?.(0, remaining);
    }
    if (navigator.mediaSession?.setPositionState && duration > 0) {
      try { navigator.mediaSession.setPositionState({ duration, playbackRate: audio.playbackRate || 1, position: Math.min(duration, audio.currentTime || 0) }); } catch {}
    }
  };

  return <audio ref={audioRef} className="music-audio-engine" crossOrigin="anonymous"
    onTimeUpdate={(event) => updateProgress(event.currentTarget)}
    onProgress={(event) => updateProgress(event.currentTarget)}
    onDurationChange={(event) => updateProgress(event.currentTarget)}
    onWaiting={() => setPlaybackStatus("buffering")}
    onStalled={() => setPlaybackStatus("buffering")}
    onPlaying={(event) => { claimPlayback("music"); setPlaying(true); setPlaybackStatus("playing");
      if (visualPreferences.crossfadeDuration > 0 && transitionRef.current.trackId === current?.id && event.currentTarget.currentTime < 1) {
        analyserRef.current?.setOutputGain?.(0);
        analyserRef.current?.setOutputGain?.(outputGain, Math.min(visualPreferences.crossfadeDuration, 8));
      } else analyserRef.current?.setOutputGain?.(outputGain);
      if (visualPreferences.atmosphere !== "off") analyserRef.current?.start?.();
      window.dispatchEvent(new CustomEvent("orion:music-playback-start")); window.electron?.musicAddHistory?.(current, 0); }}
    onPause={() => { analyserRef.current?.pause?.(); if (current && playbackStatus !== "error") setPlaybackStatus("paused"); }}
    onError={() => {
      if (current && recoveryAttemptsRef.current < 2) {
        recoveryAttemptsRef.current += 1;
        setPlaybackStatus("loading");
        retryStream();
        return;
      }
      setPlaying(false); setPlaybackStatus("error");
    }}
    onEnded={playNext} />;
}
