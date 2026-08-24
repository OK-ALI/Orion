import { forwardRef, useEffect, useMemo, useRef } from "react";
import { DeviceEventEmitter, Platform, requireNativeComponent } from "react-native";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType, WebViewProps } from "react-native-webview";
import type { ProviderRequestManifestV1 } from "@orion/shared/sources";

const NativeCinemaWebView = Platform.OS === "android"
  ? requireNativeComponent("OrionCinemaWebView")
  : null;

export interface OrionCinemaWebViewProps extends WebViewProps {
  shieldManifest: ProviderRequestManifestV1;
  shieldSessionId: string;
  downloadCaptureEnabled?: boolean;
  downloadProviderClass?: string | null;
  onNativeShieldEvidence?(payload: string): void;
  onNativeSingleTap?(): void;
}

/**
 * Uses the stock WebView implementation everywhere except Android Cinema
 * playback. The custom manager is deliberately opt-in through nativeConfig.
 */
export const OrionCinemaWebView = forwardRef<WebViewType, OrionCinemaWebViewProps>(
  ({
    shieldManifest,
    shieldSessionId,
    downloadCaptureEnabled = false,
    downloadProviderClass = null,
    onNativeShieldEvidence,
    onNativeSingleTap,
    ...props
  }, ref) => {
    const lastSingleTapSequence = useRef(0);
    const serializedManifest = useMemo(() => JSON.stringify({
      ...shieldManifest,
      sessionId: shieldSessionId,
      downloadCaptureEnabled,
      providerClass: downloadProviderClass,
    }), [downloadCaptureEnabled, downloadProviderClass, shieldManifest, shieldSessionId]);
    const nativeConfig = useMemo(() => NativeCinemaWebView
      ? {
        component: NativeCinemaWebView as never,
        props: { orionShieldSession: serializedManifest },
      }
      : undefined, [serializedManifest]);

    useEffect(() => {
      if (Platform.OS !== "android" || !onNativeShieldEvidence) return undefined;
      const subscription = DeviceEventEmitter.addListener("OrionShieldEvidence", (raw) => {
        if (typeof raw !== "string") return;
        try {
          const envelope = JSON.parse(raw);
          if (envelope.sessionId !== shieldSessionId || envelope.sourceId !== shieldManifest.sourceId) return;
          onNativeShieldEvidence(raw);
        } catch {}
      });
      return () => subscription.remove();
    }, [onNativeShieldEvidence, shieldManifest.sourceId, shieldSessionId]);

    useEffect(() => {
      if (Platform.OS !== "android" || !onNativeSingleTap) return undefined;
      lastSingleTapSequence.current = 0;
      const subscription = DeviceEventEmitter.addListener("OrionPlayerSingleTap", (raw) => {
        if (typeof raw !== "string") return;
        try {
          const envelope = JSON.parse(raw);
          if (envelope.sessionId !== shieldSessionId || envelope.sourceId !== shieldManifest.sourceId) return;
          const sequence = Number(envelope.sequence);
          if (!Number.isFinite(sequence) || sequence <= lastSingleTapSequence.current) return;
          lastSingleTapSequence.current = sequence;
          onNativeSingleTap();
        } catch {}
      });
      return () => subscription.remove();
    }, [onNativeSingleTap, shieldManifest.sourceId, shieldSessionId]);

    return (
      <WebView
        {...props}
        ref={ref}
        nativeConfig={nativeConfig}
      />
    );
  },
);

OrionCinemaWebView.displayName = "OrionCinemaWebView";
