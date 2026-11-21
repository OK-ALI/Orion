import type { MobileThemeTokens } from "../../context/ThemeContext";

function rgb(hex: string): number[] {
  return [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
}

export function studioLuminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(value => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function studioContrast(first: string, second: string): number {
  const a = studioLuminance(first);
  const b = studioLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function studioReadableForeground(background: string, preferred: string, minimum = 4.5): string {
  if (studioContrast(preferred, background) >= minimum) return preferred;
  return studioContrast("#FFFFFF", background) > studioContrast("#000000", background) ? "#FFFFFF" : "#000000";
}

/** Keep the applied hue and move it only as far toward light or dark as readability requires. */
export function studioAccentForeground(theme: MobileThemeTokens, background: string, minimum = 4.5): string {
  if (studioContrast(theme.accent, background) >= minimum) return theme.accent;
  const fallback = studioReadableForeground(background, theme.text, minimum);
  const channels = rgb(theme.accent);
  const target = rgb(fallback);
  for (let step = 1; step < 20; step++) {
    const adjusted = "#" + channels.map((value, index) =>
      Math.round(value + (target[index] - value) * (step / 20)).toString(16).padStart(2, "0"),
    ).join("").toUpperCase();
    if (studioContrast(adjusted, background) >= minimum) return adjusted;
  }
  return fallback;
}

export function getStudioAccentNotice(theme: MobileThemeTokens): string | null {
  if (theme.id !== "custom") return null;
  if (studioContrast(theme.accent, theme.surface) < 3 || studioContrast(theme.onAccent, theme.accent) < 4.5) {
    return "This accent may be hard to distinguish in Orion. Check the preview or choose a different color.";
  }
  if (theme.onAccent.toUpperCase() === "#000000") {
    return "This accent uses dark button text. Check its readability on artwork and other screens.";
  }
  return null;
}
