import { useEffect, useMemo, useState, useCallback } from 'react';
import type { MobileDownloadAssetV1, OfflineMediaEntryV1 } from '@orion/shared/types';
import { mobileDownloadItemKeyFromMediaV1 } from '../downloads/downloadIdentity';
import { readMobileDownloadRepositoryV1, subscribeMobileDownloadRepositoryV1, type MobileDownloadRepositorySnapshotV1 } from '../downloads/downloadRepository';
import { getMobileDownloadReconciliationStateV1, subscribeMobileDownloadReconciliationV1 } from '../downloads/nativeDownloadEngine';

export interface MediaDetailLocalCopy {
  entry: OfflineMediaEntryV1;
  asset: MobileDownloadAssetV1;
}

export function selectMediaDetailLocalCopies(
  snapshot: MobileDownloadRepositorySnapshotV1, id: string, type: 'movie' | 'tv', ready: boolean,
): MediaDetailLocalCopy[] {
  if (!ready) return [];
  const assets = new Map(snapshot.assets.map((asset) => [asset.assetId, asset]));
  const seen = new Set<string>();
  const copies: MediaDetailLocalCopy[] = [];
  for (const entry of snapshot.offlineEntries) {
    if (String(entry.media.id) !== String(id) || entry.media.mediaType !== type) continue;
    if (type === 'tv' && (entry.media.season == null || entry.media.episode == null)) continue;
    const itemKey = mobileDownloadItemKeyFromMediaV1(entry.media);
    if (seen.has(itemKey)) continue;
    // Prefer the entry's primary copy, then another verified copy of the same identity.
    const asset = [entry.primaryAssetId, ...entry.assetIds].map((assetId) => assets.get(assetId)).find((candidate) =>
      candidate && mobileDownloadItemKeyFromMediaV1(candidate.media) === itemKey &&
      candidate.destination === 'orion-library' &&
      ['orion-library', 'user-folder'].includes(candidate.storageTarget.mode) &&
      candidate.availability === 'verified' &&
      candidate.artifacts.some((artifact) => artifact.role === 'primary' && artifact.availability === 'verified')
    );
    if (!asset) continue;
    seen.add(itemKey);
    copies.push({ entry, asset });
  }
  return copies.sort((a, b) => (a.entry.media.season ?? 0) - (b.entry.media.season ?? 0) ||
    (a.entry.media.episode ?? 0) - (b.entry.media.episode ?? 0));
}

export function localMediaDetailRecord(copy: MediaDetailLocalCopy | undefined) {
  if (!copy) return null;
  const { entry } = copy;
  const catalogId = Number(entry.media.id);
  if (!Number.isSafeInteger(catalogId) || catalogId <= 0) return null;
  const title = entry.media.mediaType === 'tv'
    ? entry.seriesTitle || entry.media.seriesTitle || entry.title
    : entry.title;
  return {
    id: catalogId, media_type: entry.media.mediaType,
    title, name: title, year: entry.media.year,
    poster_path: entry.posterPath || entry.media.posterPath || null,
    backdrop_path: entry.backdropPath || entry.media.backdropPath || null,
  };
}

export function useMediaDetailLocalAvailability(id: string, type: 'movie' | 'tv') {
  const [snapshot, setSnapshot] = useState(readMobileDownloadRepositoryV1);
  const [reconciliation, setReconciliation] = useState(getMobileDownloadReconciliationStateV1);
  useEffect(() => {
    const unsubscribeRepository = subscribeMobileDownloadRepositoryV1(setSnapshot);
    const unsubscribeReconciliation = subscribeMobileDownloadReconciliationV1((state) => {
      setReconciliation(state);
      setSnapshot(readMobileDownloadRepositoryV1());
    });
    setSnapshot(readMobileDownloadRepositoryV1());
    return () => { unsubscribeRepository(); unsubscribeReconciliation(); };
  }, []);
  const copies = useMemo(() => selectMediaDetailLocalCopies(snapshot, id, type, reconciliation === 'ready'), [snapshot, id, type, reconciliation]);
  const record = useMemo(() => localMediaDetailRecord(copies[0]), [copies]);
  // Recheck repository truth at the action boundary. Native playback still verifies the artifact.
  const getPlayableCopies = useCallback(() => selectMediaDetailLocalCopies(
    readMobileDownloadRepositoryV1(), id, type, getMobileDownloadReconciliationStateV1() === 'ready',
  ), [id, type]);
  const findPlayableCopy = useCallback((assetId?: string, season?: number, episode?: number) => {
    const matches = getPlayableCopies().filter((copy) => (!assetId || copy.asset.assetId === assetId) &&
      (season === undefined || copy.entry.media.season === season) &&
      (episode === undefined || copy.entry.media.episode === episode));
    // Display order is never an implicit episode selection.
    return matches.length === 1 ? matches[0] : undefined;
  }, [getPlayableCopies]);
  return { copies, record, reconciliation, getPlayableCopies, findPlayableCopy };
}
