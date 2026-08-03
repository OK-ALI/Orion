import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import {
  applyAccentColor,
  applyFontPreset,
  applyInteractionAppearance,
  applyTheme,
} from "../../shared/utils/appearance";

/**
 * Applies persisted appearance before React paints the first application frame.
 * Keeping this work synchronous prevents a default-theme flash during startup.
 */
export function applyStoredAppearance() {
  const accent = storage.get(STORAGE_KEYS.ACCENT_COLOR) || "orion";
  const glowStrength = storage.get(STORAGE_KEYS.CINEMA_GLOW_STRENGTH) ?? 50;
  const theme = storage.get(STORAGE_KEYS.THEME) || "dark";
  const customVars = storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || null;
  const reducedMotion = !!storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS);

  applyTheme(theme, customVars);
  applyAccentColor(accent, glowStrength);
  applyFontPreset(storage.get(STORAGE_KEYS.FONT_PRESET) || "orion");
  applyInteractionAppearance({
    preset: storage.get(STORAGE_KEYS.INTERACTION_HOVER_PRESET) || "balanced",
    override: storage.get(STORAGE_KEYS.INTERACTION_HOVER_COLOR) || "",
    strength: storage.get(STORAGE_KEYS.INTERACTION_GLOW_STRENGTH) ?? 50,
    accentId: accent,
    themeId: theme,
  });

  const font = storage.get(STORAGE_KEYS.FONT_SIZE) || "normal";
  const zoomMap = { sm: 0.85, normal: 1, lg: 1.15 };
  window.electron?.setZoomFactor?.(zoomMap[font] ?? 1);

  document.body.classList.toggle("compact-mode", !!storage.get(STORAGE_KEYS.COMPACT_MODE));
  document.body.classList.toggle("no-anim", reducedMotion);
  const motion = reducedMotion
    ? "calm"
    : storage.get(STORAGE_KEYS.MOTION_PRESET) || "balanced";
  document.body.dataset.motion = motion;
  document.documentElement.dataset.motion = motion;
  document.body.dataset.background = storage.get(STORAGE_KEYS.BACKGROUND_SCENE) || "orbit";

  return { accent, reducedMotion, theme };
}
