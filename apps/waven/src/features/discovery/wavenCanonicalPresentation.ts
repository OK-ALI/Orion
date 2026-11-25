import type {
  MusicAlbum,
  MusicAlbumDetail,
  MusicArtist,
  MusicArtistDetail,
  MusicDashboardResult,
  MusicEntity,
  MusicPlaylist,
  MusicSearchResult,
  MusicTrack,
} from '../../domain/music';

export type WavenPresentationKind = 'track' | 'artist' | 'album' | 'playlist';

const SESSION_PRESENTATION_LIMIT = 1024;
const sessionPresentation = new Map<string, MusicEntity>();

export interface WavenMediaPresentationEvidence {
  secondary?: boolean;
  lowConfidence?: boolean;
  rendererType?: string | null;
  reason?: string | null;
}

const sessionMediaPresentationEvidence = new Map<string, WavenMediaPresentationEvidence>();

export const WAVEN_SECONDARY_PRESENTATION_PATTERN = new RegExp(
  [
    String.raw`\b(?:official\s+)?music\s+video\b`,
    String.raw`\b(?:official\s+)?video\b`,
    String.raw`\bvideo\s+oficial\b`,
    String.raw`\bvídeo\s+oficial\b`,
    String.raw`\boffizielles?\s+(?:musik)?video\b`,
    String.raw`\bclip\s+officiel\b`,
    String.raw`\bdance\s+performance(?:\s+video)?\b`,
    String.raw`\bperformance(?:\s+video)?\b`,
    String.raw`\blive\s+performance\b`,
    String.raw`\blive\s+(?:version|session|recording)\b`,
    String.raw`\bplay\s*[▶►]\s*`,
    String.raw`\blyric(?:s)?(?:\s+video)?\b`,
    String.raw`\bvisuali[sz]er\b`,
    String.raw`(?:^|[^\p{L}\p{N}])mv(?:$|[^\p{L}\p{N}])`,
    String.raw`\bfancam\b`,
    String.raw`ミュージックビデオ`,
    String.raw`뮤직비디오`,
  ].join('|'),
  'iu',
);

export const WAVEN_LOW_CONFIDENCE_PRESENTATION_PATTERN = new RegExp(
  [
    String.raw`\bai\s+fan\s+song\b`,
    String.raw`\bfan[- ]?made\b`,
    String.raw`\bfan\s+song\b`,
    String.raw`\bunofficial(?:\s+audio|\s+video)?\b`,
    String.raw`\bre-?upload(?:ed)?\b`,
    String.raw`\breaction\b`,
    String.raw`\bnightcore\b`,
    String.raw`\b8d\s+audio\b`,
    String.raw`\bsped\s+up\b`,
    String.raw`\bslowed(?:\s+(?:and|&)\s+reverb)?\b`,
  ].join('|'),
  'iu',
);

