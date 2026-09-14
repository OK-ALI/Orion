import { NativeModules, Platform } from 'react-native';
import {
  PORTABLE_PROFILE_PRIMARY_KEY,
  normalizePortableProfileV3,
} from '@orion/shared/types';

interface NativeMissingResult {
  state: 'missing';
  revisionTag: null;
}

interface NativeFoundResult {
  state: 'found';
  profileJson: string;
  revisionTag: string;
  remoteModifiedAt: number | null;
}

type NativeReadResult = NativeMissingResult | NativeFoundResult;

interface NativeWrittenResult {
  state: 'written';
  revisionTag: string;
  remoteModifiedAt: number | null;
}

interface NativeConflictResult {
  state: 'conflict';
  revisionTag: string | null;
}

type NativeWriteResult = NativeWrittenResult | NativeConflictResult;

interface OrionGoogleDriveControlledNoOpNativeModule {
  readPortableProfile(accountEmail: string, profileKey: string): Promise<NativeReadResult>;
  writePortableProfile(
    accountEmail: string,
    profileKey: string,
    profileJson: string,
    expectedRevisionTag: string,
  ): Promise<NativeWriteResult>;
}

export interface ControlledNoOpWritePreparation {
  accountEmail: string;
  profileKey: typeof PORTABLE_PROFILE_PRIMARY_KEY;
  revisionTag: string;
  rawSha256: string;
  rawByteLength: number;
  portableProfileRevision: number;
  namespaceCount: number;
  namespaceKeys: string[];
}

export type ControlledNoOpWriteExecutionResult =
  | {
      state: 'verified';
      beforeRevisionTag: string;
      afterRevisionTag: string;
      rawSha256: string;
      rawByteLength: number;
      portableProfileRevision: number;
      namespaceCount: number;
    }
  | {
      state: 'conflict';
      expectedRevisionTag: string;
      currentRevisionTag: string | null;
    }
  | {
      state: 'verification-required';
      beforeRevisionTag: string;
      writtenRevisionTag: string;
      rawSha256: string;
      errorCode: string;
    }
  | {
      state: 'mismatch';
      beforeRevisionTag: string;
      writtenRevisionTag: string;
      expectedSha256: string;
      actualSha256: string | null;
      reason: string;
    };

interface PendingSnapshot extends ControlledNoOpWritePreparation {
  rawProfileJson: string;
}

interface PendingVerification {
  accountEmail: string;
  rawProfileJson: string;
  rawSha256: string;
  rawByteLength: number;
  portableProfileRevision: number;
  namespaceCount: number;
  beforeRevisionTag: string;
  writtenRevisionTag: string;
}

const nativeModule = NativeModules.OrionGoogleDriveProfileStore as
  | OrionGoogleDriveControlledNoOpNativeModule
  | undefined;

let pendingSnapshot: PendingSnapshot | null = null;
let pendingVerification: PendingVerification | null = null;

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'UNKNOWN';
  const value = String((error as { code?: unknown }).code || '').trim();
  return value || 'UNKNOWN';
}

function requireNative(): OrionGoogleDriveControlledNoOpNativeModule {
  if (Platform.OS !== 'android' || !nativeModule) {
    fail(
      'GOOGLE_DRIVE_PROFILE_STORE_UNAVAILABLE',
      'Orion Cloud profile storage is unavailable on this build.',
    );
  }
  return nativeModule;
}

function requireAccountEmail(accountEmail: string): string {
  const normalized = accountEmail.trim();
  if (!normalized) {
    fail(
      'GOOGLE_DRIVE_PROFILE_ARGUMENT_INVALID',
      'A Google account is required for the controlled Orion Cloud write gate.',
    );
  }
  return normalized;
}

function validateRevisionTag(revisionTag: string): string {
  const normalized = revisionTag.trim();
  if (!normalized || (!normalized.startsWith('version:') && !normalized.startsWith('etag:'))) {
    fail(
      'ORION_CLOUD_CONTROLLED_WRITE_REVISION_INVALID',
      'The existing Orion Cloud profile does not have a usable conditional revision tag.',
    );
  }
  return normalized;
}

