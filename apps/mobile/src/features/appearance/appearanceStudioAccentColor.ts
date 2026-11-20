export interface AccentHsv {
  hue: number;
  saturation: number;
  brightness: number;
}

export const ACCENT_HUES = [
  "Red", "Orange", "Yellow", "Lime", "Green", "Mint",
  "Cyan", "Sky", "Blue", "Violet", "Magenta", "Rose",
] as const;

export const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));
const wrapHue = (value: number) => ((value % 360) + 360) % 360;

export function hueIndex(hue: number): number {
  return Math.round(wrapHue(hue) / 30) % ACCENT_HUES.length;
}

export function hexToAccentHsv(hex: string, neutralHue = 0): AccentHsv {
  const [r, g, b] = [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  let hue = neutralHue;
  if (span > 0) {
    if (max === r) hue = 60 * ((g - b) / span);
    else if (max === g) hue = 60 * ((b - r) / span + 2);
    else hue = 60 * ((r - g) / span + 4);
  }
  return { hue: wrapHue(hue), saturation: max > 0 ? span / max * 100 : 0, brightness: max * 100 };
}

export function accentHsvToHex({ hue, saturation, brightness }: AccentHsv): string {
  const value = clampPercent(brightness) / 100;
  const chroma = value * clampPercent(saturation) / 100;
  const sector = wrapHue(hue) / 60;
  const secondary = chroma * (1 - Math.abs(sector % 2 - 1));
  const vectors = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary],
    [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]];
  return "#" + vectors[Math.floor(sector)].map(channel =>
    Math.round((channel + value - chroma) * 255).toString(16).padStart(2, "0"),
  ).join("").toUpperCase();
}

export function accentFromArea(hue: number, x: number, y: number, width: number, height: number): AccentHsv | null {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { hue, saturation: clampPercent(x / width * 100), brightness: clampPercent((1 - y / height) * 100) };
}

export function describeAccent(hex: string): string {
  const { hue, saturation, brightness } = hexToAccentHsv(hex);
  if (brightness === 0) return "Black";
  if (saturation === 0) {
    if (brightness === 100) return "White";
    return brightness < 45 ? "Dark gray" : "Gray";
  }
  const shade = brightness < 40 ? "Dark " : saturation < 35 ? "Soft " : "";
  const name = ACCENT_HUES[hueIndex(hue)];
  return shade ? shade + name.toLowerCase() : name;
}

export function storedPickerAccent(hex: string, opening: string | null, defaultAccent: string): string | null {
  if (hex === (opening ?? defaultAccent)) return opening;
  return hex === defaultAccent ? null : hex;
}
