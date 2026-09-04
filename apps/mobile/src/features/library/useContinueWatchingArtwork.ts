import { useEffect, useState } from 'react';
import { imgUrl } from '@orion/shared/api';
import type { ContinueWatchingEntry } from '@orion/shared/types';
import { useNetworkStatus } from '../../context/NetworkContext';
import {
  artworkIdentityKey,
  selectTmdbArtworkSource,
} from './offlineArtworkPolicy';
import {
  getOfflineArtworkUri,
  subscribeOfflineArtworkCache,
} from './offlineArtworkCache';

export function useContinueWatchingArtwork(entry: ContinueWatchingEntry): string | null {
  const { remoteReady } = useNetworkStatus();
  const { mediaIdentity, presentation } = entry.progress;
  const sourcePath = selectTmdbArtworkSource(presentation.backdropPath, presentation.posterPath);
  const identityKey = artworkIdentityKey(mediaIdentity);
  const [cacheVersion, refresh] = useState(0);
  const [localArtwork, setLocalArtwork] = useState<{ key: string; uri: string | null }>({
    key: '',
    uri: null,
  });

  useEffect(
    () => subscribeOfflineArtworkCache(() => refresh((value) => value + 1)),
    [],
  );

  useEffect(() => {
    if (remoteReady || !identityKey || !sourcePath) {
      setLocalArtwork({ key: '', uri: null });
      return;
    }
    const key = identityKey + '|' + sourcePath;
    setLocalArtwork({ key, uri: getOfflineArtworkUri(identityKey, sourcePath) });
  }, [cacheVersion, identityKey, remoteReady, sourcePath]);

  if (!identityKey || !sourcePath) return null;
  if (remoteReady) return imgUrl(sourcePath, 'w780');
  const key = identityKey + '|' + sourcePath;
  return localArtwork.key === key ? localArtwork.uri : null;
}