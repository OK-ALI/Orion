import type {
  MusicAlbum,
  MusicAlbumDetail,
  MusicArtist,
  MusicArtistDetail,
  MusicDashboardProvider,
  MusicDashboardResult,
  MusicEntity,
  MusicMetadataProvider,
  MusicPlaylist,
  MusicSearchResult,
  MusicTrack,
} from '../../../domain/music';
import {
  canonicalizeWavenAlbumDetail,
  canonicalizeWavenAlbums,
  canonicalizeWavenArtistDetail,
  canonicalizeWavenDashboard,
  canonicalizeWavenSearchResult,
  canonicalizeWavenTracks,
  chooseWavenLargestArtwork,
  isWavenLowConfidenceEntityPresentation,
  isWavenLowConfidencePresentation,
  isWavenSecondaryEntityPresentation,
  isWavenSecondaryPresentation,
  normalizeWavenCanonicalMediaText,
  readWavenPresentation,
  rememberWavenMediaPresentationEvidence,
  rememberWavenPresentation,
  wavenCanonicalMediaKey,
} from '../../../features/discovery/wavenCanonicalPresentation';
import {
  canonicalCatalogReleaseDate,
  NEW_RELEASE_MAX_AGE_DAYS,
  releaseTimeCompatible,
  releaseTitleSimilarity,
  verifiedReleaseDate,
} from './newReleaseVerification';

const YTMUSIC_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const YTMUSIC_BASE = 'https://music.youtube.com/youtubei/v1';
const YTMUSIC_ORIGIN = 'https://music.youtube.com';

const WAVEN_GLOBAL_DISCOVERY_MARKETS = [
  'US',
  'GB',
  'KR',
  'JP',
  'IN',
  'BR',
  'MX',
  'DE',
] as const;

type JsonRecord = Record<string, any>;

export interface WavenSearchDiscoveryCategory {
  id: string;
  title: string;
  group: string;
  browseId: string;
  params: string;
  accentColor: string | null;
}

export interface WavenSearchDiscoveryProvider {
  readonly id: string;
  readonly name: string;
  getCategories(requestContext?: { signal?: AbortSignal }): Promise<readonly WavenSearchDiscoveryCategory[]>;
  getCategory(
    category: WavenSearchDiscoveryCategory,
    requestContext?: { signal?: AbortSignal },
  ): Promise<MusicDashboardResult>;
  getNewReleases(requestContext?: { signal?: AbortSignal }): Promise<MusicDashboardResult>;
}

let visitorId = '';
let visitorRefreshPromise: Promise<void> | null = null;
let visitorRefreshAttempted = false;

const catalogArtistHints = new Map<string, MusicArtist>();
const catalogTrackAlbumIds = new Map<string, string>();

function rememberCatalogTrackAlbum(item: MusicEntity, renderer: any): void {
  if (!('providerTrackId' in item)) return;
  const entries = renderer?.menu?.menuRenderer?.items || [];
  const album = entries.find((entry: any) =>
    textFromRuns(entry?.menuNavigationItemRenderer?.text) === 'Go to album',
  );
  const browseId = album?.menuNavigationItemRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
  if (typeof browseId === 'string' && browseId.startsWith('MPRE')) {
    catalogTrackAlbumIds.set(catalogArtistHintKey(item), browseId);
  }
}

function catalogArtistHintKey(item: MusicEntity): string {
  return `${item.source.provider}\0${item.source.id}`;
}

function linkedArtistFromRuns(runs: readonly any[]): MusicArtist | null {
  const linked = runs.find((run: any) => {
    const endpoint = run?.navigationEndpoint?.browseEndpoint;
    return (
      endpoint?.browseId &&
      pageType(run.navigationEndpoint) === 'MUSIC_PAGE_TYPE_ARTIST'
    );
  });
  const browseId = String(linked?.navigationEndpoint?.browseEndpoint?.browseId || '');
  const name = String(linked?.text || '').trim();
  if (!browseId || !name) return null;

  return {
    id: `ytmusic-artist:${browseId}`,
    name,
    profileImageUrl: null,
    artworkUrl: null,
    source: { provider: 'ytmusic-metadata', id: browseId },
  } satisfies MusicArtist;
}

function rememberCatalogArtistHint(
  item: MusicEntity,
  runs: readonly any[],
) {
  const hint = linkedArtistFromRuns(runs);
  if (!hint) return;
  catalogArtistHints.set(
    catalogArtistHintKey(item),
    readWavenPresentation(hint, 'artist'),
  );
}

export function readYouTubeMusicCatalogArtistHint(
  item: MusicEntity,
): MusicArtist | null {
  const hint = catalogArtistHints.get(catalogArtistHintKey(item)) ?? null;
  if (!hint) return null;
  return readWavenPresentation(hint, 'artist');
}


const HOME_DISCOVERY_FILLERS = [
  { type: 'tracks' as const, queries: ['popular songs'], limit: 24 },
  {
    type: 'artists' as const,
    queries: ['top music artists', 'top artists'],
    limit: 18,
  },
  { type: 'albums' as const, queries: ['popular albums'], limit: 18 },
  { type: 'playlists' as const, queries: ['popular playlists'], limit: 18 },
];

function context(market = 'US', clientName: 'WEB_REMIX' | 'WEB' = 'WEB_REMIX') {
  return {
    context: {
      client: {
        clientName,
        clientVersion: clientName === 'WEB' ? '2.20240724.00.00' : '1.20240724.00.00',
        hl: 'en',
        gl: market,
      },
      user: {},
    },
  };
}

function headers(): Record<string, string> {
  const value: Record<string, string> = {
    accept: 'application/json',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    origin: YTMUSIC_ORIGIN,
    referer: `${YTMUSIC_ORIGIN}/`,
  };
  if (visitorId) value['x-goog-visitor-id'] = visitorId;
  return value;
}

function nav(value: any, path: readonly (string | number)[]): any {
  return path.reduce((current, key) => current?.[key], value);
}

function textFromRuns(value: any): string {
  const runs = Array.isArray(value?.runs) ? value.runs : [];
  return runs.map((run: any) => run?.text || '').join('').trim();
}


function colorFromArgb(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const unsigned = numeric >>> 0;
  const red = (unsigned >>> 16) & 0xff;
  const green = (unsigned >>> 8) & 0xff;
  const blue = unsigned & 0xff;
  return `rgb(${red}, ${green}, ${blue})`;
}

function bestThumb(thumbnails: any = [], preferredSize = 544): string | null {
  return chooseWavenLargestArtwork(
    Array.isArray(thumbnails) ? thumbnails : [],
    preferredSize,
  );
}

function parseDuration(value: unknown): number | null {
  const parts = String(value || '')
    .split(':')
    .map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? seconds * 1_000 : null;
}

function metadataParts(value: unknown): string[] {
  return String(value || '')
    .split(/\s*[\u2022\u00B7]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function albumFromMetadata(parts: readonly string[]): string | null {
  const content = parts.filter(
    (part) => !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(part),
  );
  return content.length > 1 ? content.at(-1) ?? null : null;
}

function pageType(endpoint: any): string {
  return (
    nav(endpoint, [
      'browseEndpoint',
      'browseEndpointContextSupportedConfigs',
      'browseEndpointContextMusicConfig',
      'pageType',
    ]) || ''
  );
}

function extractVideoId(renderer: any): string | null {
  return (
    nav(renderer, [
      'overlay',
      'musicItemThumbnailOverlayRenderer',
      'content',
      'musicPlayButtonRenderer',
      'playNavigationEndpoint',
      'watchEndpoint',
      'videoId',
    ]) ||
    nav(renderer, ['playlistItemData', 'videoId']) ||
    nav(renderer, [
      'flexColumns',
      0,
      'musicResponsiveListItemFlexColumnRenderer',
      'text',
      'runs',
      0,
      'navigationEndpoint',
      'watchEndpoint',
      'videoId',
    ]) ||
    null
  );
}

function extractBrowseId(renderer: any): string | null {
  const rootBrowseId = nav(renderer, [
    'navigationEndpoint',
    'browseEndpoint',
    'browseId',
  ]);
  if (rootBrowseId) return rootBrowseId;

  for (const column of renderer?.flexColumns || []) {
    const runs =
      nav(column, [
        'musicResponsiveListItemFlexColumnRenderer',
        'text',
        'runs',
      ]) || [];
    for (const run of runs) {
      const browseId = nav(run, [
        'navigationEndpoint',
        'browseEndpoint',
        'browseId',
      ]);
      if (browseId) return browseId;
    }
  }
  return null;
}

function titleBrowse(renderer: any): {
  id: string | null;
  endpoint: any;
} {
  const runs =
    nav(renderer, [
      'flexColumns',
      0,
      'musicResponsiveListItemFlexColumnRenderer',
      'text',
      'runs',
    ]) || [];
  const endpoint =
    runs.find((run: any) => run?.navigationEndpoint?.browseEndpoint)
      ?.navigationEndpoint || null;
  return {
    id: endpoint?.browseEndpoint?.browseId || null,
    endpoint,
  };
}

function endpointFor(renderer: any): any {
  return (
    renderer?.navigationEndpoint ||
    renderer?.title?.runs?.find((run: any) => run?.navigationEndpoint)
      ?.navigationEndpoint ||
    renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint ||
    null
  );
}

function validThumbnailList(value: unknown): any[] {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry?.url === 'string' && entry.url.trim())
    : [];
}

function nestedThumbnailList(value: any, depth = 0): any[] {
  if (!value || typeof value !== 'object' || depth > 7) return [];

  const direct = validThumbnailList(value.thumbnails);
  if (direct.length) return direct;

  const preferredKeys = [
    'thumbnail',
    'musicThumbnailRenderer',
    'thumbnailRenderer',
    'croppedSquareThumbnailRenderer',
    'musicThumbnail',
    'image',
  ];
  for (const key of preferredKeys) {
    const candidate = nestedThumbnailList(value?.[key], depth + 1);
    if (candidate.length) return candidate;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const candidate = nestedThumbnailList(child, depth + 1);
      if (candidate.length) return candidate;
    }
    return [];
  }

  for (const [key, child] of Object.entries(value)) {
    if (preferredKeys.includes(key) || key === 'thumbnails') continue;
    const candidate = nestedThumbnailList(child, depth + 1);
    if (candidate.length) return candidate;
  }

  return [];
}

