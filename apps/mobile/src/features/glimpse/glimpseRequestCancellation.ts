/** Release Glimpse's transaction even when an upstream promise ignores cancellation. */
export function awaitGlimpseRequest<T>(request: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('Glimpse request cancelled'));
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => { cleanup(); reject(new Error('Glimpse request cancelled')); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      request().then(value => { cleanup(); if (signal.aborted) abort(); else resolve(value); },
        error => { cleanup(); reject(error); });
    } catch (error) { cleanup(); reject(error); }
  });
}
