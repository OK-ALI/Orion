import type { MobileDownloadJobV1, MobileDownloadPreferencesV1, MobileDownloadStorageTargetV1 } from '@orion/shared/types';
import { mobileDownloadItemKeyFromMediaV1, type MobileDownloadTargetV1 } from './downloadIdentity';
import type { MobileDownloadCandidateSelectionV1 } from './downloadCandidateCapture';
import { startNativeDownloadJobV1 } from './nativeDownloadEngine';
import { resolveMobileDownloadSubtitleSourcesForNativeV1 } from './downloadSubtitles';

export interface StartMobileDownloadSelectionInputV1 {
  target: MobileDownloadTargetV1;
  selection: MobileDownloadCandidateSelectionV1;
  preferences: MobileDownloadPreferencesV1;
  selectedSubtitleAssetIds?: readonly string[];
}

function createJobId(): string {
  const random = Math.floor(Math.random() * 0x100000000).toString(36).padStart(6, '0');
  return `mobdl-${Date.now().toString(36)}-${random}`;
}

/**
 * Starts the Android-owned direct/HLS/DASH transfer engine for the logical Orion
 * Library. Its physical MP4 owner is the persisted user-selected SAF folder.
 */
export async function startMobileDownloadFromSelectionV1(input: StartMobileDownloadSelectionInputV1): Promise<string> {
  const { target, selection, preferences } = input;
  const candidate = selection.candidate;
  if (mobileDownloadItemKeyFromMediaV1(candidate.media) !== target.itemKey ||
      String(candidate.media.id) !== String(target.media.id) ||
      candidate.media.mediaType !== target.media.mediaType ||
      candidate.media.season !== target.media.season || candidate.media.episode !== target.media.episode) {
    throw new Error('This stream belongs to another title or episode. Resolve the download again.');
  }
  if (candidate.preflight.state !== 'ready' || !candidate.preflight.requestContextReady) {
    throw new Error('The playback source is no longer ready. Open the player and try again.');
  }
  const kind = candidate.preflight.resolvedManifestKind;
  const methodMatchesKind = selection.resolvedMethod === 'direct'
    ? kind === 'direct'
    : selection.resolvedMethod === 'fragments' && (kind === 'hls' || kind === 'dash');
  if (!methodMatchesKind) {
    throw new Error('Mobile downloads require a ready Direct, HLS, or DASH stream. Resolve the source again.');
  }
  const destination: MobileDownloadJobV1['destination'] = 'orion-library';
  const storageTarget: MobileDownloadStorageTargetV1 | null = preferences.libraryStorageTarget;

  if (!candidate.capabilities.orionLibrary) {
    throw new Error('This source is not ready for Orion Library storage.');
  }
  if (!storageTarget || storageTarget.mode !== 'user-folder' || !storageTarget.targetId || !storageTarget.writable || !storageTarget.persistedPermission) {
    throw new Error('Choose a writable Orion Library storage folder before starting this download.');
  }

  const selectedSubtitleAssetIds = [...new Set(input.selectedSubtitleAssetIds || [])].slice(0, 2);
  const subtitleSources = resolveMobileDownloadSubtitleSourcesForNativeV1(selectedSubtitleAssetIds);
  const now = Date.now();
  const job: MobileDownloadJobV1 = {
    schemaVersion: 1,
    jobId: createJobId(),
    candidateId: candidate.candidateId,
    media: { ...target.media },
    destination,
    storageTarget,
    requestedQuality: preferences.preferredQuality,
    selectedSubtitleAssetIds,
    state: 'queued',
    progress: { bytesDownloaded: 0, totalBytes: candidate.preflight.requiredBytes, completedFragments: null, totalFragments: null, percent: null, bytesPerSecond: null, etaSeconds: null },
    retryCount: 0,
    recoveryCount: 0,
    failure: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  };

  return startNativeDownloadJobV1({ job, groupKey: target.groupKey, itemKey: target.itemKey, subtitleSources });
}