function thumbnailList(renderer: any): any[] {
  const candidates = [
    nav(renderer, [
      'thumbnail',
      'musicThumbnailRenderer',
      'thumbnail',
      'thumbnails',
    ]),
    nav(renderer, [
      'thumbnailRenderer',
      'musicThumbnailRenderer',
      'thumbnail',
      'thumbnails',
    ]),
    nav(renderer, ['thumbnail', 'thumbnails']),
  ];

  for (const candidate of candidates) {
    const valid = validThumbnailList(candidate);
    if (valid.length) return valid;
  }

  return nestedThumbnailList(renderer);
}

function metadataRuns(renderer: any): any[] {
  return (
    nav(renderer, ['subtitle', 'runs']) ||
    nav(renderer, ['subtitle', 'text', 'runs']) ||
    nav(renderer, [
      'flexColumns',
      1,
      'musicResponsiveListItemFlexColumnRenderer',
      'text',
      'runs',
    ]) ||
    []
  );
}

function titleFor(renderer: any): string {
  return (
    textFromRuns(renderer?.title) ||
    textFromRuns(
      nav(renderer, [
        'flexColumns',
        0,
        'musicResponsiveListItemFlexColumnRenderer',
        'text',
      ]),
    ) ||
    ''
  );
}

function artistFromRuns(runs: readonly any[]): string {
  const linked = runs.find((run: any) => {
    const endpoint = run?.navigationEndpoint?.browseEndpoint;
    return (
      endpoint &&
      pageType(run.navigationEndpoint) === 'MUSIC_PAGE_TYPE_ARTIST'
    );
  });
  return (
    linked?.text ||
    metadataParts(runs.map((run: any) => run?.text || '').join(''))[0] ||
    'Unknown artist'
  );
}

type AlbumPresentationEvidence = {
  artistName: string | null;
  primaryType: 'Album' | 'Single' | 'EP' | null;
  releaseDate: string | null;
};

function releasePrimaryType(value: unknown): AlbumPresentationEvidence['primaryType'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'single') return 'Single';
  if (normalized === 'ep' || normalized === 'e.p.') return 'EP';
  if (normalized === 'album') return 'Album';
  return null;
}

function albumPresentationEvidence(runs: readonly any[]): AlbumPresentationEvidence {
  const linkedArtist = runs.find((run: any) => {
    const endpoint = run?.navigationEndpoint?.browseEndpoint;
    return endpoint && pageType(run.navigationEndpoint) === 'MUSIC_PAGE_TYPE_ARTIST';
  });
  const parts = metadataParts(runs.map((run: any) => run?.text || '').join(''));
  const primaryType = parts.map(releasePrimaryType).find(Boolean) || null;
  const releaseDate = parts.find((part) => /^(?:19|20)\d{2}$/.test(part)) || null;
  const artistName = String(linkedArtist?.text || '').trim() ||
    parts.find((part) =>
      !releasePrimaryType(part) &&
      !/^(?:19|20)\d{2}$/.test(part) &&
      !/^\d{1,3}\s+(?:tracks?|songs?)$/i.test(part) &&
      !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(part),
    ) || null;
  return { artistName, primaryType, releaseDate };
}

function albumDetailHeaderRenderer(payload: any): any {
  return (
    nav(payload, [
      'contents',
      'twoColumnBrowseResultsRenderer',
      'tabs',
      0,
      'tabRenderer',
      'content',
      'sectionListRenderer',
      'contents',
      0,
      'musicResponsiveHeaderRenderer',
    ]) ||
    payload?.header?.musicDetailHeaderRenderer ||
    payload?.header?.musicResponsiveHeaderRenderer ||
    null
  );
}

function albumDetailPresentationEvidence(payload: any): AlbumPresentationEvidence {
  const header = albumDetailHeaderRenderer(payload);
  if (!header) return { artistName: null, primaryType: null, releaseDate: null };
  const subtitle = albumPresentationEvidence(header?.subtitle?.runs || []);
  const strapline = albumPresentationEvidence(header?.straplineTextOne?.runs || []);
  return {
    artistName: strapline.artistName || subtitle.artistName,
    primaryType: subtitle.primaryType || strapline.primaryType,
    releaseDate: subtitle.releaseDate || strapline.releaseDate,
  };
}

