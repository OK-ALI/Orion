export const DESKTOP_CONNECTION_STATES = Object.freeze([
  "checking",
  "online",
  "degraded",
  "offline",
  "reconnecting",
]);

export function normalizeDesktopConnectionState(value) {
  return DESKTOP_CONNECTION_STATES.includes(value)
    ? value
    : "checking";
}

export function deriveDesktopConnectionState({
  transportStatus,
  serviceRequired = false,
  serviceReachable = null,
  previousState = "checking",
} = {}) {
  const previous =
    normalizeDesktopConnectionState(
      previousState,
    );

  if (transportStatus === "offline") {
    return "offline";
  }

  if (transportStatus === "degraded") {
    return "degraded";
  }

  if (
    transportStatus !== "online"
  ) {
    return (
      previous === "offline" ||
      previous === "reconnecting"
    )
      ? "reconnecting"
      : "checking";
  }

  if (!serviceRequired) {
    return "online";
  }

  if (serviceReachable === false) {
    return "degraded";
  }

  if (serviceReachable === true) {
    return "online";
  }

  return (
    previous === "offline" ||
    previous === "reconnecting"
  )
    ? "reconnecting"
    : "checking";
}

export function legacyDesktopNetworkStatus(
  productState,
) {
  const state =
    normalizeDesktopConnectionState(
      productState,
    );

  return state === "reconnecting"
    ? "checking"
    : state;
}

export function shouldEmitDesktopRecovery(
  previousState,
  nextState,
) {
  const previous =
    normalizeDesktopConnectionState(
      previousState,
    );

  const next =
    normalizeDesktopConnectionState(
      nextState,
    );

  if (next !== "online") {
    return false;
  }

  return (
    previous === "offline" ||
    previous === "reconnecting" ||
    previous === "degraded"
  );
}

export function isDesktopRemoteReady(
  productState,
) {
  return (
    normalizeDesktopConnectionState(
      productState,
    ) === "online"
  );
}