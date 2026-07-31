/** @typedef {{ bass:number, mids:number, treble:number, energy:number, beat:number, timestamp:number, bins:Uint8Array }} MusicVisualFrame */

/** @typedef {"idle"|"initializing"|"awaiting-gesture"|"active"|"silent"|"suspended"|"failed"} MusicAnalyserState */

export const EMPTY_VISUAL_FRAME = Object.freeze({ bass: 0, mids: 0, treble: 0, energy: 0, beat: 0, timestamp: 0, bins: new Uint8Array(0) });

function average(data, start, end) {
  if (!data.length || end <= start) return 0;
  let total = 0;
  for (let index = start; index < end; index += 1) total += data[index];
  return total / ((end - start) * 255);
}

function binForFrequency(frequency, sampleRate, fftSize, length) {
  if (!Number.isFinite(sampleRate) || !Number.isFinite(fftSize)) return 0;
  return Math.min(length, Math.max(0, Math.round(frequency / (sampleRate / fftSize))));
}

/**
 * Convert analyser bins into stable visual bands. Supplying sampleRate and
 * fftSize makes the bands frequency-aware; the fallback preserves older tests
 * and browsers that do not expose audio graph metadata.
 */
export function analyzeFrequencyData(data, previous = EMPTY_VISUAL_FRAME, timestamp = performance.now(), options = {}) {
  const length = data.length;
  const { sampleRate, fftSize, settling = false } = options;
  const frequencyAware = Number.isFinite(sampleRate) && Number.isFinite(fftSize);
  const bassEnd = frequencyAware ? Math.max(2, binForFrequency(250, sampleRate, fftSize, length)) : Math.max(2, Math.floor(length * 0.12));
  const midsEnd = frequencyAware ? Math.max(bassEnd + 1, binForFrequency(4000, sampleRate, fftSize, length)) : Math.max(3, Math.floor(length * 0.48));
  const trebleEnd = frequencyAware ? Math.max(midsEnd + 1, binForFrequency(12000, sampleRate, fftSize, length)) : length;
  const rawBass = average(data, frequencyAware ? binForFrequency(20, sampleRate, fftSize, length) : 0, bassEnd);
  const rawMids = average(data, bassEnd, Math.min(length, midsEnd));
  const rawTreble = average(data, Math.min(length, midsEnd), Math.min(length, trebleEnd));
  const noiseFloor = 0.018;
  const suppress = (value) => value <= noiseFloor ? 0 : Math.min(1, (value - noiseFloor) / (1 - noiseFloor));
  const bass = suppress(rawBass);
  const mids = suppress(rawMids);
  const treble = suppress(rawTreble);
  const energy = bass * 0.5 + mids * 0.34 + treble * 0.16;
  const smooth = (next, old, attack = 0.3, release = 0.14) => old + (next - old) * (next > old ? attack : release);
  const smoothedEnergy = smooth(energy, previous.energy || 0, 0.24);
  const beatFloor = Math.max(0.2, (previous.bass || 0) * 1.18, (previous.energy || 0) * 1.3);
  const beatTarget = !settling && bass > beatFloor ? 1 : 0;
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

export function createMusicAnalyser(audio, bus, getPreferences = () => ({}), onState = () => {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !audio) { onState("failed"); return null; }
  let context;
  let source;
  let analyser;
  let gain;
  let raf = 0;
  let lastFrameAt = 0;
  let active = false;
  let previous = EMPTY_VISUAL_FRAME;
  let settleUntil = 0;
  let state = "initializing";
  let frameCount = 0;
  let nonZeroFrameCount = 0;
  let consecutiveSignalFrames = 0;
  let startedAt = 0;
  let lastEnergy = 0;
  let blockedReason = "";
  let data = null;
  let pendingGain = 1;
  const diagnostics = () => ({ state, contextState: context?.state || "unavailable", sourceConnected: !!source,
    frameCount, nonZeroFrameCount, lastEnergy, lastFrameAt, blockedReason });
  const report = (next, reason = "") => {
    state = next;
    blockedReason = reason;
    onState(next, diagnostics());
  };
  const ensureContext = () => {
    if (context) return true;
    try {
      context = new AudioContextClass({ latencyHint: "playback" });
      context.onstatechange = () => {
        if (context.state !== "suspended" || !source) return;
        active = false;
        cancelAnimationFrame(raf);
        report("awaiting-gesture", "Audio-reactive visuals need an available system audio output.");
      };
      return true;
    } catch {
      report("failed", "The Web Audio context could not be created.");
      return false;
    }
  };
  const connectGraph = () => {
    if (source && analyser && gain) return true;
    if (context.state !== "running") return false;
    try {
      source = context.createMediaElementSource(audio);
      analyser = context.createAnalyser();
      gain = context.createGain();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(pendingGain, context.currentTime);
      data = new Uint8Array(analyser.frequencyBinCount);
      report("suspended");
      return true;
    } catch {
      report("failed", "The Web Audio graph could not attach to this playback source.");
      return false;
    }
  };
  report("awaiting-gesture", "Play once to enable audio-reactive visuals.");
  const tick = (now) => {
    if (!active || !analyser || !data) return;
    const preferences = getPreferences();
    const tier = preferences.adaptPerformance === false
      ? (preferences.atmosphere === "immersive" ? "quality" : "balanced")
      : (document.documentElement.dataset.performanceTier || "balanced");
    const interval = tier === "quality" ? 1000 / 60 : tier === "efficiency" ? 1000 / 15 : 1000 / 30;
    if (now - lastFrameAt >= interval) {
      analyser.getByteFrequencyData(data);
      previous = analyzeFrequencyData(data, previous, now, {
        sampleRate: context.sampleRate,
        fftSize: analyser.fftSize,
        settling: now < settleUntil,
      });
      frameCount += 1;
      lastEnergy = previous.energy;
      lastFrameAt = now;
      if (previous.energy > 0.004) {
        nonZeroFrameCount += 1;
        consecutiveSignalFrames += 1;
      } else consecutiveSignalFrames = 0;
      if (consecutiveSignalFrames >= 3 && state !== "active") report("active");
      else if (state !== "active" && now - startedAt > 1200 && state !== "silent") {
        report("silent", "Playback is running, but the analyser is receiving silence.");
      }
      bus.publish(previous);
      lastFrameAt = now;
    }
    raf = requestAnimationFrame(tick);
  };
  return {
    async unlock() {
      if (!ensureContext()) return false;
      // Unlock the context during the trusted gesture, but do not capture the
      // media element yet. Attaching a MediaElementSource while the element is
      // still resolving can cause Chromium to suspend the graph and stall the
      // otherwise playable element at 0:00. The `playing` event calls start(),
      // which connects the persistent graph only after audio is flowing.
      if (context.state === "running") return true;
      try {
        const silent = context.createBufferSource?.();
        if (silent && context.createBuffer) {
          silent.buffer = context.createBuffer(1, 1, context.sampleRate || 44_100);
          silent.connect(context.destination);
          silent.start(0);
        }
      } catch {}
      await context.resume().catch(() => {});
      if (context.state !== "running") {
        report("awaiting-gesture", "Play once to enable audio-reactive visuals.");
        return false;
      }
      return true;
    },
    async start() {
      if (!ensureContext()) return;
      if (context.state === "suspended") await context.resume().catch(() => {});
      if (context.state !== "running") { report("awaiting-gesture", "Play once to enable audio-reactive visuals."); return; }
      // Let Chromium prove the unlocked context has a usable output device
      // before routing the media element through it. This keeps playback
      // independent on machines where Web Audio is exposed but unavailable.
      if (!source) {
        try {
          const devices = await navigator.mediaDevices?.enumerateDevices?.();
          if (Array.isArray(devices) && !devices.some((device) => device.kind === "audiooutput")) {
            report("awaiting-gesture", "Audio-reactive visuals need an available system audio output.");
            return;
          }
        } catch {}
        const contextTime = context.currentTime;
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        if (context.state !== "running" || context.currentTime - contextTime < 0.35) {
          report("awaiting-gesture", "Audio-reactive visuals need an available system audio output.");
          return;
        }
      }
      if (!connectGraph()) return;
      if (active) return;
      active = true;
      startedAt = performance.now();
      consecutiveSignalFrames = 0;
      report("initializing");
      raf = requestAnimationFrame(tick);
    },
    pause({ reset = true } = {}) {
      active = false;
      cancelAnimationFrame(raf);
      if (reset) bus.reset();
      const contextState = context?.state || "unavailable";
      report(contextState !== "running" ? "awaiting-gesture" : "suspended",
        contextState !== "running" ? "Play once to enable audio-reactive visuals." : "");
    },
    beginTrack() {
      settleUntil = performance.now() + 260;
      previous = EMPTY_VISUAL_FRAME;
      consecutiveSignalFrames = 0;
      lastEnergy = 0;
    },
    setOutputGain(value, duration = 0) {
      pendingGain = Math.min(2, Math.max(0, Number(value) || 0));
      if (!gain) return;
      if (!context) return;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      if (duration > 0) gain.gain.linearRampToValueAtTime(pendingGain, now + duration);
      else gain.gain.setValueAtTime(pendingGain, now);
    },
    getState() { return state; },
    getDiagnostics: diagnostics,
    destroy() {
      active = false;
      cancelAnimationFrame(raf);
      bus.reset();
      report("idle");
      try { source?.disconnect(); analyser?.disconnect(); gain?.disconnect(); context?.close(); } catch {}
    },
  };
}
