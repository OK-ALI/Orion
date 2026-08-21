export const PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS = 20_000;

export type PortableProfileAutoSyncHeartbeatDomain = 'myList' | 'watched' | 'viewingActivity';

const DOMAIN_OFFSETS_MS: Record<PortableProfileAutoSyncHeartbeatDomain, number> = {
  myList: 3_000,
  watched: 9_000,
  viewingActivity: 15_000,
};

interface PortableProfileAutoSyncHeartbeatOptions {
  intervalMs?: number;
  setTimeoutImpl?: typeof globalThis.setTimeout;
  clearTimeoutImpl?: typeof globalThis.clearTimeout;
  setIntervalImpl?: typeof globalThis.setInterval;
  clearIntervalImpl?: typeof globalThis.clearInterval;
  isActive?: () => boolean;
}

/**
 * Bounded remote-change heartbeat for an already-mounted Mobile sync domain.
 * Local, network, policy and AppState changes still reconcile immediately.
 * This only closes the gap where another device changes Orion Cloud while
 * Mobile remains active and otherwise idle.
 */
export function startPortableProfileAutoSyncHeartbeat(
  domain: PortableProfileAutoSyncHeartbeatDomain,
  reconcile: () => void | Promise<void>,
  {
    intervalMs = PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    setIntervalImpl = globalThis.setInterval,
    clearIntervalImpl = globalThis.clearInterval,
    isActive = () => true,
  }: PortableProfileAutoSyncHeartbeatOptions = {},
): () => void {
  if (typeof reconcile !== 'function') throw new TypeError('Portable profile heartbeat reconcile callback is required.');

  const boundedInterval = Math.max(5_000, Number(intervalMs) || PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS);
  const offset = Math.min(DOMAIN_OFFSETS_MS[domain], Math.max(0, boundedInterval - 1_000));
  let stopped = false;
  let intervalId: ReturnType<typeof globalThis.setInterval> | null = null;

  const tick = () => {
    if (stopped || !isActive()) return;
    Promise.resolve(reconcile()).catch(() => {
      // Domain owners translate reconciliation failures into product status.
    });
  };

  const timeoutId = setTimeoutImpl(() => {
    if (stopped) return;
    tick();
    intervalId = setIntervalImpl(tick, boundedInterval);
  }, offset);

  return () => {
    stopped = true;
    clearTimeoutImpl(timeoutId);
    if (intervalId != null) clearIntervalImpl(intervalId);
  };
}
