import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import {
  readMobileDownloadRepositoryV1,
  subscribeMobileDownloadRepositoryV1,
  type MobileDownloadRepositorySnapshotV1,
} from '../downloads/downloadRepository';
import { artworkIdentityKey, selectTmdbArtworkSource } from './offlineArtworkPolicy';
import { cacheOfflineArtwork } from './offlineArtworkCache';

interface ArtworkCandidate {
  identityKey: string;
  sourcePath: string;
}

function addCandidate(
  candidates: Map<string, ArtworkCandidate>,
  media: any,
  backdropPath: unknown,
  posterPath: unknown,
) {
  const identityKey = artworkIdentityKey(media);
  const sourcePath = selectTmdbArtworkSource(backdropPath, posterPath);
  if (identityKey && sourcePath && !candidates.has(identityKey)) {
    candidates.set(identityKey, { identityKey, sourcePath });
  }
}

export function collectOfflineArtworkCandidates(
  continueEntries: any[],
  repository: MobileDownloadRepositorySnapshotV1,
): ArtworkCandidate[] {
  const candidates = new Map<string, ArtworkCandidate>();
  for (const entry of continueEntries) {
    addCandidate(
      candidates,
      entry?.progress?.mediaIdentity,
      entry?.progress?.presentation?.backdropPath,
      entry?.progress?.presentation?.posterPath,
    );
  }
  for (const job of repository.jobs) {
    addCandidate(candidates, job.media, job.media.backdropPath, job.media.posterPath);
  }
  for (const entry of repository.offlineEntries) {
    addCandidate(
      candidates,
      entry.media,
      entry.backdropPath || entry.media.backdropPath,
      entry.posterPath || entry.media.posterPath,
    );
  }
  return [...candidates.values()];
}

export async function cacheOfflineArtworkCandidates(
  candidates: ArtworkCandidate[],
  concurrency = 2,
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      await cacheOfflineArtwork(candidate.identityKey, candidate.sourcePath);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), candidates.length) }, () => worker()),
  );
}

/** Backfills non-authoritative artwork while remote capability is available. */
export function MobileArtworkCacheCoordinator() {
  const { progress, watched, getContinueWatching } = useLibrary();
  const { remoteReady, recoveryEpoch } = useNetworkStatus();
  const [repository, setRepository] = useState(readMobileDownloadRepositoryV1);

  useEffect(
    () => subscribeMobileDownloadRepositoryV1(setRepository),
    [],
  );

  const continueEntries = useMemo(
    () => getContinueWatching(),
    [getContinueWatching, progress, watched],
  );
  const candidates = useMemo(
    () => collectOfflineArtworkCandidates(continueEntries, repository),
    [continueEntries, repository],
  );
  const candidateKey = candidates
    .map((candidate) => candidate.identityKey + '|' + candidate.sourcePath)
    .join('||');

  useEffect(() => {
    if (!remoteReady || candidates.length === 0) return;
    void cacheOfflineArtworkCandidates(candidates);
  }, [candidateKey, candidates, recoveryEpoch, remoteReady]);

  return null;
}