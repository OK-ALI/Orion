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
const PLAYER_PROGRESS_EVENT_NAME = 'OrionFinalizedPlayerProgress';

export type MobileDownloadReconciliationStateV1 = 'checking' | 'ready' | 'unavailable';
type MobileDownloadReconciliationListenerV1 = (state: MobileDownloadReconciliationStateV1) => void;

let mobileDownloadReconciliationStateV1: MobileDownloadReconciliationStateV1 = 'checking';
let mobileDownloadReconciliationGenerationV1 = 0;
const mobileDownloadReconciliationListenersV1 = new Set<MobileDownloadReconciliationListenerV1>();

function publishMobileDownloadReconciliationStateV1(state: MobileDownloadReconciliationStateV1): void {
  if (mobileDownloadReconciliationStateV1 === state) return;
  mobileDownloadReconciliationStateV1 = state;
  for (const listener of mobileDownloadReconciliationListenersV1) listener(state);
}

export function getMobileDownloadReconciliationStateV1(): MobileDownloadReconciliationStateV1 {
  return mobileDownloadReconciliationStateV1;
}

export function subscribeMobileDownloadReconciliationV1(
  listener: MobileDownloadReconciliationListenerV1,
): () => void {
  mobileDownloadReconciliationListenersV1.add(listener);
  listener(mobileDownloadReconciliationStateV1);
  return () => mobileDownloadReconciliationListenersV1.delete(listener);
}

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
  playAssetLocally(assetId: string): Promise<unknown>;
  locateAsset(assetId: string): Promise<unknown>;
  resolveOfflinePlayback(assetId: string): Promise<unknown>;
  classifyOfflinePlayback(assetId: string): Promise<unknown>;
  launchFinalizedPlayer(
    assetId: string,
    initialPositionSeconds: number,
    title: string | null,
    presentation: NativeFinalizedPlayerPresentationV1,
    themeAccent: string,
    themeOnAccent: string,
    themeText: string,
    themeTextSecondary: string,
    themeMediaScrim: string,
    themeSurface: string,
    themeElevated: string,
    themeBorder: string,
    reducedMotion: boolean,
  ): Promise<unknown>;
  chooseDeviceStorageTarget(): Promise<{
    ok: boolean;
    targetId?: string;
    displayName?: string;
    writable?: boolean;
    persistedPermission?: boolean;
  }>;
  chooseLibraryStorageTarget(): Promise<{
    ok: boolean;
    targetId?: string;
    displayName?: string;
    writable?: boolean;
    persistedPermission?: boolean;
  }>;
  validateLibraryStorageTarget(targetId: string): Promise<{
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
  const generation = ++mobileDownloadReconciliationGenerationV1;
  const module = nativeModule();
  if (!module) {
    if (generation === mobileDownloadReconciliationGenerationV1) {
      publishMobileDownloadReconciliationStateV1('unavailable');
    }
    return;
  }

  publishMobileDownloadReconciliationStateV1('checking');
  try {
    const snapshot = await module.reconcileDownloads();
    if (generation !== mobileDownloadReconciliationGenerationV1) return;
    applyNativeDownloadSnapshotV1(snapshot);
    publishMobileDownloadReconciliationStateV1('ready');
  } catch (error) {
    if (generation === mobileDownloadReconciliationGenerationV1) {
      publishMobileDownloadReconciliationStateV1('unavailable');
    }
    throw error;
  }
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


export interface NativeOfflinePlaybackRouteV1 {
  schemaVersion: 1;
  assetId: string;
  sourceKind: 'file' | 'hls' | 'dash';
  fragmentCount: number;
}

export async function classifyNativeOfflinePlaybackV1(assetId: string): Promise<NativeOfflinePlaybackRouteV1> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const clean = assetId.trim();
  if (!/^[A-Za-z0-9._:-]{1,140}$/.test(clean)) throw new Error('Offline download identity is invalid.');
  const raw = await module.classifyOfflinePlayback(clean);
  const result = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (result.ok !== true) {
    throw new Error(typeof result.message === 'string' && result.message.trim()
      ? result.message
      : 'Orion could not classify this offline download.');
  }
  const resultAssetId = typeof result.assetId === 'string' ? result.assetId.trim() : '';
  const sourceKind = result.sourceKind === 'file' || result.sourceKind === 'hls' || result.sourceKind === 'dash'
    ? result.sourceKind
    : null;
  if (resultAssetId !== clean || !sourceKind) {
    throw new Error('Offline playback route is invalid.');
  }
  return {
    schemaVersion: 1,
    assetId: clean,
    sourceKind,
    fragmentCount: Math.max(0, Math.trunc(Number(result.fragmentCount) || 0)),
  };
}