function albumDetailPlayVideoId(payload: any): string | null {
  const header = albumDetailHeaderRenderer(payload);
  if (!header) return null;
  const visit = (value: any, depth = 0): string | null => {
    if (!value || typeof value !== 'object' || depth > 7) return null;
    const renderer = value?.musicPlayButtonRenderer;
    const videoId = renderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
    if (typeof videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return videoId;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = visit(child, depth + 1);
        if (found) return found;
      }
      return null;
    }
    for (const child of Object.values(value)) {
      const found = visit(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return visit(header);
}

function isSingleRelease(album: MusicAlbum): boolean {
  return String(album.primaryType || '').trim().toLowerCase() === 'single';
}

function singleTrackFromAlbumPlayEndpoint(
  album: MusicAlbum,
  payload: any,
): MusicTrack | null {
  if (!isSingleRelease(album)) return null;
  const videoId = albumDetailPlayVideoId(payload);
  const artistName = String(album.artistName || '').trim();
  if (!videoId || !artistName) return null;
  return rememberWavenPresentation({
    id: `ytmusic:${videoId}`,
    providerTrackId: videoId,
    provider: 'ytmusic',
    title: album.title,
    artistName,
    albumTitle: album.title,
    artworkUrl: album.artworkUrl || null,
    source: { provider: 'ytmusic-metadata', id: videoId },
    providerRefs: [{ provider: 'ytmusic-metadata', id: videoId }],
  } satisfies MusicTrack, 'track');
}

function singleTrackMatchesAlbumIdentity(album: MusicAlbum, track: MusicTrack): boolean {
  const linkedAlbumId = catalogTrackAlbumIds.get(catalogArtistHintKey(track));
  if (!linkedAlbumId || linkedAlbumId !== album.source.id) return false;
  if (releaseTitleSimilarity(album.title, track.title) < 0.96) return false;
  const expectedArtist = normalizeWavenCanonicalMediaText(album.artistName);
  const actualArtist = normalizeWavenCanonicalMediaText(track.artistName);
  return !expectedArtist || !actualArtist || expectedArtist === actualArtist;
}

async function resolveSingleTrackFromCatalog(
  album: MusicAlbum,
  signal?: AbortSignal,
): Promise<MusicTrack | null> {
  if (!isSingleRelease(album)) return null;
  const artistName = String(album.artistName || '').trim();
  if (!artistName) return null;
  const query = `${artistName} ${album.title}`.trim().slice(0, 200);
  const payload = await ytmRequest('search', { query }, signal);
  const result = splitResults(dedupeMusicEntities(collectMusicItems(payload)));
  return curateSearchTracks(result.tracks).find((track) =>
    singleTrackMatchesAlbumIdentity(album, track),
  ) || null;
}

function isAlbumBrowse(
  browsePageType: string,
  browseId: unknown,
): boolean {
  const id = String(browseId || '');
  return (
    browsePageType === 'MUSIC_PAGE_TYPE_ALBUM' ||
    id.startsWith('MPRE')
  );
}

function isExplicitNonMusicTrack(
  metadata: readonly string[],
  browsePageType: string,
): boolean {
  const primaryType = String(metadata[0] || '').trim().toLowerCase();
  return (
    browsePageType === 'MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE' ||
    primaryType === 'episode' ||
    primaryType === 'podcast'
  );
}

function nestedMusicVideoType(value: any, depth = 0): string | null {
  if (!value || typeof value !== 'object' || depth > 7) return null;
  if (typeof value.musicVideoType === 'string' && value.musicVideoType.trim()) {
    return value.musicVideoType.trim();
  }

  const preferredKeys = [
    'watchEndpointMusicSupportedConfigs',
    'watchEndpointMusicConfig',
    'playNavigationEndpoint',
    'watchEndpoint',
    'navigationEndpoint',
    'overlay',
  ];
  for (const key of preferredKeys) {
    const found = nestedMusicVideoType(value?.[key], depth + 1);
    if (found) return found;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const found = nestedMusicVideoType(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (preferredKeys.includes(key) || key === 'musicVideoType') continue;
    const found = nestedMusicVideoType(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function rememberYouTubeMusicTrackPresentation(
  track: MusicTrack,
  renderer: any,
  metadata: readonly string[],
): MusicTrack {
  const rendererType = nestedMusicVideoType(renderer);
  const normalizedRendererType = String(rendererType || '').toUpperCase();
  const rendererSecondary = Boolean(
    normalizedRendererType &&
      normalizedRendererType !== 'MUSIC_VIDEO_TYPE_ATV' &&
      !normalizedRendererType.endsWith('_AUDIO'),
  );
  const providerTypeSecondary = metadata.some((part) =>
    /^(?:video|music video|performance|live performance)$/i.test(part.trim()),
  );
  const videoStyleMetadata = metadata.some((part) =>
    /(?:^|\s)\d[\d,.]*\s*(?:k|m|b)?\s+views?\b|\bviews?\b/i.test(part),
  );
  const titleSecondary = isWavenSecondaryPresentation(track.title);
  const lowConfidence = isWavenLowConfidencePresentation(track.title);

  rememberWavenMediaPresentationEvidence(track, {
    lowConfidence,
    reason: rendererSecondary
      ? 'youtube-music-video-renderer'
      : providerTypeSecondary
        ? 'youtube-music-provider-type'
        : videoStyleMetadata
          ? 'youtube-music-view-count-renderer'
          : titleSecondary
            ? 'secondary-title-semantics'
            : null,
    rendererType: rendererType || null,
    secondary:
      rendererSecondary ||
      providerTypeSecondary ||
      videoStyleMetadata ||
      titleSecondary,
  }, 'track');
  return track;
}

function normalizeEndpointItem(renderer: any): MusicEntity | null {
  const title = titleFor(renderer);
  if (!title) return null;

  const endpoint = endpointFor(renderer);
  const watch = endpoint?.watchEndpoint;
  const browse = endpoint?.browseEndpoint;
  const explicitBrowseId = browse?.browseId || null;
  const fallbackBrowseId = extractBrowseId(renderer);
  const type = pageType(endpoint);
  const runs = metadataRuns(renderer);
  const metadata = metadataParts(
    runs.map((run: any) => run?.text || '').join(''),
  );
  const artworkUrl = bestThumb(thumbnailList(renderer));
  const durationText = runs.find((run: any) =>
    /^\d{1,2}:\d{2}(?::\d{2})?$/.test(run?.text || ''),
  )?.text;
  const videoId = watch?.videoId || extractVideoId(renderer);

  if (videoId && isExplicitNonMusicTrack(metadata, type)) return null;

  // Discovery cards often expose both a canonical browse identity and a play
  // overlay. WAVEN keeps the explicit music entity identity authoritative:
  // Album/Single/EP, Artist and Playlist semantics must not collapse into a
  // video-style Track merely because the same card is immediately playable.
  if (explicitBrowseId && type === 'MUSIC_PAGE_TYPE_ARTIST') {
    return {
      id: `ytmusic-artist:${explicitBrowseId}`,
      name: title,
      profileImageUrl: artworkUrl,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: explicitBrowseId },
    } satisfies MusicArtist;
  }

  if (
    explicitBrowseId &&
    (
      type === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
      String(explicitBrowseId).startsWith('VL')
    )
  ) {
    return {
      id: `ytmusic-playlist:${explicitBrowseId}`,
      title,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: explicitBrowseId },
    } satisfies MusicPlaylist;
  }

  if (explicitBrowseId && isAlbumBrowse(type, explicitBrowseId)) {
    const albumEvidence = albumPresentationEvidence(runs);
    return {
      id: `ytmusic-album:${explicitBrowseId}`,
      title,
      artistName: albumEvidence.artistName,
      releaseDate: albumEvidence.releaseDate,
      primaryType: albumEvidence.primaryType,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: explicitBrowseId },
    } satisfies MusicAlbum;
  }

  if (videoId) {
    const track = {
      id: `ytmusic:${videoId}`,
      providerTrackId: videoId,
      provider: 'ytmusic',
      title,
      artistName: artistFromRuns(runs),
      albumTitle: albumFromMetadata(metadata),
      durationMs: parseDuration(durationText),
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: videoId },
      providerRefs: [{ provider: 'ytmusic-metadata', id: videoId }],
    } satisfies MusicTrack;
    return rememberYouTubeMusicTrackPresentation(track, renderer, metadata);
  }

  if (!fallbackBrowseId) return null;
  const source = { provider: 'ytmusic-metadata', id: fallbackBrowseId };

  if (type === 'MUSIC_PAGE_TYPE_ARTIST') {
    return {
      id: `ytmusic-artist:${fallbackBrowseId}`,
      name: title,
      profileImageUrl: artworkUrl,
      artworkUrl,
      source,
    } satisfies MusicArtist;
  }

  if (
    type === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
    String(fallbackBrowseId).startsWith('VL')
  ) {
    return {
      id: `ytmusic-playlist:${fallbackBrowseId}`,
      title,
      artworkUrl,
      source,
    } satisfies MusicPlaylist;
  }

  if (!isAlbumBrowse(type, fallbackBrowseId)) return null;

  const albumEvidence = albumPresentationEvidence(runs);
  return {
    id: `ytmusic-album:${fallbackBrowseId}`,
    title,
    artistName: albumEvidence.artistName,
    releaseDate: albumEvidence.releaseDate,
    primaryType: albumEvidence.primaryType,
    artworkUrl,
    source,
  } satisfies MusicAlbum;
}

function normalizeListItem(item: any): MusicEntity | null {
  const renderer = item?.musicResponsiveListItemRenderer;
  if (!renderer) return null;

  const title = textFromRuns(
    nav(renderer, [
      'flexColumns',
      0,
      'musicResponsiveListItemFlexColumnRenderer',
      'text',
    ]),
  );
  if (!title) return null;

  const subtitleRuns =
    nav(renderer, [
      'flexColumns',
      1,
      'musicResponsiveListItemFlexColumnRenderer',
      'text',
      'runs',
    ]) || [];
  const metadata = metadataParts(
    subtitleRuns.map((run: any) => run?.text || '').join(''),
  );
  const videoId = extractVideoId(renderer);
  const titleEndpoint = titleBrowse(renderer);
  const rootBrowseEndpoint = renderer?.navigationEndpoint?.browseEndpoint || null;
  const explicitBrowseId =
    titleEndpoint.id ||
    rootBrowseEndpoint?.browseId ||
    null;
  const browsePageType = pageType(
    titleEndpoint.endpoint || renderer.navigationEndpoint,
  );
  const fallbackBrowseId = extractBrowseId(renderer);
  const thumbnails = thumbnailList(renderer);
  const durationText = subtitleRuns.find((run: any) =>
    /^\d+:\d+/.test(run?.text || ''),
  )?.text;
  const artistName =
    subtitleRuns.find((run: any) =>
      pageType(run?.navigationEndpoint) === 'MUSIC_PAGE_TYPE_ARTIST',
    )?.text ||
    metadata[0] ||
    'Unknown artist';
  const artworkUrl = bestThumb(thumbnails);

  if (videoId && isExplicitNonMusicTrack(metadata, browsePageType)) return null;

  if (
    explicitBrowseId &&
    browsePageType === 'MUSIC_PAGE_TYPE_ARTIST'
  ) {
    return {
      id: `ytmusic-artist:${explicitBrowseId}`,
      name: title,
      profileImageUrl: artworkUrl,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: String(explicitBrowseId) },
    } satisfies MusicArtist;
  }

  if (
    explicitBrowseId &&
    (
      browsePageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
      String(explicitBrowseId).startsWith('VL')
    )
  ) {
    return {
      id: `ytmusic-playlist:${explicitBrowseId}`,
      title,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: String(explicitBrowseId) },
    } satisfies MusicPlaylist;
  }

  if (
    explicitBrowseId &&
    isAlbumBrowse(browsePageType, explicitBrowseId)
  ) {
    const albumEvidence = albumPresentationEvidence(subtitleRuns);
    return {
      id: `ytmusic-album:${explicitBrowseId}`,
      title,
      artistName: albumEvidence.artistName,
      releaseDate: albumEvidence.releaseDate,
      primaryType: albumEvidence.primaryType,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: String(explicitBrowseId) },
    } satisfies MusicAlbum;
  }

  if (videoId) {
    const track = {
      id: `ytmusic:${videoId}`,
      providerTrackId: videoId,
      provider: 'ytmusic',
      title,
      artistName,
      albumTitle: albumFromMetadata(metadata),
      durationMs: parseDuration(durationText),
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: videoId },
      providerRefs: [{ provider: 'ytmusic-metadata', id: videoId }],
    } satisfies MusicTrack;
    return rememberYouTubeMusicTrackPresentation(track, renderer, metadata);
  }

  if (fallbackBrowseId && browsePageType === 'MUSIC_PAGE_TYPE_ARTIST') {
    return {
      id: `ytmusic-artist:${fallbackBrowseId}`,
      name: title,
      profileImageUrl: artworkUrl,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: String(fallbackBrowseId) },
    } satisfies MusicArtist;
  }

  if (
    browsePageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
    String(fallbackBrowseId).startsWith('VL')
  ) {
    return {
      id: `ytmusic-playlist:${fallbackBrowseId}`,
      title,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: String(fallbackBrowseId) },
    } satisfies MusicPlaylist;
  }

  if (fallbackBrowseId && isAlbumBrowse(browsePageType, fallbackBrowseId)) {
    const albumEvidence = albumPresentationEvidence(subtitleRuns);
    return {
      id: `ytmusic-album:${fallbackBrowseId}`,
      title,
      artistName: albumEvidence.artistName,
      releaseDate: albumEvidence.releaseDate,
      primaryType: albumEvidence.primaryType,
      artworkUrl,
      source: { provider: 'ytmusic-metadata', id: String(fallbackBrowseId) },
    } satisfies MusicAlbum;
  }

  return null;
}

