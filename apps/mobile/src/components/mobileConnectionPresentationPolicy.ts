import type { NetworkProductState } from "../context/networkStatePolicy";

interface ConnectionPresentation {
  footer: string;
  tone: "success" | "textMuted" | "warning" | "accent";
  localDownloads: boolean;
  banner: {
    expanded: string;
    compact: string;
    icon: "cloud-offline-outline" | "warning-outline" | "refresh-outline";
  } | null;
}

// Presentation only: NetworkContext remains the authority for connection state.
const PRESENTATION: Record<NetworkProductState, ConnectionPresentation> = {
  online: {
    footer: "Online",
    tone: "success",
    localDownloads: false,
    banner: null,
  },
  checking: {
    footer: "Checking connection",
    tone: "textMuted",
    localDownloads: false,
    banner: null,
  },
  degraded: {
    footer: "Service unavailable",
    tone: "warning",
    localDownloads: true,
    banner: { expanded: "Service unavailable", compact: "Service unavailable", icon: "warning-outline" },
  },
  offline: {
    footer: "Offline mode",
    tone: "warning",
    localDownloads: true,
    banner: { expanded: "You're offline", compact: "Offline", icon: "cloud-offline-outline" },
  },
  reconnecting: {
    footer: "Trying to reconnect",
    tone: "accent",
    localDownloads: true,
    banner: { expanded: "Trying to reconnect", compact: "Reconnecting", icon: "refresh-outline" },
  },
};

export function getMobileConnectionPresentation(state: NetworkProductState): ConnectionPresentation {
  return PRESENTATION[state];
}
