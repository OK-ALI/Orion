import type { OrionReleaseChannelV1, OrionUpdateStateV1 } from '@orion/shared/types';
import {
  checkMobileReleaseTruthV1,
  getMobileCurrentVersionV1,
  getMobileUpdateChannelV1,
  getMobileUpdateLastCheckedV1,
  type MobileReleaseCheckV1,
} from './mobileReleaseTruth';
import {
  getAndroidUpdateEnvironmentV1,
  type OrionAndroidUpdateEnvironmentV1,
  type OrionNativeUpdateEventV1,
} from './nativeUpdateEngine';

export type MobileApplicationUpdateStatusV1 =
  | 'not-checked'
  | 'checking'
  | 'current'
  | 'rolling-out'
  | 'unsupported'
  | 'unavailable'
  | 'permission-required'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'failed';

export interface MobileApplicationUpdateStateV1 {
  status: MobileApplicationUpdateStatusV1;
  channel: OrionReleaseChannelV1;
  result: MobileReleaseCheckV1 | null;
  environment: OrionAndroidUpdateEnvironmentV1 | null;
  engineState: OrionUpdateStateV1;
  progress: number | null;
  error: string | null;
  lastCheckedAt: number | null;
}

export interface MobileApplicationUpdatePresentationV1 {
  label: string;
  description: string;
}

type MobileApplicationUpdateListener = (state: MobileApplicationUpdateStateV1) => void;

const listeners = new Set<MobileApplicationUpdateListener>();
let checkSequence = 0;
let latestState: MobileApplicationUpdateStateV1 = {
  status: 'not-checked',
  channel: getMobileUpdateChannelV1(),
  result: null,
  environment: null,
  engineState: 'idle',
  progress: null,
  error: null,
  lastCheckedAt: getMobileUpdateLastCheckedV1(),
};

function deriveStatus(
  result: MobileReleaseCheckV1 | null,
  environment: OrionAndroidUpdateEnvironmentV1 | null,
  engineState: OrionUpdateStateV1,
  error: string | null,
): MobileApplicationUpdateStatusV1 {
  if (engineState === 'downloading') return 'downloading';
  if (engineState === 'verifying') return 'verifying';
  if (engineState === 'installing') return 'installing';
  if (engineState === 'failed' || error) return 'failed';
  if (!result) return 'not-checked';
  if (result.state === 'unsupported') return 'unsupported';
  if (result.rollout.deferred && result.state !== 'available') return 'rolling-out';
  if (result.state === 'current') return 'current';
  if (result.integrity.status !== 'ready') return 'unavailable';
  if (!environment) return 'unavailable';
  if (!environment.productionSignerMatched || !environment.requestInstallPackagesDeclared) return 'unavailable';
  if (!environment.canRequestPackageInstalls) return 'permission-required';
  return 'available';
}

function publish(next: MobileApplicationUpdateStateV1): MobileApplicationUpdateStateV1 {
  latestState = next;
  for (const listener of listeners) listener(next);
  return next;
}

function withDerivedStatus(input: Omit<MobileApplicationUpdateStateV1, 'status'>): MobileApplicationUpdateStateV1 {
  return {
    ...input,
    status: deriveStatus(input.result, input.environment, input.engineState, input.error),
  };
}

export function getMobileApplicationUpdateStateV1(): MobileApplicationUpdateStateV1 {
  return latestState;
}

export function isMobileApplicationUpdateInstallReadyV1(
  state: MobileApplicationUpdateStateV1,
): boolean {
  const environment = state.environment;
  return state.result?.state === 'available'
    && state.result.integrity.status === 'ready'
    && !!environment
    && environment.productionSignerMatched
    && environment.requestInstallPackagesDeclared
    && environment.canRequestPackageInstalls;
}

export function subscribeMobileApplicationUpdateStateV1(
  listener: MobileApplicationUpdateListener,
): () => void {
  listeners.add(listener);
  listener(latestState);
  return () => listeners.delete(listener);
}

