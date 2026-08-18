export function favoritePayload(record) {
  if (!record || typeof record !== "object") return null;
  const payload = record.payload || record.track || record;
  return payload && typeof payload === "object" ? payload : null;
}

export function favoriteIdentity(record) {
  if (!record || typeof record !== "object") return "";
  if (typeof record.identity === "string" && record.identity) return record.identity;

  const payload = favoritePayload(record) || record;
  const provider =
    record.provider ||
    record.source?.provider ||
    payload.provider ||
    payload.source?.provider ||
    "unknown";
  const id =
    record.id ||
    record.source?.id ||
    payload.id ||
    payload.source?.id;

  return id ? `${provider}:${id}` : "";
}

export function favoritePayloads(records = []) {
  return records.map(favoritePayload).filter(Boolean);
}

export function groupFavoritePayloads(records = []) {
  const groups = { tracks: [], albums: [], artists: [] };

  for (const record of records) {
    const payload = favoritePayload(record);
    if (!payload) continue;
    if (record.kind === "track") groups.tracks.push(payload);
    if (record.kind === "album") groups.albums.push(payload);
    if (record.kind === "artist") groups.artists.push(payload);
  }

  return groups;
}

export function favoriteTrackPreview(records = [], limit = 6) {
  return favoritePayloads(records)
    .filter((item) => item?.id && item?.title)
    .slice(0, Math.max(0, Number(limit) || 0));
}
