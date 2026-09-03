import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  measureNetworkStatus,
  withNetworkDeadline,
  medianLatency,
  NETWORK_PROBE_INTERVAL,
} from "../../services/networkStatus";

import {
  deriveDesktopConnectionState,
  isDesktopRemoteReady,
  legacyDesktopNetworkStatus,
  shouldEmitDesktopRecovery,
} from "../../services/desktopConnectionPolicy";

const initialNetwork = () => {
  const disconnected =
    navigator.onLine === false;

  return {
    status:
      disconnected
        ? "offline"
        : "checking",
    productState:
      disconnected
        ? "offline"
        : "checking",
    transportStatus:
      disconnected
        ? "offline"
        : "checking",
    serviceReachable: null,
    degradedReason: null,
    latencyMs: null,
    tier: "unknown",
    checkedAt: 0,
    recoveryEpoch: 0,
    restoredAt: null,
    remoteReady: false,
  };
};

export default function useNetworkStatus({
  serviceProbe = null,
} = {}) {
  const initialRef =
    useRef(null);

  if (!initialRef.current) {
    initialRef.current =
      initialNetwork();
  }

  const [network, setNetwork] =
    useState(initialRef.current);

  const networkRef =
    useRef(initialRef.current);

  // Remember an outage through intermediate checking states until it recovers.
  const outageRef = useRef(initialRef.current.productState === "offline");

  const samplesRef =
    useRef([]);

  const manualProbeRef =
    useRef(null);
  const serviceOwnerRef = useRef(serviceProbe);

  const commitNetwork =
    useCallback((next) => {
      const previous =
        networkRef.current;

      const nextProductState =
        deriveDesktopConnectionState({
          transportStatus:
            next.transportStatus,
          serviceRequired:
            next.serviceRequired,
          serviceReachable:
            next.serviceReachable,
          previousState:
            previous.productState,
        });

      if (nextProductState === "offline" || nextProductState === "degraded") {
        outageRef.current = true;
      }
      const recovered =
        shouldEmitDesktopRecovery(
          previous.productState,
          nextProductState,
          outageRef.current,
        );
      if (recovered) outageRef.current = false;

      const committed = {
        ...previous,
        ...next,
        productState:
          nextProductState,
        status:
          legacyDesktopNetworkStatus(
            nextProductState,
          ),
        remoteReady:
          isDesktopRemoteReady(
            nextProductState,
          ),
        recoveryEpoch:
          recovered
            ? previous.recoveryEpoch + 1
            : previous.recoveryEpoch,
        restoredAt:
          recovered
            ? Date.now()
            : previous.restoredAt,
      };

      delete committed.serviceRequired;

      networkRef.current =
        committed;

      setNetwork(committed);
    }, []);

  useEffect(() => {
    let disposed = false;
    let timer = null;
    let generation = 0;
    let inFlight = null;
    let controller = null;

    const serviceRequired =
      typeof serviceProbe === "function";
    const serviceChanged = serviceOwnerRef.current !== serviceProbe;
    serviceOwnerRef.current = serviceProbe;
    if (serviceChanged && serviceRequired && networkRef.current.productState === "online") {
      commitNetwork({
        transportStatus: "checking", serviceRequired, serviceReachable: null,
        degradedReason: null,
      });
    }

    const schedule = () => {
      clearTimeout(timer);

      if (!disposed) {
        timer =
          setTimeout(
            probe,
            NETWORK_PROBE_INTERVAL,
          );
      }
    };

    const probe = () => {
      if (disposed) return Promise.resolve();
      if (inFlight) return inFlight;
      clearTimeout(timer);
      const currentGeneration = ++generation;
      controller = new AbortController();
      const signal = controller.signal;
      // Publish the promise before starting work so every trigger joins this check.
      inFlight = Promise.resolve().then(() => runProbe(currentGeneration, signal))
        .finally(() => {
          if (currentGeneration === generation) {
            inFlight = null;
            controller = null;
          }
        });
      return inFlight;
    };

    const runProbe = async (currentGeneration, signal) => {
      if (disposed || currentGeneration !== generation) return;

      if (navigator.onLine === false) {
        samplesRef.current = [];

        if (!disposed) {
          commitNetwork({
            transportStatus:
              "offline",
            serviceRequired,
            serviceReachable: null,
            degradedReason: null,
            latencyMs: null,
            tier: "unknown",
            checkedAt: Date.now(),
          });
        }

        schedule();
        return;
      }

      const previousState =
        networkRef.current.productState;

      if (
        previousState === "offline" ||
        previousState === "reconnecting" ||
        previousState === "degraded"
      ) {
        commitNetwork({
          transportStatus:
            "checking",
          serviceRequired,
          serviceReachable: null,
          degradedReason: null,
          latencyMs: null,
          tier: "unknown",
          checkedAt:
            networkRef.current.checkedAt,
        });
      }

      const transport =
        await measureNetworkStatus({ signal });

      if (
        disposed ||
        currentGeneration !== generation
      ) {
        return;
      }

      if (transport.status === "offline") {
        samplesRef.current = [];

        commitNetwork({
          transportStatus:
            "offline",
          serviceRequired,
          serviceReachable: null,
          degradedReason: null,
          latencyMs: null,
          tier: "unknown",
          checkedAt:
            transport.checkedAt,
        });

        schedule();
        return;
      }

      if (
        transport.status === "online" &&
        Number.isFinite(
          transport.latencyMs,
        )
      ) {
        samplesRef.current = [
          ...samplesRef.current,
          transport.latencyMs,
        ].slice(-5);
      }

      const median =
        medianLatency(
          samplesRef.current,
        );

      if (transport.status === "degraded") {
        commitNetwork({
          transportStatus:
            "degraded",
          serviceRequired,
          serviceReachable: null,
          degradedReason:
            "transport-probe",
          latencyMs:
            transport.latencyMs,
          tier:
            transport.tier,
          checkedAt:
            transport.checkedAt,
        });

        schedule();
        return;
      }

      if (!serviceRequired) {
        commitNetwork({
          transportStatus:
            "online",
          serviceRequired: false,
          serviceReachable: null,
          degradedReason: null,
          latencyMs: median,
          tier:
            transport.tier,
          checkedAt:
            transport.checkedAt,
        });

        schedule();
        return;
      }

      // A routine check does not revoke the last validated capability while pending.
      if (networkRef.current.productState !== "online") commitNetwork({
        transportStatus:
          "online",
        serviceRequired: true,
        serviceReachable: null,
        degradedReason: null,
        latencyMs: median,
        tier:
          transport.tier,
        checkedAt:
          transport.checkedAt,
      });

      try {
        await withNetworkDeadline((serviceSignal) => serviceProbe({ signal: serviceSignal }), { signal });

        if (
          disposed ||
          currentGeneration !== generation
        ) {
          return;
        }

        commitNetwork({
          transportStatus:
            "online",
          serviceRequired: true,
          serviceReachable: true,
          degradedReason: null,
          latencyMs: median,
          tier:
            transport.tier,
          checkedAt:
            Date.now(),
        });
      } catch {
        if (
          disposed ||
          currentGeneration !== generation
        ) {
          return;
        }

        commitNetwork({
          transportStatus:
            "online",
          serviceRequired: true,
          serviceReachable: false,
          degradedReason:
            "service",
          latencyMs: median,
          tier:
            transport.tier,
          checkedAt:
            Date.now(),
        });
      }

      schedule();
    };

    const handleOnline = () => {
      clearTimeout(timer);
      samplesRef.current = [];
      void probe();
    };

    const handleOffline = () => {
      generation += 1;
      controller?.abort();
      controller = null;
      inFlight = null;
      clearTimeout(timer);
      samplesRef.current = [];

      commitNetwork({
        transportStatus:
          "offline",
        serviceRequired,
        serviceReachable: null,
        degradedReason: null,
        latencyMs: null,
        tier: "unknown",
        checkedAt: Date.now(),
      });
    };

    const handleVisibility = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        clearTimeout(timer);
        void probe();
      }
    };

    manualProbeRef.current = probe;

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "offline",
      handleOffline,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    void probe();

    return () => {
      disposed = true;
      generation += 1;
      controller?.abort();
      inFlight = null;
      clearTimeout(timer);
      samplesRef.current = [];
      manualProbeRef.current = null;

      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "offline",
        handleOffline,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, [
    commitNetwork,
    serviceProbe,
  ]);

  const recheck =
    useCallback(() => {
      return manualProbeRef.current?.()?.then(() => networkRef.current);
    }, []);

  return {
    ...network,
    recheck,
  };
}