const SMART_CONNECT_PORT = 8924;

export function smartConnectHttpUrl(host: string, endpoint: string): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `http://${host}:${SMART_CONNECT_PORT}${path}`;
}

export function smartConnectSocketUrl(host: string, token: string): string {
  return `ws://${host}:${SMART_CONNECT_PORT}/api/socket?token=${encodeURIComponent(token)}`;
}

