import React, { useEffect, useRef, useState } from "react";
import {
  Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, useWindowDimensions, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontSizes, spacing } from "@orion/shared/tokens";
import type { OrionThemeId } from "@orion/shared/types";
import { ORION_MOBILE_THEMES, resolvePalette, useOrionTheme } from "../../context/ThemeContext";
import { usePerformanceProfile } from "../../context/PerformanceContext";
import { resolveMotionPolicy } from "../../services/motionPolicy";
import { AppearanceStudioAccentSheet, type AccentSheetHandle } from "./AppearanceStudioAccentSheet";
import { focusStudioNode, StudioAction, StudioCard, StudioHeading, studioTextStyles } from "./AppearanceStudioControls";
import { AppearanceStudioPreview } from "./AppearanceStudioPreview";
import { matchesThemeScheme, type AppearanceScheme } from "./appearancePreferences";
import { studioAccentForeground, studioReadableForeground } from "./appearanceStudioContrast";
import { describeAccent } from "./appearanceStudioAccentColor";
import {
  getStudioLayout, getStudioPreviewTheme, getStudioTheme, isStudioDirty, newStudioDraft,
  resetStudioSelection, selectStudioTheme, studioBackAction, THEME_NAMES, THEME_DETAILS, withAccentChoice,
} from "./appearanceStudioDraft";

const DEFAULT_ACCENT = ORION_MOBILE_THEMES.custom.accent;
const themeIds = Object.keys(THEME_NAMES) as OrionThemeId[];

