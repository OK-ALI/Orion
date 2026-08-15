import React from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrionThemeId } from "@orion/shared/types";
import { fontSizes, radii, spacing } from "@orion/shared/tokens";
import { ORION_MOBILE_THEMES, useOrionTheme } from "../../src/context/ThemeContext";
import { usePerformanceProfile } from "../../src/context/PerformanceContext";
import { MobilePageHeader } from "../../src/components/MobilePageHeader";
import { useResponsiveLayout } from "../../src/services/responsive";
import {
  MOBILE_ACTIVE_SETTINGS_SECTIONS,
  MOBILE_SETTINGS_SECTION_BY_ID,
  type MobileSettingsSectionId,
} from "../../src/features/settings/settingsArchitecture";
import { SettingsSectionNavigator } from "../../src/features/settings/SettingsSectionNavigator";
import {
  PERFORMANCE_PROFILE_LABELS,
  PERFORMANCE_PROFILE_OPTIONS,
  type PerformanceProfileSelection,
} from "../../src/services/performanceProfiles";

const THEME_LABELS: Record<OrionThemeId, string> = {
  "midnight-premiere": "Midnight Premiere",
  amoled: "AMOLED",
  mocha: "Mocha",
  slate: "Slate",
  "projector-silver": "Projector Silver",
  custom: "Custom",
};

const THEME_DESCRIPTIONS: Record<OrionThemeId, string> = {
  "midnight-premiere": "Orion's cinematic dark signature.",
  amoled: "Pure black tuned for OLED displays.",
  mocha: "Warm cinema tones with softer contrast.",
  slate: "Cool blue-gray tones for a calmer screen.",
  "projector-silver": "A bright projector-inspired light theme.",
  custom: "Your accent on Orion's dark canvas.",
};

interface SettingsSectionProps {
  sectionId: MobileSettingsSectionId;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useOrionTheme>["theme"];
  onLayout: (event: LayoutChangeEvent) => void;
}

