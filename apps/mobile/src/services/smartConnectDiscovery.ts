import NetInfo from '@react-native-community/netinfo';

async function probeDesktop(ip: string, protocolVersion: number, timeoutMs = 700) {
  if (!ip || ip === '127.0.0.1' || ip === 'localhost') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://${ip}:8924/api/status`, { signal: controller.signal });
    if (!response.ok) return false;
    const status = await response.json();
    return Number(status?.version) === protocolVersion;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverSmartConnectDesktop(
  preferredIps: Array<string | null | undefined>,
  protocolVersion: number,
) {
  const preferred = [...new Set(preferredIps.map((value) => String(value || '').trim()).filter(Boolean))];
  for (const candidate of preferred) {
    if (await probeDesktop(candidate, protocolVersion, 1_100)) return candidate;
  }

  const network = await NetInfo.fetch();
  const phoneIp = String((network.details as any)?.ipAddress || '');
  const match = phoneIp.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;

  const prefix = match[1];
  const ownHost = Number(match[2]);
  const candidates = Array.from({ length: 254 }, (_, index) => index + 1)
    .filter((host) => host !== ownHost)
    .map((host) => `${prefix}.${host}`);

  for (let offset = 0; offset < candidates.length; offset += 24) {
    const batch = candidates.slice(offset, offset + 24);
    const results = await Promise.all(batch.map(async (candidate) => (
      await probeDesktop(candidate, protocolVersion, 600) ? candidate : null
    )));
    const found = results.find(Boolean);
    if (found) return found;
  }
  return null;
}
