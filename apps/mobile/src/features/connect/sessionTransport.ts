const SMART_CONNECT_PORT = 8924;

export function smartConnectHttpUrl(host: string, endpoint: string, port = SMART_CONNECT_PORT): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `http://${host}:${port}${path}`;
}

export function smartConnectSocketUrl(host: string, token: string, port = SMART_CONNECT_PORT): string {
  return `ws://${host}:${port}/api/socket?token=${encodeURIComponent(token)}`;
}
