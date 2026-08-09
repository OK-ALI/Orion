export interface ParsedPairingPayload {
  ip: string;
  pin: string;
  port: number;
  fingerprint: string;
  instanceId: string;
}

export function parsePairingPayload(data: string): ParsedPairingPayload {
  let ip = data.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/)?.[1] ?? '';
  let pin = data.match(/pin[=:\s"']*([0-9]{6})/i)?.[1] ?? '';
  let port = 8924;
  let fingerprint = '';
  let instanceId = '';

  try {
    const parsedUrl = new URL(data);
    ip = parsedUrl.searchParams.get('ip') || ip;
    pin = parsedUrl.searchParams.get('pin') || pin;
    port = Number(parsedUrl.searchParams.get('port') || 8924);
    fingerprint = parsedUrl.searchParams.get('fingerprint') || '';
    instanceId = parsedUrl.searchParams.get('instanceId') || '';
  } catch {}

  if (data.includes('{')) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.ip) ip = String(parsed.ip);
      if (parsed.pin) pin = String(parsed.pin);
      if (parsed.port) port = Number(parsed.port);
      if (parsed.fingerprint) fingerprint = String(parsed.fingerprint);
      if (parsed.instanceId) instanceId = String(parsed.instanceId);
    } catch {
      // Non-JSON QR payloads continue through the IPv4/PIN parser.
    }
  }

  return { ip, pin, port, fingerprint, instanceId };
}

export function normalizeDesktopAddress(rawAddress: string): string {
  const ip = rawAddress.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/)?.[1];
  if (ip) return ip;
  return rawAddress
    .replace(/^(https?:\/\/|orion:\/\/connect\?ip=)/i, '')
    .replace(/:\d+.*$/, '');
}
