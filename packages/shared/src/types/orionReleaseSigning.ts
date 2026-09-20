import nacl from 'tweetnacl';

export const ORION_RELEASE_SIGNING_KEY_ID_V1 = 'orion-release-2026-01' as const;

const ORION_RELEASE_PUBLIC_KEYS_V1: Readonly<Record<string, string>> = Object.freeze({
  [ORION_RELEASE_SIGNING_KEY_ID_V1]: 'SuLjyzOgmmaEQcLLZ4BezrAJ8TVODzad/KRDbpGaflI=',
});

function decodeBase64(value: string): Uint8Array | null {
  try {
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(value);
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    const BufferConstructor = (globalThis as unknown as {
      Buffer?: { from(input: string, encoding: string): Uint8Array };
    }).Buffer;
    return BufferConstructor ? new Uint8Array(BufferConstructor.from(value, 'base64')) : null;
  } catch {
    return null;
  }
}

export function verifyOrionReleaseSignatureV1(
  keyId: string,
  payload: Uint8Array,
  signature: Uint8Array,
): boolean {
  const encodedKey = ORION_RELEASE_PUBLIC_KEYS_V1[keyId];
  const publicKey = encodedKey ? decodeBase64(encodedKey) : null;
  if (!publicKey || publicKey.length !== nacl.sign.publicKeyLength) return false;
  if (signature.length !== nacl.sign.signatureLength) return false;
  return nacl.sign.detached.verify(payload, signature, publicKey);
}
