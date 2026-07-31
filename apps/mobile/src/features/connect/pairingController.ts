export interface ParsedPairingPayload {
  ip: string;
  pin: string;
}

export function parsePairingPayload(data: string): ParsedPairingPayload {
  let ip = data.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/)?.[1] ?? '';
  let pin = data.match(/pin[=:\s"']*([0-9]{6})/i)?.[1] ?? '';

  if (data.includes('{')) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.ip) ip = String(parsed.ip);
      if (parsed.pin) pin = String(parsed.pin);
    } catch {
      // Non-JSON QR payloads continue through the IPv4/PIN parser.
    }
  }

  return { ip, pin };
}

export function normalizeDesktopAddress(rawAddress: string): string {
  const ip = rawAddress.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/)?.[1];
  if (ip) return ip;
  return rawAddress
    .replace(/^(https?:\/\/|orion:\/\/connect\?ip=)/i, '')
    .replace(/:\d+.*$/, '');
}

