/** @typedef {{ bass:number, mids:number, treble:number, energy:number, beat:number, timestamp:number, bins:Uint8Array }} MusicVisualFrame */

export const EMPTY_VISUAL_FRAME = Object.freeze({ bass: 0, mids: 0, treble: 0, energy: 0, beat: 0, timestamp: 0, bins: new Uint8Array(0) });

function average(data, start, end) {
  if (!data.length || end <= start) return 0;
  let total = 0;
  for (let index = start; index < end; index += 1) total += data[index];
  return total / ((end - start) * 255);
}

export function analyzeFrequencyData(data, previous = EMPTY_VISUAL_FRAME, timestamp = performance.now()) {
  const length = data.length;
  const bass = average(data, 0, Math.max(2, Math.floor(length * 0.12)));
  const mids = average(data, Math.floor(length * 0.12), Math.max(3, Math.floor(length * 0.48)));
  const treble = average(data, Math.floor(length * 0.48), length);
  const energy = bass * 0.48 + mids * 0.34 + treble * 0.18;
  const smooth = (next, old, factor = 0.28) => old + (next - old) * factor;
  const smoothedEnergy = smooth(energy, previous.energy || 0, 0.24);
  const beatTarget = bass > Math.max(0.34, (previous.bass || 0) * 1.16) ? 1 : 0;
  return {
    bass: smooth(bass, previous.bass || 0), mids: smooth(mids, previous.mids || 0),
    treble: smooth(treble, previous.treble || 0), energy: smoothedEnergy,
    beat: smooth(beatTarget, previous.beat || 0, beatTarget ? 0.55 : 0.14),
    timestamp, bins: data.slice(),
  };
}

export function createVisualBus() {
  let frame = EMPTY_VISUAL_FRAME;
  const listeners = new Set();
  return {
    getFrame: () => frame,
    publish(next) { frame = next; listeners.forEach((listener) => listener(next)); },
    reset() { frame = EMPTY_VISUAL_FRAME; listeners.forEach((listener) => listener(frame)); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

export function createMusicAnalyser(audio, bus, getPreferences = () => ({})) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !audio) return null;
  let context;
  let source;
  let analyser;
  let gain;
  let raf = 0;
  let lastFrameAt = 0;
  let active = false;
  let previous = EMPTY_VISUAL_FRAME;
  try {
    context = new AudioContextClass({ latencyHint: "playback" });
    source = context.createMediaElementSource(audio);
    analyser = context.createAnalyser();
    gain = context.createGain();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);
  } catch {
    try { context?.close(); } catch {}
    return null;
  }
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = (now) => {
    if (!active) return;
    const preferences = getPreferences();
    const tier = preferences.adaptPerformance === false
      ? (preferences.atmosphere === "immersive" ? "quality" : "balanced")
      : (document.documentElement.dataset.performanceTier || "balanced");
    const interval = tier === "quality" ? 1000 / 60 : tier === "efficiency" ? 1000 / 15 : 1000 / 30;
    if (now - lastFrameAt >= interval) {
      analyser.getByteFrequencyData(data);
      previous = analyzeFrequencyData(data, previous, now);
      bus.publish(previous);
      lastFrameAt = now;
    }
    raf = requestAnimationFrame(tick);
  };
  return {
    async start() {
      if (context.state === "suspended") await context.resume().catch(() => {});
      if (active) return;
      active = true;
      raf = requestAnimationFrame(tick);
    },
    pause() { active = false; cancelAnimationFrame(raf); bus.reset(); },
    setOutputGain(value, duration = 0) {
      const now = context.currentTime;
      const next = Math.min(2, Math.max(0, Number(value) || 0));
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      if (duration > 0) gain.gain.linearRampToValueAtTime(next, now + duration);
      else gain.gain.setValueAtTime(next, now);
    },
    destroy() { active = false; cancelAnimationFrame(raf); try { source.disconnect(); analyser.disconnect(); gain.disconnect(); context.close(); } catch {} },
  };
}
