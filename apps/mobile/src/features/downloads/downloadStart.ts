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
 * Starts only the HLS/DASH Orion Library path proven by the P10.3 fragment
 * engine. Media request URLs, headers and cookies remain native-only. Subtitle
 * provider URLs are handed to native transiently and never enter public job
 * snapshots or the Download UI.
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
  if (preferences.defaultDestination !== 'orion-library') {
    throw new Error('Stream downloads currently save to Orion Library only.');
  }

  const selectedSubtitleAssetIds = [...new Set(input.selectedSubtitleAssetIds || [])].slice(0, 2);
  const subtitleSources = resolveMobileDownloadSubtitleSourcesForNativeV1(selectedSubtitleAssetIds);
  const now = Date.now();
  const job: MobileDownloadJobV1 = {
    schemaVersion: 1,
    jobId: createJobId(),
    candidateId: candidate.candidateId,
    media: { ...target.media },
    destination: 'orion-library',
    storageTarget: orionLibraryTarget(),
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
