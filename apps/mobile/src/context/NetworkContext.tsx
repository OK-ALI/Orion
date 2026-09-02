import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import NetInfo, {
  type NetInfoStateType,
} from "@react-native-community/netinfo";
import { tmdbFetch } from "@orion/shared/api";

import {
  deriveNetworkProductState,
  isRemoteReady,
  isTransportAvailable,
  shouldEmitRecovery,
  type NetworkProductState,
} from "./networkStatePolicy";

const PROBE_INTERVAL_MS = 15000;
const PROBE_TIMEOUT_MS = 8000;

export interface NetworkStatus {
  online: boolean;
  internetReachable: boolean | null;
  connectionType: NetInfoStateType;
  latencyMs: number | null;
  checkedAt: number;
  productState: NetworkProductState;
  serviceReachable: boolean | null;
  remoteReady: boolean;
  recoveryEpoch: number;
  restoredAt: number | null;
}

interface ProbeState {
  serviceReachable: boolean | null;
  latencyMs: number | null;
  checkedAt: number;
}

const NetworkContext =
  createContext<NetworkStatus | null>(null);

async function probeRemoteService(): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      tmdbFetch("/configuration"),
      new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error("network-probe-timeout"));
        }, PROBE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function NetworkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [nativeState, setNativeState] = useState({
    online: true,
    internetReachable: null as boolean | null,
    connectionType: "unknown" as NetInfoStateType,
  });

  const [probeState, setProbeState] =
    useState<ProbeState>({
      serviceReachable: null,
      latencyMs: null,
      checkedAt: 0,
    });

  const [productState, setProductState] =
    useState<NetworkProductState>("checking");

  const [recoveryEpoch, setRecoveryEpoch] =
    useState(0);

  const [restoredAt, setRestoredAt] =
    useState<number | null>(null);

  const productStateRef =
    useRef<NetworkProductState>("checking");

  const probeGenerationRef =
    useRef(0);

  const applyProductState =
    useCallback((nextState: NetworkProductState) => {
      const previousState = productStateRef.current;

      if (previousState === nextState) {
        return;
      }

      productStateRef.current = nextState;
      setProductState(nextState);

      if (
        shouldEmitRecovery(
          previousState,
          nextState,
        )
      ) {
        setRecoveryEpoch((value) => value + 1);
        setRestoredAt(Date.now());
      }
    }, []);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setNativeState({
          online: Boolean(state.isConnected),
          internetReachable:
            state.isInternetReachable,
          connectionType: state.type,
        });
      }),
    [],
  );

  useEffect(() => {
    let disposed = false;

    const transportAvailable =
      isTransportAvailable(
        nativeState.online,
        nativeState.internetReachable,
      );

    probeGenerationRef.current += 1;

    if (!transportAvailable) {
      setProbeState({
        serviceReachable: null,
        latencyMs: null,
        checkedAt: Date.now(),
      });

      applyProductState("offline");

      return () => {
        disposed = true;
        probeGenerationRef.current += 1;
      };
    }

    setProbeState((current) => ({
      ...current,
      serviceReachable: null,
      latencyMs: null,
    }));

    applyProductState(
      deriveNetworkProductState({
        nativeOnline: nativeState.online,
        internetReachable:
          nativeState.internetReachable,
        serviceReachable: null,
        previousState:
          productStateRef.current,
      }),
    );

    const probe = async () => {
      const generation =
        ++probeGenerationRef.current;

      const startedAt =
        globalThis.performance?.now?.() ??
        Date.now();

      try {
        await probeRemoteService();

        if (
          disposed ||
          generation !==
            probeGenerationRef.current
        ) {
          return;
        }

        const finishedAt =
          globalThis.performance?.now?.() ??
          Date.now();

        setProbeState({
          serviceReachable: true,
          latencyMs: Math.max(
            1,
            Math.round(
              finishedAt - startedAt,
            ),
          ),
          checkedAt: Date.now(),
        });

        applyProductState(
          deriveNetworkProductState({
            nativeOnline:
              nativeState.online,
            internetReachable:
              nativeState.internetReachable,
            serviceReachable: true,
            previousState:
              productStateRef.current,
          }),
        );
      } catch {
        if (
          disposed ||
          generation !==
            probeGenerationRef.current
        ) {
          return;
        }

        setProbeState({
          serviceReachable: false,
          latencyMs: null,
          checkedAt: Date.now(),
        });

        applyProductState(
          deriveNetworkProductState({
            nativeOnline:
              nativeState.online,
            internetReachable:
              nativeState.internetReachable,
            serviceReachable: false,
            previousState:
              productStateRef.current,
          }),
        );
      }
    };

    void probe();

    const timer =
      setInterval(
        () => {
          void probe();
        },
        PROBE_INTERVAL_MS,
      );

    return () => {
      disposed = true;
      probeGenerationRef.current += 1;
      clearInterval(timer);
    };
  }, [
    applyProductState,
    nativeState.internetReachable,
    nativeState.online,
  ]);

  const transportAvailable =
    isTransportAvailable(
      nativeState.online,
      nativeState.internetReachable,
    );

  const value =
    useMemo<NetworkStatus>(
      () => ({
        online: transportAvailable,
        internetReachable:
          nativeState.internetReachable,
        connectionType:
          nativeState.connectionType,
        latencyMs:
          probeState.latencyMs,
        checkedAt:
          probeState.checkedAt,
        productState,
        serviceReachable:
          probeState.serviceReachable,
        remoteReady:
          isRemoteReady(productState),
        recoveryEpoch,
        restoredAt,
      }),
      [
        nativeState.connectionType,
        nativeState.internetReachable,
        probeState.checkedAt,
        probeState.latencyMs,
        probeState.serviceReachable,
        productState,
        recoveryEpoch,
        restoredAt,
        transportAvailable,
      ],
    );

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  const value =
    useContext(NetworkContext);

  if (!value) {
    throw new Error(
      "useNetworkStatus must be used within NetworkProvider",
    );
  }

  return value;
}