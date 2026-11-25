/** Bounded, abortable probe; redirects/login HTML never establish internet reachability. */
export async function probeInternetEndpoint(url: string, parent: AbortSignal, timeoutMs = 4000, fetcher: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController(), abort = () => controller.abort();
  if (parent.aborted) return false;
  parent.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      fetcher(url, { method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal }).then(response => response.status === 204 && !response.redirected),
      new Promise<boolean>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(false); }, timeoutMs); }),
      new Promise<boolean>(resolve => { const cancelled = () => resolve(false); controller.signal.addEventListener('abort', cancelled, { once: true }); }),
    ]);
  } catch { return false; }
  finally { if (timer) clearTimeout(timer); parent.removeEventListener('abort', abort); controller.abort(); }
}
export async function boundedConnectivityProbe<T>(operation: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController(), abort = () => controller.abort();
  if (parent.aborted) throw new Error('Connectivity probe cancelled.');
  parent.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
      const fail = () => reject(new Error('Connectivity probe cancelled.'));
      controller.signal.addEventListener('abort', fail, { once: true });
      timer = setTimeout(() => controller.abort(), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); parent.removeEventListener('abort', abort); controller.abort(); }
}
