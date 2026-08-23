import type { OrionReleaseChannelV1 } from '@orion/shared/types';
import {
  subscribeMobileApplicationUpdateStateV1,
  type MobileApplicationUpdateStateV1,
} from './mobileApplicationUpdateState';
import { mmkvStorageAdapter } from './storageAdapter';

const DISMISSED_KEY = 'orion.mobile.updateAnnouncementDismissed.v1';

export interface MobileUpdateAnnouncementV1 {
  channel: OrionReleaseChannelV1;
  version: string;
  currentVersion: string;
  lastCheckedAt: number;
  installState: 'ready' | 'permission-required';
}

type AnnouncementListener = (announcement: MobileUpdateAnnouncementV1 | null) => void;

const listeners = new Set<AnnouncementListener>();
let latestAnnouncement: MobileUpdateAnnouncementV1 | null = null;

function dismissalId(announcement: Pick<MobileUpdateAnnouncementV1, 'channel' | 'version'>): string {
  return `${announcement.channel}:${announcement.version}`;
}

const MAX_DISMISSED_ANNOUNCEMENTS = 24;

function readDismissedIds(): string[] {
  const value = String(mmkvStorageAdapter.get(DISMISSED_KEY) || '').trim();
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        .slice(-MAX_DISMISSED_ANNOUNCEMENTS);
    }
  } catch {
    // The original P9-F4 candidate stored one channel:version string. Keep it as legacy input.
  }

  return [value];
}

function writeDismissedIds(ids: string[]): void {
  const bounded = Array.from(new Set(ids)).slice(-MAX_DISMISSED_ANNOUNCEMENTS);
  mmkvStorageAdapter.set(DISMISSED_KEY, JSON.stringify(bounded));
}

function publish(announcement: MobileUpdateAnnouncementV1 | null): void {
  latestAnnouncement = announcement;
  for (const listener of listeners) listener(announcement);
}

function syncFromApplicationUpdateState(state: MobileApplicationUpdateStateV1): void {
  const release = state.result?.releaseTruth.mobile.release;
  const installState = state.status === 'available'
    ? 'ready'
    : state.status === 'permission-required'
      ? 'permission-required'
      : null;

  if (!release || !state.result || !installState) {
    publish(null);
    return;
  }

  const announcement: MobileUpdateAnnouncementV1 = {
    channel: state.channel,
    version: release.version,
    currentVersion: state.result.currentVersion,
    lastCheckedAt: state.result.lastCheckedAt,
    installState,
  };

  if (readDismissedIds().includes(dismissalId(announcement))) {
    publish(null);
    return;
  }

  publish(announcement);
}

subscribeMobileApplicationUpdateStateV1(syncFromApplicationUpdateState);

export function getMobileUpdateAnnouncementV1(): MobileUpdateAnnouncementV1 | null {
  return latestAnnouncement;
}

export function subscribeMobileUpdateAnnouncementV1(listener: AnnouncementListener): () => void {
  listeners.add(listener);
  listener(latestAnnouncement);
  return () => listeners.delete(listener);
}

export function dismissMobileUpdateAnnouncementV1(
  announcement: MobileUpdateAnnouncementV1,
): void {
  writeDismissedIds([...readDismissedIds(), dismissalId(announcement)]);
  if (latestAnnouncement && dismissalId(latestAnnouncement) === dismissalId(announcement)) {
    publish(null);
  }
}
