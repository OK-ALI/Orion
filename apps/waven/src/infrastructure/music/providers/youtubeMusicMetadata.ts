import type {
  MusicAlbum,
  MusicArtist,
  MusicDashboardProvider,
  MusicDashboardResult,
  MusicEntity,
  MusicMetadataProvider,
  MusicPlaylist,
  MusicSearchResult,
  MusicTrack,
} from '../../../domain/music';

const YTMUSIC_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const YTMUSIC_BASE = 'https://music.youtube.com/youtubei/v1';
const YTMUSIC_ORIGIN = 'https://music.youtube.com';

type JsonRecord = Record<string, any>;

let visitorId = '';

function context() {
  return {
    context: {
      client: {
        clientName: 'WEB_REMIX',
        clientVersion: '1.20240724.00.00',
        hl: 'en',
        gl: 'US',
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

function bestThumb(thumbnails: any = []): string | null {
  const list = Array.isArray(thumbnails) ? thumbnails : [];
  const url = list.at(-1)?.url || list[0]?.url || null;
  return url ? String(url).replace(/w\d+-h\d+/i, 'w544-h544') : null;
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

function thumbnailList(renderer: any): any[] {
  return (
    nav(renderer, [
      'thumbnail',
      'musicThumbnailRenderer',
      'thumbnail',
      'thumbnails',
    ]) ||
    nav(renderer, [
      'thumbnailRenderer',
      'musicThumbnailRenderer',
      'thumbnail',
      'thumbnails',
    ]) ||
    nav(renderer, ['thumbnail', 'thumbnails']) ||
    []
  );
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

function normalizeEndpointItem(renderer: any): MusicEntity | null {
  const title = titleFor(renderer);
  if (!title) return null;

  const endpoint = endpointFor(renderer);
  const watch = endpoint?.watchEndpoint;
  const browse = endpoint?.browseEndpoint;
  const browseId = browse?.browseId || extractBrowseId(renderer);
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

  if (videoId) {
    return {
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
  }

  if (!browseId) return null;
  const source = { provider: 'ytmusic-metadata', id: browseId };

  if (type === 'MUSIC_PAGE_TYPE_ARTIST') {
    return {
      id: `ytmusic-artist:${browseId}`,
      name: title,
      profileImageUrl: artworkUrl,
      artworkUrl,
      source,
    } satisfies MusicArtist;
  }

  if (
    type === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
    String(browseId).startsWith('VL')
  ) {
    return {
      id: `ytmusic-playlist:${browseId}`,
      title,
      artworkUrl,
      source,
    } satisfies MusicPlaylist;
  }

  if (!isAlbumBrowse(type, browseId)) return null;

  return {
    id: `ytmusic-album:${browseId}`,
    title,
    artistName: artistFromRuns(runs),
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
  const browseId = titleEndpoint.id || extractBrowseId(renderer);
  const browsePageType = pageType(
    titleEndpoint.endpoint || renderer.navigationEndpoint,
  );
  const thumbnails =
    nav(renderer, [
      'thumbnail',
      'musicThumbnailRenderer',
      'thumbnail',
      'thumbnails',
    ]) || [];
  const durationText = subtitleRuns.find((run: any) =>
    /^\d+:\d+/.test(run?.text || ''),
  )?.text;
  const artistName =
    subtitleRuns.find((run: any) =>
      nav(run, [
        'navigationEndpoint',
        'browseEndpoint',
        'browseId',
      ])?.startsWith('UC'),
    )?.text ||
    metadata[0] ||
    'Unknown artist';

  if (videoId) {
    return {
      id: `ytmusic:${videoId}`,
      providerTrackId: videoId,
      provider: 'ytmusic',
      title,
      artistName,
      albumTitle: albumFromMetadata(metadata),
      durationMs: parseDuration(durationText),
      artworkUrl: bestThumb(thumbnails),
      source: { provider: 'ytmusic-metadata', id: videoId },
      providerRefs: [{ provider: 'ytmusic-metadata', id: videoId }],
    } satisfies MusicTrack;
  }

  if (browseId && browsePageType === 'MUSIC_PAGE_TYPE_ARTIST') {
    return {
      id: `ytmusic-artist:${browseId}`,
      name: title,
      profileImageUrl: bestThumb(thumbnails),
      artworkUrl: bestThumb(thumbnails),
      source: { provider: 'ytmusic-metadata', id: String(browseId) },
    } satisfies MusicArtist;
  }

  if (
    browsePageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
    String(browseId).startsWith('VL')
  ) {
    return {
      id: `ytmusic-playlist:${browseId}`,
      title,
      artworkUrl: bestThumb(thumbnails),
      source: { provider: 'ytmusic-metadata', id: String(browseId) },
    } satisfies MusicPlaylist;
  }

  if (browseId && isAlbumBrowse(browsePageType, browseId)) {
    return {
      id: `ytmusic-album:${browseId}`,
      title,
      artistName,
      artworkUrl: bestThumb(thumbnails),
      source: { provider: 'ytmusic-metadata', id: String(browseId) },
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

  return {
    id: `ytmusic:${videoId}`,
    providerTrackId: videoId,
    provider: 'ytmusic',
    title,
    artistName: artistFromRuns(bylineRuns),
    durationMs: parseDuration(
      panel.lengthText?.simpleText || textFromRuns(panel.lengthText),
    ),
    artworkUrl: bestThumb(panel.thumbnail?.thumbnails || []),
    source: { provider: 'ytmusic-metadata', id: videoId },
    providerRefs: [{ provider: 'ytmusic-metadata', id: videoId }],
  } satisfies MusicTrack;
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
      if (item) items.push(item);
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

async function ytmRequest(
  endpoint: string,
  body: JsonRecord,
  signal?: AbortSignal,
): Promise<JsonRecord> {
  if (!visitorId) {
    await refreshVisitorId(signal).catch(() => {});
  }

  const response = await fetch(
    `${YTMUSIC_BASE}/${endpoint}?alt=json&key=${YTMUSIC_KEY}`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...context(), ...body }),
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

export function createYouTubeMusicMetadataProvider(): MusicMetadataProvider<AbortSignal> {
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
    ],

    async search(query, requestContext = {}) {
      const safeQuery = String(query || '').trim().slice(0, 200);
      if (!safeQuery) return splitResults([]);

      const payload = await ytmRequest(
        'search',
        { query: safeQuery },
        requestContext.signal,
      );
      return {
        ...splitResults(collectMusicItems(payload)),
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
      return {
        ...splitResults(collectMusicItems(payload)),
        continuation: collectContinuationTokens(payload, 1)[0] || null,
      };
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

      const shelfSections = collectCatalogSections(payload);
      if (shelfSections.length) {
        return { sections: shelfSections };
      }

      const fallbackPayload = await ytmRequest(
        'search',
        { query: 'Top songs' },
        requestContext.signal,
      );
      const fallback = splitResults(collectMusicItems(fallbackPayload));
      const sections: MusicDashboardResult['sections'] = [];

      if (fallback.tracks.length) {
        sections.push({
          id: 'ytmusic-home-tracks',
          title: 'YouTube Music picks',
          type: 'tracks',
          items: fallback.tracks.slice(0, 24),
          attribution: 'YouTube Music',
        });
      }
      if (fallback.albums.length) {
        sections.push({
          id: 'ytmusic-home-albums',
          title: 'Albums and releases',
          type: 'albums',
          items: fallback.albums.slice(0, 18),
          attribution: 'YouTube Music',
        });
      }
      if (fallback.artists.length) {
        sections.push({
          id: 'ytmusic-home-artists',
          title: 'Artists',
          type: 'artists',
          items: fallback.artists.slice(0, 18),
          attribution: 'YouTube Music',
        });
      }

      return { sections };
    },
  };
}
