/**
 * Mobile downloader presentation boundary.
 *
 * P10.1 establishes durable contracts, preferences and repository ownership.
 * Long-running transfer execution remains unavailable until the Android-native
 * Phase 10 engine is present. This module must never simulate progress or
 * report an unfinished asset as complete.
 */

import type { OfflineMediaEntryV1 } from '@orion/shared/types';
import { listOfflineMediaEntriesV1 } from '../features/downloads/downloadRepository';

export const MOBILE_DOWNLOADER_AVAILABLE = false;

export interface MobileDownloadCapability {
  available: false;
  state: 'waiting-for-engine';
  reason: string;
}

export function getMobileDownloadCapability(): MobileDownloadCapability {
  return {
    available: false,
    state: 'waiting-for-engine',
    reason: 'Downloads are not available on this build yet.',
  };
}

export async function startDownloadItem(): Promise<never> {
  throw new Error(getMobileDownloadCapability().reason);
}

export async function getDownloadedItems(): Promise<OfflineMediaEntryV1[]> {
  return listOfflineMediaEntriesV1();
}

export async function deleteDownloadItem(): Promise<never> {
  throw new Error('Download deletion will be available with the native download engine.');
}