export function getMobileApplicationUpdatePresentationV1(
  state: MobileApplicationUpdateStateV1,
): MobileApplicationUpdatePresentationV1 {
  const version = state.result?.releaseTruth.mobile.release?.version || null;
  const channelLabel = state.channel === 'preview' ? 'Preview' : 'Stable';

  switch (state.status) {
    case 'checking':
      return { label: 'Checking', description: 'Looking for Orion app updates…' };
    case 'current':
      return { label: 'Up to date', description: `You are using the latest app version available on ${channelLabel}.` };
    case 'rolling-out':
      return { label: 'Rolling out', description: 'A newer Orion version is rolling out and has not reached this device yet.' };
    case 'unsupported':
      return { label: 'Unavailable', description: 'This device cannot install the latest Orion Mobile release.' };
    case 'unavailable':
      return { label: 'Unavailable', description: 'This app build cannot safely install the available Orion update.' };
    case 'permission-required':
      return { label: 'Permission needed', description: 'Allow Orion to install app updates from this source.' };
    case 'available':
      return {
        label: 'Update ready',
        description: version ? `Orion Mobile v${version} is ready to install.` : 'A new Orion Mobile version is ready to install.',
      };
    case 'downloading':
      return { label: 'Downloading', description: 'Downloading the Orion app update…' };
    case 'verifying':
      return { label: 'Verifying', description: 'Verifying the Orion app update before installation…' };
    case 'installing':
      return { label: 'Installing', description: 'Opening Android installer to finish the Orion app update…' };
    case 'failed':
      return { label: 'Needs attention', description: 'Orion could not finish the app update. Try again.' };
    default:
      return { label: 'Not checked', description: 'Check for Orion app updates when you are ready.' };
  }
}

export async function checkMobileApplicationUpdateStateV1(
  requestedChannel: OrionReleaseChannelV1 = getMobileUpdateChannelV1(),
): Promise<MobileApplicationUpdateStateV1> {
  const sequence = ++checkSequence;
  publish({
    ...latestState,
    status: 'checking',
    channel: requestedChannel,
    engineState: 'idle',
    progress: null,
    error: null,
  });

  const [releaseOutcome, environmentOutcome] = await Promise.allSettled([
    checkMobileReleaseTruthV1(requestedChannel),
    getAndroidUpdateEnvironmentV1(),
  ]);

  if (sequence !== checkSequence) return latestState;

  if (releaseOutcome.status === 'rejected') {
    return publish({
      ...latestState,
      status: 'failed',
      channel: requestedChannel,
      result: null,
      environment: environmentOutcome.status === 'fulfilled' ? environmentOutcome.value : null,
      engineState: 'failed',
      progress: null,
      error: 'Orion could not check for app updates. Check your connection and try again.',
    });
  }

  const result = releaseOutcome.value;
  const environment = environmentOutcome.status === 'fulfilled' ? environmentOutcome.value : null;
  const environmentError = environmentOutcome.status === 'rejected' && result.state === 'available'
    ? 'Orion could not verify app-update support on this device.'
    : null;

  return publish(withDerivedStatus({
    channel: result.channel,
    result,
    environment,
    engineState: 'idle',
    progress: null,
    error: environmentError,
    lastCheckedAt: result.lastCheckedAt,
  }));
}

export async function refreshMobileApplicationUpdateEnvironmentV1(): Promise<MobileApplicationUpdateStateV1> {
  if (!latestState.result) return latestState;
  try {
    const environment = await getAndroidUpdateEnvironmentV1();
    return publish(withDerivedStatus({
      ...latestState,
      environment,
      error: latestState.engineState === 'failed' ? latestState.error : null,
    }));
  } catch {
    return publish(withDerivedStatus({
      ...latestState,
      environment: null,
      error: latestState.result.state === 'available'
        ? 'Orion could not verify app-update support on this device.'
        : null,
    }));
  }
}

export function publishMobileApplicationUpdateEngineEventV1(
  event: OrionNativeUpdateEventV1,
): MobileApplicationUpdateStateV1 {
  const progress = typeof event.progress === 'number' ? event.progress : null;
  const error = event.error
    ? 'Orion could not finish the app update. Try again.'
    : event.state === 'failed'
      ? 'Orion could not finish the app update. Try again.'
      : null;

  return publish(withDerivedStatus({
    ...latestState,
    engineState: event.state,
    progress,
    error,
  }));
}

export function resetMobileApplicationUpdateEngineStateV1(): MobileApplicationUpdateStateV1 {
  return publish(withDerivedStatus({
    ...latestState,
    engineState: 'idle',
    progress: null,
    error: null,
  }));
}

export function getMobileApplicationCurrentVersionV1(): string {
  return latestState.result?.currentVersion || getMobileCurrentVersionV1();
}
