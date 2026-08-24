import type { MobileDownloadJobV1, MobileDownloadPreferencesV1, MobileDownloadStorageTargetV1 } from '@orion/shared/types';
import type { MobileDownloadTargetV1 } from './downloadIdentity';
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

function orionLibraryTarget(): MobileDownloadStorageTargetV1 {
  return { mode: 'orion-library', targetId: 'orion-library', displayName: 'Orion Library', writable: true, persistedPermission: true };
}

/**
 * Starts the Android-owned HLS/DASH fragment engine for either Orion Library
 * or a persisted SAF Device Storage target. Media request URLs, headers and
 * cookies remain native-only. Subtitle provider URLs are transient native input.
 */
export async function startMobileDownloadFromSelectionV1(input: StartMobileDownloadSelectionInputV1): Promise<string> {
  const { target, selection, preferences } = input;
  const candidate = selection.candidate;
  if (candidate.preflight.state !== 'ready' || !candidate.preflight.requestContextReady) {
    throw new Error('The playback source is no longer ready. Open the player and try again.');
  }
  if (selection.resolvedMethod !== 'fragments' || !['hls', 'dash'].includes(candidate.preflight.resolvedManifestKind)) {
    throw new Error('Mobile downloads require a ready HLS or DASH stream. Try another source.');
  }
  const destination = preferences.defaultDestination;
  const storageTarget = destination === 'device-storage' ? preferences.deviceStorageTarget : orionLibraryTarget();
  if (destination === 'device-storage') {
    if (!candidate.capabilities.deviceStorage) {
      throw new Error(candidate.capabilities.deviceStorageBlockedReason || 'This stream cannot be finalized safely to Device Storage.');
    }
    if (!storageTarget?.targetId || !storageTarget.writable || !storageTarget.persistedPermission) {
      throw new Error('Choose a Device Storage folder before starting this download.');
    }
  } else if (!candidate.capabilities.orionLibrary) {
    throw new Error('This source is not ready for Orion Library storage.');
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
    storageTarget: storageTarget || orionLibraryTarget(),
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
