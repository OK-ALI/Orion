/**
 * Orion Design Tokens — Typography
 *
 * Font families, sizes, weights, and line heights extracted from tokens.css.
 */

// ── Font Families ────────────────────────────────────────────────────────────
export const fontFamilies = {
  body: "Inter",
  heading: "Space Grotesk",
  display: "Outfit",
  stats: "Space Grotesk",
} as const;

/**
 * Full CSS font-family stacks for desktop (web) usage.
 * Mobile uses only the primary family name via expo-font / react-native asset linking.
 */
export const fontFamilyStacks = {
  body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  heading: '"Space Grotesk", "Inter", -apple-system, sans-serif',
  display: '"Outfit", "Space Grotesk", sans-serif',
} as const;

// ── Font Sizes (px values — mobile will convert to scalable units) ───────────
export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  hero: 52,
} as const;

// ── Font Weights ─────────────────────────────────────────────────────────────
export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// ── Line Heights ─────────────────────────────────────────────────────────────
export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.65,
} as const;

// ── Letter Spacing ───────────────────────────────────────────────────────────
export const letterSpacing = {
  /** Cinematic weight for headers, as specified in mobile specs */
  heading: -0.02,
  normal: 0,
} as const;

export type FontSize = keyof typeof fontSizes;
export type FontWeight = keyof typeof fontWeights;
