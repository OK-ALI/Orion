/**
 * Orion Design Tokens — Spacing, Radii, Shadows, Transitions
 *
 * Extracted from tokens.css design system.
 */

// ── Spacing scale ────────────────────────────────────────────────────────────
export const spacing = {
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ── Border Radii ─────────────────────────────────────────────────────────────
export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ── Shadows ──────────────────────────────────────────────────────────────────
export const shadows = {
  sm: { offsetX: 0, offsetY: 2, blur: 8, color: "rgba(0, 0, 0, 0.3)" },
  md: { offsetX: 0, offsetY: 8, blur: 24, color: "rgba(0, 0, 0, 0.4)" },
  lg: { offsetX: 0, offsetY: 16, blur: 48, color: "rgba(0, 0, 0, 0.5)" },
  xl: { offsetX: 0, offsetY: 24, blur: 64, color: "rgba(0, 0, 0, 0.6)" },
} as const;

/**
 * CSS box-shadow strings for desktop usage.
 */
export const shadowsCss = {
  sm: "0 2px 8px rgba(0, 0, 0, 0.3)",
  md: "0 8px 24px rgba(0, 0, 0, 0.4)",
  lg: "0 16px 48px rgba(0, 0, 0, 0.5)",
  xl: "0 24px 64px rgba(0, 0, 0, 0.6)",
  glow: "0 0 30px rgba(139, 92, 246, 0.38)",
} as const;

// ── Transitions / Easings ────────────────────────────────────────────────────
export const easings = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const durations = {
  fast: 150,
  normal: 250,
  slow: 400,
  world: 760,
} as const;

// ── Layout constants ─────────────────────────────────────────────────────────
export const layout = {
  /** Desktop sidebar widths */
  sidebarCompactWidth: 60,
  sidebarExpandedWidth: 224,
  sidebarRailWidth: 52,
  sidebarTransitionDuration: 220,
  titlebarHeight: 38,
  /** Media card sizes */
  mediaCardCompact: 154,
  mediaCardStandard: 176,
  mediaCardCollection: 164,
} as const;

// ── Interaction tokens ───────────────────────────────────────────────────────
export const interaction = {
  liftPx: -4,
  scale: 1.02,
  glowBlur: 30,
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiiKey = keyof typeof radii;
