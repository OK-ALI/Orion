export const PLAYLIST_ARTWORK_PRESETS = [
  { id: "orion-glow", label: "Orion Glow" },
  { id: "velvet-orbit", label: "Velvet Orbit" },
  { id: "signal-bloom", label: "Signal Bloom" },
  { id: "night-drive", label: "Night Drive" },
  { id: "solar-dust", label: "Solar Dust" },
  { id: "monochrome", label: "Monochrome" },
];

function stableIndex(value, size) {
  let hash = 0;
  for (const char of String(value || "Orion")) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % Math.max(1, size);
}

export function playlistArtworkPreset(playlist) {
  if (playlist?.artwork?.kind === "preset" && playlist.artwork.preset) return playlist.artwork.preset;
  return PLAYLIST_ARTWORK_PRESETS[
    stableIndex(`${playlist?.id || ""}:${playlist?.name || ""}`, PLAYLIST_ARTWORK_PRESETS.length)
  ].id;
}

export function playlistArtworkMode(playlist) {
  if (playlist?.artwork?.kind === "custom" && playlist.artwork.dataUrl) return "custom";
  if (playlist?.artwork?.kind === "preset") return "preset";
  return playlist?.items?.length ? "mosaic" : "preset";
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be decoded."));
    image.src = dataUrl;
  });
}

export async function customPlaylistArtworkFromFile(file) {
  if (!file || !String(file.type || "").startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Artwork images must be 12 MB or smaller.");

  const source = await fileAsDataUrl(file);
  const image = await loadImage(source);
  const side = Math.max(1, Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const sx = Math.max(0, ((image.naturalWidth || image.width) - side) / 2);
  const sy = Math.max(0, ((image.naturalHeight || image.height) - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Artwork processing is unavailable.");
  context.drawImage(image, sx, sy, side, side, 0, 0, 640, 640);

  let dataUrl = canvas.toDataURL("image/webp", 0.86);
  if (dataUrl.length > 520000) {
    canvas.width = 512;
    canvas.height = 512;
    context.drawImage(image, sx, sy, side, side, 0, 0, 512, 512);
    dataUrl = canvas.toDataURL("image/webp", 0.72);
  }

  return {
    kind: "custom",
    dataUrl,
    name: String(file.name || "Custom artwork").slice(0, 120),
  };
}
