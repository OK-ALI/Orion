import { useEffect, useState } from "react";
import { deterministicPalette } from "../visual/artworkPalette";

export default function MusicArtwork({ track, currentArtwork, className = "", label = "", children, variant = "track", fit = "cover" }) {
  const [url, setUrl] = useState(currentArtwork?.url || "");
  const [status, setStatus] = useState(currentArtwork?.url ? "ready" : "loading");
  const palette = currentArtwork?.palette || deterministicPalette(`${track?.artistName}:${track?.albumTitle}:${track?.title}`);
  useEffect(() => {
    if (currentArtwork?.url) { setUrl(currentArtwork.url); setStatus("ready"); return undefined; }
    let cancelled = false;
    setUrl("");
    setStatus(track ? "loading" : "error");
    if (track) window.electron?.musicGetArtwork?.(track).then((result) => {
      if (cancelled) return;
      if (result?.ok) { setUrl(result.url); setStatus("ready"); }
      else setStatus("error");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [track?.id, track?.artworkUrl, track?.profileImageUrl, track?.thumbnail, currentArtwork?.url]);
  return <span className={`music-artwork is-${variant} fit-${fit} artwork-${status} ${className}`} role={label ? "img" : undefined} aria-label={label || undefined}
    style={{ "--art-base": palette.base, "--art-primary": palette.primary, "--art-spectral": palette.spectral,
      ...(url ? { backgroundImage: `url(${url})` } : {}) }}>
    {!url && status === "loading" && <span className="music-artwork-shimmer" aria-hidden="true" />}
    {!url && status === "error" && <span className="music-generated-stars" aria-hidden="true"><i /><i /><i /><i /></span>}{children}
  </span>;
}
