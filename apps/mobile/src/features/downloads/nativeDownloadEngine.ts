import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import type { MobileDownloadAssetSelectionV1, MobileDownloadJobV1, MobileDownloadManagementResultV1, MobileDownloadStorageTargetV1 } from '@orion/shared/types';
import type { MobileDownloadSubtitleSourceV1 } from './downloadSubtitles';
import {
  normalizeMobileDownloadAssetV1,
  normalizeMobileDownloadJobV1,
  normalizeMobileDownloadRepositoryV1,
  normalizeOfflineMediaEntryV1,
  writeMobileDownloadRepositoryV1,
} from './downloadRepository';

const EVENT_NAME = 'OrionDownloadEngineSnapshot';

interface NativeDownloadEngineModule {
  getSnapshot(): Promise<unknown>;
  startJob(payloadJson: string): Promise<{ ok: boolean; jobId?: string }>;
  pauseJob(jobId: string): void;
  resumeJob(jobId: string): Promise<boolean>;
  retryJob(jobId: string): Promise<boolean>;
  retryAllJobs(): Promise<{ restarted?: number; actionRequired?: number }>;
  cancelJob(jobId: string): void;
  reconcileDownloads(): Promise<unknown>;
  deleteAssets(assetIdsJson: string): Promise<unknown>;
  deleteAllDownloads(): Promise<unknown>;
  removeStaleRecords(assetIdsJson: string): Promise<unknown>;
  removeUnavailableRecords(assetIdsJson: string): Promise<unknown>;
  openAsset(assetId: string): Promise<unknown>;
  locateAsset(assetId: string): Promise<unknown>;
  chooseDeviceStorageTarget(): Promise<{
    ok: boolean;
    targetId?: string;
    displayName?: string;
    writable?: boolean;
    persistedPermission?: boolean;
  }>;
}

function nativeModule(): NativeDownloadEngineModule | null {
  if (Platform.OS !== 'android') return null;
  return NativeModules.OrionDownloadEngine as NativeDownloadEngineModule | undefined || null;
}

export function isNativeDownloadEngineAvailableV1(): boolean {
  return nativeModule() !== null;
}

export function applyNativeDownloadSnapshotV1(value: unknown): void {
  const snapshot = normalizeMobileDownloadRepositoryV1(value);
  writeMobileDownloadRepositoryV1(snapshot);
}

export async function initializeNativeDownloadEngineV1(): Promise<() => void> {
  const module = nativeModule();
  if (!module) return () => {};
  applyNativeDownloadSnapshotV1(await module.getSnapshot());
  const subscription = DeviceEventEmitter.addListener(EVENT_NAME, applyNativeDownloadSnapshotV1);
  return () => subscription.remove();
}

export interface StartNativeDownloadJobInputV1 {
  job: MobileDownloadJobV1;
  groupKey: string;
  itemKey: string;
  subtitleSources?: readonly MobileDownloadSubtitleSourceV1[];
}

export async function startNativeDownloadJobV1(input: StartNativeDownloadJobInputV1): Promise<string> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const safeJob = normalizeMobileDownloadJobV1(input.job);
  if (!safeJob) throw new Error('Download job is invalid.');
  const result = await module.startJob(JSON.stringify({
    schemaVersion: 1,
    groupKey: input.groupKey,
    itemKey: input.itemKey,
    job: safeJob,
    subtitleSources: (input.subtitleSources || []).slice(0, 2).map((track) => ({
      id: track.id, provider: track.provider, language: track.language, languageLabel: track.languageLabel,
      label: track.label, format: track.format, url: track.url,
    })),
  }));
  if (!result?.ok || !result.jobId) throw new Error('Orion could not start this download.');
  return result.jobId;
}

export function pauseNativeDownloadJobV1(jobId: string): void {
  nativeModule()?.pauseJob(jobId);
}

export async function resumeNativeDownloadJobV1(jobId: string): Promise<void> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  await module.resumeJob(jobId);
}

export async function retryNativeDownloadJobV1(jobId: string): Promise<void> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  await module.retryJob(jobId);
}


export async function retryAllNativeDownloadJobsV1(): Promise<{ restarted: number; actionRequired: number }> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const result = await module.retryAllJobs();
  return {
    restarted: Math.max(0, Math.trunc(Number(result?.restarted) || 0)),
    actionRequired: Math.max(0, Math.trunc(Number(result?.actionRequired) || 0)),
  };
}

export function cancelNativeDownloadJobV1(jobId: string): void {
  nativeModule()?.cancelJob(jobId);
}

