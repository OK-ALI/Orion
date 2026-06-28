function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

function extractPaletteFromBitmap(pixels) {
  const buckets = new Map();
  for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
    const b = pixels[offset];
    const g = pixels[offset + 1];
    const r = pixels[offset + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luminance = (max + min) / 2;
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (luminance < 16 || luminance > 242 || saturation < 0.09) continue;
    const qr = Math.min(255, Math.round(r / 32) * 32);
    const qg = Math.min(255, Math.round(g / 32) * 32);
    const qb = Math.min(255, Math.round(b / 32) * 32);
    const key = `${qr},${qg},${qb}`;
    buckets.set(key, (buckets.get(key) || 0) + 1 + saturation * 3);
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return ["#6d4aff", "#1697b7"];
  const first = ranked[0][0].split(",").map(Number);
  const secondEntry = ranked.find(([key]) => {
    const color = key.split(",").map(Number);
    return Math.abs(color[0] - first[0]) + Math.abs(color[1] - first[1]) + Math.abs(color[2] - first[2]) > 100;
  }) || ranked[1] || ranked[0];
  return [rgbToHex(...first), rgbToHex(...secondEntry[0].split(",").map(Number))];
}

module.exports = { extractPaletteFromBitmap };
