import { useEffect, useRef, useState } from "react";
import { measureNetworkStatus, medianLatency, NETWORK_PROBE_INTERVAL } from "../../services/networkStatus";

const initialStatus = () => ({
  status: navigator.onLine === false ? "offline" : "checking",
  latencyMs: null,
  tier: "unknown",
  checkedAt: 0,
});

export default function useNetworkStatus() {
  const [network, setNetwork] = useState(initialStatus);
  const samplesRef = useRef([]);

  useEffect(() => {
    let disposed = false;
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed) timer = setTimeout(probe, NETWORK_PROBE_INTERVAL);
    };
    const probe = async () => {
      if (navigator.onLine === false) {
        samplesRef.current = [];
        if (!disposed) setNetwork({ status: "offline", latencyMs: null, tier: "unknown", checkedAt: Date.now() });
        schedule();
        return;
      }
      const result = await measureNetworkStatus();
      if (result.status === "offline") samplesRef.current = [];
      if (result.status === "online" && Number.isFinite(result.latencyMs)) {
        samplesRef.current = [...samplesRef.current, result.latencyMs].slice(-5);
      }
      if (!disposed) setNetwork({ ...result, latencyMs: medianLatency(samplesRef.current) });
      schedule();
    };
    const handleOnline = () => {
      samplesRef.current = [];
      probe();
    };
    const handleOffline = () => {
      clearTimeout(timer);
      samplesRef.current = [];
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
      samplesRef.current = [];
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return network;
}
