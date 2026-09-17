import type {
  MusicDashboardProvider,
  MusicDashboardResult,
  MusicTrack,
} from '../../../domain/music';

const SPOTIFY_CHARTS_URL =
  'https://charts-spotify-com-service.spotify.com/public/v0/charts';

type JsonRecord = Record<string, any>;

function chartArtworkUrl(value: unknown): string | null {
  const raw = String(value || '');
  const spotifyImage = raw.match(/^spotify:image:([A-Za-z0-9]+)$/);
  if (spotifyImage) return `https://i.scdn.co/image/${spotifyImage[1]}`;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

function normalizeChartEntry(entry: JsonRecord, index: number): MusicTrack | null {
  const metadata = entry?.trackMetadata || {};
  const title = String(metadata.trackName || '').trim();
  const artistName = String(metadata.artists?.[0]?.name || '').trim();
  if (!title || !artistName) return null;

  const sourceId = String(
    metadata.trackUri || `${title}:${artistName}:${index}`,
  );

  return {
    id: `spotify-chart:${sourceId}`,
    title,
    artistName,
    artworkUrl: chartArtworkUrl(metadata.displayImageUri),
    source: {
      provider: 'spotify-charts-dashboard',
      id: sourceId,
    },
    providerRefs: [
      {
        provider: 'spotify-charts-dashboard',
        id: sourceId,
      },
    ],
  };
}

export async function fetchGlobalTop50(
  signal?: AbortSignal,
): Promise<MusicTrack[]> {
  const response = await fetch(SPOTIFY_CHARTS_URL, {
    signal,
    headers: { accept: 'application/json' },
  });

  if (response.status === 429) {
    throw new Error('Global charts are temporarily rate limited.');
  }
  if (!response.ok) {
    throw new Error(`Global charts returned ${response.status}.`);
  }

  const payload = (await response.json()) as JsonRecord;
  return (payload?.chartEntryViewResponses?.[0]?.entries || [])
    .map(normalizeChartEntry)
    .filter((item: MusicTrack | null): item is MusicTrack => Boolean(item));
}

export function createSpotifyChartsDashboardProvider(): MusicDashboardProvider<AbortSignal> {
  return {
    id: 'spotify-charts-dashboard',
    kind: 'dashboard',
    name: 'Global Charts',
    capabilities: ['home', 'charts', 'top50', 'metadataOnly'],

    async getDashboard(
      requestContext = {},
    ): Promise<MusicDashboardResult> {
      const tracks = await fetchGlobalTop50(requestContext.signal);
      return {
        sections: [
          {
            id: 'waven-global-top-50',
            title: 'Global Top 50',
            type: 'tracks',
            attribution: 'Global Charts',
            items: tracks,
          },
        ],
      };
    },
  };
}
