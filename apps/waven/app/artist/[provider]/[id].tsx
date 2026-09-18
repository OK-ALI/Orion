import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  WavenDetailReleaseRail,
  WavenDetailSection,
  WavenDetailTrackRow,
  WavenMusicDetailFoundation,
} from '../../../src/components/detail/WavenMusicDetailFoundation';
import type {
  MusicArtist,
  MusicArtistDetail,
} from '../../../src/domain/music';
import { wavenDiscoveryRuntime } from '../../../src/features/discovery/wavenDiscoveryRuntime';
import { primeWavenAlbumDetail, readWavenArtistDetailPrefetch } from '../../../src/features/discovery/wavenDetailPrefetch';
import { albumDetailRoute } from '../../../src/features/discovery/detailNavigation';
import { beginWavenEntityReveal, wavenEntityRevealKey } from '../../../src/features/navigation/wavenEntityReveal';
import { useWavenReducedMotion } from '../../../src/hooks/useWavenReducedMotion';
import { wavenColors, wavenSpacing } from '../../../src/theme/tokens';

type DetailStatus = 'loading' | 'ready' | 'error';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default function WavenArtistDetailRoute() {
  const router = useRouter();
  const reducedMotion = useWavenReducedMotion();
  const params = useLocalSearchParams<{
    provider?: string | string[];
    id?: string | string[];
    name?: string | string[];
    artworkUrl?: string | string[];
  }>();
  const provider = firstParam(params.provider);
  const id = firstParam(params.id);
  const hasRouteIdentity = Boolean(provider && id);
  const entityKey = wavenEntityRevealKey('artist', provider, id);
  const seedName = firstParam(params.name) || 'Artist';
  const seedArtworkUrl = firstParam(params.artworkUrl) || null;
  const seedArtist = useMemo<MusicArtist>(
    () => ({
      id: `detail-artist:${provider}:${id}`,
      name: seedName,
      profileImageUrl: seedArtworkUrl,
      artworkUrl: seedArtworkUrl,
      source: { provider, id },
    }),
    [id, provider, seedArtworkUrl, seedName],
  );

  const [status, setStatus] = useState<DetailStatus>('loading');
  const [detail, setDetail] = useState<MusicArtistDetail | null>(null);
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
        ? readWavenArtistDetailPrefetch(seedArtist) ??
          wavenDiscoveryRuntime.getArtist(seedArtist, { signal: controller.signal })
        : wavenDiscoveryRuntime.getArtist(seedArtist, { signal: controller.signal });

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
  }, [hasRouteIdentity, id, provider, retryNonce, seedArtist]);

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

  const artist = detail?.artist ?? seedArtist;
  const artworkUrl =
    artist.artworkUrl || artist.profileImageUrl || seedArtworkUrl;
  const artistMeta = detail
    ? [
        detail.tracks.length
          ? `${detail.tracks.length} ${detail.tracks.length === 1 ? 'song' : 'songs'}`
          : null,
        detail.albums.length
          ? `${detail.albums.length} ${detail.albums.length === 1 ? 'release' : 'releases'}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <WavenMusicDetailFoundation
      artworkUrl={artworkUrl}
      seedArtworkUrl={seedArtworkUrl}
      entityKey={entityKey}
      fallbackSeed={`artist-detail-${provider}-${id}`}
      kindLabel="Artist"
      onBack={handleBack}
      onRetry={() => setRetryNonce((value) => value + 1)}
      status={status}
      subtitle={artistMeta}
      title={artist.name}
    >
      {detail?.tracks.length ? (
        <WavenDetailSection revealIndex={0} title="Songs">
          {detail.tracks.slice(0, 8).map((track, index) => (
            <WavenDetailTrackRow
              fallbackArtistName={artist.name}
              key={track.id}
              revealIndex={index}
              showArtwork
              track={track}
            />
          ))}
        </WavenDetailSection>
      ) : null}

      {detail?.albums.length ? (
        <WavenDetailSection revealIndex={1} title="Albums & Releases">
          <WavenDetailReleaseRail
            albums={detail.albums.slice(0, 12)}
            onAlbumPress={(album) => {
              const route = albumDetailRoute(album);
              const albumKey = wavenEntityRevealKey(
                'album',
                album.source.provider,
                album.source.id,
              );
              const open = async () => {
                void primeWavenAlbumDetail(album);
                if (!reducedMotion) {
                  const started = await beginWavenEntityReveal(
                    {
                      artworkUrl: album.artworkUrl,
                      entityKey: albumKey,
                      kind: 'album',
                      title: album.title,
                    },
                    () => router.push(route),
                  );
                  if (started) return;
                }
                router.push(route);
              };
              void open();
            }}
          />
        </WavenDetailSection>
      ) : null}

      {detail && !detail.tracks.length && !detail.albums.length ? (
        <View style={{ marginTop: wavenSpacing.lg }}>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: wavenColors.textSecondary, textAlign: 'center' }}
          >
            No additional artist catalog details are available right now.
          </Text>
        </View>
      ) : null}
    </WavenMusicDetailFoundation>
  );
}
