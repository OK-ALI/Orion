import React from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, Switch, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrionThemeId } from "@orion/shared/types";
import { fontSizes, radii, spacing } from "@orion/shared/tokens";
import { ORION_MOBILE_THEMES, useOrionTheme } from "../../src/context/ThemeContext";
import { useResponsiveLayout } from "../../src/services/responsive";
import { MobilePageHeader } from "../../src/components/MobilePageHeader";

const THEME_LABELS: Record<OrionThemeId, string> = {
  "midnight-premiere": "Midnight Premiere",
  amoled: "AMOLED",
  mocha: "Mocha",
  slate: "Slate",
  "projector-silver": "Projector Silver",
  custom: "Custom",
};

export default function MobileSettingsScreen() {
  const { theme, preferences, setTheme, setReducedMotion, setFollowSystem, setCustomAccent } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MobilePageHeader eyebrow="ORION MOBILE" title="Settings" subtitle="Appearance and accessibility changes apply immediately on this device." />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
      >

      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Theme</Text>
        <View style={styles.themeGrid}>
          {(Object.keys(ORION_MOBILE_THEMES) as OrionThemeId[]).map((id) => {
            const preview = ORION_MOBILE_THEMES[id];
            const selected = preferences.theme === id;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={id}
                onPress={() => setTheme(id)}
                style={[
                  styles.themeButton,
                  { backgroundColor: preview.background, borderColor: selected ? theme.accent : preview.border },
                ]}
              >
                <View style={[styles.themeSwatch, { backgroundColor: preview.accent }]} />
                <Text style={[styles.themeLabel, { color: preview.text }]}>{THEME_LABELS[id]}</Text>
                {selected && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
              </Pressable>
            );
          })}
        </View>
        {preferences.theme === "custom" && (
          <View style={styles.customAccentRow}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Custom accent</Text>
            <TextInput
              accessibilityLabel="Custom accent hexadecimal color"
              autoCapitalize="characters"
              maxLength={7}
              defaultValue={preferences.customAccent || "#E50914"}
              placeholder="#E50914"
              placeholderTextColor={theme.textMuted}
              onEndEditing={(event) => setCustomAccent(event.nativeEvent.text.trim())}
              style={[styles.colorInput, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]}
            />
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.settingRow, styles.settingDivider, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Follow system appearance</Text>
            <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
              Start in Projector Silver for light mode and Midnight Premiere for dark mode.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Follow system appearance"
            value={preferences.followSystem}
            onValueChange={setFollowSystem}
            trackColor={{ false: theme.border, true: theme.accentSoft }}
            thumbColor={preferences.followSystem ? theme.accent : theme.textMuted}
          />
        </View>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Reduced motion</Text>
            <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
              Reduce decorative transitions while retaining clear state changes.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Reduced motion"
            value={preferences.reducedMotion}
            onValueChange={setReducedMotion}
            trackColor={{ false: theme.border, true: theme.accentSoft }}
            thumbColor={preferences.reducedMotion ? theme.accent : theme.textMuted}
          />
        </View>
      </View>

      <View style={[styles.notice, { borderColor: theme.border }]}>
        <Ionicons name="cloud-outline" size={20} color={theme.textMuted} />
        <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
          Google sign-in and cross-device sync are intentionally scheduled for the next mobile milestone.
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing[2], paddingHorizontal: spacing[5], paddingBottom: 80 },
  contentTablet: { maxWidth: 900, width: "100%", alignSelf: "center" },
  section: { borderRadius: radii["2xl"], borderWidth: 1, padding: spacing[5], marginBottom: spacing[4] },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: "900", marginBottom: spacing[4] },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  themeButton: { minHeight: 64, minWidth: 150, flexGrow: 1, flexBasis: 180, borderWidth: 2, borderRadius: radii.xl, paddingHorizontal: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  themeSwatch: { width: 18, height: 18, borderRadius: 9 },
  themeLabel: { flex: 1, fontSize: fontSizes.sm, fontWeight: "800" },
  settingRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing[4] },
  settingDivider: { borderBottomWidth: 1, paddingBottom: spacing[4], marginBottom: spacing[4] },
  settingTitle: { fontSize: fontSizes.md, fontWeight: "800" },
  settingDescription: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  notice: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], flexDirection: "row", gap: spacing[3] },
  noticeText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 19 },
  customAccentRow: { marginTop: spacing[4], flexDirection: "row", alignItems: "center", gap: spacing[4] },
  colorInput: { marginLeft: "auto", width: 116, minHeight: 48, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 14, fontWeight: "800" },
});
