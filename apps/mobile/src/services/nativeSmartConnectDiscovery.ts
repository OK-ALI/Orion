import { NativeModules, Platform } from 'react-native';

export interface NativeSmartConnectService {
  instanceId: string;
  displayName: string;
  host: string;
  port: number;
  protocolVersion: number;
}

interface NativeDiscoveryResponse {
  results?: NativeSmartConnectService[];
  errorCode?: string;
}

const nativeModule = NativeModules.OrionNsdDiscovery as {
  discover(timeoutMs: number): Promise<NativeDiscoveryResponse>;
  stopDiscovery(): Promise<void>;
} | undefined;

export async function discoverNativeSmartConnectServices(timeoutMs = 4_500) {
  if (Platform.OS !== 'android' || !nativeModule) return [];
  const response = await nativeModule.discover(timeoutMs);
  return Array.isArray(response?.results) ? response.results : [];
}

export async function stopNativeSmartConnectDiscovery() {
  if (Platform.OS === 'android' && nativeModule) await nativeModule.stopDiscovery().catch(() => {});
}