export function normalizeManagementResult(value: unknown): MobileDownloadManagementResultV1 {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const strings = (candidate: unknown) => Array.isArray(candidate)
    ? [...new Set(candidate.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))]
    : [];
  const failures = Array.isArray(input.failures) ? input.failures.flatMap((candidate) => {
    const item = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : null;
    if (!item || typeof item.assetId !== 'string' || typeof item.code !== 'string' || typeof item.message !== 'string') return [];
    return [{
      assetId: item.assetId,
      artifactId: typeof item.artifactId === 'string' ? item.artifactId : null,
      code: item.code,
      message: item.message,
    }];
  }) : [];
  const dispositions = new Set(['physically-deleted', 'already-missing', 'removed-from-orion', 'retained-unavailable', 'retained-failed']);
  const outcomes = Array.isArray(input.outcomes) ? input.outcomes.flatMap((candidate) => {
    const item = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : null;
    if (!item || typeof item.assetId !== 'string' || typeof item.disposition !== 'string' || !dispositions.has(item.disposition)) return [];
    return [{
      assetId: item.assetId,
      disposition: item.disposition as MobileDownloadManagementResultV1['outcomes'][number]['disposition'],
    }];
  }) : [];
  return {
    schemaVersion: 1,
    requestedAssetIds: strings(input.requestedAssetIds),
    deletedAssetIds: strings(input.deletedAssetIds),
    retainedAssetIds: strings(input.retainedAssetIds),
    reclaimedBytes: Math.max(0, Number.isFinite(Number(input.reclaimedBytes)) ? Number(input.reclaimedBytes) : 0),
    failures,
    outcomes,
  };
}

export function formatNativeDownloadManagementResultV1(
  result: MobileDownloadManagementResultV1,
  formatBytes: (value: number) => string,
): string {
  const count = (disposition: MobileDownloadManagementResultV1['outcomes'][number]['disposition']) =>
    result.outcomes.filter((outcome) => outcome.disposition === disposition).length;
  const physical = count('physically-deleted');
  const missing = count('already-missing');
  const forgotten = count('removed-from-orion');
  const retained = result.retainedAssetIds.length;
  const parts: string[] = [];
  if (physical) parts.push(`${physical} deleted`);
  if (missing) parts.push(`${missing} already absent`);
  if (forgotten) parts.push(`${forgotten} removed from Orion`);
  if (retained) parts.push(`${retained} kept`);
  if (parts.length === 0) parts.push(`${result.deletedAssetIds.length} removed`);
  let message = `${parts.join(', ')} · ${formatBytes(result.reclaimedBytes)} reclaimed.`;
  if (forgotten) message += ' Physical deletion was not confirmed for records removed from Orion.';
  if (result.failures.length) message += ` ${result.failures[0].message}`;
  return message;
}

export async function reconcileNativeDownloadsV1(): Promise<void> {
  const module = nativeModule();
  if (!module) return;
  applyNativeDownloadSnapshotV1(await module.reconcileDownloads());
}

export async function deleteNativeDownloadAssetsV1(selections: readonly MobileDownloadAssetSelectionV1[]): Promise<MobileDownloadManagementResultV1> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const unique = new Map<string, MobileDownloadAssetSelectionV1>();
  for (const selection of selections) {
    if (!selection.assetId || unique.has(selection.assetId)) continue;
    unique.set(selection.assetId, { assetId: selection.assetId, managementToken: selection.managementToken });
  }
  return normalizeManagementResult(await module.deleteAssets(JSON.stringify({
    schemaVersion: 1,
    selections: [...unique.values()],
  })));
}

export async function deleteAllNativeDownloadsV1(): Promise<MobileDownloadManagementResultV1> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  return normalizeManagementResult(await module.deleteAllDownloads());
}

export async function removeStaleNativeDownloadRecordsV1(assetIds: readonly string[]): Promise<MobileDownloadManagementResultV1> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  return normalizeManagementResult(await module.removeStaleRecords(JSON.stringify([...new Set(assetIds)])));
}

export async function removeUnavailableNativeDownloadRecordsV1(assetIds: readonly string[]): Promise<MobileDownloadManagementResultV1> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  return normalizeManagementResult(await module.removeUnavailableRecords(JSON.stringify([...new Set(assetIds)])));
}

async function runNativeAssetAction(method: 'openAsset' | 'locateAsset', assetId: string): Promise<void> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const result = await module[method](assetId) as { ok?: boolean; message?: string };
  if (!result?.ok) throw new Error(typeof result?.message === 'string' ? result.message : 'Android could not perform this action.');
}

export const openNativeDownloadAssetV1 = (assetId: string) => runNativeAssetAction('openAsset', assetId);
export const locateNativeDownloadAssetV1 = (assetId: string) => runNativeAssetAction('locateAsset', assetId);

export async function chooseNativeDeviceStorageTargetV1(): Promise<MobileDownloadStorageTargetV1 | null> {
  const module = nativeModule();
  if (!module) return null;
  const result = await module.chooseDeviceStorageTarget();
  if (!result?.ok || !result.targetId || !result.displayName) return null;
  return {
    mode: 'device-storage',
    targetId: result.targetId,
    displayName: result.displayName,
    writable: result.writable === true,
    persistedPermission: result.persistedPermission === true,
  };
}

// Compile-time imports deliberately exercise the same normalizers used for the
// native projection boundary so future contract drift fails TypeScript gates.
void normalizeMobileDownloadAssetV1;
void normalizeOfflineMediaEntryV1;
