import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import type { MobileDownloadJobV1, MobileDownloadStorageTargetV1 } from '@orion/shared/types';
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