function normalizeMusicItem(item: any): MusicEntity | null {
  if (item?.musicResponsiveListItemRenderer) {
    return normalizeListItem(item);
  }

  const renderer =
    item?.musicTwoRowItemRenderer || item?.musicMultiRowListItemRenderer;
  if (renderer) return normalizeEndpointItem(renderer);

  const panel = item?.playlistPanelVideoRenderer;
  if (!panel) return null;

  const title = textFromRuns(panel.title);
  const bylineRuns =
    panel.longBylineText?.runs || panel.shortBylineText?.runs || [];
  const videoId =
    panel.navigationEndpoint?.watchEndpoint?.videoId || panel.videoId;
  if (!title || !videoId) return null;

  const panelMetadata = metadataParts(
    bylineRuns.map((run: any) => run?.text || '').join(''),
  );
  const track = {
    id: `ytmusic:${videoId}`,
    providerTrackId: videoId,
    provider: 'ytmusic',
    title,
    artistName: artistFromRuns(bylineRuns),
    durationMs: parseDuration(
      panel.lengthText?.simpleText || textFromRuns(panel.lengthText),
    ),
    artworkUrl: bestThumb(nestedThumbnailList(panel.thumbnail)),
    source: { provider: 'ytmusic-metadata', id: videoId },
    providerRefs: [{ provider: 'ytmusic-metadata', id: videoId }],
  } satisfies MusicTrack;
  return rememberYouTubeMusicTrackPresentation(track, panel, panelMetadata);
}

function collectMusicItems(payload: any): MusicEntity[] {
  const items: MusicEntity[] = [];
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return;

    if (
      value.musicResponsiveListItemRenderer ||
      value.musicTwoRowItemRenderer ||
      value.musicMultiRowListItemRenderer ||
      value.playlistPanelVideoRenderer
    ) {
      const item = normalizeMusicItem(value);
      if (item) {
        const renderer =
          value.musicResponsiveListItemRenderer ||
          value.musicTwoRowItemRenderer ||
          value.musicMultiRowListItemRenderer ||
          value.playlistPanelVideoRenderer ||
          null;
        const presentationKind =
          'providerTrackId' in item
            ? 'track'
            : 'name' in item
              ? 'artist'
              : String(item.id || '').startsWith('ytmusic-playlist:')
                ? 'playlist'
                : 'album';
        const presented = rememberWavenPresentation(item, presentationKind);
        rememberCatalogArtistHint(item, metadataRuns(renderer));
        rememberCatalogTrackAlbum(item, renderer);
        items.push(presented);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
    } else {
      Object.values(value).forEach(visit);
    }
  };
  visit(payload);
  return items;
}

function splitResults(items: readonly MusicEntity[]): MusicSearchResult {
  const tracks: MusicTrack[] = [];
  const artists: MusicArtist[] = [];
  const albums: MusicAlbum[] = [];
  const playlists: MusicPlaylist[] = [];

  for (const item of items) {
    if ('providerTrackId' in item) tracks.push(item);
    else if ('name' in item) artists.push(item);
    else if (String(item.id || '').startsWith('ytmusic-playlist:')) {
      playlists.push(item as MusicPlaylist);
    } else {
      albums.push(item as MusicAlbum);
    }
  }

  return { tracks, artists, albums, playlists };
}

function dedupeMusicEntities<T extends MusicEntity>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identity = String(item.id || '');
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}


type ReleaseSectionType = 'albums' | 'tracks';

interface GlobalReleaseCandidate {
  type: ReleaseSectionType;
  item: MusicAlbum | MusicTrack;
  bestRank: number;
  firstMarketIndex: number;
  marketCount: number;
  videoPresentation: boolean;
}

interface NewReleaseSignal {
  item: MusicTrack;
  market: string;
  bestRank: number;
  firstMarketIndex: number;
  marketCount: number;
}

interface ResolvedNewRelease {
  type: ReleaseSectionType;
  item: MusicAlbum | MusicTrack;
}

// The first 18 signals can miss truthful releases later in the fixed-market
// ranking. Search a bounded window, stopping after enough unique verified music.
const NEW_RELEASE_SIGNAL_LIMIT = 48;
const NEW_RELEASE_RESOLVER_CONCURRENCY = 3;
const NEW_RELEASE_VERIFIED_TARGET = 16;

function normalizeReleaseIdentityText(value: unknown): string {
  return normalizeWavenCanonicalMediaText(value);
}

function isSecondaryPresentationTitle(value: unknown): boolean {
  return isWavenSecondaryPresentation(value);
}

function isLowConfidencePresentationTitle(value: unknown): boolean {
  return isWavenLowConfidencePresentation(value);
}

function isVideoReleasePresentation(item: MusicAlbum | MusicTrack): boolean {
  return isWavenSecondaryEntityPresentation(item);
}

function isLowConfidenceSearchTrack(item: MusicTrack): boolean {
  return isWavenLowConfidenceEntityPresentation(item);
}

function curateSearchTracks(tracks: readonly MusicTrack[]): MusicTrack[] {
  return canonicalizeWavenTracks(tracks, { songsOnly: true });
}

function curateSearchAlbums(albums: readonly MusicAlbum[]): MusicAlbum[] {
  return canonicalizeWavenAlbums(albums);
}

function releaseIdentity(item: MusicAlbum | MusicTrack): string {
  return wavenCanonicalMediaKey(item);
}

function releaseSignalTitle(item: MusicTrack): string {
  const artist = normalizeReleaseIdentityText(item.artistName);
  let title = String(item.title || '').trim();
  if (artist && normalizeReleaseIdentityText(title).startsWith(`${artist} `)) {
    const prefix = new RegExp(`^\\s*${String(item.artistName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*[-–—:]\\s*|\\s+)`, 'iu');
    title = title.replace(prefix, '').trim();
  }
  return title;
}

