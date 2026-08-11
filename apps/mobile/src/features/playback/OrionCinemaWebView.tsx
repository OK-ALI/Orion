import { forwardRef } from "react";
import { Platform, requireNativeComponent } from "react-native";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType, WebViewProps } from "react-native-webview";
import type { ProviderRequestManifestV1 } from "@orion/shared/sources";

const NativeCinemaWebView = Platform.OS === "android"
  ? requireNativeComponent("OrionCinemaWebView")
  : null;

export interface OrionCinemaWebViewProps extends WebViewProps {
  shieldManifest: ProviderRequestManifestV1;
}

/**
 * Uses the stock WebView implementation everywhere except Android Cinema
 * playback. The custom manager is deliberately opt-in through nativeConfig.
 */
export const OrionCinemaWebView = forwardRef<WebViewType, OrionCinemaWebViewProps>(
  ({ shieldManifest, ...props }, ref) => (
    <WebView
      {...props}
      ref={ref}
      nativeConfig={NativeCinemaWebView
        ? {
          component: NativeCinemaWebView as never,
          props: { orionShieldSession: JSON.stringify(shieldManifest) },
        }
        : undefined}
    />
  ),
);

OrionCinemaWebView.displayName = "OrionCinemaWebView";
