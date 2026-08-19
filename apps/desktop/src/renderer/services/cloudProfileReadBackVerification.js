const DEFAULT_READ_BACK_DELAYS_MS = [0, 250, 750, 1500];

function wait(delayMs) {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function readBackCloudProfileUntilVerified(store, profileKey, verify, delaysMs = DEFAULT_READ_BACK_DELAYS_MS) {
  for (const delayMs of delaysMs) {
    await wait(delayMs);
    const result = await store.read(profileKey);
    if (result.state === "found" && verify(result)) return result;
  }
  return null;
}