function textTokens(value: unknown): Set<string> {
  return new Set(
    normalizeReleaseIdentityText(value)
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function tokenDiceSimilarity(left: unknown, right: unknown): number {
  const leftText = normalizeReleaseIdentityText(left);
  const rightText = normalizeReleaseIdentityText(right);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 1;
  if (leftText.includes(rightText) || rightText.includes(leftText)) {
    const shorter = Math.min(leftText.length, rightText.length);
    const longer = Math.max(leftText.length, rightText.length);
    if (shorter >= 5 && shorter / longer >= 0.72) return 0.94;
  }

  const leftTokens = textTokens(leftText);
  const rightTokens = textTokens(rightText);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return (2 * overlap) / (leftTokens.size + rightTokens.size);
}

function artistIdentityEquivalent(
  signal: MusicTrack,
  candidate: MusicAlbum | MusicTrack,
): boolean {
  const signalHint = readYouTubeMusicCatalogArtistHint(signal);
  const candidateHint = readYouTubeMusicCatalogArtistHint(candidate);
  if (signalHint || candidateHint) {
    return Boolean(
      signalHint &&
      candidateHint &&
      signalHint.source.provider === candidateHint.source.provider &&
      signalHint.source.id === candidateHint.source.id,
    );
  }

  const signalArtist = normalizeReleaseIdentityText(signal.artistName);
  const candidateArtist = normalizeReleaseIdentityText(candidate.artistName);
  if (!signalArtist || !candidateArtist) return false;
  if (signalArtist === candidateArtist) return true;
  if (signalArtist.includes(candidateArtist) || candidateArtist.includes(signalArtist)) {
    const shorter = Math.min(signalArtist.length, candidateArtist.length);
    const longer = Math.max(signalArtist.length, candidateArtist.length);
    return shorter >= 4 && shorter / longer >= 0.72;
  }
  return tokenDiceSimilarity(signalArtist, candidateArtist) >= 0.8;
}

function releaseSignalCandidateScore(
  signal: MusicTrack,
  candidate: MusicAlbum | MusicTrack,
): number {
  if (isWavenSecondaryEntityPresentation(candidate)) return -1;
  if (isWavenLowConfidenceEntityPresentation(candidate)) return -1;
  if (!artistIdentityEquivalent(signal, candidate)) return -1;

  const titleSimilarity = releaseTitleSimilarity(
    releaseSignalTitle(signal),
    candidate.title,
  );
  if (titleSimilarity < 0.84) return -1;

  const signalHint = readYouTubeMusicCatalogArtistHint(signal);
  const candidateHint = readYouTubeMusicCatalogArtistHint(candidate);
  const sameArtistIdentity = Boolean(
    signalHint &&
      candidateHint &&
      signalHint.source.provider === candidateHint.source.provider &&
      signalHint.source.id === candidateHint.source.id,
  );

  return (titleSimilarity * 100) + (sameArtistIdentity ? 20 : 8) + ('providerTrackId' in candidate ? 0 : 3);
}

function rankGlobalNewReleaseSignals(
  marketResults: readonly {
    market: string;
    sections: MusicDashboardResult['sections'];
  }[],
): NewReleaseSignal[] {
  const signals = new Map<string, NewReleaseSignal>();

  marketResults.forEach((marketResult, marketIndex) => {
    let rank = 0;
    const seenInMarket = new Set<string>();
    for (const section of marketResult.sections) {
      if (section.type !== 'tracks') continue;
      for (const rawItem of section.items) {
        const item = rawItem as MusicTrack;
        const currentRank = rank++;
        if (!isVideoReleasePresentation(item)) continue;
        if (isLowConfidenceSearchTrack(item)) continue;
        const title = releaseSignalTitle(item);
        const artist = normalizeReleaseIdentityText(item.artistName);
        if (!title || !artist || artist === 'unknown artist') continue;
        const key = `${title}\0${artist}`;
        const existing = signals.get(key);
        if (!existing) {
          signals.set(key, {
            item,
            market: marketResult.market,
            bestRank: currentRank,
            firstMarketIndex: marketIndex,
            marketCount: 1,
          });
          seenInMarket.add(key);
          continue;
        }
        if (!seenInMarket.has(key)) {
          existing.marketCount += 1;
          seenInMarket.add(key);
        }
        if (currentRank < existing.bestRank) {
          existing.bestRank = currentRank;
          existing.market = marketResult.market;
          existing.item = item;
        }
      }
    }
  });

  return [...signals.values()]
    .sort((left, right) => {
      if (left.bestRank !== right.bestRank) return left.bestRank - right.bestRank;
      if (left.marketCount !== right.marketCount) return right.marketCount - left.marketCount;
      const identity = releaseIdentity(left.item).localeCompare(releaseIdentity(right.item));
      return identity || left.firstMarketIndex - right.firstMarketIndex;
    })
    .slice(0, NEW_RELEASE_SIGNAL_LIMIT);
}

function albumBrowseEvidence(payload: any): { year: number | null; trackId: string | null } {
  const content = payload?.contents?.twoColumnBrowseResultsRenderer;
  const header = content?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
    ?.contents?.[0]?.musicResponsiveHeaderRenderer;
  const subtitle = textFromRuns(header?.subtitle);
  const yearText = subtitle.match(/(?:^|\s|•)(20\d{2})(?:$|\s)/)?.[1];
  const shelf = content?.secondaryContents?.sectionListRenderer?.contents?.find(
    (entry: any) => entry?.musicShelfRenderer,
  )?.musicShelfRenderer;
  const tracks = Array.isArray(shelf?.contents) ? shelf.contents : [];
  const trackId = tracks.map((entry: any) => extractVideoId(entry?.musicResponsiveListItemRenderer))
    .find((id: string | null) => Boolean(id)) || null;
  return { year: yearText ? Number(yearText) : null, trackId };
}

function providerPublishDate(payload: any): string | null {
  const microformat = payload?.microformat?.playerMicroformatRenderer ||
    payload?.microformat?.microformatDataRenderer;
  const date = microformat?.publishDate || microformat?.uploadDate;
  return verifiedReleaseDate(date) === null ? null : String(date);
}

type ReleaseEvidenceCache = Map<string, Promise<JsonRecord>>;

function releaseEvidenceRequest(
  endpoint: 'browse' | 'player',
  id: string,
  market: string,
  signal: AbortSignal | undefined,
  cache: ReleaseEvidenceCache,
): Promise<JsonRecord> {
  const key = `${endpoint}:${id}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const request = ytmRequest(
    endpoint,
    endpoint === 'browse' ? { browseId: id } : { videoId: id },
    signal,
    market,
    endpoint === 'player' ? 'WEB' : 'WEB_REMIX',
  );
  cache.set(key, request);
  return request;
}

async function verifyCanonicalReleaseTime(
  signalDate: string,
  candidate: ResolvedNewRelease,
  observedAt: number,
  market: string,
  requestSignal?: AbortSignal,
  cache: ReleaseEvidenceCache = new Map(),
): Promise<boolean> {
  let trackId = 'providerTrackId' in candidate.item
    ? candidate.item.providerTrackId
    : null;
  const albumId = candidate.type === 'albums'
    ? candidate.item.source.id
    : catalogTrackAlbumIds.get(catalogArtistHintKey(candidate.item));
  let albumYear: number | null = null;

  const trackPlayer = trackId && /^[A-Za-z0-9_-]{11}$/.test(trackId)
    ? releaseEvidenceRequest('player', trackId, market, requestSignal, cache).catch(() => null)
    : null;
  if (albumId && /^MPRE[A-Za-z0-9_-]+$/.test(albumId)) {
    const browse = await releaseEvidenceRequest('browse', albumId, market, requestSignal, cache);
    const evidence = albumBrowseEvidence(browse);
    albumYear = evidence.year;
    // Album browse exposes only a year. Reject a known stale year, then use
    // the album's own catalog audio for an exact timestamp when needed.
    const oldestAllowedYear = new Date(observedAt - NEW_RELEASE_MAX_AGE_DAYS * 86_400_000).getUTCFullYear();
    const newestAllowedYear = new Date(observedAt + 86_400_000).getUTCFullYear();
    if (evidence.year === null || evidence.year < oldestAllowedYear || evidence.year > newestAllowedYear) {
      return false;
    }
    if (candidate.type === 'albums') trackId = evidence.trackId;
  }

  if (!trackId || !/^[A-Za-z0-9_-]{11}$/.test(trackId)) return false;
  const player = await (trackPlayer || releaseEvidenceRequest(
    'player', trackId, market, requestSignal, cache,
  ));
  // The label-supplied "Released on" date is the acceptance evidence.
  // Upload timing and linked Album/Single year only corroborate it; neither
  // a fresh OMV nor a fresh audio upload can independently qualify a card.
  const releasedOn = canonicalCatalogReleaseDate(player?.videoDetails?.shortDescription);
  const publishedOn = providerPublishDate(player);
  if (!releasedOn || !publishedOn ||
      !releaseTimeCompatible(releasedOn, publishedOn, observedAt)) return false;
  if (albumYear !== null && albumYear !== Number(releasedOn.slice(0, 4))) return false;
  return releaseTimeCompatible(signalDate, releasedOn, observedAt);
}

async function resolveNewReleaseSignal(
  signal: NewReleaseSignal,
  observedAt: number,
  requestSignal?: AbortSignal,
  cache: ReleaseEvidenceCache = new Map(),
): Promise<ResolvedNewRelease | null> {
  const query = `${signal.item.artistName} ${releaseSignalTitle(signal.item)}`
    .trim()
    .slice(0, 200);
  if (!query || !signal.item.providerTrackId) return null;
  const [signalPlayer, payload] = await Promise.all([
    releaseEvidenceRequest('player', signal.item.providerTrackId, signal.market, requestSignal, cache),
    ytmRequest('search', { query }, requestSignal, signal.market),
  ]);
  const signalDate = providerPublishDate(signalPlayer);
  if (!signalDate || !releaseTimeCompatible(signalDate, signalDate, observedAt)) return null;
  const parsed = splitResults(dedupeMusicEntities(collectMusicItems(payload)));
  const tracks = curateSearchTracks(parsed.tracks);
  const albums = curateSearchAlbums(parsed.albums);

  const candidates: ResolvedNewRelease[] = [
    ...albums.map((item) => ({ type: 'albums' as const, item })),
    ...tracks.map((item) => ({ type: 'tracks' as const, item })),
  ];

  const ranked = candidates.map((candidate, index) => ({
    candidate,
    score: releaseSignalCandidateScore(signal.item, candidate.item),
    index,
  })).filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  // One signal can make at most three candidate checks; date failures never
  // turn into filler and the original signal can never become a Home card.
  for (const entry of ranked.slice(0, 3)) {
    if (await verifyCanonicalReleaseTime(
      signalDate, entry.candidate, observedAt, signal.market, requestSignal, cache,
    )) return entry.candidate;
  }
  return null;
}

async function resolveGlobalNewReleaseSignals(
  signals: readonly NewReleaseSignal[],
  requestSignal?: AbortSignal,
  directSections: MusicDashboardResult['sections'] = [],
): Promise<ResolvedNewRelease[]> {
  if (!signals.length) return [];
  const signalCount = Math.min(signals.length, NEW_RELEASE_SIGNAL_LIMIT);
  const resolved: Array<ResolvedNewRelease | null> = new Array(signalCount).fill(null);
  const failures: unknown[] = [];
  const observedAt = Date.now();
  const cache: ReleaseEvidenceCache = new Map();
  const verifiedIdentities = new Set<string>();
  const verifiedEntities = new Set<string>();
  const canonical: ResolvedNewRelease[] = [];
  let nextIndex = 0;

  const rememberVerified = (item: MusicAlbum | MusicTrack): boolean => {
    const identity = releaseIdentity(item);
    const entity = `${item.source.provider}\0${item.source.id}`;
    if (verifiedIdentities.has(identity) || verifiedEntities.has(entity)) return false;
    verifiedIdentities.add(identity);
    verifiedEntities.add(entity);
    return true;
  };
  for (const section of directSections) {
    for (const item of section.items) rememberVerified(item as MusicAlbum | MusicTrack);
  }

  const throwIfAborted = () => {
    if (requestSignal?.aborted) {
      const abortError = new Error('Discovery request aborted.');
      abortError.name = 'AbortError';
      throw abortError;
    }
  };
  const worker = async (index: number) => {
    throwIfAborted();
    try {
      resolved[index] = await resolveNewReleaseSignal(signals[index], observedAt, requestSignal, cache);
    } catch (error) {
      if (requestSignal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw error;
      }
      failures.push(error);
    }
  };

  const workerCount = Math.min(NEW_RELEASE_RESOLVER_CONCURRENCY, signals.length);
  throwIfAborted();
  // Commit complete, contiguous batches in rank order. Network completion
  // order cannot choose which releases fill the target; at most three signals
  // are in flight, and no later batch starts after the target or cancellation.
  while (nextIndex < signalCount && verifiedIdentities.size < NEW_RELEASE_VERIFIED_TARGET) {
    throwIfAborted();
    const batchStart = nextIndex;
    nextIndex = Math.min(signalCount, batchStart + workerCount);
    await Promise.all(Array.from(
      { length: nextIndex - batchStart },
      (_, offset) => worker(batchStart + offset),
    ));
    throwIfAborted();
    for (let index = batchStart; index < nextIndex; index += 1) {
      const entry = resolved[index];
      if (entry && rememberVerified(entry.item)) canonical.push(entry);
    }
  }

  if (!canonical.length && nextIndex > 0 && failures.length === nextIndex && failures[0] instanceof Error) {
    throw failures[0];
  }
  return canonical;
}

function sectionsFromResolvedNewReleases(
  resolved: readonly ResolvedNewRelease[],
): MusicDashboardResult['sections'] {
  const albums = resolved
    .filter((entry) => entry.type === 'albums')
    .map((entry) => entry.item as MusicAlbum);
  const tracks = resolved
    .filter((entry) => entry.type === 'tracks')
    .map((entry) => entry.item as MusicTrack);
  const sections: MusicDashboardResult['sections'] = [];
  if (albums.length) {
    sections.push({
      id: 'ytmusic-new-release-resolved-albums',
      title: 'New Releases',
      type: 'albums',
      items: albums,
      attribution: 'YouTube Music',
    });
  }
  if (tracks.length) {
    sections.push({
      id: 'ytmusic-new-release-resolved-tracks',
      title: 'New Releases',
      type: 'tracks',
      items: tracks,
      attribution: 'YouTube Music',
    });
  }
  return sections;
}

function mergeGlobalNewReleaseSections(
  marketResults: readonly {
    market: string;
    sections: MusicDashboardResult['sections'];
  }[],
): MusicDashboardResult['sections'] {
  const candidates = new Map<string, GlobalReleaseCandidate>();

  marketResults.forEach((marketResult, marketIndex) => {
    const rankByType: Record<ReleaseSectionType, number> = {
      albums: 0,
      tracks: 0,
    };
    const seenInMarket = new Set<string>();

    for (const section of marketResult.sections) {
      if (section.type !== 'albums' && section.type !== 'tracks') continue;

      for (const rawItem of section.items) {
        const item = rawItem as MusicAlbum | MusicTrack;
        const type = section.type as ReleaseSectionType;
        const rank = rankByType[type]++;
        const key = releaseIdentity(item);
        if (!key.replace('\0', '').trim()) continue;

        const existing = candidates.get(key);
        if (!existing) {
          candidates.set(key, {
            type,
            item,
            bestRank: rank,
            firstMarketIndex: marketIndex,
            marketCount: 1,
            videoPresentation: isVideoReleasePresentation(item),
          });
          seenInMarket.add(key);
          continue;
        }

        if (!seenInMarket.has(key)) {
          existing.marketCount += 1;
          seenInMarket.add(key);
        }
        existing.bestRank = Math.min(existing.bestRank, rank);

        const nextVideoPresentation = isVideoReleasePresentation(item);

        // Presentation quality is authoritative before renderer type. A
        // canonical Track must beat a video-shaped Album/Single renderer, and
        // a canonical Album/Single wins the tie against a canonical Track.
        if (existing.videoPresentation && !nextVideoPresentation) {
          existing.type = type;
          existing.item = item;
          existing.videoPresentation = false;
        } else if (
          existing.videoPresentation === nextVideoPresentation &&
          existing.type === 'tracks' &&
          type === 'albums'
        ) {
          existing.type = type;
          existing.item = item;
          existing.videoPresentation = nextVideoPresentation;
        }
      }
    }
  });

  const ordered = [...candidates.values()].sort((left, right) => {
    if (left.videoPresentation !== right.videoPresentation) {
      return left.videoPresentation ? 1 : -1;
    }
    if (left.bestRank !== right.bestRank) {
      return left.bestRank - right.bestRank;
    }
    if (left.marketCount !== right.marketCount) {
      return right.marketCount - left.marketCount;
    }
    if (left.type !== right.type) {
      return left.type === 'albums' ? -1 : 1;
    }
    const identityOrder = releaseIdentity(left.item).localeCompare(
      releaseIdentity(right.item),
    );
    if (identityOrder !== 0) return identityOrder;
    return left.firstMarketIndex - right.firstMarketIndex;
  });

  const albums = ordered
    .filter(
      (candidate) =>
        candidate.type === 'albums' &&
        !candidate.videoPresentation &&
        !isLowConfidencePresentationTitle(candidate.item.title),
    )
    .map((candidate) => candidate.item as MusicAlbum)
    .slice(0, 48);
  const tracks = ordered
    .filter(
      (candidate) =>
        candidate.type === 'tracks' &&
        !candidate.videoPresentation &&
        !isLowConfidenceSearchTrack(candidate.item as MusicTrack),
    )
    .map((candidate) => candidate.item as MusicTrack)
    .slice(0, 48);

  const sections: MusicDashboardResult['sections'] = [];
  if (albums.length > 0) {
    sections.push({
      id: 'ytmusic-new-releases-global-albums',
      title: 'New Releases',
      type: 'albums',
      items: albums,
      attribution: 'YouTube Music',
    });
  }
  if (tracks.length > 0) {
    sections.push({
      id: 'ytmusic-new-releases-global-tracks',
      title: 'New Releases',
      type: 'tracks',
      items: tracks,
      attribution: 'YouTube Music',
    });
  }
  return sections;
}

function collectContinuationTokens(payload: any, limit = 2): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  const visit = (value: any) => {
    if (!value || typeof value !== 'object' || tokens.length >= limit) return;
    const token =
      nav(value, [
        'continuationItemRenderer',
        'continuationEndpoint',
        'continuationCommand',
        'token',
      ]) ||
      nav(value, ['nextContinuationData', 'continuation']) ||
      nav(value, [
        'continuationEndpoint',
        'continuationCommand',
        'token',
      ]);

    if (token && !seen.has(String(token))) {
      seen.add(String(token));
      tokens.push(String(token));
    }

    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  visit(payload);
  return tokens;
}

function collectSearchSuggestions(payload: any): string[] {
  const values: string[] = [];
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return;

    const runs = value.searchSuggestionRenderer?.suggestion?.runs;
    if (Array.isArray(runs)) {
      const label = runs
        .map((run: any) => run?.text || '')
        .join('')
        .trim();
      if (label && !values.includes(label)) values.push(label);
    }

    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  visit(payload);
  return values.slice(0, 10);
}

function shelfTitle(renderer: any, fallback: string): string {
  const header =
    renderer?.header?.musicCarouselShelfBasicHeaderRenderer ||
    renderer?.header?.musicShelfRenderer?.header ||
    renderer?.header ||
    renderer;
  return (
    textFromRuns(header?.title) ||
    textFromRuns(header?.strapline) ||
    fallback
  );
}

function collectCatalogSections(payload: any): MusicDashboardResult['sections'] {
  const sections: MusicDashboardResult['sections'] = [];
  const seen = new Set<string>();

  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return;

    const renderer =
      value.musicCarouselShelfRenderer ||
      value.musicShelfRenderer ||
      value.gridRenderer;

    if (renderer) {
      const sourceItems = renderer.contents || renderer.items || [];
      const groups = splitResults(collectMusicItems(sourceItems));
      const candidates = [
        { type: 'tracks' as const, items: groups.tracks },
        { type: 'albums' as const, items: groups.albums },
        { type: 'artists' as const, items: groups.artists },
        { type: 'playlists' as const, items: groups.playlists },
      ]
        .filter((group) => group.items.length)
        .sort((left, right) => right.items.length - left.items.length);

      const strongest = candidates[0];
      if (strongest) {
        const title = shelfTitle(
          renderer,
          `YouTube Music ${strongest.type}`,
        );
        const identity = `${title.toLowerCase()}\0${strongest.type}`;
        if (!seen.has(identity)) {
          seen.add(identity);
          sections.push({
            id: `ytmusic-shelf-${sections.length + 1}`,
            title,
            type: strongest.type,
            items: strongest.items.slice(0, 24),
            attribution: 'YouTube Music',
          });
        }
      }
    }

    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };

  visit(payload);
  return sections;
}


function collectSearchDiscoveryCategories(
  payload: any,
): WavenSearchDiscoveryCategory[] {
  const sections =
    nav(payload, [
      'contents',
      'singleColumnBrowseResultsRenderer',
      'tabs',
      0,
      'tabRenderer',
      'content',
      'sectionListRenderer',
      'contents',
    ]) || [];
  const categories: WavenSearchDiscoveryCategory[] = [];
  const seen = new Set<string>();

  for (const section of sections) {
    const grid = section?.gridRenderer;
    if (!grid) continue;

    const group =
      textFromRuns(grid?.header?.gridHeaderRenderer?.title) || 'Explore';

    for (const item of grid.items || []) {
      const renderer = item?.musicNavigationButtonRenderer;
      const title = textFromRuns(renderer?.buttonText);
      const endpoint = renderer?.clickCommand?.browseEndpoint;
      const params = String(endpoint?.params || '').trim();
      const browseId = String(
        endpoint?.browseId || 'FEmusic_moods_and_genres_category',
      ).trim();

      if (!title || !params || params.length > 4_000) continue;
      if (browseId !== 'FEmusic_moods_and_genres_category') continue;

      const identity = `${browseId}\0${params}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      categories.push({
        id: `ytmusic-discovery-${categories.length + 1}`,
        title,
        group,
        browseId,
        params,
        accentColor: colorFromArgb(renderer?.solid?.leftStripeColor),
      });
    }
  }

  return categories;
}

