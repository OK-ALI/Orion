const ORION_TRAILER_ORIGIN = "https://com.okali.orion";
const ORION_TRAILER_REFERRER = `${ORION_TRAILER_ORIGIN}/`;

export function createTrailerDirectUrl(candidate, { privacyEnhanced = false } = {}) {
  if (!candidate) return "";
  if (candidate.site === "Vimeo") {
    const params = new URLSearchParams({ autoplay: "1", playsinline: "1", dnt: "1", api: "1" });
    return `https://player.vimeo.com/video/${encodeURIComponent(candidate.providerKey)}?${params.toString()}`;
  }
  const params = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    controls: "1",
    rel: "0",
    fs: "1",
    origin: ORION_TRAILER_ORIGIN,
    widget_referrer: ORION_TRAILER_REFERRER,
  });
  const host = privacyEnhanced ? "www.youtube-nocookie.com" : "www.youtube.com";
  return `https://${host}/embed/${encodeURIComponent(candidate.providerKey)}?${params.toString()}`;
}

export function createTrailerWrapperUrl(candidate, { privacyEnhanced = false } = {}) {
  if (!candidate) return "";
  const provider = candidate.site === "Vimeo" ? "vimeo" : "youtube";
  const candidateId = candidate.id || `${provider}:${candidate.providerKey}`;
  const params = new URLSearchParams({
    provider,
    candidate: candidateId,
    key: candidate.providerKey,
  });
  if (provider === "youtube" && privacyEnhanced) params.set("privacy", "1");
  return `orion-trailer://player/embed?${params.toString()}`;
}

export function createTrailerEmbedUrl(candidate, transport = "wrapper") {
  return transport === "direct"
    ? createTrailerDirectUrl(candidate)
    : createTrailerWrapperUrl(candidate);
}

export function createTrailerExternalUrl(candidate) {
  if (!candidate) return "";
  return candidate.site === "Vimeo"
    ? `https://vimeo.com/${encodeURIComponent(candidate.providerKey)}`
    : `https://www.youtube.com/watch?v=${encodeURIComponent(candidate.providerKey)}`;
}

export function classifyYouTubeError(code) {
  const numeric = Number(code);
  if (numeric === 2) return { provider: "YouTube", category: "invalid-request", publicCode: 2, retryable: false };
  if (numeric === 5) return { provider: "YouTube", category: "html5-playback", publicCode: 5, retryable: true };
  if (numeric === 100) return { provider: "YouTube", category: "removed", publicCode: 100, retryable: false };
  if (numeric === 101 || numeric === 150) return { provider: "YouTube", category: "embed-disabled", publicCode: numeric, retryable: false };
  if (numeric === 153) return { provider: "YouTube", category: "client-identity", publicCode: 153, retryable: true };
  return { provider: "YouTube", category: "provider-error", publicCode: code ?? null, retryable: false };
}

export function classifyVimeoError(code) {
  const value = String(code || "provider-error");
  const embed = /privacy|embed|permission/i.test(value);
  return { provider: "Vimeo", category: embed ? "embed-disabled" : "provider-error", publicCode: value, retryable: false };
}
