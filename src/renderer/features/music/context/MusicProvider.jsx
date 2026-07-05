import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AudioEngine from "../player/AudioEngine";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import { getPlaybackOwner } from "../../../app/playback/PlaybackCoordinator";
import { normalizeQueueRecovery, previousQueueTarget, shuffledIndices } from "../utils/queueNavigation";
import { createVisualBus } from "../visual/musicVisualEngine";
import { deterministicPalette, extractArtworkPalette } from "../visual/artworkPalette";

const MusicContext = createContext(null);

function readVisualPreferences() {
  return {
    atmosphere: storage.get(STORAGE_KEYS.MUSIC_ATMOSPHERE) || "pulse",
    visualizer: storage.get(STORAGE_KEYS.MUSIC_VISUALIZER) || "orbit",
    intensity: clamp(storage.get(STORAGE_KEYS.MUSIC_VISUAL_INTENSITY) ?? 65, 0, 100),
    artworkColor: storage.get(STORAGE_KEYS.MUSIC_ARTWORK_COLOR) !== false,
    lyricsMotion: storage.get(STORAGE_KEYS.MUSIC_LYRICS_MOTION) !== false,
    adaptPerformance: storage.get(STORAGE_KEYS.MUSIC_PERFORMANCE_ADAPT) !== false,
    replayGain: storage.get(STORAGE_KEYS.MUSIC_REPLAY_GAIN) !== false,
    crossfadeDuration: clamp(storage.get(STORAGE_KEYS.MUSIC_CROSSFADE_DURATION) ?? 0, 0, 8),
    lowGpu: storage.get(STORAGE_KEYS.MUSIC_LOW_GPU) === true,
    disableAudioReactiveBg: storage.get(STORAGE_KEYS.MUSIC_DISABLE_AUDIO_REACTIVE_BG) === true,
    staticBg: storage.get(STORAGE_KEYS.MUSIC_STATIC_BG) === true,
    particleDensity: storage.get(STORAGE_KEYS.MUSIC_PARTICLE_DENSITY) || "medium",
    batterySaver: storage.get(STORAGE_KEYS.MUSIC_BATTERY_SAVER) === true,
    reduceMotion: storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) === true,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

export function MusicProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState("idle");
  const [stream, setStream] = useState(null);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(() => clamp(storage.get(STORAGE_KEYS.MUSIC_VOLUME) ?? 0.8, 0, 1));
  const [muted, setMuted] = useState(() => storage.get(STORAGE_KEYS.MUSIC_MUTED) === true);
  const [repeat, setRepeat] = useState("off");
  const [shuffle, setShuffle] = useState(false);
  const [panel, setPanel] = useState(null);
  const [lyrics, setLyrics] = useState({ status: "idle", value: null, error: "" });
  const [candidates, setCandidates] = useState({ status: "idle", items: [], error: "" });
  const [resolveNonce, setResolveNonce] = useState(0);
  const [visualPreferences, setVisualPreferences] = useState(readVisualPreferences);
  const [artwork, setArtwork] = useState({ url: "", palette: deterministicPalette("orion") });
  const [immersive, setImmersive] = useState(false);
  const engineRef = useRef(null);
  const visualBus = useMemo(() => createVisualBus(), []);
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  const historyRef = useRef([]);
  const shuffleBagRef = useRef([]);
  const shouldAutoplayRef = useRef(false);
  const restoringQueueRef = useRef(false);
  queueRef.current = queue;
  indexRef.current = index;
  const current = queue[index] || null;

  useEffect(() => {
    window.electron?.musicLoadQueue?.().then((saved) => {
      restoringQueueRef.current = true;
      const recovered = normalizeQueueRecovery(saved);
      setQueue(recovered.items); setIndex(recovered.index); setRepeat(recovered.repeat); setShuffle(recovered.shuffle);
      historyRef.current = recovered.history;
      shuffleBagRef.current = recovered.shuffleBag;
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => window.electron?.musicSaveQueue?.({ items: queue, index, repeat, shuffle,
      history: historyRef.current.slice(-500), shuffleBag: shuffleBagRef.current.slice(0, queue.length) }), 250);
    return () => clearTimeout(timer);
  }, [index, queue, repeat, shuffle]);

  useEffect(() => { storage.set(STORAGE_KEYS.MUSIC_VOLUME, volume); }, [volume]);
  useEffect(() => { storage.set(STORAGE_KEYS.MUSIC_MUTED, muted); }, [muted]);
  useEffect(() => {
    const refresh = () => setVisualPreferences(readVisualPreferences());
    window.addEventListener("orion:music-appearance-changed", refresh);
    return () => window.removeEventListener("orion:music-appearance-changed", refresh);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!current) { setArtwork({ url: "", palette: deterministicPalette("orion") }); return undefined; }
    const fallback = deterministicPalette(`${current.artistName}:${current.albumTitle}:${current.title}`);
    setArtwork({ url: "", palette: fallback });
    const artworkTrack = current.artworkUrl || !stream?.candidate?.thumbnail ? current : { ...current, artworkUrl: stream.candidate.thumbnail };
    window.electron?.musicGetArtwork?.(artworkTrack).then(async (result) => {
      if (cancelled || !result?.ok) return;
      const palette = visualPreferences.artworkColor ? await extractArtworkPalette(result.url, current.id) : fallback;
      if (!cancelled) setArtwork({ url: result.url, palette });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [current?.id, current?.artworkUrl, stream?.candidate?.thumbnail, visualPreferences.artworkColor]);
  useEffect(() => {
    if (restoringQueueRef.current) { restoringQueueRef.current = false; return; }
    historyRef.current = [];
    shuffleBagRef.current = shuffledIndices(queue.length, index);
  }, [queue.map((item) => `${item.provider || ""}:${item.id}`).join("|")]);

  useEffect(() => {
    setLyrics({ status: "idle", value: null, error: "" });
    setCandidates({ status: "idle", items: [], error: "" });
    setProgress({ currentTime: 0, duration: 0 });
    setBuffered(0);
    if (!current) {
      setStream(null); setPlaying(false); setPlaybackStatus("idle");
      return undefined;
    }
    let cancelled = false;
    setPlaybackStatus("loading");
    window.electron?.musicResolveTrack?.(current).then((value) => {
      if (cancelled) return;
      if (!value?.ok) {
        setStream({ error: value?.error || "This track could not be resolved." });
        setPlaying(false); setPlaybackStatus("error");
        return;
      }
      setStream(value);
      const autoplay = shouldAutoplayRef.current;
      shouldAutoplayRef.current = false;
      setPlaying(autoplay);
      setPlaybackStatus(autoplay ? "loading" : "paused");
    }).catch((error) => {
      if (!cancelled) {
        setStream({ error: error?.message || "This track could not be resolved." });
        setPlaying(false); setPlaybackStatus("error");
      }
    });
    return () => { cancelled = true; };
  }, [current?.id, current?.provider, resolveNonce]);

  const seekTo = useCallback((seconds) => engineRef.current?.seekTo?.(seconds), []);
  const seekBy = useCallback((seconds) => engineRef.current?.seekBy?.(seconds), []);
  const setVolume = useCallback((value) => setVolumeState(clamp(value, 0, 1)), []);
  const toggleMute = useCallback(() => setMuted((value) => !value), []);
  const togglePlaying = useCallback(() => {
    if (!current) return;
    shouldAutoplayRef.current = true;
    setPlaying((value) => !value);
  }, [current]);

  const selectQueueItem = useCallback((position, autoplay = true) => {
    if (position < 0 || position >= queueRef.current.length) return;
    if (indexRef.current >= 0 && position !== indexRef.current) historyRef.current.push(indexRef.current);
    shouldAutoplayRef.current = autoplay;
    if (position === indexRef.current) { seekTo(0); setPlaying(autoplay); }
    else setIndex(position);
  }, [seekTo]);

  const playTrack = useCallback((track, context = []) => {
    const items = context.length ? context : [track];
    const position = Math.max(0, items.findIndex((item) => item.id === track.id));
    shouldAutoplayRef.current = true;
    setQueue(items); setIndex(position); setPlaying(true);
    window.dispatchEvent(new CustomEvent("orion:music-playback-start"));
  }, []);

  const playNext = useCallback(() => {
    const items = queueRef.current;
    const currentIndex = indexRef.current;
    if (!items.length || currentIndex < 0) return;
    if (repeat === "one") { seekTo(0); setPlaying(true); return; }
    let next = -1;
    if (shuffle) {
      if (!shuffleBagRef.current.length && repeat === "all") shuffleBagRef.current = shuffledIndices(items.length, currentIndex);
      next = shuffleBagRef.current.shift() ?? -1;
    } else if (currentIndex + 1 < items.length) next = currentIndex + 1;
    else if (repeat === "all") next = 0;
    if (next < 0) { setPlaying(false); setPlaybackStatus("paused"); return; }
    historyRef.current.push(currentIndex);
    shouldAutoplayRef.current = true;
    setIndex(next); setPlaying(true);
  }, [repeat, seekTo, shuffle]);

  const playPrevious = useCallback(() => {
    const decision = previousQueueTarget({ currentTime: progress.currentTime,
      currentIndex: indexRef.current, history: historyRef.current });
    if (decision.restart) { seekTo(0); return; }
    if (historyRef.current.length) historyRef.current.pop();
    const target = decision.index;
    shouldAutoplayRef.current = true;
    if (target === indexRef.current) seekTo(0);
    else setIndex(target);
    setPlaying(true);
  }, [progress.currentTime, seekTo]);

  const stop = useCallback((clearQueue = false) => {
    engineRef.current?.stop?.();
    setPlaying(false); setPlaybackStatus("idle");
    if (clearQueue) { setQueue([]); setIndex(-1); }
  }, []);
  const retryStream = useCallback(() => { shouldAutoplayRef.current = true; setResolveNonce((value) => value + 1); }, []);

  const loadLyrics = useCallback(async () => {
    if (!current) return;
    setLyrics({ status: "loading", value: null, error: "" });
    const result = await window.electron?.musicGetLyrics?.(current);
    setLyrics(result?.ok ? { status: "ready", value: result.lyrics, error: "" }
      : { status: "error", value: null, error: result?.error || "No lyrics are available." });
  }, [current]);

  const loadCandidates = useCallback(async () => {
    if (!current) return;
    setCandidates({ status: "loading", items: [], error: "" });
    const result = await window.electron?.musicListTrackCandidates?.(current);
    setCandidates(result?.ok ? { status: "ready", items: result.candidates || [], error: "" }
      : { status: "error", items: [], error: result?.error || "Music sources could not be loaded." });
  }, [current]);

  const selectCandidate = useCallback(async (candidateId) => {
    setPlaybackStatus("loading");
    const result = await window.electron?.musicResolveCandidate?.(candidateId);
    if (!result?.ok) { setStream({ error: result?.error }); setPlaybackStatus("error"); return; }
    shouldAutoplayRef.current = true;
    setStream(result); setPlaying(true); setPlaybackStatus("loading");
  }, []);

  const removeFromQueue = useCallback((position) => {
    setQueue((items) => items.filter((_, itemIndex) => itemIndex !== position));
    setIndex((value) => value > position ? value - 1 : value === position ? -1 : value);
  }, []);
  const moveQueueItem = useCallback((from, to) => {
    if (from === to || from < 0 || to < 0) return;
    setQueue((items) => {
      if (from >= items.length || to >= items.length) return items;
      const next = items.slice();
      const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
      return next;
    });
    setIndex((value) => value === from ? to : from < value && to >= value ? value - 1 : from > value && to <= value ? value + 1 : value);
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (!current) return;
      if (getPlaybackOwner() === "video") return;
      const target = event.target;
      const editable = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
      if (editable || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "k") { event.preventDefault(); togglePlaying(); }
      else if (key === "arrowleft") { event.preventDefault(); seekBy(-5); }
      else if (key === "arrowright") { event.preventDefault(); seekBy(5); }
      else if (key === "j") { event.preventDefault(); seekBy(-10); }
      else if (key === "l") { event.preventDefault(); seekBy(10); }
      else if (key === "m") { event.preventDefault(); toggleMute(); }
      else if (key === "n") { event.preventDefault(); playNext(); }
      else if (key === "p") { event.preventDefault(); playPrevious(); }
      else if (key === "q") { event.preventDefault(); setPanel((value) => value === "queue" ? null : "queue"); }
      else if (key === "y") { event.preventDefault(); setPanel((value) => value === "lyrics" ? null : "lyrics"); loadLyrics(); }
      else if (key === "escape" && panel) setPanel(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [current, loadLyrics, panel, playNext, playPrevious, seekBy, toggleMute, togglePlaying]);

  useEffect(() => {
    const pause = () => setPlaying(false);
    window.addEventListener("orion:video-playback-start", pause);
    return () => window.removeEventListener("orion:video-playback-start", pause);
  }, []);

  const value = useMemo(() => ({ queue, setQueue, index, current, playing, setPlaying, togglePlaying,
    playbackStatus, setPlaybackStatus, stream, progress, setProgress, buffered, setBuffered,
    volume, setVolume, muted, setMuted, toggleMute, repeat, setRepeat, shuffle, setShuffle,
    panel, setPanel, lyrics, loadLyrics, candidates, loadCandidates, selectCandidate,
    playTrack, playNext, playPrevious, selectQueueItem, removeFromQueue, moveQueueItem, seekTo, seekBy,
    stop, retryStream, engineRef, visualBus, visualPreferences, artwork, immersive, setImmersive }),
  [buffered, candidates, current, index, loadCandidates, loadLyrics, lyrics, muted, panel,
    playNext, playPrevious, playTrack, playbackStatus, playing, progress, queue, removeFromQueue, moveQueueItem,
    repeat, retryStream, seekBy, seekTo, selectCandidate, selectQueueItem, setVolume, shuffle,
    stop, stream, toggleMute, togglePlaying, volume, visualBus, visualPreferences, artwork, immersive]);

  return <MusicContext.Provider value={value}>{children}<AudioEngine controller={value} /></MusicContext.Provider>;
}

export function useMusic() {
  const value = useContext(MusicContext);
  if (!value) throw new Error("useMusic must be used inside MusicProvider.");
  return value;
}