function discoverySectionsFromPayload(
  payload: any,
  fallbackPrefix: string,
): MusicDashboardResult['sections'] {
  const sections = collectCatalogSections(payload);
  if (sections.length) return sections;

  const groups = splitResults(dedupeMusicEntities(collectMusicItems(payload)));
  const fallback: MusicDashboardResult['sections'] = [];
  const candidates = [
    { type: 'tracks' as const, items: groups.tracks },
    { type: 'artists' as const, items: groups.artists },
    { type: 'albums' as const, items: groups.albums },
    { type: 'playlists' as const, items: groups.playlists },
  ];

  for (const candidate of candidates) {
    if (!candidate.items.length) continue;
    fallback.push({
      id: `${fallbackPrefix}-${candidate.type}`,
      title: candidate.type,
      type: candidate.type,
      items: candidate.items.slice(0, 36),
      attribution: 'YouTube Music',
    });
  }

  return fallback;
}


function newReleaseSectionsFromPayload(
  payload: any,
  fallbackPrefix: string,
): MusicDashboardResult['sections'] {
  const shelfSections = discoverySectionsFromPayload(payload, fallbackPrefix);
  const flat = splitResults(dedupeMusicEntities(collectMusicItems(payload)));

  const albums = dedupeMusicEntities([
    ...shelfSections
      .filter((section) => section.type === 'albums')
      .flatMap((section) => section.items as MusicAlbum[]),
    ...flat.albums,
  ]);
  const tracks = dedupeMusicEntities([
    ...shelfSections
      .filter((section) => section.type === 'tracks')
      .flatMap((section) => section.items as MusicTrack[]),
    ...flat.tracks,
  ]);

  const sections: MusicDashboardResult['sections'] = [];
  if (albums.length > 0) {
    sections.push({
      id: `${fallbackPrefix}-albums`,
      title: 'New Releases',
      type: 'albums',
      items: albums.slice(0, 64),
      attribution: 'YouTube Music',
    });
  }
  if (tracks.length > 0) {
    sections.push({
      id: `${fallbackPrefix}-tracks`,
      title: 'New Releases',
      type: 'tracks',
      items: tracks.slice(0, 64),
      attribution: 'YouTube Music',
    });
  }
  return sections;
}

