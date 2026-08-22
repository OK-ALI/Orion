import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { OrionUpdateStateV1 } from '@orion/shared/types';

export type OrionAndroidUpdateSourceV1 = 'direct';

export interface OrionAndroidUpdateEnvironmentV1 {
  source: OrionAndroidUpdateSourceV1;
  packageName: string;
  versionCode: number;
  signerSha256: string | null;
  productionSignerMatched: boolean;
  requestInstallPackagesDeclared: boolean;
  canRequestPackageInstalls: boolean;
}

export interface OrionNativeUpdateEventV1 {
  state: OrionUpdateStateV1;
  progress?: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  error?: string;
}

interface OrionUpdatesNativeModule {
  getEnvironment(): Promise<OrionAndroidUpdateEnvironmentV1>;
  openDirectInstallPermissionSettings(): Promise<boolean>;
  installDirectApk(
    url: string,
    assetName: string,
    expectedSize: number,
    expectedSha256: string,
    expectedSignerSha256: string,
  ): Promise<{ ok: boolean; code?: 'permission-required' | 'direct-build-required'; state?: OrionUpdateStateV1 }>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const nativeModule = NativeModules.OrionUpdates as OrionUpdatesNativeModule | undefined;
const nativeAvailable = Platform.OS === 'android' && !!nativeModule;
const emitter = nativeAvailable && nativeModule ? new NativeEventEmitter(nativeModule as never) : null;

export function isAndroidUpdateEngineAvailableV1(): boolean {
  return nativeAvailable;
}

export async function getAndroidUpdateEnvironmentV1(): Promise<OrionAndroidUpdateEnvironmentV1 | null> {
  if (!nativeAvailable || !nativeModule) return null;
  return nativeModule.getEnvironment();
}

export async function openDirectInstallPermissionSettingsV1(): Promise<boolean> {
  if (!nativeAvailable || !nativeModule) return false;
  return nativeModule.openDirectInstallPermissionSettings();
}

export async function installDirectApkV1(input: {
  url: string;
  assetName: string;
  expectedSize: number;
  expectedSha256: string;
  expectedSignerSha256: string;
}): Promise<{ ok: boolean; code?: 'permission-required' | 'direct-build-required'; state?: OrionUpdateStateV1 }> {
  if (!nativeAvailable || !nativeModule) return { ok: false, code: 'direct-build-required' };
  return nativeModule.installDirectApk(
    input.url,
    input.assetName,
    input.expectedSize,
    input.expectedSha256,
    input.expectedSignerSha256,
  );
}

export function subscribeAndroidUpdateStateV1(
  listener: (event: OrionNativeUpdateEventV1) => void,
): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener('OrionUpdateState', listener);
  return () => subscription.remove();
}
