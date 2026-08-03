import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../context/NetworkContext";
import { useOrionTheme } from "../context/ThemeContext";

export type OfflineIndicatorState = "hidden" | "expanded" | "compact";

export function OfflineBanner() {
  const network = useNetworkStatus();
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const offline = !network.online || network.internetReachable === false;
  const [state, setState] = useState<OfflineIndicatorState>(offline ? "expanded" : "hidden");

  useEffect(() => {
    if (!offline) {
      setState("hidden");
      return;
    }
    setState("expanded");
    const timer = setTimeout(() => setState("compact"), 4000);
    return () => clearTimeout(timer);
  }, [offline, network.connectionType]);

  if (state === "hidden") return null;
  const onWarning = theme.dark ? theme.background : theme.text;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 8 }]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          state === "compact" && styles.compact,
          { backgroundColor: theme.warning, borderColor: theme.border },
        ]}
      >
        <Ionicons name="cloud-offline-outline" size={16} color={onWarning} />
        <Text numberOfLines={1} style={[styles.text, { color: onWarning }]}>
          {state === "compact" ? "Offline" : "Offline — cached library data remains available"}
        </Text>
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
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 10,
  },
  compact: { paddingHorizontal: 12 },
  text: { fontSize: 12, fontWeight: "800" },
});
