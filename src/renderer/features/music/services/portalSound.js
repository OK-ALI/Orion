import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import cinemaToMusicSound from "../../../assets/music/cinema-to-music.mp3";
import musicToCinemaSound from "../../../assets/music/music-to-cinema.mp3";

function playRecordedPortal(source, volume, fallback) {
  const audio = new Audio(source);
  audio.preload = "auto";
  // The supplied transition assets are deliberately mastered softly. Give the
  // portal control a modest, bounded gain so its default setting is audible
  // over Orion's scene without overriding the user's system volume.
  audio.volume = Math.max(0, Math.min(1, volume * 2.25));
  audio.play().catch(fallback);
}

function playSyntheticFallback(direction, volume) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try {
    const context = new Context({ latencyHint: "interactive" });
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.28), context.currentTime + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.62);
    gain.connect(context.destination);
    [0, 1].forEach((index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index ? "sine" : "triangle";
      const start = direction === "music" ? 196 : 294;
      const end = direction === "music" ? 392 : 147;
      oscillator.frequency.setValueAtTime(start * (index ? 1.5 : 1), context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(end * (index ? 1.5 : 1), context.currentTime + 0.48);
      oscillator.connect(gain); oscillator.start(); oscillator.stop(context.currentTime + 0.64);
    });
    window.setTimeout(() => context.close().catch(() => {}), 800);
  } catch {}
}

export function playPortalSound(direction = "music") {
  if (storage.get(STORAGE_KEYS.MUSIC_PORTAL_SOUND) === false) return;
  const reduced = storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduced) return;
  const volume = Math.max(0, Math.min(1, Number(storage.get(STORAGE_KEYS.MUSIC_PORTAL_VOLUME) ?? 45) / 100));
  const source = direction === "music" ? cinemaToMusicSound : musicToCinemaSound;
  playRecordedPortal(source, volume, () => playSyntheticFallback(direction, volume));
}