export default function AppearanceStudioDialog({ onClose }: { onClose: () => void }) {
  const {
    theme, preferences, systemReducedMotion, appearanceChoices, appearanceSaveBlock, systemScheme, applyAppearanceChoices,
  } = useOrionTheme();
  const { resolvedProfile } = usePerformanceProfile();
  const motion = resolveMotionPolicy(preferences.reducedMotion, systemReducedMotion);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [opening] = useState(appearanceChoices);
  const [draft, setDraft] = useState(() => newStudioDraft(opening, DEFAULT_ACCENT));
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewScheme, setPreviewScheme] = useState<AppearanceScheme>(systemScheme);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const applying = useRef(false);
  const heading = useRef<Text>(null);
  const confirmationHeading = useRef<Text>(null);
  const closeButton = useRef<View>(null);
  const cancelButton = useRef<View>(null);
  const changeColor = useRef<View>(null);
  const picker = useRef<AccentSheetHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const editorOffset = useRef(0);
  const returnFocus = useRef<"header" | "close" | "cancel" | "color" | null>(null);

  const width = Math.max(0, Math.min(window.width, measured?.width ?? window.width) - insets.left - insets.right);
  const height = Math.max(0, Math.min(window.height, measured?.height ?? window.height) - insets.top - insets.bottom);
  const { sideBySide, stackedActions } = getStudioLayout(width, height, window.fontScale, false);
  const selectedTheme = getStudioTheme(draft.choices, "dark");
  const previewTheme = resolvePalette(getStudioPreviewTheme(draft, previewScheme), draft.choices.customAccent);
  const dirty = isStudioDirty(draft, opening);
  const followSystem = draft.choices.followSystem;
  const accent = draft.choices.customAccent ?? DEFAULT_ACCENT;

  useEffect(() => {
    if (pickerOpen) return;
    if (!confirming && !returnFocus.current) return;
    const frame = requestAnimationFrame(() => {
      if (confirming) focusStudioNode(confirmationHeading.current);
      else {
        const target = returnFocus.current;
        returnFocus.current = null;
        if (target !== "color") scroll.current?.scrollTo({ y: editorOffset.current, animated: false });
        focusStudioNode(target === "color" ? changeColor.current : target === "close" ? closeButton.current
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
    if (applying.current || appearanceSaveBlock || !dirty) return;
    applying.current = true;
    const result = applyAppearanceChoices(opening, draft.choices);
    if (result.ok) onClose();
    else {
      applying.current = false;
      setSaveError(result.message);
    }
  }

  function closePicker() {
    returnFocus.current = "color";
    setPickerOpen(false);
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
                          setExpanded(false);
                          edit(current => ({ ...current, choices: { ...current.choices, followSystem: value } }));
                        }}
                        trackColor={{ false: theme.border, true: theme.accentSoft }}
                        thumbColor={followSystem ? studioAccentForeground(theme, theme.background, 3)
                          : studioReadableForeground(theme.background, theme.textMuted, 3)}
                        style={styles.switch} />
                    </View>
                    {followSystem && <StudioCard compact label="Light theme" value={THEME_NAMES[draft.choices.lightTheme]}
                      swatch={ORION_MOBILE_THEMES[draft.choices.lightTheme].accent} theme={theme} />}
                    <StudioCard compact label={followSystem ? "Dark theme" : "Fixed theme"}
                      value={THEME_NAMES[selectedTheme]} swatch={resolvePalette(selectedTheme, appearanceChoices.customAccent).accent}
                      expanded={expanded} onPress={() => setExpanded(value => !value)} theme={theme} />
                    {expanded && (
                      <>
                        <View style={[styles.cards, sideBySide && styles.row]}>
                          {themeIds.filter(id => !followSystem || matchesThemeScheme(id, "dark")).map(id => {
                            const palette = resolvePalette(id, appearanceChoices.customAccent);
                            return <View key={id} style={sideBySide && styles.themeColumn}>
                              <StudioCard label={THEME_NAMES[id] + " theme"} detail={THEME_DETAILS[id]} theme={theme}
                                palette={palette} swatch={palette.accent} checked={id === selectedTheme}
                                onPress={() => edit(current => selectStudioTheme(current, "dark", id))} />
                            </View>;
                          })}
                        </View>
                        <StudioAction label={followSystem ? "Reset Dark theme" : "Restore opening theme"} theme={theme} onPress={() => {
                          edit(current => resetStudioSelection(current, opening, "dark"));
                          setStatus(followSystem ? "Dark theme reset in preview." : "Original fixed theme restored in preview.");
                        }} />
                      </>
                    )}
                    {selectedTheme === "custom" && (
                      <View style={[styles.group, styles.section]}>
                        <StudioHeading title="Custom accent" theme={theme} />
                        <StudioCard compact label="Change Color" value={describeAccent(accent)} swatch={accent}
                          cardRef={changeColor} theme={theme} onPress={() => setPickerOpen(true)} />
                      </View>
                    )}
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
                    {!followSystem && previewTheme.id !== draft.choices.manualTheme &&
                      <Text style={[studioTextStyles.description, { color: theme.textSecondary }]}>
                        Fixed theme uses {THEME_NAMES[draft.choices.manualTheme]}.
                      </Text>}
                    <AppearanceStudioPreview theme={previewTheme} editorTheme={theme} />
                  </View>
                </View>
                {(appearanceSaveBlock || saveError) &&
                  <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.text }}>
                    {appearanceSaveBlock ?? ("Changes weren’t saved. " + saveError)}
                  </Text>}
                {status && <Text accessibilityLiveRegion="polite" style={{ color: theme.text }}>{status}</Text>}
                <View testID="studio-actions" style={stackedActions ? styles.group : styles.row}>
                  <StudioAction label="Cancel" actionRef={cancelButton} theme={theme} fluid={!stackedActions} onPress={() => requestClose("cancel")} />
                  <StudioAction label="Apply" theme={theme} fluid={!stackedActions} primary
                    disabled={!dirty || !!appearanceSaveBlock} onPress={apply} />
                </View>
              </>
            )}
          </ScrollView>
          {pickerOpen && <AppearanceStudioAccentSheet ref={picker} theme={theme} original={draft.choices.customAccent}
            defaultAccent={DEFAULT_ACCENT} stacked={stackedActions} onCancel={closePicker}
            onUse={value => { edit(current => withAccentChoice(current, value, DEFAULT_ACCENT)); closePicker(); }} />}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  window: { flex: 1, minHeight: 0 },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: spacing[5], gap: spacing[5] },
  group: { gap: spacing[3], minWidth: 0 },
  section: { marginTop: spacing[2] },
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
