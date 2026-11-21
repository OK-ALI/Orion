import type { MobileThemeTokens } from "../../context/ThemeContext";
import { studioContrast as paletteContrast, studioLuminance } from "./appearanceStudioContrast";

export { paletteContrast };

export const CUSTOM_PALETTE_ROLES = ["accent", "background", "surface", "text", "border"] as const;
export type CustomPaletteRole = typeof CUSTOM_PALETTE_ROLES[number];
export type CustomPaletteProfile = "light" | "dark";
export type CustomPaletteOverrides = Record<CustomPaletteRole, string | null>;
export type PaletteIssue = { role: CustomPaletteRole; code: "invalid-hex" | "scheme-luminance" | "text-contrast" };
export type PaletteRoleColor = {
  requestedColor: string | null;
  inheritedColor: string;
  effectiveColor: string;
  adjusted: boolean;
};

export type CustomPaletteResolution = {
  palette: MobileThemeTokens;
  roles: Record<CustomPaletteRole, PaletteRoleColor>;
  issues: PaletteIssue[];
  warnings: { role: CustomPaletteRole; code: "contrast-adjusted" }[];
};

const LIGHT_MIN = 0.1834;
const DARK_MAX = 0.175;
const TEXT_MIN = 4.5;
const CONTROL_MIN = 3;
const WHITE = "#FFFFFF";
const BLACK = "#000000";

