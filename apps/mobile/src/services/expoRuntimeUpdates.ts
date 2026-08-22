import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import {
  normalizeOrionReleaseChannelV1,
  type OrionReleaseChannelV1,
  type OrionUpdateStateV1,
} from '@orion/shared/types';

export const ORION_MOBILE_RUNTIME_VERSION_V1 = 'orion-mobile-native-r1';

export type OrionRuntimeRetryActionV1 = 'check' | 'download' | 'restart';

export interface OrionRuntimeUpdateStatusV1 {
  state: OrionUpdateStateV1;
  channel: OrionReleaseChannelV1;
  enabled: boolean;
  runtimeVersion: string | null;
  runningUpdateId: string | null;
  isEmbeddedLaunch: boolean;
  isEmergencyLaunch: boolean;
  emergencyLaunchReason: string | null;
  availableUpdateId: string | null;
  rollbackToEmbedded: boolean;
  retryAction: OrionRuntimeRetryActionV1 | null;
  message: string | null;
}

function runtimeAvailable(): boolean {
  return Platform.OS !== 'web' && Updates.isEnabled;
}

function manifestUpdateId(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== 'object') return null;
  const id = (manifest as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function baseStatus(
  requestedChannel: OrionReleaseChannelV1,
  state: OrionUpdateStateV1,
  message: string | null = null,
): OrionRuntimeUpdateStatusV1 {
  const channel = normalizeOrionReleaseChannelV1(requestedChannel);
  return {
    state,
    channel,
    enabled: runtimeAvailable(),
    runtimeVersion: Updates.runtimeVersion || null,
    runningUpdateId: Updates.updateId || null,
    isEmbeddedLaunch: !!Updates.isEmbeddedLaunch,
    isEmergencyLaunch: !!Updates.isEmergencyLaunch,
    emergencyLaunchReason: Updates.emergencyLaunchReason || null,
    availableUpdateId: null,
    rollbackToEmbedded: false,
    retryAction: null,
    message,
  };
}

export function getExpoRuntimeUpdateStatusV1(
  requestedChannel: OrionReleaseChannelV1,
): OrionRuntimeUpdateStatusV1 {
  if (!runtimeAvailable()) {
    return baseStatus(
      requestedChannel,
      'unsupported',
      'Runtime updates are unavailable in this build. Orion will continue using its embedded app bundle.',
    );
  }
  if (Updates.isEmergencyLaunch) {
    return baseStatus(
      requestedChannel,
      'current',
      Updates.emergencyLaunchReason
        ? `Orion recovered to a working runtime: ${Updates.emergencyLaunchReason}`
        : 'Orion recovered to a working runtime after an update problem.',
    );
  }
  return baseStatus(requestedChannel, 'idle');
}

export function setExpoRuntimeUpdateChannelV1(channel: OrionReleaseChannelV1): void {
  if (!runtimeAvailable()) return;
  const normalized = normalizeOrionReleaseChannelV1(channel);
  Updates.setUpdateRequestHeadersOverride({ 'expo-channel-name': normalized });
}

export async function checkExpoRuntimeUpdateV1(
  requestedChannel: OrionReleaseChannelV1,
): Promise<OrionRuntimeUpdateStatusV1> {
  const initial = getExpoRuntimeUpdateStatusV1(requestedChannel);
  if (!initial.enabled) return initial;

  try {
    setExpoRuntimeUpdateChannelV1(initial.channel);
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable || result.isRollBackToEmbedded) {
      return {
        ...baseStatus(initial.channel, 'available'),
        availableUpdateId: result.isAvailable ? manifestUpdateId(result.manifest) : null,
        rollbackToEmbedded: result.isRollBackToEmbedded,
        message: result.isRollBackToEmbedded
          ? 'A safe rollback to Orion\'s embedded runtime is available.'
          : 'A runtime-compatible Orion update is available.',
      };
    }
    return baseStatus(initial.channel, 'current', 'Runtime code is current for this channel.');
  } catch (error) {
    return {
      ...baseStatus(
        initial.channel,
        'failed',
        error instanceof Error ? error.message : 'Unable to check for a runtime update.',
      ),
      retryAction: 'check',
    };
  }
}

export async function downloadExpoRuntimeUpdateV1(
  requestedChannel: OrionReleaseChannelV1,
): Promise<OrionRuntimeUpdateStatusV1> {
  const initial = getExpoRuntimeUpdateStatusV1(requestedChannel);
  if (!initial.enabled) return initial;

  try {
    setExpoRuntimeUpdateChannelV1(initial.channel);
    const result = await Updates.fetchUpdateAsync();
    return {
      ...baseStatus(
        initial.channel,
        'restart-required',
        result.isRollBackToEmbedded
          ? 'Recovery rollback downloaded. Restart Orion to apply it.'
          : 'Runtime update downloaded. Restart Orion to apply it.',
      ),
      availableUpdateId: result.isNew ? manifestUpdateId(result.manifest) : null,
      rollbackToEmbedded: result.isRollBackToEmbedded,
    };
  } catch (error) {
    return {
      ...baseStatus(
        initial.channel,
        'failed',
        error instanceof Error ? error.message : 'Unable to download the runtime update.',
      ),
      retryAction: 'download',
    };
  }
}

export async function reloadExpoRuntimeUpdateV1(): Promise<void> {
  if (!runtimeAvailable()) {
    throw new Error('Runtime updates are unavailable in this build.');
  }
  await Updates.reloadAsync();
}
