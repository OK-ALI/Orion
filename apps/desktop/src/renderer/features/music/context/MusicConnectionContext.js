import { createContext, useContext } from "react";

// App supplies this snapshot. Music never probes or derives transport state.
export const MusicConnectionContext = createContext("unknown");
export const useMusicConnection = () => useContext(MusicConnectionContext);

// Degraded describes service-specific availability; it is not a global Music outage.
export const isMusicRemoteEligible = (state = "online") => state === "online" || state === "degraded";