export function inheritedCustomPalette(): CustomPaletteOverrides {
  return { accent: null, background: null, surface: null, text: null, border: null };
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function rgb(color: string): number[] {
  return [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
}

function hex(channels: number[]): string {
  return "#" + channels.map(value => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function blend(base: number[], color: number[], alpha: number): string {
  return hex(base.map((value, index) => value + (color[index] - value) * alpha));
}

function mix(base: string, color: string, alpha: number): string {
  return blend(rgb(base), rgb(color), alpha);
}

/** The mobile base palettes use six-digit HEX and rgba tokens. */
export function compositePaletteColor(color: string, backdrop: string): string {
  if (isHexColor(color)) return color.toUpperCase();
  const channels = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(color);
  if (!channels) throw new Error("Unsupported palette color");
  return blend(rgb(backdrop), channels.slice(1, 4).map(Number), Number(channels[4]));
}

export function paletteColorMatchesScheme(color: string, scheme: CustomPaletteProfile): boolean {
  if (!isHexColor(color)) return false;
  const luminance = studioLuminance(color);
  return scheme === "light" ? luminance >= LIGHT_MIN : luminance <= DARK_MAX;
}

function toneToward(color: string, neutral: string, keep: (candidate: string) => boolean): string {
  if (keep(color)) return color;
  const from = rgb(color);
  const to = rgb(neutral);
  for (let step = 1; step < 64; step++) {
    const candidate = blend(from, to, step / 64);
    if (keep(candidate)) return candidate;
  }
  return neutral;
}

function readable(color: string, surfaces: readonly string[], minimum: number): boolean {
  return surfaces.every(surface => paletteContrast(compositePaletteColor(color, surface), surface) >= minimum);
}

function derive(base: MobileThemeTokens, scheme: CustomPaletteProfile, overrides: CustomPaletteOverrides) {
  const issues: PaletteIssue[] = [];
  const colors = { ...overrides };
  for (const role of CUSTOM_PALETTE_ROLES) {
    if (colors[role] !== null && !isHexColor(colors[role])) {
      issues.push({ role, code: "invalid-hex" });
      colors[role] = null;
    }
  }

  const dark = scheme === "dark";
  const neutral = dark ? WHITE : BLACK;
  const background = colors.background ?? base.background;
  const surface = colors.surface ?? base.surface;
  for (const role of ["background", "surface"] as const) {
    if (!paletteColorMatchesScheme(colors[role] ?? base[role], scheme)) {
      issues.push({ role, code: "scheme-luminance" });
    }
  }

  const changedSurfaces = colors.background !== null || colors.surface !== null;
  const elevated = changedSurfaces
    ? dark ? mix(background, surface, 0.55) : mix(background, WHITE, 0.55)
    : base.elevated;
  const input = changedSurfaces
    ? dark ? mix(background, surface, 0.72) : mix(surface, WHITE, 0.72)
    : base.input;
  const hover = mix(surface, neutral, dark ? 0.08 : 0.06);
  const surfaceHover = changedSurfaces
    ? paletteColorMatchesScheme(hover, scheme) ? hover : surface
    : base.surfaceHover;
  const surfaces = [...new Set([background, surface, elevated, input, surfaceHover])];
  const proposedText = colors.text ?? base.text;
  const textReadable = readable(proposedText, surfaces, TEXT_MIN);
  if (colors.text !== null && !textReadable) issues.push({ role: "text", code: "text-contrast" });
  const text = textReadable ? proposedText : neutral;

  const accent = toneToward(colors.accent ?? base.accent, neutral, color => readable(color, surfaces, TEXT_MIN));
  const [r, g, b] = rgb(accent);
  const softAlpha = dark ? 16 : 12;
  let accentSoft = `rgba(${r},${g},${b},0)`;
  let tints: string[] = [];
  for (let alpha = softAlpha; alpha > 0; alpha--) {
    const fill = `rgba(${r},${g},${b},${alpha / 100})`;
    const composites = surfaces.map(backdrop => compositePaletteColor(fill, backdrop));
    if (composites.every(color => paletteColorMatchesScheme(color, scheme))
        && readable(text, composites, TEXT_MIN) && readable(accent, composites, TEXT_MIN)) {
      accentSoft = fill;
      tints = composites;
      break;
    }
  }

  const owned = [...new Set([...surfaces, ...tints])];
  const nominalBorder = colors.border ?? base.border;
  const border = readable(nominalBorder, owned, CONTROL_MIN)
    ? nominalBorder
    : toneToward(compositePaletteColor(nominalBorder, surface), neutral, color => readable(color, owned, CONTROL_MIN));

  const readableText = (color: string) => toneToward(color, neutral, value => readable(value, owned, TEXT_MIN));
  const palette: MobileThemeTokens = {
    ...base, dark, background, surface, elevated, input, surfaceHover, text, accent, accentSoft,
    border, onAccent: paletteContrast(BLACK, accent) > paletteContrast(WHITE, accent) ? BLACK : WHITE,
    textSecondary: readableText(base.textSecondary), textMuted: readableText(base.textMuted),
    success: readableText(base.success), warning: readableText(base.warning), danger: readableText(base.danger),
  };
  return { palette, issues };
}

function describeRoles(base: MobileThemeTokens, overrides: CustomPaletteOverrides, palette: MobileThemeTokens) {
  const describe = (role: CustomPaletteRole): PaletteRoleColor => ({
    requestedColor: overrides[role],
    inheritedColor: base[role],
    effectiveColor: palette[role],
    adjusted: (overrides[role] ?? base[role]).toUpperCase() !== palette[role].toUpperCase(),
  });
  return {
    accent: describe("accent"), background: describe("background"), surface: describe("surface"),
    text: describe("text"), border: describe("border"),
  };
}

export function describeCustomPalette(
  base: MobileThemeTokens, overrides: CustomPaletteOverrides, palette: MobileThemeTokens, issues: PaletteIssue[] = [],
): CustomPaletteResolution {
  const roles = describeRoles(base, overrides, palette);
  const warnings = (["accent", "border"] as const)
    .filter(role => roles[role].adjusted)
    .map(role => ({ role, code: "contrast-adjusted" as const }));
  return { palette, roles, issues, warnings };
}

/** Failed stored palettes get a safe display projection while their requested values remain available for repair. */
export function resolveAdaptiveCustomPalette(
  base: MobileThemeTokens, scheme: CustomPaletteProfile, overrides: CustomPaletteOverrides,
): CustomPaletteResolution {
  const result = derive(base, scheme, overrides);
  const palette = result.issues.length ? derive(base, scheme, inheritedCustomPalette()).palette : result.palette;
  return describeCustomPalette(base, overrides, palette, result.issues);
}
