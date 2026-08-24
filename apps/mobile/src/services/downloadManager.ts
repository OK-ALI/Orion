/**
 * Mobile downloader presentation boundary.
 *
 * P10.3 activates this boundary only when the Android-owned native engine is
 * actually present. Presentation must never simulate transfer availability,
 * progress or completion.
 */

import type { OfflineMediaEntryV1 } from '@orion/shared/types';
import { listOfflineMediaEntriesV1 } from '../features/downloads/downloadRepository';
import { isNativeDownloadEngineAvailableV1 } from '../features/downloads/nativeDownloadEngine';

export const MOBILE_DOWNLOADER_AVAILABLE = isNativeDownloadEngineAvailableV1();

export interface MobileDownloadCapability {
  available: boolean;
  state: 'ready' | 'waiting-for-engine';
  reason: string;
}

export function getMobileDownloadCapability(): MobileDownloadCapability {
  if (MOBILE_DOWNLOADER_AVAILABLE) {
    return {
      available: true,
      state: 'ready',
      reason: 'Android native download engine ready.',
    };
  }
  return {
    available: false,
    state: 'waiting-for-engine',
    reason: "Downloads require Orion's Android native download engine.",
  };
}

export async function getDownloadedItems(): Promise<OfflineMediaEntryV1[]> {
  return listOfflineMediaEntriesV1();
}

export async function deleteDownloadItem(): Promise<never> {
  throw new Error('Download deletion is not active in this P10.3 candidate yet.');
}
