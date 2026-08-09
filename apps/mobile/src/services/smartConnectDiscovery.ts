import NetInfo from '@react-native-community/netinfo';
import { discoverNativeSmartConnectServices } from './nativeSmartConnectDiscovery';

export type SmartConnectDiscoveryMethod = 'saved' | 'nsd' | 'qr' | 'direct-ip' | 'subnet-fallback';

export interface SmartConnectDiscoveryResult {
  instanceId: string;
  displayName: string;
  host: string;
  port: number;
  protocolVersion: number;
  discoveryMethod: SmartConnectDiscoveryMethod;
  verifiedAt: number;
}

export type SmartConnectEndpointProbe =
  | { ok: true; result: SmartConnectDiscoveryResult }
  | { ok: false; errorCode: 'endpoint-lost' | 'protocol-mismatch' };

export async function inspectSmartConnectEndpoint(
  host: string,
  port: number,
  protocolVersion: number,
  discoveryMethod: SmartConnectDiscoveryMethod,
  timeoutMs = 1_500,
): Promise<SmartConnectEndpointProbe> {
  if (!host || host === '127.0.0.1' || host === 'localhost') {
    return { ok: false, errorCode: 'endpoint-lost' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://${host}:${port}/api/status`, { signal: controller.signal });
    if (!response.ok) return { ok: false, errorCode: 'endpoint-lost' };
    const status = await response.json();
    if (Number(status?.version) !== protocolVersion) {
      return { ok: false, errorCode: 'protocol-mismatch' };
    }
    return {
      ok: true,
      result: {
        instanceId: String(status.instanceId || `${host}:${port}`),
        displayName: String(status.displayName || 'Orion Desktop'),
        host,
        port: Number(status.port || port),
        protocolVersion,
        discoveryMethod,
        verifiedAt: Date.now(),
      },
    };
  } catch {
    return { ok: false, errorCode: 'endpoint-lost' };
  } finally {
    clearTimeout(timer);
  }
}

async function probeDesktop(
  host: string,
  port: number,
  protocolVersion: number,
  discoveryMethod: SmartConnectDiscoveryMethod,
  timeoutMs = 900,
): Promise<SmartConnectDiscoveryResult | null> {
  const probe = await inspectSmartConnectEndpoint(
    host,
    port,
    protocolVersion,
    discoveryMethod,
    timeoutMs,
  );
  return probe.ok ? probe.result : null;
}

export async function discoverSmartConnectDesktops(
  savedEndpoints: Array<{ host?: string | null; port?: number | null }>,
  protocolVersion: number,
) {
  const startedAt = Date.now();
  const verified = new Map<string, SmartConnectDiscoveryResult>();
  for (const endpoint of savedEndpoints) {
    const result = await probeDesktop(String(endpoint.host || '').trim(), Number(endpoint.port || 8924), protocolVersion, 'saved', 1_200);
    if (result) verified.set(result.instanceId, result);
  }
  if (verified.size) return { results: [...verified.values()], durationMs: Date.now() - startedAt, nsdResultCount: 0 };

  const nativeResults = await discoverNativeSmartConnectServices(4_500).catch(() => []);
  for (const candidate of nativeResults) {
    if (candidate.protocolVersion !== protocolVersion) continue;
    const result = await probeDesktop(candidate.host, candidate.port, protocolVersion, 'nsd', 1_100);
    if (result) verified.set(result.instanceId, result);
  }
  return {
    results: [...verified.values()],
    durationMs: Date.now() - startedAt,
    nsdResultCount: nativeResults.length,
  };
}

export async function scanSmartConnectSubnet(protocolVersion: number) {
  const network = await NetInfo.fetch();
  const phoneIp = String((network.details as any)?.ipAddress || '');
  const match = phoneIp.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d{1,3})$/);
  if (!match) return [];
  const prefix = match[1];
  const ownHost = Number(match[2]);
  const results: SmartConnectDiscoveryResult[] = [];
  const candidates = Array.from({ length: 254 }, (_, index) => index + 1).filter((host) => host !== ownHost);
  for (let offset = 0; offset < candidates.length && !results.length; offset += 18) {
    const batch = candidates.slice(offset, offset + 18);
    const found = await Promise.all(batch.map((host) => probeDesktop(`${prefix}.${host}`, 8924, protocolVersion, 'subnet-fallback', 650)));
    results.push(...found.filter((item): item is SmartConnectDiscoveryResult => Boolean(item)));
  }
  return results;
}

export async function verifySmartConnectEndpoint(
  host: string,
  port: number,
  protocolVersion: number,
  method: SmartConnectDiscoveryMethod,
) {
  return probeDesktop(host, port, protocolVersion, method, 1_500);
}

/** @deprecated Prefer discoverSmartConnectDesktops so multiple Desktops remain visible. */
export async function discoverSmartConnectDesktop(
  preferredIps: Array<string | null | undefined>,
  protocolVersion: number,
) {
  const discovery = await discoverSmartConnectDesktops(
    preferredIps.filter(Boolean).map((host) => ({ host: String(host), port: 8924 })),
    protocolVersion,
  );
  return discovery.results[0]?.host || null;
}
