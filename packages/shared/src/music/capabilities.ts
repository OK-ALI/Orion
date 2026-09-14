import type {
  MusicAlbum,
  MusicAlbumDetail,
  MusicArtist,
  MusicArtistDetail,
  MusicDashboardResult,
  MusicEntity,
  MusicLyrics,
  MusicPlaylist,
  MusicPlaylistDetail,
  MusicRadioResult,
  MusicSearchResult,
  MusicTrack,
} from "./entities";
import type {
  MusicProviderCapability,
  MusicProviderKind,
} from "./providers";

/**
 * Request context remains transport-neutral. Each application can supply its
 * own cancellation-signal type without coupling the shared music domain to a
 * particular runtime.
 */
export interface MusicProviderRequestContext<TSignal = unknown> {
  signal?: TSignal;
}

/** Common executable-provider identity. Configuration and health stay descriptive. */
export interface MusicProviderRuntimeBase<K extends MusicProviderKind> {
  readonly id: string;
  readonly name: string;
  readonly kind: K;
  readonly capabilities?: readonly MusicProviderCapability[];
}

/** Unified catalog search shared by Local/Core and remote metadata providers. */
export interface MusicSearchCapability<TSignal = unknown> {
  search(
    query: string,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicSearchResult>;
}

/** Optional continuation for providers whose catalog search is paginated. */
export interface MusicSearchContinuationCapability<TSignal = unknown> {
  continueSearch(
    continuation: string,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicSearchResult>;
}

/** Optional lightweight query suggestions. */
export interface MusicSearchSuggestionCapability<TSignal = unknown> {
  getSuggestions(
    query: string,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<readonly string[]>;
}

/** Detail lookups are split so a provider can advertise only what it supports. */
export interface MusicArtistDetailCapability<TSignal = unknown> {
  getArtist(
    artist: MusicArtist,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicArtistDetail>;
}

export interface MusicAlbumDetailCapability<TSignal = unknown> {
  getAlbum(
    album: MusicAlbum,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicAlbumDetail>;
}

export interface MusicPlaylistDetailCapability<TSignal = unknown> {
  getPlaylist(
    playlist: MusicPlaylist,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicPlaylistDetail>;
}

/** Provider-driven radio or related-track discovery for an existing entity. */
export interface MusicRadioCapability<TSignal = unknown> {
  getRadio(
    item: MusicEntity,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicRadioResult>;
}

/** Home, charts, and other provider-curated discovery sections. */
export interface MusicDashboardCapability<TSignal = unknown> {
  getDashboard(
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicDashboardResult>;
}

/** Plain or synchronized lyric lookup. Null means the provider has no match. */
export interface MusicLyricsCapability<TSignal = unknown> {
  getLyrics(
    track: MusicTrack,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<MusicLyrics | null>;
}

/**
 * Portable candidate summary. Provider-specific candidates may extend this
 * type with private resolution metadata inside their own adapter boundary.
 */
export interface MusicStreamCandidate {
  id: string;
  providerId: string;
  title?: string;
  artistName?: string;
  durationMs?: number | null;
  providerTrackId?: string | null;
  local?: boolean;
}

/**
 * Streaming resolution is intentionally generic. The playback phase owns the
 * concrete resolved-source shape, so provider contracts do not smuggle runtime
 * transport details into the shared music domain.
 */
export interface MusicStreamingCapability<
  TCandidate extends MusicStreamCandidate = MusicStreamCandidate,
  TResolved = unknown,
  TSignal = unknown,
> {
  searchForTrack(
    track: MusicTrack,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<readonly TCandidate[]>;

  resolveCandidate(
    candidate: TCandidate,
    context?: MusicProviderRequestContext<TSignal>,
  ): Promise<TResolved>;
}

/**
 * Current first-party metadata providers all expose search. Detail,
 * continuation, suggestion, playlist, and radio capabilities remain optional.
 */
export interface MusicMetadataProvider<TSignal = unknown>
  extends MusicProviderRuntimeBase<"metadata">,
    MusicSearchCapability<TSignal> {
  continueSearch?: MusicSearchContinuationCapability<TSignal>["continueSearch"];
  getSuggestions?: MusicSearchSuggestionCapability<TSignal>["getSuggestions"];
  getArtist?: MusicArtistDetailCapability<TSignal>["getArtist"];
  getAlbum?: MusicAlbumDetailCapability<TSignal>["getAlbum"];
  getPlaylist?: MusicPlaylistDetailCapability<TSignal>["getPlaylist"];
  getRadio?: MusicRadioCapability<TSignal>["getRadio"];
}

export interface MusicLyricsProvider<TSignal = unknown>
  extends MusicProviderRuntimeBase<"lyrics">,
    MusicLyricsCapability<TSignal> {}

export interface MusicDashboardProvider<TSignal = unknown>
  extends MusicProviderRuntimeBase<"dashboard">,
    MusicDashboardCapability<TSignal> {}

export interface MusicStreamingProvider<
  TCandidate extends MusicStreamCandidate = MusicStreamCandidate,
  TResolved = unknown,
  TSignal = unknown,
> extends MusicProviderRuntimeBase<"streaming">,
    MusicStreamingCapability<TCandidate, TResolved, TSignal> {
  readonly supportsLocalFiles?: boolean;
}

/**
 * Executable contracts currently proven by the Local/Core, YouTube Music,
 * LRCLib, and Spotify Charts evidence set. Other provider kinds remain
 * descriptor-only until an implementation supplies behavior worth locking.
 */
export type MusicCoreExecutableProvider<TSignal = unknown> =
  | MusicMetadataProvider<TSignal>
  | MusicLyricsProvider<TSignal>
  | MusicDashboardProvider<TSignal>
  | MusicStreamingProvider<MusicStreamCandidate, unknown, TSignal>;
