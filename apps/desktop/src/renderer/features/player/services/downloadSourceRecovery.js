import { getEffectivePlayerSources, getCinemaSourceRuntimeHealth } from "../sources/registry";

export const MAX_DOWNLOAD_SOURCE_ATTEMPTS = 3;
export const DOWNLOAD_SOURCE_ATTEMPT_MS = 30_000;

export function nextDownloadRecoverySource(mediaType, attempted) {
  const now = Date.now();
  const candidates = getEffectivePlayerSources().filter((source) => {
    const health = getCinemaSourceRuntimeHealth(source.id, mediaType);
    return source.supportsDownloads === true
      && (mediaType === "movie" ? source.media?.movie : source.media?.tv)
      && !attempted.has(source.id)
      && (!health?.cooldownUntil || health.cooldownUntil <= now);
  });
  return candidates.sort((left, right) => {
    const priority = (source) => source.routingMode === "automatic" ? 0 : source.id === "vidsrc" ? 2 : 1;
    return priority(left) - priority(right);
  })[0] || null;
}

export function resolveDownloadRecoveryConsent(recovery, kind, approved) {
  if (kind === "manual") {
    recovery.manualConsentResolved = true;
    recovery.manualApproved = approved;
  } else if (kind === "vidsrc") {
    recovery.vidsrcConsentResolved = true;
    recovery.vidsrcApproved = approved;
  }
}

export function advanceDownloadSourceRecovery(mediaType, sourceId, result, recovery) {
  if (["expired", "http_401", "http_403"].includes(result?.code) && !recovery.refreshed) {
    recovery.refreshed = true;
    recovery.reload = true;
    return { action: "refresh" };
  }
  recovery.attempted.add(sourceId);
  while (recovery.attempted.size < MAX_DOWNLOAD_SOURCE_ATTEMPTS) {
    const next = nextDownloadRecoverySource(mediaType, recovery.attempted);
    if (!next) break;
    if (next.routingMode === "manual-only" && recovery.manualConsentResolved && !recovery.manualApproved) {
      recovery.attempted.add(next.id);
      continue;
    }
    if (next.routingMode === "manual-only" && !recovery.manualApproved) {
      return { action: "consent", kind: "manual", sourceId: next.id };
    }
    if (next.id === "vidsrc" && recovery.vidsrcConsentResolved && !recovery.vidsrcApproved) {
      recovery.attempted.add(next.id);
      continue;
    }
    if (next.id === "vidsrc" && !recovery.vidsrcApproved) {
      return { action: "consent", kind: "vidsrc", sourceId: next.id };
    }
    recovery.attempted.add(next.id);
    return { action: "switch", sourceId: next.id };
  }
  return { action: "fail", error: result?.error || "No downloadable stream was found. Choose another source and retry." };
}
