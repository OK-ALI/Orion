import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export interface SecureDeviceIdentity { deviceId: string; publicKey: string; algorithm: string }
export interface SecureResponse { status: number; body: string; fingerprint: string }

const module = NativeModules.OrionSecureConnect as undefined | {
  getIdentity(): Promise<SecureDeviceIdentity>;
  sign(value: string): Promise<string>;
  verify(publicKey: string, value: string, signature: string): Promise<boolean>;
  request(host: string, port: number, fingerprint: string | null, path: string, method: string, body: string | null): Promise<SecureResponse>;
  openSocket(host: string, port: number, fingerprint: string, ticket: string, deviceId: string): Promise<boolean>;
  sendSocket(payload: string): Promise<boolean>;
  sendRealtimeSocket?(payload: string): Promise<boolean>;
  sendRealtimeSocketFireAndForget?(payload: string): void;
  closeSocket(): Promise<void>;
  addListener(name: string): void;
  removeListeners(count: number): void;
};

function requireModule() {
  if (Platform.OS !== 'android' || !module) throw new Error('SECURE_SMART_CONNECT_UNAVAILABLE');
  return module;
}

export const getSecureDeviceIdentity = () => requireModule().getIdentity();
export const signSecureValue = (value: string) => requireModule().sign(value);
export const verifySecureValue = (publicKey: string, value: string, signature: string) =>
  requireModule().verify(publicKey, value, signature);

export async function secureSmartConnectRequest<T>(
  host: string,
  port: number,
  fingerprint: string | null,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T; fingerprint: string }> {
  const response = await requireModule().request(
    host, port, fingerprint, path, method, body === undefined ? null : JSON.stringify(body),
  );
  let data: T;
  try { data = JSON.parse(response.body || '{}') as T; } catch { data = {} as T; }
  return { ok: response.status >= 200 && response.status < 300, status: response.status, data, fingerprint: response.fingerprint };
}

export const openSecureSmartConnectSocket = (
  host: string, port: number, fingerprint: string, ticket: string, deviceId: string,
) => requireModule().openSocket(host, port, fingerprint, ticket, deviceId);
export const sendSecureSmartConnectSocket = (payload: string) => requireModule().sendSocket(payload);
export const sendRealtimeSmartConnectSocket = (payload: string) => {
  const mod = requireModule();
  if (mod.sendRealtimeSocketFireAndForget) {
    mod.sendRealtimeSocketFireAndForget(payload);
  } else if (mod.sendRealtimeSocket) {
    void mod.sendRealtimeSocket(payload);
  } else {
    void mod.sendSocket(payload);
  }
};
export const closeSecureSmartConnectSocket = () => module?.closeSocket() ?? Promise.resolve();

export function subscribeSecureSmartConnect(
  handlers: { onMessage(data: string): void; onClose(): void; onFailure(message: string): void },
) {
  if (!module) return () => {};
  const emitter = new NativeEventEmitter(module as any);
  const subscriptions = [
    emitter.addListener('orionSmartConnectMessage', (event) => handlers.onMessage(String(event?.data || ''))),
    emitter.addListener('orionSmartConnectClosed', handlers.onClose),
    emitter.addListener('orionSmartConnectFailure', (event) => handlers.onFailure(String(event?.message || 'Secure connection failed.'))),
  ];
  return () => subscriptions.forEach((subscription) => subscription.remove());
}
