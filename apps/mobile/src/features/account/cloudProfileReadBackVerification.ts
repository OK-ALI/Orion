import type { CloudProfileReadResult, CloudProfileStore } from '@orion/shared/api';

export type FoundCloudProfileReadResult = Extract<CloudProfileReadResult, { state: 'found' }>;

const DEFAULT_READ_BACK_DELAYS_MS = [0, 250, 750, 1500] as const;

function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Performs bounded semantic read-back verification after a successful cloud
 * write. The opaque backend revision tag is intentionally not treated as
 * document identity: backends may expose a fresh tag while a just-written
 * object is still converging across metadata/content reads.
 *
 * Callers must provide the domain-specific semantic verifier. A result is
 * accepted only when a fresh CloudProfileStore read proves the expected
 * PortableProfileV3 content. Later writes still use the revision tag from
 * their own fresh pre-write read, preserving optimistic concurrency.
 */
export async function readBackCloudProfileUntilVerified(
  store: CloudProfileStore,
  profileKey: string,
  verify: (result: FoundCloudProfileReadResult) => boolean,
  delaysMs: readonly number[] = DEFAULT_READ_BACK_DELAYS_MS,
): Promise<FoundCloudProfileReadResult | null> {
  for (const delayMs of delaysMs) {
    await wait(delayMs);
    const result = await store.read(profileKey);
    if (result.state === 'found' && verify(result)) return result;
  }
  return null;
}