export interface NativeOfflineSubtitleV1 {
  id: string;
  language: string;
  label: string;
  format: 'vtt' | 'srt' | 'ass';
  isDefault: boolean;
  content: string;
}

export interface NativeOfflinePlaybackSourceV1 {
  schemaVersion: 1;
  assetId: string;
  uri: string;
  contentType: 'progressive' | 'hls';
  sourceKind: 'file' | 'hls' | 'dash';
  fragmentCount: number;
  subtitleCount: number;
  subtitles: NativeOfflineSubtitleV1[];
}

export type NativeFinalizedPlayerPresentationV1 = 'fit' | 'fill' | 'stretch';
export type NativeFinalizedPlayerStateV1 =
  | 'preparing'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'ended'
  | 'failed';

export interface NativeFinalizedPlayerProgressV1 {
  assetId: string;
  state: NativeFinalizedPlayerStateV1;
  playing: boolean;
  currentTime: number;
  duration: number | null;
  presentation: NativeFinalizedPlayerPresentationV1;
  code?: string;
  message?: string;
}

export interface NativeFinalizedPlayerResultV1 {
  ok: boolean;
  currentTime: number;
  duration: number | null;
  completed: boolean;
  presentation: NativeFinalizedPlayerPresentationV1;
  code?: string;
  message?: string;
}

function normalizeFinalizedPlayerPresentationV1(value: unknown): NativeFinalizedPlayerPresentationV1 {
  return value === 'fill' || value === 'stretch' ? value : 'fit';
}

export interface NativeFinalizedPlayerThemeV1 {
  accent: string;
  onAccent: string;
  text: string;
  textSecondary: string;
  mediaScrim: string;
  surface: string;
  elevated: string;
  border: string;
  reducedMotion: boolean;
}

function normalizeRgbHex(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^#[0-9A-F]{6}$/.test(candidate) ? candidate : fallback;
}

function normalizeRgbaArgb(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  const rgba = candidate.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/i);
  if (!rgba) return fallback;
  const red = Math.min(255, Number(rgba[1]));
  const green = Math.min(255, Number(rgba[2]));
  const blue = Math.min(255, Number(rgba[3]));
  const alpha = Math.round(Math.min(1, Math.max(0, Number(rgba[4]))) * 255);
  const byte = (component: number) => Math.round(component).toString(16).padStart(2, '0').toUpperCase();
  return `#${byte(alpha)}${byte(red)}${byte(green)}${byte(blue)}`;
}

function normalizeMediaScrimArgb(value: unknown): string {
  return normalizeRgbaArgb(value, '#C7030308');
}

function normalizeFinalizedPlayerThemeV1(value: NativeFinalizedPlayerThemeV1 | undefined): NativeFinalizedPlayerThemeV1 {
  return {
    accent: normalizeRgbHex(value?.accent, '#E50914'),
    onAccent: normalizeRgbHex(value?.onAccent, '#FFFFFF'),
    text: normalizeRgbHex(value?.text, '#F4F1F6'),
    textSecondary: normalizeRgbHex(value?.textSecondary, '#B5AEBA'),
    mediaScrim: normalizeMediaScrimArgb(value?.mediaScrim),
    surface: normalizeRgbHex(value?.surface, '#191622'),
    elevated: normalizeRgbHex(value?.elevated, '#100E17'),
    border: normalizeRgbaArgb(value?.border, '#1AFFFFFF'),
    reducedMotion: value?.reducedMotion === true,
  };
}

