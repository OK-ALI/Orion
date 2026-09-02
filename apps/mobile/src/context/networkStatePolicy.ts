export type NetworkProductState =
  | "checking"
  | "online"
  | "degraded"
  | "offline"
  | "reconnecting";

export interface NetworkStateObservation {
  nativeOnline: boolean;
  internetReachable: boolean | null;
  serviceReachable: boolean | null;
  previousState: NetworkProductState;
}

export function isTransportAvailable(
  nativeOnline: boolean,
  internetReachable: boolean | null,
): boolean {
  return nativeOnline && internetReachable !== false;
}

export function deriveNetworkProductState(
  observation: NetworkStateObservation,
): NetworkProductState {
  if (
    !isTransportAvailable(
      observation.nativeOnline,
      observation.internetReachable,
    )
  ) {
    return "offline";
  }

  if (observation.serviceReachable === true) {
    return "online";
  }

  if (observation.serviceReachable === false) {
    return "degraded";
  }

  if (
    observation.previousState === "offline" ||
    observation.previousState === "reconnecting"
  ) {
    return "reconnecting";
  }

  return "checking";
}

export function shouldEmitRecovery(
  previousState: NetworkProductState,
  nextState: NetworkProductState,
): boolean {
  if (nextState !== "online") return false;

  return (
    previousState === "offline" ||
    previousState === "reconnecting" ||
    previousState === "degraded"
  );
}

export function isRemoteReady(
  state: NetworkProductState,
): boolean {
  return state === "online";
}