function SettingsSection({ sectionId, icon, title, description, children, theme, onLayout }: SettingsSectionProps) {
  return (
    <View
      nativeID={`settings-section-${sectionId}`}
      onLayout={onLayout}
      style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
          <Ionicons name={icon} size={20} color={theme.accent} />
        </View>
        <View style={styles.sectionHeadingCopy}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>{description}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export default function MobileSettingsScreen() {
  const { theme, preferences, setTheme, setReducedMotion, setFollowSystem, setCustomAccent } = useOrionTheme();
  const { selection, resolvedProfile, setSelection } = usePerformanceProfile();
  const { isTablet } = useResponsiveLayout();
  const appearance = MOBILE_SETTINGS_SECTION_BY_ID.appearance;
  const performance = MOBILE_SETTINGS_SECTION_BY_ID.performance;
  const accessibility = MOBILE_SETTINGS_SECTION_BY_ID.accessibility;
  const scrollRef = React.useRef<ScrollView>(null);
  const sectionOffsets = React.useRef<Partial<Record<MobileSettingsSectionId, number>>>({});
  const [currentSectionId, setCurrentSectionId] = React.useState<MobileSettingsSectionId>('appearance');

  const recordSectionLayout = React.useCallback((sectionId: MobileSettingsSectionId) => (event: LayoutChangeEvent) => {
    sectionOffsets.current[sectionId] = event.nativeEvent.layout.y;
  }, []);

  const jumpToSection = React.useCallback((sectionId: MobileSettingsSectionId) => {
    const y = sectionOffsets.current[sectionId];
    if (typeof y !== 'number') return;
    setCurrentSectionId(sectionId);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing[2]), animated: !preferences.reducedMotion });
  }, [preferences.reducedMotion]);

  const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + 28;
    let nextId = MOBILE_ACTIVE_SETTINGS_SECTIONS[0]?.id || 'appearance';
    for (const section of MOBILE_ACTIVE_SETTINGS_SECTIONS) {
      const offset = sectionOffsets.current[section.id];
      if (typeof offset === 'number' && offset <= y) nextId = section.id;
    }
    setCurrentSectionId((current) => current === nextId ? current : nextId);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MobilePageHeader
        eyebrow="ORION MOBILE"
        title="Settings"
        subtitle="Customize Orion Mobile on this device."
      />

      <SettingsSectionNavigator
        sections={MOBILE_ACTIVE_SETTINGS_SECTIONS}
        currentSectionId={currentSectionId}
        onSelect={jumpToSection}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <SettingsSection
          sectionId="appearance"
          icon="color-palette-outline"
          title={appearance.label}
          description="Themes and system appearance."
          theme={theme}
          onLayout={recordSectionLayout('appearance')}
        >
          <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Theme</Text>
          <View style={styles.themeGrid}>
            {(Object.keys(ORION_MOBILE_THEMES) as OrionThemeId[]).map((id) => {
              const preview = ORION_MOBILE_THEMES[id];
              const selected = preferences.theme === id;
              const previewAccent = id === "custom" && preferences.customAccent
                ? preferences.customAccent
                : preview.accent;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={`${THEME_LABELS[id]} theme`}
                  accessibilityHint={THEME_DESCRIPTIONS[id]}
                  accessibilityState={{ checked: selected }}
                  key={id}
                  onPress={() => setTheme(id)}
                  style={[
                    styles.themeButton,
                    { backgroundColor: preview.background, borderColor: selected ? theme.accent : preview.border },
                  ]}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: previewAccent }]} />
                  <View style={styles.themeCopy}>
                    <Text style={[styles.themeLabel, { color: preview.text }]}>{THEME_LABELS[id]}</Text>
                    <Text numberOfLines={2} style={[styles.themeDescription, { color: preview.textSecondary }]}>
                      {THEME_DESCRIPTIONS[id]}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
                </Pressable>
              );
            })}
          </View>

          {preferences.theme === "custom" && (
            <View style={[styles.customAccentRow, { borderTopColor: theme.border }]}>
              <View style={styles.settingCopy}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Custom accent</Text>
                <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>Use a six-digit hexadecimal accent color.</Text>
              </View>
              <TextInput
                accessibilityLabel="Custom accent hexadecimal color"
                accessibilityHint="Enter a six-digit hexadecimal color such as number sign E50914"
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

          <View style={[styles.settingRow, styles.settingTopDivider, { borderTopColor: theme.border }]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Follow system appearance</Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>Use Projector Silver in light mode and Midnight Premiere in dark mode.</Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel="Follow system appearance"
              accessibilityHint="Uses Orion's light or dark theme to match the device appearance"
              accessibilityState={{ checked: preferences.followSystem }}
              value={preferences.followSystem}
              onValueChange={setFollowSystem}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={preferences.followSystem ? theme.accent : theme.textMuted}
            />
          </View>
        </SettingsSection>

        <SettingsSection
          sectionId="performance"
          icon="speedometer-outline"
          title={performance.label}
          description="Choose how much browsing work Orion keeps ready."
          theme={theme}
          onLayout={recordSectionLayout('performance')}
        >
          <View style={[styles.performanceSummary, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
            <View style={styles.performanceSummaryCopy}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Active profile</Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                {selection === 'automatic'
                  ? `Automatic selected ${PERFORMANCE_PROFILE_LABELS[resolvedProfile]} for this device.`
                  : `${PERFORMANCE_PROFILE_LABELS[resolvedProfile]} is selected manually.`}
              </Text>
            </View>
            <View style={[styles.profileBadge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
              <Text style={[styles.profileBadgeText, { color: theme.accent }]}>{PERFORMANCE_PROFILE_LABELS[resolvedProfile]}</Text>
            </View>
          </View>

          <View style={styles.profileGrid}>
            {PERFORMANCE_PROFILE_OPTIONS.map((option) => {
              const selected = selection === option.id;
              const optionLabel = option.id === 'automatic' ? 'Automatic (Recommended)' : option.label;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${optionLabel} performance profile`}
                  accessibilityHint={option.description}
                  accessibilityState={{ checked: selected }}
                  onPress={() => setSelection(option.id as PerformanceProfileSelection)}
                  style={({ pressed }) => [
                    styles.profileOption,
                    {
                      backgroundColor: selected ? theme.accentSoft : theme.elevated,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                    pressed && { backgroundColor: theme.surfaceHover },
                  ]}
                >
                  <View style={styles.profileOptionHeading}>
                    <Text style={[styles.profileOptionTitle, { color: theme.text }]}>{optionLabel}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                  </View>
                  <Text style={[styles.profileOptionDescription, { color: theme.textSecondary }]}>{option.description}</Text>
                  {option.id === 'automatic' && (
                    <Text style={[styles.profileResolvedText, { color: theme.accent }]}>Currently: {PERFORMANCE_PROFILE_LABELS[resolvedProfile]}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.performanceNote, { color: theme.textMuted }]}>
            Profiles currently tune browsing render budgets. Catalog content, artwork sources and playback behavior stay unchanged.
          </Text>
        </SettingsSection>

        <SettingsSection
          sectionId="accessibility"
          icon="accessibility-outline"
          title={accessibility.label}
          description="Motion and interaction comfort."
          theme={theme}
          onLayout={recordSectionLayout('accessibility')}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Reduced motion</Text>
              <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>Reduce decorative transitions while retaining clear state changes.</Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel="Reduced motion"
              accessibilityHint="Reduces decorative transitions while preserving state changes"
              accessibilityState={{ checked: preferences.reducedMotion }}
              value={preferences.reducedMotion}
              onValueChange={setReducedMotion}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={preferences.reducedMotion ? theme.accent : theme.textMuted}
            />
          </View>
        </SettingsSection>

        <View style={[styles.notice, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <Ionicons name="layers-outline" size={20} color={theme.textMuted} />
          <Text style={[styles.noticeText, { color: theme.textSecondary }]}>Additional settings stay hidden until their Mobile features are ready.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing[2], paddingHorizontal: spacing[5], paddingBottom: 80 },
  contentTablet: { maxWidth: 900, width: "100%", alignSelf: "center" },
  section: { borderRadius: radii["2xl"], borderWidth: 1, padding: spacing[5], marginBottom: spacing[4] },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing[3], marginBottom: spacing[5] },
  sectionIcon: { width: 44, height: 44, borderRadius: radii.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sectionHeadingCopy: { flex: 1 },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: "900" },
  sectionDescription: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 2 },
  groupTitle: { fontSize: fontSizes.md, fontWeight: "900", marginBottom: spacing[4] },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  themeButton: { minHeight: 76, minWidth: 150, flexGrow: 1, flexBasis: 180, borderWidth: 2, borderRadius: radii.xl, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  themeSwatch: { width: 18, height: 18, borderRadius: 9 },
  themeCopy: { flex: 1, minWidth: 0 },
  themeLabel: { fontSize: fontSizes.sm, fontWeight: "800" },
  themeDescription: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  settingRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing[4] },
  settingTopDivider: { borderTopWidth: 1, paddingTop: spacing[4], marginTop: spacing[4] },
  settingCopy: { flex: 1 },
  settingTitle: { fontSize: fontSizes.md, fontWeight: "800" },
  settingDescription: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  customAccentRow: { marginTop: spacing[4], paddingTop: spacing[4], borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: spacing[4] },
  colorInput: { width: 116, minHeight: 48, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 14, fontWeight: "800" },
  performanceSummary: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  performanceSummaryCopy: { flex: 1 },
  profileBadge: { minHeight: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  profileBadgeText: { fontSize: fontSizes.xs, fontWeight: '900' },
  profileGrid: { gap: spacing[3] },
  profileOption: { minHeight: 78, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: 14, paddingVertical: 12 },
  profileOptionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  profileOptionTitle: { flex: 1, fontSize: fontSizes.sm, fontWeight: '900' },
  profileOptionDescription: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  profileResolvedText: { fontSize: fontSizes.xs, fontWeight: '800', marginTop: 7 },
  performanceNote: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: spacing[4] },
  notice: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], flexDirection: "row", alignItems: "flex-start", gap: spacing[3] },
  noticeText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 19 },
});