function normalizeFinalizedPlayerProgressV1(value: unknown): NativeFinalizedPlayerProgressV1 | null {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  const state = typeof raw.state === 'string' ? raw.state : '';
  if (!/^[A-Za-z0-9._:-]{1,140}$/.test(assetId)
    || !['preparing', 'buffering', 'playing', 'paused', 'seeking', 'ended', 'failed'].includes(state)) {
    return null;
  }
  const currentTime = Math.max(0, Number(raw.currentTime) || 0);
  const durationValue = Number(raw.duration);
  const duration = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : null;
  return {
    assetId,
    state: state as NativeFinalizedPlayerStateV1,
    playing: raw.playing === true,
    currentTime,
    duration,
    presentation: normalizeFinalizedPlayerPresentationV1(raw.presentation),
    ...(typeof raw.code === 'string' && raw.code.trim() ? { code: raw.code.trim().slice(0, 120) } : {}),
    ...(typeof raw.message === 'string' && raw.message.trim() ? { message: raw.message.trim().slice(0, 240) } : {}),
  };
}

export function subscribeNativeFinalizedPlayerProgressV1(
  listener: (event: NativeFinalizedPlayerProgressV1) => void,
): () => void {
  if (Platform.OS !== 'android') return () => {};
  const subscription = DeviceEventEmitter.addListener(PLAYER_PROGRESS_EVENT_NAME, (value: unknown) => {
    const event = normalizeFinalizedPlayerProgressV1(value);
    if (event) listener(event);
  });
  return () => subscription.remove();
}

export async function launchNativeFinalizedPlayerV1({
  assetId,
  initialPositionSeconds = 0,
  title,
  presentation = 'fit',
  theme,
}: {
  assetId: string;
  initialPositionSeconds?: number;
  title?: string | null;
  presentation?: NativeFinalizedPlayerPresentationV1;
  theme?: NativeFinalizedPlayerThemeV1;
}): Promise<NativeFinalizedPlayerResultV1> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const clean = assetId.trim();
  if (!/^[A-Za-z0-9._:-]{1,140}$/.test(clean)) throw new Error('Offline download identity is invalid.');
  const initialPosition = Math.max(0, Number(initialPositionSeconds) || 0);
  const safePresentation = normalizeFinalizedPlayerPresentationV1(presentation);
  const safeTheme = normalizeFinalizedPlayerThemeV1(theme);
  const raw = await module.launchFinalizedPlayer(
    clean,
    initialPosition,
    title?.trim() || null,
    safePresentation,
    safeTheme.accent,
    safeTheme.onAccent,
    safeTheme.text,
    safeTheme.textSecondary,
    safeTheme.mediaScrim,
    safeTheme.surface,
    safeTheme.elevated,
    safeTheme.border,
    safeTheme.reducedMotion,
  );
  const result = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const currentTime = Math.max(0, Number(result.currentTime) || 0);
  const durationValue = Number(result.duration);
  const duration = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : null;
  return {
    ok: result.ok === true,
    currentTime,
    duration,
    completed: result.completed === true,
    presentation: normalizeFinalizedPlayerPresentationV1(result.presentation),
    ...(typeof result.code === 'string' && result.code.trim() ? { code: result.code.trim().slice(0, 120) } : {}),
    ...(typeof result.message === 'string' && result.message.trim() ? { message: result.message.trim().slice(0, 240) } : {}),
  };
}

