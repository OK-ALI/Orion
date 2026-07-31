import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import NetInfo, { type NetInfoStateType } from "@react-native-community/netinfo";
import { tmdbFetch } from "@orion/shared/api";

interface NetworkStatus {
  online: boolean;
  internetReachable: boolean | null;
  connectionType: NetInfoStateType;
  latencyMs: number | null;
  checkedAt: number;
}

const NetworkContext = createContext<NetworkStatus | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [nativeState, setNativeState] = useState({
    online: true,
    internetReachable: null as boolean | null,
    connectionType: "unknown" as NetInfoStateType,
  });
  const [latency, setLatency] = useState({ latencyMs: null as number | null, checkedAt: 0 });

  useEffect(() => NetInfo.addEventListener((state) => {
    setNativeState({
      online: Boolean(state.isConnected),
      internetReachable: state.isInternetReachable,
      connectionType: state.type,
    });
  }), []);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      if (!nativeState.online || nativeState.internetReachable === false) {
        setLatency({ latencyMs: null, checkedAt: Date.now() });
        return;
      }
      const startedAt = globalThis.performance?.now?.() ?? Date.now();
      try {
        await tmdbFetch("/configuration");
        if (!cancelled) {
          const finishedAt = globalThis.performance?.now?.() ?? Date.now();
          setLatency({ latencyMs: Math.max(1, Math.round(finishedAt - startedAt)), checkedAt: Date.now() });
        }
      } catch {
        if (!cancelled) setLatency({ latencyMs: null, checkedAt: Date.now() });
      }
    };
    probe();
    const timer = setInterval(probe, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [nativeState.internetReachable, nativeState.online]);

  const value = useMemo(() => ({
    ...nativeState,
    ...latency,
  }), [latency, nativeState]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  const value = useContext(NetworkContext);
  if (!value) throw new Error("useNetworkStatus must be used within NetworkProvider");
  return value;
}
