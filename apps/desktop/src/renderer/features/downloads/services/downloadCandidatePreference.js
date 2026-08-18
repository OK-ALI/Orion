const KIND_PRIORITY = Object.freeze({
  hls: 3,
  dash: 2,
  direct: 1,
});

export function preferredDownloadCandidate(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return [...candidates].sort((left, right) => {
    const kindDelta = (KIND_PRIORITY[right?.kind] || 0) - (KIND_PRIORITY[left?.kind] || 0);
    if (kindDelta) return kindDelta;
    const scoreDelta = (Number(right?.score) || 0) - (Number(left?.score) || 0);
    if (scoreDelta) return scoreDelta;
    return (Number(right?.capturedAt) || 0) - (Number(left?.capturedAt) || 0);
  })[0] || null;
}

export function candidateReadinessTitle(candidate, recommendedId) {
  if (!candidate) return "";
  const kind = String(candidate.kind || "stream").toUpperCase();
  const state = candidate.kind === "direct" ? "source available" : "source ready";
  return `${kind} ${state}${candidate.id === recommendedId ? " · Recommended" : ""}`;
}
