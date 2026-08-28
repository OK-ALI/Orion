import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MobileDownloadAssetV1 } from '@orion/shared/types';
import { mobileDownloadItemKeyFromMediaV1 } from './downloadIdentity';
import {
  readMobileDownloadRepositoryV1,
  subscribeMobileDownloadRepositoryV1,
  type MobileDownloadRepositorySnapshotV1,
} from './downloadRepository';
import {
  getMobileDownloadReconciliationStateV1,
  reconcileNativeDownloadsV1,
  subscribeMobileDownloadReconciliationV1,
} from './nativeDownloadEngine';

export interface MobileDownloadAvailabilityV1 {
  downloaded: boolean;
  episodeCount: number;
}

export interface MobileDownloadAvailabilityIndexV1 {
  ready: boolean;
  verifiedItemKeys: ReadonlySet<string>;
  verifiedEpisodeCountsByMediaId: ReadonlyMap<string, number>;
}

const EMPTY_AVAILABILITY: MobileDownloadAvailabilityV1 = Object.freeze({ downloaded: false, episodeCount: 0 });
const EMPTY_INDEX: MobileDownloadAvailabilityIndexV1 = {
  ready: false,
  verifiedItemKeys: new Set<string>(),
  verifiedEpisodeCountsByMediaId: new Map<string, number>(),
};

const MobileDownloadAvailabilityContext = createContext<MobileDownloadAvailabilityIndexV1>(EMPTY_INDEX);

function hasVerifiedPrimaryArtifact(asset: MobileDownloadAssetV1): boolean {
  if (asset.destination !== 'orion-library' || !['orion-library', 'user-folder'].includes(asset.storageTarget.mode)) return false;
  if (asset.availability !== 'verified') return false;
  return asset.artifacts.some((artifact) => artifact.role === 'primary' && artifact.availability === 'verified');
}

export function deriveMobileDownloadAvailabilityIndexV1(
  snapshot: MobileDownloadRepositorySnapshotV1,
  ready = true,
): MobileDownloadAvailabilityIndexV1 {
  if (!ready) return EMPTY_INDEX;

  const assetsById = new Map(snapshot.assets.map((asset) => [asset.assetId, asset]));
  const verifiedItemKeys = new Set<string>();
  const verifiedEpisodeKeysByMediaId = new Map<string, Set<string>>();

  for (const entry of snapshot.offlineEntries) {
    const itemKey = mobileDownloadItemKeyFromMediaV1(entry.media);
    const linkedVerifiedAsset = entry.assetIds.some((assetId) => {
      const asset = assetsById.get(assetId);
      return Boolean(
        asset &&
        hasVerifiedPrimaryArtifact(asset) &&
        mobileDownloadItemKeyFromMediaV1(asset.media) === itemKey
      );
    });

    if (!linkedVerifiedAsset) continue;
    verifiedItemKeys.add(itemKey);

    if (entry.media.mediaType !== 'tv' || entry.media.season === null || entry.media.episode === null) continue;
    const mediaId = String(entry.media.id);
    const logicalEpisodeKey = `s${entry.media.season}:e${entry.media.episode}`;
    const episodeKeys = verifiedEpisodeKeysByMediaId.get(mediaId) || new Set<string>();
    episodeKeys.add(logicalEpisodeKey);
    verifiedEpisodeKeysByMediaId.set(mediaId, episodeKeys);
  }

  return {
    ready: true,
    verifiedItemKeys,
    verifiedEpisodeCountsByMediaId: new Map(
      [...verifiedEpisodeKeysByMediaId].map(([mediaId, episodeKeys]) => [mediaId, episodeKeys.size]),
    ),
  };
}

function sameAvailabilityIndexV1(
  left: MobileDownloadAvailabilityIndexV1,
  right: MobileDownloadAvailabilityIndexV1,
): boolean {
  if (left.ready !== right.ready) return false;
  if (left.verifiedItemKeys.size !== right.verifiedItemKeys.size) return false;
  if (left.verifiedEpisodeCountsByMediaId.size !== right.verifiedEpisodeCountsByMediaId.size) return false;
  for (const itemKey of left.verifiedItemKeys) {
    if (!right.verifiedItemKeys.has(itemKey)) return false;
  }
  for (const [mediaId, count] of left.verifiedEpisodeCountsByMediaId) {
    if (right.verifiedEpisodeCountsByMediaId.get(mediaId) !== count) return false;
  }
  return true;
}

export function selectMobileDownloadAvailabilityV1(
  index: MobileDownloadAvailabilityIndexV1,
  id: string | number | null | undefined,
  mediaType: 'movie' | 'tv',
): MobileDownloadAvailabilityV1 {
  if (!index.ready || id === null || id === undefined) return EMPTY_AVAILABILITY;
  const normalizedId = String(id);

  if (mediaType === 'movie') {
    return index.verifiedItemKeys.has(`movie:${normalizedId}`)
      ? { downloaded: true, episodeCount: 0 }
      : EMPTY_AVAILABILITY;
  }

  const episodeCount = index.verifiedEpisodeCountsByMediaId.get(normalizedId) || 0;
  return episodeCount > 0 ? { downloaded: true, episodeCount } : EMPTY_AVAILABILITY;
}

export function MobileDownloadAvailabilityProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<MobileDownloadAvailabilityIndexV1>(EMPTY_INDEX);

  useEffect(() => {
    let disposed = false;
    let reconciliationState = getMobileDownloadReconciliationStateV1();

    const publish = (snapshot: MobileDownloadRepositorySnapshotV1) => {
      if (disposed || reconciliationState !== 'ready') return;
      const next = deriveMobileDownloadAvailabilityIndexV1(snapshot, true);
      setIndex((current) => sameAvailabilityIndexV1(current, next) ? current : next);
    };

    const unsubscribeRepository = subscribeMobileDownloadRepositoryV1(publish);
    const unsubscribeReconciliation = subscribeMobileDownloadReconciliationV1((state) => {
      if (disposed) return;
      reconciliationState = state;
      if (state !== 'ready') {
        setIndex((current) => current.ready ? EMPTY_INDEX : current);
        return;
      }
      publish(readMobileDownloadRepositoryV1());
    });

    void reconcileNativeDownloadsV1().catch(() => {});

    return () => {
      disposed = true;
      unsubscribeReconciliation();
      unsubscribeRepository();
    };
  }, []);

  return <MobileDownloadAvailabilityContext.Provider value={index}>{children}</MobileDownloadAvailabilityContext.Provider>;
}

export function useMobileDownloadAvailability(
  id: string | number | null | undefined,
  mediaType: 'movie' | 'tv',
): MobileDownloadAvailabilityV1 {
  const index = useContext(MobileDownloadAvailabilityContext);
  return useMemo(() => selectMobileDownloadAvailabilityV1(index, id, mediaType), [id, index, mediaType]);
}
