import { createContext, useContext } from "react";

// App supplies this snapshot. Music never probes or derives transport state.
export const MusicConnectionContext = createContext("unknown");
export const useMusicConnection = () => useContext(MusicConnectionContext);