function detailHeader<T extends MusicArtist | MusicAlbum>(
  payload: any,
  kind: 'artist' | 'album',
  fallback: T,
): T {
  const header = kind === 'album'
    ? albumDetailHeaderRenderer(payload)
    : payload?.header?.musicImmersiveHeaderRenderer ||
      payload?.header?.musicDetailHeaderRenderer ||
      payload?.header?.musicEditablePlaylistDetailHeaderRenderer ||
      null;

  if (!header) return fallback;

  const title =
    textFromRuns(header.title) ||
    ('name' in fallback ? fallback.name : fallback.title);
  const artworkUrl =
    bestThumb(thumbnailList(header), 1200) ||
    fallback.artworkUrl ||
    ('profileImageUrl' in fallback ? fallback.profileImageUrl : null) ||
    null;

  if (kind === 'artist' && 'name' in fallback) {
    return {
      ...fallback,
      name: title || fallback.name,
      profileImageUrl: artworkUrl,
      artworkUrl,
    } as T;
  }

  if ('title' in fallback) {
    const evidence = albumDetailPresentationEvidence(payload);
    return {
      ...fallback,
      title: title || fallback.title,
      artistName: evidence.artistName || fallback.artistName || null,
      releaseDate: evidence.releaseDate || fallback.releaseDate || null,
      primaryType: evidence.primaryType || fallback.primaryType || null,
      artworkUrl,
    } as T;
  }

  return fallback;
}

function detailBrowseId(
  item: MusicArtist | MusicAlbum,
  expectedProvider = 'ytmusic-metadata',
): string {
  if (item.source?.provider !== expectedProvider) {
    throw new Error('This music detail source is unavailable.');
  }

  const browseId = String(item.source?.id || '').trim();
  if (!browseId || browseId.length > 256 || !/^[A-Za-z0-9_-]+$/.test(browseId)) {
    throw new Error('This music detail identity is unavailable.');
  }

  return browseId;
}

async function refreshVisitorId(signal?: AbortSignal): Promise<void> {
  const response = await fetch(YTMUSIC_ORIGIN, {
    headers: headers(),
    signal,
  });
  if (!response.ok) return;

  const html = await response.text();
  const match = html.match(/ytcfg\.set\s*\(\s*({.+?})\s*\)\s*;/);
  if (!match) return;

  try {
    visitorId = JSON.parse(match[1])?.VISITOR_DATA || visitorId;
  } catch {
    // Anonymous requests still work when a visitor ID cannot be recovered.
  }
}


async function ensureVisitorId(signal?: AbortSignal): Promise<void> {
  if (visitorId || visitorRefreshAttempted) return;
  if (!visitorRefreshPromise) {
    visitorRefreshPromise = refreshVisitorId(signal)
      .catch(() => {})
      .finally(() => {
        // Anonymous provider requests work without a visitor ID. Avoid a
        // redundant homepage fetch before every bounded catalog request.
        visitorRefreshAttempted = true;
        visitorRefreshPromise = null;
      });
  }
  await visitorRefreshPromise;
}

async function ytmRequest(
  endpoint: string,
  body: JsonRecord,
  signal?: AbortSignal,
  market = 'US',
  clientName: 'WEB_REMIX' | 'WEB' = 'WEB_REMIX',
): Promise<JsonRecord> {
  await ensureVisitorId(signal);

  const response = await fetch(
    `${YTMUSIC_BASE}/${endpoint}?alt=json&key=${YTMUSIC_KEY}`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...context(market, clientName), ...body }),
      signal,
    },
  );

  if (response.status === 429) {
    throw new Error('YouTube Music rate limited WAVEN.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('YouTube Music rejected this session.');
  }
  if (!response.ok) {
    throw new Error(`YouTube Music returned ${response.status}.`);
  }

  return response.json() as Promise<JsonRecord>;
}

export interface WavenArtistPresentationProvider
  extends MusicMetadataProvider<AbortSignal> {
  getArtistPresentation(
    artist: MusicArtist,
    requestContext?: { signal?: AbortSignal },
  ): Promise<MusicArtist>;
}

