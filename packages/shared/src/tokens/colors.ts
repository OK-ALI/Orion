/**
 * Orion Design Tokens — Colors
 *
 * Extracted from the desktop tokens.css design system.
 * Consumable by both CSS (desktop) and React Native StyleSheet (mobile).
 */

// ── Backgrounds — layered dark ───────────────────────────────────────────────
export const backgrounds = {
  base: "#08070c",
  elevated: "#100e17",
  surface: "#191622",
  hover: "#252033",
  input: "#14111c",
} as const;

// ── Accent ───────────────────────────────────────────────────────────────────
export const accent = {
  primary: "#E50914",
  hover: "#F6121D",
  soft: "rgba(229, 9, 20, 0.14)",
  glow: "rgba(229, 9, 20, 0.38)",
} as const;

// ── Signature colors ─────────────────────────────────────────────────────────
export const signature = {
  spectral: "#67e8f9",
  focusRing: "#67e8f9",
  cinemaGold: "#e5bd73",
  cinemaVelvet: "#5b214f",
} as const;

// ── Music Planet palette ─────────────────────────────────────────────────────
export const music = {
  violet: "#8b5cf6",
  magenta: "#d946ef",
  highlight: "#e8e5ee",
  onMedia: "#ffffff",
} as const;

// ── Text ─────────────────────────────────────────────────────────────────────
export const text = {
  primary: "#f0f0f5",
  secondary: "#a0a0b0",
  muted: "#606078",
  disabled: "#3a3a4a",
} as const;

// ── Borders ──────────────────────────────────────────────────────────────────
export const borders = {
  default: "rgba(255, 255, 255, 0.07)",
  hover: "rgba(255, 255, 255, 0.14)",
  accent: "rgba(229, 9, 20, 0.4)",
} as const;

// ── Semantic ─────────────────────────────────────────────────────────────────
export const semantic = {
  success: "#48c774",
  successSoft: "rgba(72, 199, 116, 0.12)",
  warning: "#ffb845",
  warningSoft: "rgba(255, 184, 69, 0.12)",
  danger: "#ff4757",
  dangerSoft: "rgba(255, 71, 87, 0.12)",
} as const;

// ── Glassmorphism ────────────────────────────────────────────────────────────
export const glass = {
  bg: "rgba(18, 18, 26, 0.88)",
  border: "rgba(255, 255, 255, 0.06)",
  blur: 20,
} as const;

// ── Media / Overlay ──────────────────────────────────────────────────────────
export const overlay = {
  onAccent: "#ffffff",
  onMedia: "#ffffff",
  mediaBlack: "#000000",
  mediaScrim: "rgba(4, 6, 12, 0.78)",
  mediaScrimSoft: "rgba(4, 6, 12, 0.48)",
  backdrop: "rgba(2, 4, 10, 0.82)",
} as const;

// ── Provider colors ──────────────────────────────────────────────────────────
export const providers = {
  subdl: "#7da5ff",
  subdlSoft: "rgba(99, 149, 255, 0.12)",
  wyzie: "#b993ff",
  wyzieSoft: "rgba(180, 130, 255, 0.12)",
  stream: "#a6b0bd",
  streamSoft: "rgba(166, 176, 189, 0.10)",
} as const;

/**
 * Flat color map for easy lookup by token name.
 * Useful for dynamic theming and programmatic access.
 */
export const colors = {
  ...backgrounds,
  ...accent,
  ...signature,
  ...music,
  ...text,
  ...semantic,
  ...glass,
  ...overlay,
  ...providers,
} as const;

export type OrionColor = keyof typeof colors;
