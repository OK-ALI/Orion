/**
 * Platform-neutral music entities shared across the Orion ecosystem.
 *
 * These are data contracts only. Runtime, UI, storage, playback, and sync
 * concerns stay outside this shared domain boundary.
 */

export const MUSIC_ENTITY_KINDS = ["track", "artist", "album", "playlist"] as const;
export const MUSIC_DASHBOARD_SECTION_KINDS = ["tracks", "artists", "albums", "playlists"] as const;
export const MUSIC_LYRICS_KINDS = ["plain", "synced"] as const;

export type MusicEntityKind = (typeof MUSIC_ENTITY_KINDS)[number];
export type MusicDashboardSectionKind = (typeof MUSIC_DASHBOARD_SECTION_KINDS)[number];
export type MusicLyricsKind = (typeof MUSIC_LYRICS_KINDS)[number];

/** Stable provider-owned identity for an entity or a provider reference. */
export interface MusicSourceRef {
  provider: string;
  id: string;
}

/** Alias retained for existing Music Planet providerRefs terminology. */
export type MusicProviderRef = MusicSourceRef;

/** Optional artwork identity without exposing a local filesystem path. */
export interface MusicArtworkRef {
  url: string;
  source?: MusicSourceRef;
  width?: number;
  height?: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artistName: string;
  albumTitle?: string | null;
  albumArtist?: string | null;
  durationMs?: number | null;
  artworkUrl?: string | null;
  /** Logical media family used by existing queue/local-first identity rules. */
  provider?: string;
  providerTrackId?: string | null;
  source: MusicSourceRef;
  providerRefs?: readonly MusicProviderRef[];
}

export interface MusicArtist {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  artworkUrl?: string | null;
  source: MusicSourceRef;
}

export interface MusicAlbum {
  id: string;
  title: string;
  artistName?: string | null;
  releaseDate?: string | null;
  primaryType?: string | null;
  artworkUrl?: string | null;
  source: MusicSourceRef;
}

export interface MusicPlaylist {
  id: string;
  title: string;
  description?: string | null;
  artworkUrl?: string | null;
  source: MusicSourceRef;
}

export type MusicEntity = MusicTrack | MusicArtist | MusicAlbum | MusicPlaylist;

export interface MusicSearchResult {
  tracks: MusicTrack[];
  artists: MusicArtist[];
  albums: MusicAlbum[];
  playlists: MusicPlaylist[];
  continuation?: string | null;
}

export interface MusicArtistDetail {
  artist: MusicArtist;
  biography?: string;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
}

export interface MusicAlbumDetail {
  album: MusicAlbum;
  tracks: MusicTrack[];
}

export interface MusicPlaylistDetail {
  playlist: MusicPlaylist;
  tracks: MusicTrack[];
}

export interface MusicRadioResult {
  tracks: MusicTrack[];
}

export interface MusicDashboardSection {
  id: string;
  title: string;
  type: MusicDashboardSectionKind;
  items: MusicEntity[];
  attribution?: string;
}

export interface MusicDashboardResult {
  sections: MusicDashboardSection[];
}

export interface MusicLyricLine {
  /** Seconds from the beginning of the track. Null is valid for plain lyrics. */
  time: number | null;
  text: string;
}

export interface MusicLyrics {
  type: MusicLyricsKind;
  source: string;
  lines: MusicLyricLine[];
}
