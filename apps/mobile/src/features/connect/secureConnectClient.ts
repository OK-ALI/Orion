import {
  closeSecureSmartConnectSocket,
  getSecureDeviceIdentity,
  openSecureSmartConnectSocket,
  secureSmartConnectRequest,
  sendSecureSmartConnectSocket,
  signSecureValue,
  subscribeSecureSmartConnect,
  verifySecureValue,
} from '../../services/nativeSecureConnect';

export interface SecureEndpoint {
  host: string;
  port: number;
  fingerprint: string;
  instanceId?: string;
}

export interface PairingTranscript {
  pairingId: string;
  desktopInstanceId: string;
  deviceId: string;
  deviceName: string;
  certificateFingerprint: string;
  phrase: { words: string[]; expiresAt: number };
}

export async function startSecurePairing(endpoint: SecureEndpoint, pin: string, deviceName: string) {
  const identity = await getSecureDeviceIdentity();
  const response = await secureSmartConnectRequest<any>(
    endpoint.host, endpoint.port, endpoint.fingerprint || null, '/api/pair/start', 'POST',
    { pin, deviceId: identity.deviceId, deviceName, publicKey: identity.publicKey },
  );
  if (!response.ok || !response.data?.transcript) throw pairingFailure(response.data, response.status);
  return { identity, transcript: response.data.transcript as PairingTranscript, fingerprint: response.fingerprint };
}

export async function confirmSecurePairing(endpoint: SecureEndpoint, transcript: PairingTranscript) {
  const response = await secureSmartConnectRequest<any>(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/pair/confirm', 'POST',
    { pairingId: transcript.pairingId, deviceId: transcript.deviceId },
  );
  if (!response.ok) throw pairingFailure(response.data, response.status);
  return response.data;
}

export async function rejectSecurePairing(endpoint: SecureEndpoint, transcript: PairingTranscript) {
  await secureSmartConnectRequest(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/pair/reject', 'POST',
    { pairingId: transcript.pairingId, deviceId: transcript.deviceId },
  ).catch(() => null);
}

export async function waitForDesktopConfirmation(endpoint: SecureEndpoint, transcript: PairingTranscript) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = await secureSmartConnectRequest<any>(
      endpoint.host, endpoint.port, endpoint.fingerprint, '/api/pair/result', 'POST',
      { pairingId: transcript.pairingId, deviceId: transcript.deviceId },
    );
    if (result.ok && result.data?.paired) return result.data;
    if (result.status === 410) throw pairingFailure(result.data, result.status);
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw Object.assign(new Error('Desktop confirmation timed out.'), { code: 'PAIRING_TIMEOUT' });
}

export async function authenticateSecureSocket(endpoint: SecureEndpoint, deviceId: string) {
  const challenge = await secureSmartConnectRequest<any>(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/auth/challenge', 'POST', { deviceId },
  );
  if (!challenge.ok) throw pairingFailure(challenge.data, challenge.status);
  const validDesktop = await verifySecureValue(
    String(challenge.data.desktopPublicKey || ''),
    String(challenge.data.nonce || ''),
    String(challenge.data.desktopSignature || ''),
  );
  if (!validDesktop) throw Object.assign(new Error('Desktop identity verification failed.'), { code: 'DESKTOP_IDENTITY_FAILED' });
  const signature = await signSecureValue(String(challenge.data.nonce));
  const ticket = await secureSmartConnectRequest<any>(
    endpoint.host, endpoint.port, endpoint.fingerprint, '/api/auth/ticket', 'POST',
    { deviceId, signature },
  );
  if (!ticket.ok || !ticket.data?.ticket) throw pairingFailure(ticket.data, ticket.status);
  await openSecureSmartConnectSocket(endpoint.host, endpoint.port, endpoint.fingerprint, ticket.data.ticket, deviceId);
  return { connectionId: String(ticket.data.connectionId || '') };
}

export const sendSecureEnvelope = (payload: unknown) => sendSecureSmartConnectSocket(JSON.stringify(payload));
export { closeSecureSmartConnectSocket, subscribeSecureSmartConnect };

function pairingFailure(data: any, status: number) {
  const detail = data?.error || data || {};
  return Object.assign(new Error(String(detail.message || 'Secure Smart Connect request failed.')), {
    code: String(detail.code || `HTTP_${status}`),
    attemptsRemaining: Number.isFinite(Number(detail.attemptsRemaining)) ? Number(detail.attemptsRemaining) : null,
    retryAfterMs: Number.isFinite(Number(detail.retryAfterMs)) ? Number(detail.retryAfterMs) : null,
  });
}