export function createYouTubeMusicMetadataProvider(): WavenArtistPresentationProvider {
  return {
    id: 'ytmusic-metadata',
    kind: 'metadata',
    name: 'YouTube Music',
    capabilities: [
      'tracks',
      'artists',
      'albums',
      'playlists',
      'continuation',
      'suggestions',
      'artistDetail',
      'albumDetail',
    ],

    async search(query, requestContext = {}) {
      const safeQuery = String(query || '').trim().slice(0, 200);
      if (!safeQuery) return splitResults([]);

      const payload = await ytmRequest(
        'search',
        { query: safeQuery },
        requestContext.signal,
      );
      const result = splitResults(collectMusicItems(payload));
      return {
        ...canonicalizeWavenSearchResult({
          ...result,
          tracks: curateSearchTracks(result.tracks),
          albums: curateSearchAlbums(result.albums),
        }),
        continuation: collectContinuationTokens(payload, 1)[0] || null,
      };
    },

    async continueSearch(continuation, requestContext = {}) {
      const token = String(continuation || '');
      if (!token || token.length > 4_000) {
        return { ...splitResults([]), continuation: null };
      }

      const payload = await ytmRequest(
        'search',
        { continuation: token },
        requestContext.signal,
      );
      const result = splitResults(collectMusicItems(payload));
      return {
        ...canonicalizeWavenSearchResult({
          ...result,
          tracks: curateSearchTracks(result.tracks),
          albums: curateSearchAlbums(result.albums),
        }),
        continuation: collectContinuationTokens(payload, 1)[0] || null,
      };
    },

    async getArtistPresentation(artist, requestContext = {}): Promise<MusicArtist> {
      const browseId = detailBrowseId(artist);
      const payload = await ytmRequest(
        'browse',
        { browseId },
        requestContext.signal,
      );
      const enriched = detailHeader(payload, 'artist', artist);
      rememberWavenPresentation(enriched, 'artist');
      return enriched;
    },

    async getArtist(artist, requestContext = {}): Promise<MusicArtistDetail> {
      const browseId = detailBrowseId(artist);
      const payload = await ytmRequest(
        'browse',
        { browseId },
        requestContext.signal,
      );
      const continuation = collectContinuationTokens(payload, 1)[0] || null;
      let continuationPayload: JsonRecord | null = null;

      if (continuation && !requestContext.signal?.aborted) {
        try {
          continuationPayload = await ytmRequest(
            'browse',
            { continuation },
            requestContext.signal,
          );
        } catch (error) {
          if (requestContext.signal?.aborted) throw error;
        }
      }

      const detailItems = [
        ...collectMusicItems(payload),
        ...collectMusicItems(continuationPayload),
      ];
      const result = splitResults(dedupeMusicEntities(detailItems));

      const enrichedArtist = detailHeader(payload, 'artist', artist);
      rememberWavenPresentation(enrichedArtist, 'artist');
      return canonicalizeWavenArtistDetail({
        artist: enrichedArtist,
        biography: '',
        tracks: result.tracks,
        albums: result.albums,
      });
    },

    async getAlbum(album, requestContext = {}): Promise<MusicAlbumDetail> {
      const browseId = detailBrowseId(album);
      const payload = await ytmRequest(
        'browse',
        { browseId },
        requestContext.signal,
      );
      const result = splitResults(
        dedupeMusicEntities(collectMusicItems(payload)),
      );
      const enrichedAlbum = detailHeader(payload, 'album', album);
      let tracks = result.tracks;

      if (!tracks.length && isSingleRelease(enrichedAlbum)) {
        const directTrack = singleTrackFromAlbumPlayEndpoint(enrichedAlbum, payload);
        if (directTrack) {
          tracks = [directTrack];
        } else {
          const resolvedTrack = await resolveSingleTrackFromCatalog(
            enrichedAlbum,
            requestContext.signal,
          );
          if (resolvedTrack) tracks = [resolvedTrack];
        }
      }

      const detail = canonicalizeWavenAlbumDetail({
        album: enrichedAlbum,
        tracks,
      });
      if (!detail.tracks.length) {
        throw new Error('This release track listing is unavailable.');
      }
      return detail;
    },

    async getSuggestions(query, requestContext = {}) {
      const input = String(query || '').trim().slice(0, 120);
      if (input.length < 2) return [];

      const payload = await ytmRequest(
        'music/get_search_suggestions',
        { input },
        requestContext.signal,
      );
      return collectSearchSuggestions(payload);
    },
  };
}

export function createYouTubeMusicSearchDiscoveryProvider(): WavenSearchDiscoveryProvider {
  return {
    id: 'ytmusic-search-discovery',
    name: 'YouTube Music Discovery',

    async getCategories(requestContext = {}) {
      const payload = await ytmRequest(
        'browse',
        { browseId: 'FEmusic_moods_and_genres' },
        requestContext.signal,
      );
      return collectSearchDiscoveryCategories(payload);
    },

    async getCategory(category, requestContext = {}) {
      if (
        category.browseId !== 'FEmusic_moods_and_genres_category' ||
        !category.params ||
        category.params.length > 4_000
      ) {
        throw new Error('This discovery category is unavailable.');
      }

      const payload = await ytmRequest(
        'browse',
        {
          browseId: category.browseId,
          params: category.params,
        },
        requestContext.signal,
      );
      return canonicalizeWavenDashboard({
        sections: discoverySectionsFromPayload(
          payload,
          `ytmusic-category-${category.id}`,
        ),
      });
    },

    async getNewReleases(requestContext = {}) {
      const settled = await Promise.allSettled(
        WAVEN_GLOBAL_DISCOVERY_MARKETS.map(async (market) => {
          const payload = await ytmRequest(
            'browse',
            { browseId: 'FEmusic_new_releases' },
            requestContext.signal,
            market,
          );
          return {
            market,
            sections: newReleaseSectionsFromPayload(
              payload,
              `ytmusic-new-releases-${market.toLowerCase()}`,
            ),
          };
        }),
      );

      if (requestContext.signal?.aborted) {
        const abortError = new Error('Discovery request aborted.');
        abortError.name = 'AbortError';
        throw abortError;
      }

      const marketResults = settled.flatMap((entry) =>
        entry.status === 'fulfilled' ? [entry.value] : [],
      );

      if (marketResults.length === 0) {
        const firstFailure = settled.find(
          (entry): entry is PromiseRejectedResult => entry.status === 'rejected',
        );
        throw firstFailure?.reason instanceof Error
          ? firstFailure.reason
          : new Error('New releases are unavailable right now.');
      }

      // The anonymous FEmusic_new_releases surface can currently expose
      // a Music videos shelf. Those OMVs are freshness signals only. Resolve
      // the strongest cross-market signals back into canonical catalog music
      // before allowing Home to present them.
      const directSections = mergeGlobalNewReleaseSections(marketResults);
      const releaseSignals = rankGlobalNewReleaseSignals(marketResults);
      const resolvedReleases = await resolveGlobalNewReleaseSignals(
        releaseSignals,
        requestContext.signal,
        directSections,
      );
      const resolvedSections = sectionsFromResolvedNewReleases(resolvedReleases);

      return canonicalizeWavenDashboard({
        sections: mergeGlobalNewReleaseSections([
          { market: 'direct-canonical', sections: directSections },
          { market: 'canonical-resolution', sections: resolvedSections },
        ]),
      });
    },
  };
}

export function createYouTubeMusicDashboardProvider(): MusicDashboardProvider<AbortSignal> {
  return {
    id: 'ytmusic-dashboard',
    kind: 'dashboard',
    name: 'YouTube Music Home',
    capabilities: ['home', 'discovery'],

    async getDashboard(requestContext = {}) {
      const payload = await ytmRequest(
        'browse',
        { browseId: 'FEmusic_home' },
        requestContext.signal,
      );

      const sections: MusicDashboardResult['sections'] = [
        ...collectCatalogSections(payload),
      ];
      const flatDashboard = splitResults(collectMusicItems(payload));

      for (const target of HOME_DISCOVERY_FILLERS) {
        if (sections.some((section) => section.type === target.type)) continue;
        const items = flatDashboard[target.type];
        if (!items.length) continue;
        sections.push({
          id: `ytmusic-home-flat-${target.type}`,
          title: target.type,
          type: target.type,
          items: items.slice(0, target.limit),
          attribution: 'YouTube Music',
        });
      }

      const missingTargets = HOME_DISCOVERY_FILLERS.filter(
        (target) => !sections.some((section) => section.type === target.type),
      );

      const directedResults = await Promise.all(
        missingTargets.map(async (target) => {
          const queryResults = await Promise.all(
            target.queries.map(async (query) => {
              try {
                const directedPayload = await ytmRequest(
                  'search',
                  { query },
                  requestContext.signal,
                );
                return splitResults(collectMusicItems(directedPayload))[target.type];
              } catch (error) {
                if (requestContext.signal?.aborted) throw error;
                return [];
              }
            }),
          );

          return {
            target,
            items: dedupeMusicEntities(queryResults.flat()),
          };
        }),
      );

      for (const { target, items } of directedResults) {
        if (!items.length) continue;
        sections.push({
          id: `ytmusic-home-directed-${target.type}`,
          title: target.type,
          type: target.type,
          items: items.slice(0, target.limit),
          attribution: 'YouTube Music',
        });
      }

      // WAVEN owns the core Home composition. The provider dashboard remains
      // first choice, but a variable provider response must not make a core
      // Songs/Artists/Albums/Playlists lane appear or disappear. Missing lanes
      // are filled only by type-directed public discovery and then filtered by
      // the existing strict entity classifier. Exact catalog items may still
      // vary with provider availability; the Home structure does not.
      return canonicalizeWavenDashboard({ sections });
    },
  };
}
