import { useEffect, useState } from "react";
import { normalizePerformanceTier } from "./performanceBudget";

function readTier() {
  return normalizePerformanceTier(document.documentElement.dataset.performanceTier);
}

export function usePerformanceTier() {
  const [tier, setTier] = useState(readTier);

  useEffect(() => {
    const sync = (event) => {
      setTier(normalizePerformanceTier(event?.detail?.tier || document.documentElement.dataset.performanceTier));
    };
    window.addEventListener("orion:performance-tier-changed", sync);
    return () => window.removeEventListener("orion:performance-tier-changed", sync);
  }, []);

  return tier;
}