export async function resolveNativeOfflinePlaybackV1(assetId: string): Promise<NativeOfflinePlaybackSourceV1> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const clean = assetId.trim();
  if (!/^[A-Za-z0-9._:-]{1,140}$/.test(clean)) throw new Error('Offline download identity is invalid.');
  const raw = await module.resolveOfflinePlayback(clean);
  const result = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (result.ok !== true) {
    throw new Error(typeof result.message === 'string' && result.message.trim()
      ? result.message
      : 'Orion could not prepare this offline download for playback.');
  }
  const uri = typeof result.uri === 'string' ? result.uri.trim() : '';
  const sourceKind = result.sourceKind === 'file' || result.sourceKind === 'hls' || result.sourceKind === 'dash'
    ? result.sourceKind
    : null;
  const finalizedFile = sourceKind === 'file'
    && result.contentType === 'progressive'
    && uri.startsWith('content://');
  const legacyFragments = (sourceKind === 'hls' || sourceKind === 'dash')
    && result.contentType === 'hls'
    && uri.startsWith('file://');
  if (!sourceKind || (!finalizedFile && !legacyFragments)) {
    throw new Error('Offline playback source is invalid.');
  }
  const subtitleCount = Math.max(0, Math.trunc(Number(result.subtitleCount) || 0));
  const subtitles: NativeOfflineSubtitleV1[] = finalizedFile && Array.isArray(result.subtitles) ? result.subtitles.map((entry): NativeOfflineSubtitleV1 => {
    const value = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const language = typeof value.language === 'string' ? value.language.trim() : '';
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const format: NativeOfflineSubtitleV1['format'] | null = value.format === 'vtt' || value.format === 'srt' || value.format === 'ass' ? value.format : null;
    const content = typeof value.content === 'string' ? value.content : '';
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(id) || !language || !label || !format
      || !content || content.length > 10 * 1024 * 1024 || content.includes('\u0000')) {
      throw new Error('Downloaded subtitles could not be opened safely.');
    }
    return { id, language: language.slice(0, 12), label: label.slice(0, 120), format, isDefault: value.default === true, content };
  }) : [];
  if (finalizedFile && (subtitleCount > 2 || subtitles.length !== subtitleCount)) {
    throw new Error('Downloaded subtitles could not be opened safely.');
  }
  return {
    schemaVersion: 1,
    assetId: clean,
    uri,
    contentType: finalizedFile ? 'progressive' : 'hls',
    sourceKind,
    fragmentCount: Math.max(0, Math.trunc(Number(result.fragmentCount) || 0)),
    subtitleCount,
    subtitles,
  };
}

async function runNativeAssetAction(method: 'openAsset' | 'playAssetLocally' | 'locateAsset', assetId: string): Promise<void> {
  const module = nativeModule();
  if (!module) throw new Error('Android download engine is unavailable.');
  const result = await module[method](assetId) as { ok?: boolean; message?: string };
  if (!result?.ok) throw new Error(typeof result?.message === 'string' ? result.message : 'Android could not perform this action.');
}

export const openNativeDownloadAssetV1 = (assetId: string) => runNativeAssetAction('openAsset', assetId);
export const locateNativeDownloadAssetV1 = (assetId: string) => runNativeAssetAction('locateAsset', assetId);
export const playNativeDownloadAssetLocallyV1 = (assetId: string) => runNativeAssetAction('playAssetLocally', assetId);

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

function normalizeLibraryStorageTargetResult(
  result: { ok?: boolean; targetId?: string; displayName?: string; writable?: boolean; persistedPermission?: boolean } | null,
): MobileDownloadStorageTargetV1 | null {
  if (!result?.ok || !result.targetId || !result.displayName) return null;
  return {
    mode: 'user-folder',
    targetId: result.targetId,
    displayName: result.displayName,
    writable: result.writable === true,
    persistedPermission: result.persistedPermission === true,
  };
}

export async function chooseNativeLibraryStorageTargetV1(): Promise<MobileDownloadStorageTargetV1 | null> {
  const module = nativeModule();
  if (!module) return null;
  return normalizeLibraryStorageTargetResult(await module.chooseLibraryStorageTarget());
}

export async function validateNativeLibraryStorageTargetV1(targetId: string): Promise<MobileDownloadStorageTargetV1 | null> {
  const module = nativeModule();
  const clean = targetId.trim();
  if (!module || !/^saf-[a-f0-9]{20}$/.test(clean)) return null;
  return normalizeLibraryStorageTargetResult(await module.validateLibraryStorageTarget(clean));
}

// Compile-time imports deliberately exercise the same normalizers used for the
// native projection boundary so future contract drift fails TypeScript gates.
void normalizeMobileDownloadAssetV1;
void normalizeOfflineMediaEntryV1;
