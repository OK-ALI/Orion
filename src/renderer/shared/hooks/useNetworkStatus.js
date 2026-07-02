import { useEffect, useState } from "react";
import { measureNetworkStatus, NETWORK_PROBE_INTERVAL } from "../../services/networkStatus";

const initialStatus = () => ({
  status: navigator.onLine === false ? "offline" : "checking",
  latencyMs: null,
  tier: "unknown",
  checkedAt: 0,
});

export default function useNetworkStatus() {
  const [network, setNetwork] = useState(initialStatus);

  useEffect(() => {
    let disposed = false;
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed) timer = setTimeout(probe, NETWORK_PROBE_INTERVAL);
    };
    const probe = async () => {
      if (navigator.onLine === false) {
        if (!disposed) setNetwork({ status: "offline", latencyMs: null, tier: "unknown", checkedAt: Date.now() });
        schedule();
        return;
      }
      const result = await measureNetworkStatus();
      if (!disposed) setNetwork(result);
      schedule();
    };
    const handleOnline = () => probe();
    const handleOffline = () => {
      clearTimeout(timer);
      setNetwork({ status: "offline", latencyMs: null, tier: "unknown", checkedAt: Date.now() });
    };
    const handleVisibility = () => { if (document.visibilityState === "visible") probe(); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    probe();
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return network;
}
