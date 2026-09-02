import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../context/NetworkContext";
import { useOrionTheme } from "../context/ThemeContext";
import { getMobileConnectionPresentation } from "./mobileConnectionPresentationPolicy";

export type OfflineIndicatorState = "hidden" | "expanded" | "compact";

export function OfflineBanner() {
  const network = useNetworkStatus();
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const presentation = getMobileConnectionPresentation(network.productState);
  const [state, setState] = useState<OfflineIndicatorState>(presentation.banner ? "expanded" : "hidden");

  useEffect(() => {
    if (!presentation.banner) {
      setState("hidden");
      return;
    }
    setState("expanded");
    const timer = setTimeout(() => setState("compact"), 4000);
    return () => clearTimeout(timer);
  }, [network.productState, presentation.banner]);

  if (!presentation.banner || state === "hidden") return null;
  const localMessage = "Local and downloaded content remain available.";
  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 8 }]}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`${presentation.banner.expanded}. ${localMessage}`}
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          state === "compact" && styles.compact,
          { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.background },
        ]}
      >
        <Ionicons name={presentation.banner.icon} size={16} color={theme[presentation.tone]} />
        <View style={styles.copy}>
          <Text style={[styles.text, { color: theme.text }]}>
            {state === "compact" ? presentation.banner.compact : presentation.banner.expanded}
          </Text>
          {state === "expanded" && (
            <Text style={[styles.supportingText, { color: theme.textSecondary }]}>{localMessage}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 72, right: 16, zIndex: 10000, alignItems: "flex-end" },
  banner: {
    minHeight: 40,
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 10,
  },
  compact: { paddingHorizontal: 12 },
  copy: { flexShrink: 1, minWidth: 0 },
  text: { fontSize: 12, fontWeight: "800" },
  supportingText: { fontSize: 12, marginTop: 3 },
});
