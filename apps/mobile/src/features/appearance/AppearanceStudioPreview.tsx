import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontSizes, radii, spacing } from "@orion/shared/tokens";
import type { MobileThemeTokens } from "../../context/ThemeContext";
import { studioAccentForeground, studioReadableForeground } from "./appearanceStudioContrast";
import { THEME_NAMES } from "./appearanceStudioDraft";

export function AppearanceStudioPreview({ theme, editorTheme }: { theme: MobileThemeTokens; editorTheme: MobileThemeTokens }) {
  const title = THEME_NAMES[theme.id];
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={"Preview, " + title + ", " + (theme.dark ? "dark" : "light") + " appearance"}
        style={[styles.heading, { color: studioAccentForeground(editorTheme, editorTheme.background) }]}
      >{title}</Text>
      <View
        testID="studio-preview"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.sample, { backgroundColor: theme.background, borderColor: theme.border }]}
      >
        <View style={[styles.brand, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <Text style={[styles.mark, { color: theme.text }]}>ORION</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.heading, { color: theme.text }]}>Your next watch</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Saved for later</Text>
          <View style={styles.actions}>
            <View testID="studio-preview-play" style={[styles.pill, { backgroundColor: theme.accent }]}>
              <Text style={[styles.label, { color: studioReadableForeground(theme.accent, theme.onAccent) }]}>Play</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 1 }]}>
              <Ionicons name="checkmark" size={15} color={theme.text} />
              <Text style={[styles.label, { color: theme.text }]}>My List</Text>
            </View>
          </View>
        </View>
        <View style={[styles.warning, { backgroundColor: theme.elevated, borderColor: theme.warning }]}>
          <Ionicons name="warning-outline" size={18} color={theme.warning} />
          <Text style={[styles.detail, styles.warningLabel, { color: theme.text }]}>Offline · Some options are limited</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { minWidth: 0, gap: spacing[2] },
  heading: { fontSize: fontSizes.md, fontWeight: "800" },
  label: { fontSize: fontSizes.sm, fontWeight: "700", flexShrink: 1 },
  detail: { fontSize: fontSizes.xs },
  mark: { fontSize: fontSizes.sm, fontWeight: "900", letterSpacing: 2 },
  sample: { padding: spacing[2], borderWidth: 1, borderRadius: radii.xl, gap: spacing[2] },
  brand: { borderWidth: 1, borderRadius: radii.md, padding: spacing[2], gap: spacing[1] },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[2], gap: spacing[2] },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  pill: { flexDirection: "row", alignItems: "center", maxWidth: "100%", gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radii.md },
  warning: { borderWidth: 1, borderRadius: radii.md, padding: spacing[2],
    flexDirection: "row", alignItems: "center", gap: spacing[2] },
  warningLabel: { flex: 1, minWidth: 0 },
});
