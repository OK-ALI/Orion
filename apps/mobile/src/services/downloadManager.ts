/**
 * Mobile downloader boundary.
 *
 * Protected/segmented downloads are deliberately unavailable until Orion has
 * a native, resumable background engine. This module must never simulate
 * progress, cache browser Blob URLs, or report an embed page as a media file.
 */

export const MOBILE_DOWNLOADER_AVAILABLE = false;

export interface MobileDownloadCapability {
  available: false;
  state: "locked";
  reason: string;
}

export function getMobileDownloadCapability(): MobileDownloadCapability {
  return {
    available: false,
    state: "locked",
    reason: "Native protected-stream downloads are under development.",
  };
}

export async function startDownloadItem(): Promise<never> {
  throw new Error(getMobileDownloadCapability().reason);
}

export async function getDownloadedItems(): Promise<[]> {
  return [];
}

export async function deleteDownloadItem(): Promise<[]> {
  return [];
}
