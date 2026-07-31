import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkStatus } from "../context/NetworkContext";
import { useOrionTheme } from "../context/ThemeContext";

export function OfflineBanner() {
  const network = useNetworkStatus();
  const { theme } = useOrionTheme();
  if (network.online && network.internetReachable !== false) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: theme.warning }]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={theme.background} />
      <Text style={[styles.text, { color: theme.background }]}>
        Offline — cached library data remains available
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 34,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 10000,
  },
  text: { fontSize: 12, fontWeight: "800" },
});
