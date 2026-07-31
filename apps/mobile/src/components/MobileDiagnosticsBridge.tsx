import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useNetworkStatus } from '../context/NetworkContext';
import { updateMobileDiagnostics } from '../services/mobileDiagnostics';

export function MobileDiagnosticsBridge() {
  const pathname = usePathname();
  const network = useNetworkStatus();

  useEffect(() => {
    updateMobileDiagnostics({ route: pathname || '/' });
  }, [pathname]);

  useEffect(() => {
    const reachability = network.internetReachable === false ? 'unreachable' : 'reachable';
    updateMobileDiagnostics({
      networkState: network.online
        ? `online:${network.connectionType}:${reachability}`
        : `offline:${network.connectionType}`,
    });
  }, [network.connectionType, network.internetReachable, network.online]);

  return null;
}

