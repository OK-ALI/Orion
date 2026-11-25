import { useSyncExternalStore } from 'react';
import { wavenConnectivity } from './connectivityService';

/** Pure subscription boundary: rendering a consumer never starts native/network work. */
export function useWavenConnectivity() {
  return useSyncExternalStore(wavenConnectivity.subscribe, wavenConnectivity.getSnapshot, wavenConnectivity.getSnapshot);
}
