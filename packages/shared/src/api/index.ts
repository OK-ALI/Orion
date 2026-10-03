export { type IStorageAdapter, MemoryStorageAdapter } from "./storageAdapter";
export { lookupAnimeEntries } from './animeLookup';
export { verifyAnimeIdentity, type AnimeCatalogEvidence, type AnimeIdentityResult } from './animeIdentity';
export { ANIME_IDENTITY_REASONS, AnimeLookupError, normalizeAnimeTitle, type AnimeIdentityDiagnostic,
  type AnimeIdentityDiagnosticSink, type AnimeIdentityReason } from './animeIdentityDiagnostics';
export {
  initTmdbClient,
  type TmdbClientConfig,
  tmdbFetch,
  imgUrl,
  clearTmdbCache,
  setApiErrorHandlers,
  fetchTrending,
  fetchMovieDetails,
  fetchTvDetails,
  fetchPersonDetails,
  fetchSearch,
  fetchPersonSearch,
  fetchEpisodeGroup,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
} from "./tmdb";
export {
  initAnilistClient,
  cleanAnilistDescription,
  fetchAnilistData,
  buildAnilistSeasons,
} from "./anilist";
export {
  type CloudProfileReadResult,
  type CloudProfileWriteRequest,
  type CloudProfileWriteResult,
  type CloudProfileStore,
} from "./cloudProfileStore";

export {
  inspectPortableWatchedOneShotSyncV1,
  executePortableWatchedOneShotSyncV1,
  type PortableWatchedOneShotInspectionV1,
  type PortableWatchedOneShotExecutionV1,
} from "./portableWatchedOneShotSync";

export { reconcilePortableWatchedSteadyStateSyncV1 } from './portableWatchedSteadyStateSync';
export type { PortableWatchedSteadyStateReconcileV1 } from './portableWatchedSteadyStateSync';

export {
  resolvePortableMyListSteadyStateConflictV1,
  type PortableMyListCheckpointEvidenceV1,
  type PortableMyListSteadyStateConflictResolutionV1,
  type PortableMyListSteadyStateConflictResolutionResultV1,
} from './portableMyListSteadyStateConflict';

export {
  resolvePortableWatchedSteadyStateConflictV1,
  type PortableWatchedSteadyStateConflictResolutionV1,
  type PortableWatchedSteadyStateConflictResolutionResultV1,
} from './portableWatchedSteadyStateConflict';

export {
  reconcilePortableViewingActivitySteadyStateSyncV1,
  type PortableViewingActivitySteadyStateReconcileV1,
} from './portableViewingActivitySteadyStateSync';

export {
  resolvePortableViewingActivitySteadyStateConflictV1,
  type PortableViewingActivitySteadyStateConflictResolutionV1,
  type PortableViewingActivitySteadyStateConflictResolutionResultV1,
} from './portableViewingActivitySteadyStateConflict';

export {
  inspectPortableViewingActivityOneShotSyncV1,
  executePortableViewingActivityOneShotSyncV1,
  type PortableViewingActivityCountsV1,
  type PortableViewingActivityEnrollmentResolutionV1,
  type PortableViewingActivityOneShotExecutionV1,
  type PortableViewingActivityOneShotInspectionV1,
} from './portableViewingActivityOneShotSync';