function utf8Bytes(input: string): number[] {
  const output: number[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const first = input.charCodeAt(index);
    let codePoint = first;

    if (first >= 0xd800 && first <= 0xdbff) {
      const second = index + 1 < input.length ? input.charCodeAt(index + 1) : 0;
      if (second >= 0xdc00 && second <= 0xdfff) {
        codePoint = 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00);
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint <= 0x7f) {
      output.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      output.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      output.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      output.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }

  return output;
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function sha256Utf8(input: string): { hash: string; byteLength: number } {
  const bytes = utf8Bytes(input);
  const byteLength = bytes.length;
  const bitLength = byteLength * 8;

  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;

  bytes.push(
    (highBits >>> 24) & 0xff,
    (highBits >>> 16) & 0xff,
    (highBits >>> 8) & 0xff,
    highBits & 0xff,
    (lowBits >>> 24) & 0xff,
    (lowBits >>> 16) & 0xff,
    (lowBits >>> 8) & 0xff,
    lowBits & 0xff,
  );

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array<number>(64).fill(0);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let word = 0; word < 16; word += 1) {
      const base = offset + word * 4;
      words[word] = (
        (bytes[base] << 24)
        | (bytes[base + 1] << 16)
        | (bytes[base + 2] << 8)
        | bytes[base + 3]
      ) >>> 0;
    }

    for (let word = 16; word < 64; word += 1) {
      const x = words[word - 15];
      const y = words[word - 2];
      const smallSigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const smallSigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[word] = (words[word - 16] + smallSigma0 + words[word - 7] + smallSigma1) >>> 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let round = 0; round < 64; round += 1) {
      const bigSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + bigSigma1 + choose + SHA256_K[round] + words[round]) >>> 0;
      const bigSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (bigSigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return {
    hash: hash.map((value) => value.toString(16).padStart(8, '0')).join(''),
    byteLength,
  };
}

let sha256SelfTestPassed = false;

function assertSha256SelfTest(): void {
  if (sha256SelfTestPassed) return;

  const empty = sha256Utf8('').hash;
  const abc = sha256Utf8('abc').hash;

  if (
    empty !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    || abc !== 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  ) {
    fail(
      'ORION_CLOUD_CONTROLLED_WRITE_HASH_SELF_TEST_FAILED',
      'The SHA-256 safety check failed. The controlled write gate is disabled.',
    );
  }

  sha256SelfTestPassed = true;
}

async function readRawExistingProfile(accountEmail: string): Promise<NativeFoundResult> {
  const result = await requireNative().readPortableProfile(accountEmail, PORTABLE_PROFILE_PRIMARY_KEY);

  if (result.state !== 'found') {
    fail(
      'ORION_CLOUD_CONTROLLED_WRITE_PROFILE_MISSING',
      'The existing Orion primary profile is not visible. Controlled write is forbidden.',
    );
  }

  return { ...result, revisionTag: validateRevisionTag(result.revisionTag) };
}

function validateRawProfile(profileJson: string) {
  // Native write transport trims its input. Refuse the mutation unless trim is byte-neutral.
  if (!profileJson || profileJson !== profileJson.trim()) {
    fail(
      'ORION_CLOUD_CONTROLLED_WRITE_RAW_UNSAFE',
      'The existing profile contains leading or trailing whitespace, so an exact-byte no-op write is unsafe.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(profileJson);
  } catch {
    fail('GOOGLE_DRIVE_PROFILE_INVALID', 'The existing Orion Cloud profile is not valid JSON.');
  }

  const profile = normalizePortableProfileV3(parsed);
  if (!profile) {
    fail(
      'GOOGLE_DRIVE_PROFILE_INVALID',
      'The existing Orion Cloud profile failed PortableProfileV3 validation.',
    );
  }
  return profile;
}

export function isControlledNoOpWriteGateAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

export function clearControlledNoOpWriteState(): void {
  pendingSnapshot = null;
  pendingVerification = null;
}

export async function prepareControlledNoOpWrite(
  accountEmail: string,
): Promise<ControlledNoOpWritePreparation> {
  assertSha256SelfTest();
  clearControlledNoOpWriteState();

  const email = requireAccountEmail(accountEmail);
  const result = await readRawExistingProfile(email);
  const profile = validateRawProfile(result.profileJson);
  const digest = sha256Utf8(result.profileJson);
  const namespaceKeys = Object.keys(profile.namespaces).sort();

  const preparation: PendingSnapshot = {
    accountEmail: email,
    profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
    revisionTag: result.revisionTag,
    rawSha256: digest.hash,
    rawByteLength: digest.byteLength,
    portableProfileRevision: profile.revision,
    namespaceCount: namespaceKeys.length,
    namespaceKeys,
    rawProfileJson: result.profileJson,
  };

  pendingSnapshot = preparation;
  const { rawProfileJson: _privateRawProfileJson, ...publicPreparation } = preparation;
  return publicPreparation;
}

async function verifyWrittenSnapshot(
  context: PendingVerification,
): Promise<ControlledNoOpWriteExecutionResult> {
  try {
    const result = await readRawExistingProfile(context.accountEmail);
    const digest = sha256Utf8(result.profileJson);

    if (
      result.profileJson !== context.rawProfileJson
      || digest.hash !== context.rawSha256
      || digest.byteLength !== context.rawByteLength
    ) {
      return {
        state: 'mismatch',
        beforeRevisionTag: context.beforeRevisionTag,
        writtenRevisionTag: context.writtenRevisionTag,
        expectedSha256: context.rawSha256,
        actualSha256: digest.hash,
        reason: 'Read-back bytes do not exactly match the captured preimage.',
      };
    }

    const profile = validateRawProfile(result.profileJson);
    const namespaceCount = Object.keys(profile.namespaces).length;

    if (profile.revision !== context.portableProfileRevision || namespaceCount !== context.namespaceCount) {
      return {
        state: 'mismatch',
        beforeRevisionTag: context.beforeRevisionTag,
        writtenRevisionTag: context.writtenRevisionTag,
        expectedSha256: context.rawSha256,
        actualSha256: digest.hash,
        reason: 'PortableProfileV3 revision or namespace count changed unexpectedly.',
      };
    }

    // Drive revision tags are concurrency tokens, not semantic profile data.
    // The stable read-back may observe a later Drive revision than the metadata
    // returned immediately after the conditional update. Exact payload bytes,
    // SHA-256, PortableProfileV3 revision, and namespace count are the
    // preservation invariants. The observed stable read revision is reported
    // below but is not required to equal the immediate write result.

    pendingVerification = null;
    return {
      state: 'verified',
      beforeRevisionTag: context.beforeRevisionTag,
      afterRevisionTag: result.revisionTag,
      rawSha256: context.rawSha256,
      rawByteLength: context.rawByteLength,
      portableProfileRevision: context.portableProfileRevision,
      namespaceCount: context.namespaceCount,
    };
  } catch (error) {
    return {
      state: 'verification-required',
      beforeRevisionTag: context.beforeRevisionTag,
      writtenRevisionTag: context.writtenRevisionTag,
      rawSha256: context.rawSha256,
      errorCode: errorCode(error),
    };
  }
}

export async function executePreparedControlledNoOpWrite(
  accountEmail: string,
  expectedRevisionTag: string,
  expectedSha256: string,
): Promise<ControlledNoOpWriteExecutionResult> {
  assertSha256SelfTest();

  const email = requireAccountEmail(accountEmail);
  const pending = pendingSnapshot;
  if (
    !pending
    || pending.accountEmail !== email
    || pending.revisionTag !== expectedRevisionTag
    || pending.rawSha256 !== expectedSha256
  ) {
    fail(
      'ORION_CLOUD_CONTROLLED_WRITE_NOT_PREPARED',
      'The controlled write is not armed with the exact current preimage.',
    );
  }

  // Any concurrent Orion client write invalidates the preparation before mutation.
  const justBeforeWrite = await readRawExistingProfile(email);
  const justBeforeDigest = sha256Utf8(justBeforeWrite.profileJson);
  if (
    justBeforeWrite.revisionTag !== pending.revisionTag
    || justBeforeWrite.profileJson !== pending.rawProfileJson
    || justBeforeDigest.hash !== pending.rawSha256
  ) {
    pendingSnapshot = null;
    fail(
      'ORION_CLOUD_CONTROLLED_WRITE_PRECONDITION_CHANGED',
      'The Orion Cloud profile changed after preparation. No write was attempted.',
    );
  }

  const writeResult = await requireNative().writePortableProfile(
    email,
    PORTABLE_PROFILE_PRIMARY_KEY,
    pending.rawProfileJson,
    pending.revisionTag,
  );

  if (writeResult.state === 'conflict') {
    pendingSnapshot = null;
    return {
      state: 'conflict',
      expectedRevisionTag: pending.revisionTag,
      currentRevisionTag: writeResult.revisionTag,
    };
  }

  const verification: PendingVerification = {
    accountEmail: email,
    rawProfileJson: pending.rawProfileJson,
    rawSha256: pending.rawSha256,
    rawByteLength: pending.rawByteLength,
    portableProfileRevision: pending.portableProfileRevision,
    namespaceCount: pending.namespaceCount,
    beforeRevisionTag: pending.revisionTag,
    writtenRevisionTag: validateRevisionTag(writeResult.revisionTag),
  };

  pendingSnapshot = null;
  pendingVerification = verification;
  return verifyWrittenSnapshot(verification);
}

export async function retryControlledNoOpReadBack(
  accountEmail: string,
): Promise<ControlledNoOpWriteExecutionResult> {
  assertSha256SelfTest();
  const email = requireAccountEmail(accountEmail);
  const verification = pendingVerification;

  if (!verification || verification.accountEmail !== email) {
    fail(
      'ORION_CLOUD_CONTROLLED_WRITE_NO_PENDING_VERIFICATION',
      'There is no controlled write waiting for read-back verification.',
    );
  }

  return verifyWrittenSnapshot(verification);
}
