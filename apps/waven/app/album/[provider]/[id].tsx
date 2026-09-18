import { useEffect, useMemo, useState } from 'react';
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
import { readWavenAlbumDetailPrefetch } from '../../../src/features/discovery/wavenDetailPrefetch';
import { wavenEntityRevealKey } from '../../../src/features/navigation/wavenEntityReveal';
import { wavenColors, wavenSpacing } from '../../../src/theme/tokens';

type DetailStatus = 'loading' | 'ready' | 'error';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default function WavenAlbumDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    provider?: string | string[];
    id?: string | string[];
    title?: string | string[];
    artistName?: string | string[];
    artworkUrl?: string | string[];
  }>();
  const provider = firstParam(params.provider);
  const id = firstParam(params.id);
  const hasRouteIdentity = Boolean(provider && id);
  const entityKey = wavenEntityRevealKey('album', provider, id);
  const seedTitle = firstParam(params.title) || 'Album';
  const seedArtistName = firstParam(params.artistName) || null;
  const seedArtworkUrl = firstParam(params.artworkUrl) || null;
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

  const [status, setStatus] = useState<DetailStatus>('loading');
  const [detail, setDetail] = useState<MusicAlbumDetail | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    if (!hasRouteIdentity) {
      return () => controller.abort();
    }

    setStatus('loading');
    setDetail(null);

    const request =
      retryNonce === 0
        ? readWavenAlbumDetailPrefetch(seedAlbum) ??
          wavenDiscoveryRuntime.getAlbum(seedAlbum, { signal: controller.signal })
        : wavenDiscoveryRuntime.getAlbum(seedAlbum, { signal: controller.signal });

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
  }, [hasRouteIdentity, id, provider, retryNonce, seedAlbum]);

  useEffect(() => {
    if (hasRouteIdentity) return;
    router.replace('/');
  }, [hasRouteIdentity, router]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  if (!hasRouteIdentity) {
    return <View style={{ backgroundColor: wavenColors.canvas, flex: 1 }} />;
  }

  const album = detail?.album ?? seedAlbum;
  const subtitleParts = [
    album.artistName,
    detail ? `${detail.tracks.length} ${detail.tracks.length === 1 ? 'track' : 'tracks'}` : null,
  ].filter(Boolean);

  return (
    <WavenMusicDetailFoundation
      artworkUrl={album.artworkUrl || seedArtworkUrl}
      seedArtworkUrl={seedArtworkUrl}
      entityKey={entityKey}
      fallbackSeed={`album-detail-${provider}-${id}`}
      kindLabel="Album"
      onBack={handleBack}
      onRetry={() => setRetryNonce((value) => value + 1)}
      status={status}
      subtitle={subtitleParts.join(' · ') || 'Album'}
      title={album.title}
    >
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
            No album tracks are available right now.
          </Text>
        </View>
      ) : null}
    </WavenMusicDetailFoundation>
  );
}