function cleanText(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeWavenArtworkUrl(value: unknown): string | null {
  const url = cleanText(value);
  return url || null;
}

function presentationKind(item: MusicEntity): WavenPresentationKind {
  if ('name' in item) return 'artist';
  if ('providerTrackId' in item || 'providerRefs' in item || 'durationMs' in item) {
    return 'track';
  }
  if (
    'description' in item ||
    String(item.id || '').toLowerCase().includes('playlist') ||
    String(item.source.id || '').startsWith('VL')
  ) {
    return 'playlist';
  }
  return 'album';
}

export function wavenPresentationKey(
  kind: WavenPresentationKind,
  provider: string,
  id: string,
): string {
  return `${kind}:${provider}\0${id}`;
}

function keyForEntity(item: MusicEntity, kind = presentationKind(item)): string {
  return wavenPresentationKey(kind, item.source.provider, item.source.id);
}

export function rememberWavenMediaPresentationEvidence(
  item: MusicEntity,
  evidence: WavenMediaPresentationEvidence,
  kind: WavenPresentationKind = presentationKind(item),
): void {
  const key = keyForEntity(item, kind);
  const existing = sessionMediaPresentationEvidence.get(key);
  sessionMediaPresentationEvidence.set(key, {
    ...existing,
    ...evidence,
    secondary: Boolean(existing?.secondary || evidence.secondary),
    lowConfidence: Boolean(existing?.lowConfidence || evidence.lowConfidence),
    rendererType: evidence.rendererType || existing?.rendererType || null,
    reason: evidence.reason || existing?.reason || null,
  });
}

export function readWavenMediaPresentationEvidence(
  item: MusicEntity,
  kind: WavenPresentationKind = presentationKind(item),
): WavenMediaPresentationEvidence | null {
  return sessionMediaPresentationEvidence.get(keyForEntity(item, kind)) || null;
}

export function wavenEntityArtworkUrl(item: MusicEntity | null | undefined): string | null {
  if (!item) return null;
  if ('name' in item) {
    return normalizeWavenArtworkUrl(item.profileImageUrl) || normalizeWavenArtworkUrl(item.artworkUrl);
  }
  return normalizeWavenArtworkUrl(item.artworkUrl);
}

function artworkResolutionScore(url: string | null): number {
  if (!url) return 0;
  const dimensions = url.match(/(?:^|[^a-z])w(\d+)-h(\d+)(?:[^a-z]|$)/i);
  if (dimensions) return Number(dimensions[1]) * Number(dimensions[2]);
  const square = url.match(/[?=&](?:w|sz)=(\d+)/i);
  if (square) return Number(square[1]) ** 2;
  return 1;
}

function bestArtwork(existing: string | null, incoming: string | null): string | null {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return artworkResolutionScore(incoming) > artworkResolutionScore(existing)
    ? incoming
    : existing;
}

function mergeTrack(existing: MusicTrack, incoming: MusicTrack): MusicTrack {
  return {
    ...existing,
    ...incoming,
    title: cleanText(incoming.title) || existing.title,
    artistName: cleanText(incoming.artistName) || existing.artistName,
    albumTitle: cleanText(incoming.albumTitle) || existing.albumTitle || null,
    albumArtist: cleanText(incoming.albumArtist) || existing.albumArtist || null,
    durationMs: incoming.durationMs ?? existing.durationMs ?? null,
    artworkUrl: bestArtwork(
      normalizeWavenArtworkUrl(existing.artworkUrl),
      normalizeWavenArtworkUrl(incoming.artworkUrl),
    ),
    source: existing.source,
  };
}

function mergeArtist(existing: MusicArtist, incoming: MusicArtist): MusicArtist {
  const artworkUrl = bestArtwork(
    wavenEntityArtworkUrl(existing),
    wavenEntityArtworkUrl(incoming),
  );
  return {
    ...existing,
    ...incoming,
    name: cleanText(incoming.name) || existing.name,
    profileImageUrl: artworkUrl,
    artworkUrl,
    source: existing.source,
  };
}

function mergeAlbum(existing: MusicAlbum, incoming: MusicAlbum): MusicAlbum {
  return {
    ...existing,
    ...incoming,
    title: cleanText(incoming.title) || existing.title,
    artistName: cleanText(incoming.artistName) || existing.artistName || null,
    releaseDate: cleanText(incoming.releaseDate) || existing.releaseDate || null,
    primaryType: cleanText(incoming.primaryType) || existing.primaryType || null,
    artworkUrl: bestArtwork(
      normalizeWavenArtworkUrl(existing.artworkUrl),
      normalizeWavenArtworkUrl(incoming.artworkUrl),
    ),
    source: existing.source,
  };
}

function mergePlaylist(existing: MusicPlaylist, incoming: MusicPlaylist): MusicPlaylist {
  return {
    ...existing,
    ...incoming,
    title: cleanText(incoming.title) || existing.title,
    description: cleanText(incoming.description) || existing.description || null,
    artworkUrl: bestArtwork(
      normalizeWavenArtworkUrl(existing.artworkUrl),
      normalizeWavenArtworkUrl(incoming.artworkUrl),
    ),
    source: existing.source,
  };
}

function mergeSameIdentity<T extends MusicEntity>(
  existing: T,
  incoming: T,
  kind: WavenPresentationKind,
): T {
  if (
    existing.source.provider !== incoming.source.provider ||
    existing.source.id !== incoming.source.id
  ) {
    return incoming;
  }
  if (kind === 'artist') return mergeArtist(existing as MusicArtist, incoming as MusicArtist) as T;
  if (kind === 'track') return mergeTrack(existing as MusicTrack, incoming as MusicTrack) as T;
  if (kind === 'playlist') return mergePlaylist(existing as MusicPlaylist, incoming as MusicPlaylist) as T;
  return mergeAlbum(existing as MusicAlbum, incoming as MusicAlbum) as T;
}

export function rememberWavenPresentation<T extends MusicEntity>(
  item: T,
  kind: WavenPresentationKind = presentationKind(item),
): T {
  const key = keyForEntity(item, kind);
  const existing = sessionPresentation.get(key) as T | undefined;
  const merged = existing ? mergeSameIdentity(existing, item, kind) : item;
  sessionPresentation.delete(key);
  sessionPresentation.set(key, merged);

  while (sessionPresentation.size > SESSION_PRESENTATION_LIMIT) {
    const oldest = sessionPresentation.keys().next().value;
    if (!oldest) break;
    sessionPresentation.delete(oldest);
  }
  return merged;
}

export function readWavenPresentation<T extends MusicEntity>(
  item: T,
  kind: WavenPresentationKind = presentationKind(item),
): T {
  const existing = sessionPresentation.get(keyForEntity(item, kind)) as T | undefined;
  return existing ? mergeSameIdentity(existing, item, kind) : rememberWavenPresentation(item, kind);
}

export function seedWavenPresentation<T extends MusicEntity>(
  item: T,
  kind: WavenPresentationKind = presentationKind(item),
): T {
  return rememberWavenPresentation(item, kind);
}

export function isWavenSecondaryPresentation(value: unknown): boolean {
  return WAVEN_SECONDARY_PRESENTATION_PATTERN.test(cleanText(value));
}

export function isWavenLowConfidencePresentation(value: unknown): boolean {
  return WAVEN_LOW_CONFIDENCE_PRESENTATION_PATTERN.test(cleanText(value));
}

export function isWavenSecondaryEntityPresentation(
  item: MusicTrack | MusicAlbum,
): boolean {
  return Boolean(
    readWavenMediaPresentationEvidence(item)?.secondary ||
      isWavenSecondaryPresentation(item.title),
  );
}

export function isWavenLowConfidenceEntityPresentation(
  item: MusicTrack | MusicAlbum,
): boolean {
  return Boolean(
    readWavenMediaPresentationEvidence(item)?.lowConfidence ||
      isWavenLowConfidencePresentation(item.title),
  );
}

export function normalizeWavenCanonicalMediaText(value: unknown): string {
  return cleanText(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(
      /\s*[\[(][^\])]*(?:video|audio|lyric|visualizer|performance|live\s+(?:version|session|recording)|fancam|\bmv\b)[^\])]*[\])]/giu,
      ' ',
    )
    .replace(/\b(?:official\s+)?music\s+video\b/giu, ' ')
    .replace(/\b(?:official\s+)?video\b/giu, ' ')
    .replace(/\b(?:official\s+)?audio\b/giu, ' ')
    .replace(/\bvideo\s+oficial\b/giu, ' ')
    .replace(/\boffizielles?\s+(?:musik)?video\b/giu, ' ')
    .replace(/\bclip\s+officiel\b/giu, ' ')
    .replace(/\bdance\s+performance(?:\s+video)?\b/giu, ' ')
    .replace(/\bperformance(?:\s+video)?\b/giu, ' ')
    .replace(/\blive\s+performance\b/giu, ' ')
    .replace(/\blive\s+(?:version|session|recording)\b/giu, ' ')
    .replace(/\bplay\s*[▶►]\s*/giu, ' ')
    .replace(/\blyric(?:s)?(?:\s+video)?\b/giu, ' ')
    .replace(/\bvisuali[sz]er\b/giu, ' ')
    .replace(/(?:^|[^\p{L}\p{N}])mv(?:$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function wavenCanonicalMediaKey(item: MusicTrack | MusicAlbum): string {
  const title = normalizeWavenCanonicalMediaText(item.title);
  const artist = normalizeWavenCanonicalMediaText(item.artistName);
  return `${title}\0${artist || item.source.id}`;
}

function identityDedupe<T extends MusicEntity>(
  items: readonly T[],
  kind: WavenPresentationKind,
): T[] {
  const byIdentity = new Map<string, T>();
  for (const raw of items) {
    const item = rememberWavenPresentation(raw, kind);
    const key = keyForEntity(item, kind);
    const existing = byIdentity.get(key);
    byIdentity.set(key, existing ? mergeSameIdentity(existing, item, kind) : item);
  }
  return [...byIdentity.values()];
}

export function canonicalizeWavenTracks(
  tracks: readonly MusicTrack[],
  options: { songsOnly?: boolean } = {},
): MusicTrack[] {
  const selected = new Map<string, MusicTrack>();
  for (const raw of identityDedupe(tracks, 'track')) {
    if (isWavenLowConfidenceEntityPresentation(raw)) continue;
    const key = wavenCanonicalMediaKey(raw);
    if (!key.replace('\0', '').trim()) continue;
    const existing = selected.get(key);
    if (!existing) {
      selected.set(key, raw);
      continue;
    }
    if (isWavenSecondaryEntityPresentation(existing) && !isWavenSecondaryEntityPresentation(raw)) {
      selected.set(key, raw);
    }
  }
  return [...selected.values()].filter(
    (track) => !options.songsOnly || !isWavenSecondaryEntityPresentation(track),
  );
}

export function canonicalizeWavenAlbums(albums: readonly MusicAlbum[]): MusicAlbum[] {
  const selected = new Map<string, MusicAlbum>();
  for (const raw of identityDedupe(albums, 'album')) {
    if (isWavenLowConfidenceEntityPresentation(raw)) continue;
    const key = wavenCanonicalMediaKey(raw);
    if (!key.replace('\0', '').trim()) continue;
    const existing = selected.get(key);
    if (!existing) {
      selected.set(key, raw);
      continue;
    }
    if (isWavenSecondaryEntityPresentation(existing) && !isWavenSecondaryEntityPresentation(raw)) {
      selected.set(key, raw);
    }
  }
  return [...selected.values()].filter((album) => !isWavenSecondaryEntityPresentation(album));
}

export function canonicalizeWavenArtists(artists: readonly MusicArtist[]): MusicArtist[] {
  // Provider identity is authoritative. Same display names are intentionally not
  // merged because they may be genuine homonyms.
  return identityDedupe(artists, 'artist');
}

export function canonicalizeWavenPlaylists(playlists: readonly MusicPlaylist[]): MusicPlaylist[] {
  return identityDedupe(playlists, 'playlist');
}

export function canonicalizeWavenSearchResult(result: MusicSearchResult): MusicSearchResult {
  return {
    ...result,
    tracks: canonicalizeWavenTracks(result.tracks, { songsOnly: true }),
    artists: canonicalizeWavenArtists(result.artists),
    albums: canonicalizeWavenAlbums(result.albums),
    playlists: canonicalizeWavenPlaylists(result.playlists),
  };
}

export function canonicalizeWavenArtistDetail(detail: MusicArtistDetail): MusicArtistDetail {
  return {
    ...detail,
    artist: rememberWavenPresentation(detail.artist, 'artist'),
    tracks: canonicalizeWavenTracks(detail.tracks, { songsOnly: true }),
    albums: canonicalizeWavenAlbums(detail.albums),
  };
}

export function canonicalizeWavenAlbumDetail(detail: MusicAlbumDetail): MusicAlbumDetail {
  return {
    ...detail,
    album: rememberWavenPresentation(detail.album, 'album'),
    // Album browse membership is authoritative for the release track list.
    // Preserve legitimate album members even when YouTube Music decorates one
    // row with video-style renderer evidence; discovery surfaces still use
    // songsOnly filtering to suppress secondary video presentation.
    tracks: canonicalizeWavenTracks(detail.tracks),
  };
}

export function canonicalizeWavenDashboard(result: MusicDashboardResult): MusicDashboardResult {
  return {
    sections: result.sections.map((section) => ({
      ...section,
      items:
        section.type === 'tracks'
          ? canonicalizeWavenTracks(section.items as readonly MusicTrack[], { songsOnly: true })
          : section.type === 'artists'
            ? canonicalizeWavenArtists(section.items as readonly MusicArtist[])
            : section.type === 'albums'
              ? canonicalizeWavenAlbums(section.items as readonly MusicAlbum[])
              : canonicalizeWavenPlaylists(section.items as readonly MusicPlaylist[]),
    })),
  };
}

export function chooseWavenLargestArtwork(
  thumbnails: readonly any[],
  preferredSize = 544,
): string | null {
  const valid = thumbnails.filter(
    (entry) => typeof entry?.url === 'string' && entry.url.trim(),
  );
  const chosen = [...valid].sort((left, right) => {
    const leftArea = Number(left?.width || 0) * Number(left?.height || 0);
    const rightArea = Number(right?.width || 0) * Number(right?.height || 0);
    return rightArea - leftArea;
  })[0] || valid.at(-1) || valid[0] || null;
  const url = normalizeWavenArtworkUrl(chosen?.url);
  return url ? url.replace(/w\d+-h\d+/i, `w${preferredSize}-h${preferredSize}`) : null;
}

export function clearWavenPresentationSessionForTests() {
  sessionPresentation.clear();
  sessionMediaPresentationEvidence.clear();
}
