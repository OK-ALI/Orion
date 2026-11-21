import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, useWindowDimensions, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontSizes, spacing } from "@orion/shared/tokens";
import { resolveAppliedAppearancePalette, resolveCustomProfile, useOrionTheme } from "../../context/ThemeContext";
import { usePerformanceProfile } from "../../context/PerformanceContext";
import { resolveMotionPolicy } from "../../services/motionPolicy";
import { AppearanceStudioAccentSheet, type AccentSheetHandle } from "./AppearanceStudioAccentSheet";
import { focusStudioNode, StudioAction, StudioCard, StudioHeading, studioTextStyles } from "./AppearanceStudioControls";
import { AppearanceStudioPreview } from "./AppearanceStudioPreview";
import { AppearanceStudioPaletteFields } from "./AppearanceStudioPaletteFields";
import type { AdvancedAppearanceChoices, AppearanceScheme } from "./appearancePreferences";
import { studioAccentForeground, studioReadableForeground } from "./appearanceStudioContrast";
import type { CustomPaletteProfile, CustomPaletteRole } from "./customAppearancePalette";
import {
  getStudioDraftPlan, getStudioLayout, getStudioPreviewTheme, readStudioColor, resetStudioSelection,
  restoreStudioPalette, selectStudioTheme, studioBackAction, STUDIO_THEME_CHOICES, THEME_NAMES, THEME_DETAILS,
  withStudioColor, type StudioColorTarget, type StudioThemeGroup,
} from "./appearanceStudioDraft";

const themeGroupNames = { light: "Light theme", dark: "Dark theme", fixed: "Fixed theme" };
const themeChoiceKeys = { light: "lightTheme", dark: "darkTheme", fixed: "manualTheme" } as const;
const systemGroups = ["light", "dark"] as const;
const fixedGroups = ["fixed"] as const;
const validateProfile = (choices: AdvancedAppearanceChoices, profile: CustomPaletteProfile) =>
  resolveCustomProfile(choices, profile).issues;

