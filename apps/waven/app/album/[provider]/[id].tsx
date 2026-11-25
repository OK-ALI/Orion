import { useEffect, useMemo, useState } from 'react';
import { useWavenConnectivity } from '../../../src/infrastructure/connectivity/connectivityHooks';
import { WavenMusicLibraryActions } from '../../../src/components/library/WavenLibraryControls';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  WavenDetailSection,
  WavenDetailTrackRow,
  WavenMusicDetailFoundation,
} from '../../../src/components/detail/WavenMusicDetailFoundation';
import type {
  MusicAlbum,
  MusicAlbumDetail,
} from '../../../src/domain/music';
import { wavenDiscoveryRuntime } from '../../../src/features/discovery/wavenDiscoveryRuntime';
import {
  readWavenPresentation,
  seedWavenPresentation,
  wavenEntityArtworkUrl,
} from '../../../src/features/discovery/wavenCanonicalPresentation';
import {
  primeWavenAlbumDetail,
  readWavenAlbumDetailPrefetch,
  readWavenAlbumDetailSnapshot,
} from '../../../src/features/discovery/wavenDetailPrefetch';
import { wavenEntityRevealKey } from '../../../src/features/navigation/wavenEntityReveal';
import { wavenColors, wavenSpacing } from '../../../src/theme/tokens';

type DetailStatus = 'loading' | 'ready' | 'error';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default function WavenAlbumDetailRoute() {
  const connection = useWavenConnectivity();
  const router = useRouter();
  const params = useLocalSearchParams<{
    provider?: string | string[];
    id?: string | string[];
    title?: string | string[];
    artistName?: string | string[];
    artworkUrl?: string | string[];
    returnTo?: string | string[];
  }>();
  const provider = firstParam(params.provider);
  const id = firstParam(params.id);
  const hasRouteIdentity = Boolean(provider && id);
  const entityKey = wavenEntityRevealKey('album', provider, id);
  const seedTitle = firstParam(params.title) || 'Album';
  const seedArtistName = firstParam(params.artistName) || null;
  const seedArtworkUrl = firstParam(params.artworkUrl) || null;
  const returnTo = firstParam(params.returnTo);
  const seedAlbum = useMemo<MusicAlbum>(
    () => ({
      id: `detail-album:${provider}:${id}`,
      title: seedTitle,
      artistName: seedArtistName,
      artworkUrl: seedArtworkUrl,
      source: { provider, id },
    }),
    [id, provider, seedArtistName, seedArtworkUrl, seedTitle],
  );

  const presentedSeedAlbum = useMemo(
    () => readWavenPresentation(seedWavenPresentation(seedAlbum, 'album'), 'album'),
    [seedAlbum],
  );
  const initialSnapshot = useMemo(
    () => readWavenAlbumDetailSnapshot(presentedSeedAlbum),
    [presentedSeedAlbum],
  );
  const [status, setStatus] = useState<DetailStatus>(() =>
    initialSnapshot?.detail ? 'ready' : 'loading',
  );
  const [detail, setDetail] = useState<MusicAlbumDetail | null>(
    () => initialSnapshot?.detail ?? null,
  );
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    if (!hasRouteIdentity) {
      return () => controller.abort();
    }

    if (!connection.remoteReady && detail?.album.source.provider === provider && detail.album.source.id === id) {
      setStatus('ready');
      return () => controller.abort();
    }

    const snapshot = retryNonce === 0
      ? readWavenAlbumDetailSnapshot(seedAlbum)
      : null;
    if (snapshot) {
      setDetail(snapshot.detail);
      setStatus(snapshot.detail ? 'ready' : 'error');
      return () => controller.abort();
    }

    setStatus('loading');
    setDetail(null);

    const request =
      retryNonce === 0
        ? readWavenAlbumDetailPrefetch(presentedSeedAlbum) ?? primeWavenAlbumDetail(presentedSeedAlbum)
        : wavenDiscoveryRuntime.getAlbum(presentedSeedAlbum, { signal: controller.signal });

    request.then((response) => {
        if (controller.signal.aborted || response.cancelled) return;
        setDetail(response.detail);
        setStatus(response.detail ? 'ready' : 'error');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDetail(null);
        setStatus('error');
      });

    return () => controller.abort();
  }, [hasRouteIdentity, id, provider, retryNonce, presentedSeedAlbum, connection.remoteReady, connection.recoveryEpoch]);

  useEffect(() => {
    if (hasRouteIdentity) return;
    router.replace('/');
  }, [hasRouteIdentity, router]);

  const handleBack = () => {
    if (returnTo === 'search') {
      router.navigate('/search');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  if (!hasRouteIdentity) {
    return <View style={{ backgroundColor: wavenColors.canvas, flex: 1 }} />;
  }

  const album = readWavenPresentation(detail?.album ?? presentedSeedAlbum, 'album');
  const normalizedPrimaryType = String(album.primaryType || '').trim().toLowerCase();
  const releaseKind = normalizedPrimaryType === 'single'
    ? 'Single'
    : normalizedPrimaryType === 'ep'
      ? 'EP'
      : 'Album';
  const subtitleParts = [
    album.artistName,
    detail ? `${detail.tracks.length} ${detail.tracks.length === 1 ? 'track' : 'tracks'}` : null,
  ].filter(Boolean);

  return (
    <WavenMusicDetailFoundation
      artworkUrl={wavenEntityArtworkUrl(album)}
      seedArtworkUrl={wavenEntityArtworkUrl(presentedSeedAlbum)}
      entityKey={entityKey}
      fallbackSeed={`album-detail-${provider}-${id}`}
      kindLabel={releaseKind}
      onBack={handleBack}
      onRetry={() => setRetryNonce((value) => value + 1)}
      status={status}
      subtitle={subtitleParts.join(' · ') || 'Album'}
      title={album.title}
    >
      {detail ? <WavenMusicLibraryActions kind="album" entity={album} /> : null}
      {detail?.tracks.length ? (
        <WavenDetailSection revealIndex={0} title="Tracks">
          {detail.tracks.map((track, index) => (
            <WavenDetailTrackRow
              fallbackArtistName={album.artistName}
              index={index + 1}
              key={track.id}
              revealIndex={index}
              track={track}
            />
          ))}
        </WavenDetailSection>
      ) : null}

      {detail && !detail.tracks.length ? (
        <View style={{ marginTop: wavenSpacing.lg }}>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: wavenColors.textSecondary, textAlign: 'center' }}
          >
            No release tracks are available right now.
          </Text>
        </View>
      ) : null}
    </WavenMusicDetailFoundation>
  );
}
