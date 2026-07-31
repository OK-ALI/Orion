const FALLBACKS = [
  ["var(--music-palette-base-1)", "var(--music-palette-primary-1)", "var(--music-palette-spectral-1)"],
  ["var(--music-palette-base-2)", "var(--music-palette-primary-2)", "var(--music-palette-spectral-2)"],
  ["var(--music-palette-base-3)", "var(--music-palette-primary-3)", "var(--music-palette-spectral-3)"],
  ["var(--music-palette-base-4)", "var(--music-palette-primary-4)", "var(--music-palette-spectral-4)"],
];

function hash(value) {
  let output = 2166136261;
  for (const char of String(value || "orion")) output = Math.imul(output ^ char.charCodeAt(0), 16777619);
  return Math.abs(output);
}

export function neutralizeMusicHighlight(color) {
  if (!color) return color;
  const { r, g, b } = color;
  const cyanDominant = g > r * 1.18 && b > r * 1.18 && Math.abs(g - b) < 105;
  if (!cyanDominant) return color;
  const luminance = Math.max(r, g, b) / 255;
  return {
    r: Math.round(126 + luminance * 42),
    g: Math.round(104 + luminance * 26),
    b: Math.round(190 + luminance * 52),
    score: color.score,
  };
}

export function deterministicPalette(seed) {
  const [base, primary, spectral] = FALLBACKS[hash(seed) % FALLBACKS.length];
  return { base, primary, spectral, foreground: "var(--on-media)", contrast: "dark", generated: true };
}

export async function extractArtworkPalette(url, seed) {
  if (!url) return deterministicPalette(seed);
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 24; canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 24, 24);
    const pixels = context.getImageData(0, 0, 24, 24).data;
    const colors = [];
    for (let index = 0; index < pixels.length; index += 16) {
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max < 30 || max > 242 || max - min < 18) continue;
      colors.push({ r, g, b, score: (max - min) * (0.5 + max / 255) });
    }
    colors.sort((a, b) => b.score - a.score);
    const first = neutralizeMusicHighlight(colors[0]);
    const second = neutralizeMusicHighlight(colors.find((color) => colors[0] && Math.abs(color.r - colors[0].r) + Math.abs(color.g - colors[0].g) + Math.abs(color.b - colors[0].b) > 90) || colors[1]);
    if (!first) return deterministicPalette(seed);
    const srgb = (color, scale = 1) => `color(srgb ${color.r / 255 * scale} ${color.g / 255 * scale} ${color.b / 255 * scale})`;
    return { base: srgb(first, .12), primary: srgb(first), spectral: srgb(second || first), foreground: "var(--on-media)", contrast: "dark", generated: false };
  } catch { return deterministicPalette(seed); }
}
