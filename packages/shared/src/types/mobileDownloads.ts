import type { MediaIdentity } from './media';

export type MobileDownloadDestinationModeV1 = 'orion-library' | 'device-storage';
export type MobileDownloadLibraryKindV1 = 'movie' | 'series' | 'anime';
export type MobileDownloadManifestKindV1 = 'direct' | 'hls' | 'dash' | 'extensionless' | 'unknown';
export type MobileDownloadProtectionV1 = 'clear' | 'unknown' | 'protected';
export type MobileDownloadExpiryV1 = 'stable' | 'session' | 'time-bounded' | 'expired' | 'unknown';
export type MobileDownloadQualityV1 = 'best' | '1080p' | '720p' | '480p';
export type MobileDownloadSubtitlePreferenceV1 = 'preferred' | 'none';

export type MobileDownloadJobStateV1 =
  | 'queued'
  | 'preflighting'
  | 'downloading'
  | 'paused'
  | 'recovering'
  | 'verifying'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'unsupported'
  | 'protected'
  | 'expired'
  | 'cancelled'
  | 'storage-blocked'
  | 'action-required';

export interface MobileDownloadMediaIdentityV1 extends MediaIdentity {
  schemaVersion: 1;
  libraryKind: MobileDownloadLibraryKindV1;
  seriesTitle?: string | null;
  episodeTitle?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
}

export interface MobileDownloadCandidateCapabilitiesV1 {
  orionLibrary: boolean;
  deviceStorage: boolean;
  resumable: boolean;
  subtitles: boolean;
  audioSelection: boolean;
  deviceStorageBlockedReason?: string | null;
}

/** Presentation-safe candidate contract. Sensitive request material stays behind the native broker. */
export interface MobileDownloadCandidateV1 {
  schemaVersion: 1;
  candidateId: string;
  playbackSessionId: string | null;
  requestContextId: string | null;
  media: MobileDownloadMediaIdentityV1;
  sourceId: string;
  providerClass: string | null;
  manifestKind: MobileDownloadManifestKindV1;
  capabilities: MobileDownloadCandidateCapabilitiesV1;
  expiry: MobileDownloadExpiryV1;
  protection: MobileDownloadProtectionV1;
  availableQualities: MobileDownloadQualityV1[];
  capturedAt: number;
}

export interface MobileDownloadStorageTargetV1 {
  mode: MobileDownloadDestinationModeV1;
  /** Opaque Orion/native storage handle, never a raw machine path. */
  targetId: string | null;
  displayName: string;
  writable: boolean;
  persistedPermission: boolean;
}

export interface MobileDownloadProgressV1 {
  bytesDownloaded: number;
  totalBytes: number | null;
  completedFragments: number | null;
  totalFragments: number | null;
  percent: number | null;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
}

export interface MobileDownloadFailureV1 {
  code: string;
  message: string;
  retryable: boolean;
  actionRequired: boolean;
}

export interface MobileDownloadJobV1 {
  schemaVersion: 1;
  jobId: string;
  candidateId: string;
  media: MobileDownloadMediaIdentityV1;
  destination: MobileDownloadDestinationModeV1;
  storageTarget: MobileDownloadStorageTargetV1;
  requestedQuality: MobileDownloadQualityV1;
  selectedSubtitleAssetIds: string[];
  state: MobileDownloadJobStateV1;
  progress: MobileDownloadProgressV1;
  retryCount: number;
  recoveryCount: number;
  failure: MobileDownloadFailureV1 | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface MobileDownloadTrackV1 {
  id: string;
  kind: 'audio' | 'subtitle';
  language: string | null;
  label: string;
  format: string | null;
  default: boolean;
}

export interface MobileDownloadAssetLocatorV1 {
  kind: 'managed' | 'content-uri' | 'file-uri';
  value: string;
}

export interface MobileDownloadAssetV1 {
  schemaVersion: 1;
  assetId: string;
  jobId: string;
  media: MobileDownloadMediaIdentityV1;
  destination: MobileDownloadDestinationModeV1;
  storageTarget: MobileDownloadStorageTargetV1;
  locator: MobileDownloadAssetLocatorV1;
  container: string;
  mimeType: string | null;
  verifiedSizeBytes: number;
  sha256: string | null;
  tracks: MobileDownloadTrackV1[];
  sourceId: string;
  playInOrion: boolean;
  externallyVisible: boolean;
  verifiedAt: number;
}

export interface OfflineMediaEntryV1 {
  schemaVersion: 1;
  entryId: string;
  groupKey: string;
  media: MobileDownloadMediaIdentityV1;
  assetIds: string[];
  primaryAssetId: string;
  title: string;
  seriesTitle: string | null;
  episodeTitle: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  updatedAt: number;
}

export interface MobileDownloadPreferencesV1 {
  schemaVersion: 1;
  defaultDestination: MobileDownloadDestinationModeV1;
  deviceStorageTarget: MobileDownloadStorageTargetV1 | null;
  preferredQuality: MobileDownloadQualityV1;
  subtitlePreference: MobileDownloadSubtitlePreferenceV1;
}
