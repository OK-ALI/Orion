import { useEffect, useState } from "react";
import { deterministicPalette } from "../visual/artworkPalette";

export default function MusicArtwork({ track, currentArtwork, className = "", label = "", children }) {
  const [url, setUrl] = useState(currentArtwork?.url || "");
  const palette = currentArtwork?.palette || deterministicPalette(`${track?.artistName}:${track?.albumTitle}:${track?.title}`);
  useEffect(() => {
    if (currentArtwork?.url) { setUrl(currentArtwork.url); return undefined; }
    let cancelled = false;
    setUrl("");
    if (track) window.electron?.musicGetArtwork?.(track).then((result) => { if (!cancelled && result?.ok) setUrl(result.url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [track?.id, track?.artworkUrl, track?.profileImageUrl, track?.thumbnail, currentArtwork?.url]);
  return <span className={`music-artwork ${className}`} role={label ? "img" : undefined} aria-label={label || undefined}
    style={{ "--art-base": palette.base, "--art-primary": palette.primary, "--art-spectral": palette.spectral,
      ...(url ? { backgroundImage: `url(${url})` } : {}) }}>
    {!url && <span className="music-generated-stars" aria-hidden="true"><i /><i /><i /><i /></span>}{children}
  </span>;
}