export default function AppearanceStudioDialog({ onClose }: { onClose: () => void }) {
  const {
    theme, preferences, systemReducedMotion, advancedAppearanceChoices, appearanceSaveBlock, systemScheme,
    applyAdvancedAppearanceChoices,
  } = useOrionTheme();
  const { resolvedProfile } = usePerformanceProfile();
  const motion = resolveMotionPolicy(preferences.reducedMotion, systemReducedMotion);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [opening] = useState(advancedAppearanceChoices);
  const [draft, setDraft] = useState(opening);
  const [expanded, setExpanded] = useState<StudioThemeGroup | null>(null);
  const [profile, setProfile] = useState<CustomPaletteProfile>(systemScheme);
  const [pickerTarget, setPickerTarget] = useState<StudioColorTarget | null>(null);
  const [previewScheme, setPreviewScheme] = useState<AppearanceScheme>(systemScheme);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const applying = useRef(false);
  const heading = useRef<Text>(null);
  const confirmationHeading = useRef<Text>(null);
  const closeButton = useRef<View>(null);
  const cancelButton = useRef<View>(null);
  const roleNodes = useRef<Partial<Record<CustomPaletteRole, View | null>>>({});
  const returnRole = useRef<CustomPaletteRole | null>(null);
  const picker = useRef<AccentSheetHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const editorOffset = useRef(0);
  const returnFocus = useRef<"header" | "close" | "cancel" | "color" | null>(null);

  const width = Math.max(0, Math.min(window.width, measured?.width ?? window.width) - insets.left - insets.right);
  const height = Math.max(0, Math.min(window.height, measured?.height ?? window.height) - insets.top - insets.bottom);
  const { sideBySide, stackedActions } = getStudioLayout(width, height, window.fontScale, false);
  const pickerOpen = pickerTarget !== null;
  const { dirty, choices, error: draftError } = useMemo(() => getStudioDraftPlan(opening, draft, validateProfile), [opening, draft]);
  const previewId = getStudioPreviewTheme(choices, previewScheme);
  const previewTheme = useMemo(() => resolveAppliedAppearancePalette(previewId, choices), [previewId, choices]);
  const palette = useMemo(() => resolveCustomProfile(choices, profile), [choices, profile]);
  const followSystem = choices.followSystem;

  useEffect(() => {
    if (pickerOpen) return;
    if (!confirming && !returnFocus.current) return;
    const frame = requestAnimationFrame(() => {
      if (confirming) focusStudioNode(confirmationHeading.current);
      else {
        const target = returnFocus.current;
        returnFocus.current = null;
        if (target !== "color") scroll.current?.scrollTo({ y: editorOffset.current, animated: false });
        const role = returnRole.current;
        returnRole.current = null;
        focusStudioNode(target === "color" && role ? roleNodes.current[role] ?? null : target === "close" ? closeButton.current
          : target === "cancel" ? cancelButton.current : heading.current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [confirming, pickerOpen]);

  function edit(update: (current: typeof draft) => typeof draft) {
    setDraft(update);
    setSaveError(null);
    setStatus(null);
  }

  function requestClose(target: "header" | "close" | "cancel") {
    if (!dirty) {
      onClose();
      return;
    }
    returnFocus.current = target;
    setConfirming(true);
  }

  function back() {
    if (pickerOpen) {
      picker.current?.back();
      return;
    }
    switch (studioBackAction(false, confirming, dirty)) {
      case "keep-editing": setConfirming(false); break;
      case "confirm-discard": requestClose("header"); break;
      case "close": onClose(); break;
    }
  }

  function apply() {
    if (applying.current || appearanceSaveBlock || draftError || !dirty) return;
    applying.current = true;
    const result = applyAdvancedAppearanceChoices(opening, draft);
    if (result.ok) onClose();
    else {
      applying.current = false;
      setSaveError(result.message);
    }
  }

  function closePicker() {
    returnFocus.current = "color";
    returnRole.current = pickerTarget?.role ?? null;
    setPickerTarget(null);
  }

  function renderThemeGroup(group: StudioThemeGroup) {
    const selected = choices[themeChoiceKeys[group]];
    const open = expanded === group;
    return (
      <React.Fragment key={group}>
        <StudioCard compact label={themeGroupNames[group]} value={THEME_NAMES[selected]}
          swatch={resolveAppliedAppearancePalette(selected, advancedAppearanceChoices).accent} theme={theme}
          expanded={open} onPress={() => setExpanded(open ? null : group)} />
        {open && (
          <>
            <View style={[styles.cards, sideBySide && styles.row]}>
              {STUDIO_THEME_CHOICES[group].map(id => {
                const cardPalette = resolveAppliedAppearancePalette(id, advancedAppearanceChoices);
                return <View key={id} style={sideBySide && styles.themeColumn}>
                  <StudioCard label={THEME_NAMES[id] + " theme"} detail={THEME_DETAILS[id]} theme={theme}
                    palette={cardPalette} swatch={cardPalette.accent} checked={id === selected}
                    onPress={() => edit(current => selectStudioTheme(current, group, id))} />
                </View>;
              })}
            </View>
            <StudioAction label={group === "fixed" ? "Restore opening theme" : `Reset ${themeGroupNames[group]}`}
              theme={theme} onPress={() => {
                edit(current => resetStudioSelection(current, opening, group));
                setStatus("Theme selection restored in preview.");
              }} />
          </>
        )}
      </React.Fragment>
    );
  }
  return (
    <Modal visible animationType={motion.reduceMotion || resolvedProfile === "efficiency" ? "none" : "fade"}
      onRequestClose={back} onShow={() => focusStudioNode(heading.current)} statusBarTranslucent navigationBarTranslucent>
      <View testID="studio-modal" accessibilityViewIsModal onAccessibilityEscape={back}
        onLayout={({ nativeEvent: { layout } }) => setMeasured(previous =>
          previous?.width === layout.width && previous?.height === layout.height
            ? previous : { width: layout.width, height: layout.height })}
        style={[styles.window, {
          backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom,
          paddingLeft: insets.left, paddingRight: insets.right,
        }]}>
        <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
        <View style={styles.window}>
          <ScrollView ref={scroll} testID="studio-scroll" scrollEventThrottle={32}
            onScroll={event => { if (!confirming && !pickerOpen) editorOffset.current = event.nativeEvent.contentOffset.y; }} style={[styles.window, { pointerEvents: pickerOpen ? "none" : "auto" }]} contentContainerStyle={styles.content}
            accessibilityElementsHidden={pickerOpen}
            importantForAccessibility={pickerOpen ? "no-hide-descendants" : "auto"}>
            {confirming ? (
              <View testID="studio-discard" style={styles.group}>
                <StudioHeading dialogTitle title="Discard changes?" headingRef={confirmationHeading} theme={theme} />
                <Text style={{ color: theme.textSecondary }}>Your preview changes won’t be saved.</Text>
                <View style={stackedActions ? styles.group : styles.row}>
                  <StudioAction label="Keep editing" theme={theme} fluid={!stackedActions} onPress={() => setConfirming(false)} />
                  <StudioAction label="Discard changes" theme={theme} fluid={!stackedActions} onPress={onClose} />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <StudioHeading dialogTitle title="Appearance Studio" headingRef={heading} theme={theme} />
                  <StudioAction label="Close" icon="close" actionRef={closeButton} theme={theme} onPress={() => requestClose("close")} />
                </View>
                <View style={[styles.group, sideBySide && styles.paneRow]}>
                  <View style={[styles.group, sideBySide && styles.pane]}>
                    <StudioHeading title="Theme" theme={theme} />
                    <View style={styles.switchRow}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>Follow system appearance</Text>
                      <Switch accessibilityRole="switch" accessibilityLabel="Follow system appearance"
                        accessibilityState={{ checked: followSystem }} value={followSystem}
                        onValueChange={value => {
                          setExpanded(null);
                          edit(current => ({ ...current, followSystem: value }));
                        }}
                        trackColor={{ false: theme.border, true: theme.accentSoft }}
                        thumbColor={followSystem ? studioAccentForeground(theme, theme.background, 3)
                          : studioReadableForeground(theme.background, theme.textMuted, 3)}
                        style={styles.switch} />
                    </View>
                    {(followSystem ? systemGroups : fixedGroups).map(renderThemeGroup)}
                    <AppearanceStudioPaletteFields profile={profile} resolution={palette} theme={theme} stacked={stackedActions}
                      canReset={Object.values(palette.roles).some(role => role.requestedColor !== null)
                        || (profile === "dark" && choices.custom.dark.rendering !== "legacy")}
                      onProfile={setProfile} onEdit={role => setPickerTarget({ profile, role })}
                      onResetRole={role => edit(current => withStudioColor(current, { profile, role }, null))}
                      onResetPalette={() => edit(current => restoreStudioPalette(current, profile))}
                      roleRef={(role, node) => { roleNodes.current[role] = node; }} />
                  </View>
                  <View style={[styles.group, sideBySide && styles.pane]}>
                    <StudioHeading title="Preview" theme={theme} />
                    <View style={stackedActions && window.fontScale > 1.3 ? styles.group : styles.row}>
                      {(["light", "dark"] as const).map(scheme => (
                        <View key={scheme} style={styles.cardColumn}>
                          <StudioCard compact label={scheme === "light" ? "Preview Light" : "Preview Dark"} theme={theme}
                            checked={scheme === previewScheme} onPress={() => setPreviewScheme(scheme)} />
                        </View>
                      ))}
                    </View>
                    {!followSystem && previewId !== choices.manualTheme &&
                      <Text style={[studioTextStyles.description, { color: theme.textSecondary }]}>
                        Fixed theme uses {THEME_NAMES[choices.manualTheme]}.
                      </Text>}
                    <AppearanceStudioPreview theme={previewTheme} themeId={previewId} editorTheme={theme} />
                  </View>
                </View>
                {(appearanceSaveBlock || saveError || draftError) &&
                  <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.text }}>
                    {appearanceSaveBlock ?? (saveError ? "Changes weren’t saved. " + saveError : draftError)}
                  </Text>}
                {status && <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>{status}</Text>}
                {dirty && <Text accessibilityLiveRegion="polite" style={[studioTextStyles.description, { color: theme.textSecondary }]}>
                  Unsaved changes
                </Text>}
                <View testID="studio-actions" style={stackedActions ? styles.group : styles.row}>
                  <StudioAction label="Cancel" actionRef={cancelButton} theme={theme} fluid={!stackedActions} onPress={() => requestClose("cancel")} />
                  <StudioAction label="Apply" theme={theme} fluid={!stackedActions} primary
                    disabled={!dirty || !!appearanceSaveBlock || !!draftError} onPress={apply} />
                </View>
              </>
            )}
          </ScrollView>
          {pickerTarget && <AppearanceStudioAccentSheet ref={picker} theme={theme} target={pickerTarget}
            original={readStudioColor(draft, pickerTarget)}
            saved={readStudioColor(opening, pickerTarget)}
            palette={palette} stacked={stackedActions} onCancel={closePicker}
            resolveCandidate={value => {
              const next = getStudioDraftPlan(opening, withStudioColor(draft, pickerTarget, value)).choices;
              return resolveCustomProfile(next, pickerTarget.profile);
            }}
            onUse={value => { edit(current => withStudioColor(current, pickerTarget, value)); closePicker(); }} />}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  window: { flex: 1, minHeight: 0 },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: spacing[5], gap: spacing[5] },
  group: { gap: spacing[3], minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  paneRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing[5] },
  pane: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  cards: { gap: spacing[3] },
  cardColumn: { flexGrow: 1, flexBasis: 130, minWidth: 0 },
  themeColumn: { flexGrow: 1, flexBasis: "44%", minWidth: 0 },
  switchRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing[3] },
  switchLabel: { flex: 1, minWidth: 0, fontSize: fontSizes.md, fontWeight: "800" },
  switch: { minHeight: 48, flexShrink: 0 },
});
