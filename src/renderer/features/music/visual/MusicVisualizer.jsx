import { useEffect, useRef } from "react";
import { useMusic } from "../context/MusicProvider";

const THEME_FALLBACKS = {
  "--bg-base": "#08070c",
  "--music-palette-base-1": "#09081a",
  "--music-palette-primary-1": "#8b5cf6",
  "--music-palette-spectral-1": "#ddd7ee",
  "--music-palette-base-2": "#100719",
  "--music-palette-primary-2": "#d946ef",
  "--music-palette-spectral-2": "#d8cfeb",
  "--music-palette-base-3": "#06111c",
  "--music-palette-primary-3": "#6366f1",
  "--music-palette-spectral-3": "#b9b4cc",
  "--music-palette-base-4": "#130a13",
  "--music-palette-primary-4": "#a855f7",
  "--music-palette-spectral-4": "#f472b6",
  "--music-violet": "#8b5cf6",
  "--music-highlight": "#e8e5ee",
  "--music-magenta": "#d946ef"
};

function resolveColor(color) {
  if (!color) return "#000000";
  let resolved = String(color).trim();
  
  while (resolved.includes("var(")) {
    const match = resolved.match(/var\(([^)]+)\)/);
    if (match && match[1]) {
      const varName = match[1].trim();
      let computed = typeof window !== "undefined"
        ? window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
        : "";
      if (!computed) {
        computed = THEME_FALLBACKS[varName] || "";
      }
      if (computed) {
        resolved = computed;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return resolved;
}

export default function MusicVisualizer({ variant = "orbit", interactive = false, className = "" }) {
  const canvasRef = useRef(null);
  const music = useMusic();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    let frame = music.visualBus.getFrame();
    let drawId = 0;
    const draw = () => {
      drawId = 0;
      const parent = canvas.parentElement || canvas;
      const rect = parent.getBoundingClientRect();
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.clearRect(0, 0, width, height);
      const bins = frame.bins || [];
      if (!bins.length || music.visualPreferences.visualizer === "off") return;
      const intensity = Math.max(0, Math.min(1, music.visualPreferences.intensity / 100));
      const surface = canvas.closest(".music-core-page, .music-core-stage, .music-listening-orbit, .music-player-bar, .glass-music-player");
      surface?.style.setProperty("--music-bass", String(frame.bass * intensity));
      surface?.style.setProperty("--music-mids", String(frame.mids * intensity));
      surface?.style.setProperty("--music-treble", String(frame.treble * intensity));
      surface?.style.setProperty("--music-energy", String(frame.energy * intensity));
      const styles = window.getComputedStyle(canvas);
      const primaryVar = styles.getPropertyValue("--mp-primary").trim() || styles.getPropertyValue("--music-reactive-primary").trim() || styles.getPropertyValue("--music-violet").trim();
      const spectralVar = styles.getPropertyValue("--mp-spectral").trim() || styles.getPropertyValue("--music-reactive-spectral").trim() || styles.getPropertyValue("--music-waveform").trim() || styles.getPropertyValue("--music-highlight").trim();
      const primary = resolveColor(primaryVar);
      const spectral = resolveColor(spectralVar);
      context.lineWidth = Math.max(1.4, ratio * 1.4);
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, primary); gradient.addColorStop(1, spectral);
      context.strokeStyle = gradient;
      context.globalAlpha = 0.42 + frame.energy * 0.5;
      const count = variant === "compact" ? 28 : Math.min(72, bins.length);
      if (variant === "bars") {
        context.fillStyle = gradient;
        const barWidth = width / count;
        for (let index = 0; index < count; index += 1) {
          const value = bins[Math.floor(index * bins.length / count)] / 255;
          const heightValue = Math.max(ratio, value * height * .72 * intensity);
          context.fillRect(index * barWidth, height - heightValue, Math.max(1, barWidth - ratio * 2), heightValue);
        }
        return;
      }
      if (variant === "orbit") {
        const cx = width / 2, cy = height * .43, radius = Math.min(width, height) * .28;
        context.beginPath();
        for (let index = 0; index <= count; index += 1) {
          const angle = index / count * Math.PI * 2;
          const value = bins[Math.floor((index % count) * bins.length / count)] / 255;
          const r = radius + value * Math.min(width, height) * .08 * intensity;
          const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r * .72;
          if (!index) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.closePath(); context.stroke(); return;
      }
      context.beginPath();
      for (let index = 0; index < count; index += 1) {
        const value = bins[Math.floor(index * bins.length / count)] / 255;
        const x = index * width / Math.max(1, count - 1);
        const center = height / 2;
        const amplitude = Math.max(1, value * height * (variant === "orbit" ? 0.38 : 0.44));
        if (index === 0) context.moveTo(x, center - amplitude);
        else context.lineTo(x, center - amplitude);
      }
      for (let index = count - 1; index >= 0; index -= 1) {
        const value = bins[Math.floor(index * bins.length / count)] / 255;
        context.lineTo(index * width / Math.max(1, count - 1), height / 2 + Math.max(1, value * height * 0.28));
      }
      context.stroke();
    };
    const unsubscribe = music.visualBus.subscribe((next) => { frame = next; if (!drawId) drawId = requestAnimationFrame(draw); });
    draw();
    const resize = new ResizeObserver(draw); resize.observe(canvas.parentElement || canvas);
    return () => { unsubscribe(); resize.disconnect(); cancelAnimationFrame(drawId); };
  }, [music.visualBus, music.visualPreferences.visualizer, variant]);
  return <canvas ref={canvasRef} className={`music-visualizer music-visualizer-${variant} ${className}`} aria-hidden={!interactive} />;
}
