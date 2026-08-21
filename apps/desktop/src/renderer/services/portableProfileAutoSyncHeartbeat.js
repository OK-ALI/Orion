export const PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS = 20_000;

const DOMAIN_OFFSETS_MS = Object.freeze({
  myList: 3_000,
  watched: 9_000,
  viewingActivity: 15_000,
});

function defaultVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

/**
 * Bounded remote-change heartbeat for an already-mounted portable-profile
 * domain. Local changes still reconcile immediately through the domain's own
 * effects; this only closes the gap where another device changes Orion Cloud
 * while Desktop remains open and otherwise idle.
 */
export function startPortableProfileAutoSyncHeartbeat(
  domain,
  reconcile,
  {
    intervalMs = PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    setIntervalImpl = globalThis.setInterval,
    clearIntervalImpl = globalThis.clearInterval,
    isVisible = defaultVisible,
  } = {},
) {
  if (typeof reconcile !== "function") throw new TypeError("Portable profile heartbeat reconcile callback is required.");
  if (!Object.prototype.hasOwnProperty.call(DOMAIN_OFFSETS_MS, domain)) throw new TypeError(`Unknown portable profile heartbeat domain: ${domain}`);

  const boundedInterval = Math.max(5_000, Number(intervalMs) || PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS);
  const defaultOffset = DOMAIN_OFFSETS_MS[domain];
  const offset = Math.min(defaultOffset, Math.max(0, boundedInterval - 1_000));
  let stopped = false;
  let intervalId = null;

  const tick = () => {
    if (stopped || !isVisible()) return;
    Promise.resolve(reconcile()).catch(() => {
      // Domain owners already translate reconciliation failures into their
      // product status. The scheduler must never create an unhandled rejection.
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
