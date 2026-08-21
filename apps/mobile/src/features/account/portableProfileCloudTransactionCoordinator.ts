type PortableProfileCloudTransaction<T> = () => Promise<T> | T;

const transactionTails = new Map<string, Promise<void>>();

function normalizeProfileId(profileId: string): string {
  const normalized = profileId.trim();
  if (!normalized) throw new Error('Portable profile cloud transaction requires a profile ID.');
  return normalized;
}

/**
 * Serializes complete PortableProfileV3 cloud transactions for one Orion
 * profile. My List, Watched and Viewing Activity share one Drive document, so
 * their read -> decide -> write/pull -> verify -> checkpoint sequences must not
 * interleave on the same device.
 *
 * Different Orion profiles remain independent. A rejected transaction never
 * poisons the queue for later work.
 */
export async function runPortableProfileCloudTransaction<T>(
  profileId: string,
  transaction: PortableProfileCloudTransaction<T>,
): Promise<T> {
  if (typeof transaction !== 'function') {
    throw new TypeError('Portable profile cloud transaction callback is required.');
  }

  const key = normalizeProfileId(profileId);
  const previous = transactionTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => current);
  transactionTails.set(key, tail);

  await previous.catch(() => {});
  try {
    return await transaction();
  } finally {
    release();
    if (transactionTails.get(key) === tail) transactionTails.delete(key);
  }
}
