import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Animated, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
  type GestureResponderEvent, type KeyboardEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fontSizes, radii, spacing } from "@orion/shared/tokens";
import { ORION_MOBILE_THEMES, type MobileThemeTokens } from "../../context/ThemeContext";
import {
  accentFromArea, accentHsvToHex, ACCENT_HUES, clampPercent, describeAccent,
  hexToAccentHsv, hueIndex, type AccentHsv,
} from "./appearanceStudioAccentColor";
import { studioAccentForeground, studioReadableForeground } from "./appearanceStudioContrast";
import { focusStudioNode, StudioAccentField, StudioAction, StudioCard, StudioHeading, StudioSwatch } from "./AppearanceStudioControls";
import { roleColorText, StudioPaletteFeedback } from "./AppearanceStudioPaletteFields";
import { ACCENT_ERROR, parseStudioAccent, PROFILE_NAMES, ROLE_NAMES, THEME_NAMES, type StudioColorTarget } from "./appearanceStudioDraft";
import { studioKeyboardInset, studioRevealOffset, type StudioKeyboardFrame, type StudioMeasuredFrame } from "./appearanceStudioIme";
import { compositePaletteColor, type CustomPaletteResolution } from "./customAppearancePalette";

const MARKER_SIZE = 20;
const presetIds = ["midnight-premiere", "amoled", "mocha", "slate", "projector-silver"] as const;
const presets = presetIds.map(id => ({ label: THEME_NAMES[id], hex: ORION_MOBILE_THEMES[id].accent.toUpperCase() }));

export interface AccentSheetHandle { back: () => void }

interface AccentSheetProps {
  theme: MobileThemeTokens;
  target: StudioColorTarget;
  original: string | null;
  saved: string | null;
  palette: CustomPaletteResolution;
  resolveCandidate: (value: string | null) => CustomPaletteResolution;
  stacked: boolean;
  onCancel: () => void;
  onUse: (value: string | null) => void;
}

function readFrame(node: View | null, consume: (frame: StudioMeasuredFrame) => void) {
  node?.measureInWindow((x, y, width, height) => {
    if (width > 0 && height > 0) consume({ x, y, width, height });
  });
}

function markerOffset(position: number, extent: number): number {
  return Math.max(0, Math.min(extent - MARKER_SIZE, position * extent - MARKER_SIZE / 2));
}

function ColorStep({ label, value, onChange, theme }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  theme: MobileThemeTokens;
}) {
  const rounded = Math.round(value);
  const step = (amount: number) => onChange(clampPercent(rounded + amount));
  return (
    <View style={styles.stepRow}>
      <View accessible accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: rounded, text: rounded + "%" }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === "increment") step(5);
          if (event.nativeEvent.actionName === "decrement") step(-5);
        }}
        style={styles.stepLabel}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.percentage, { color: theme.textSecondary }]}>{rounded}%</Text>
      </View>
      <StudioAction label={"Decrease " + label.toLowerCase()} icon="remove" theme={theme}
        disabled={rounded === 0} onPress={() => step(-5)} />
      <StudioAction label={"Increase " + label.toLowerCase()} icon="add" theme={theme}
        disabled={rounded === 100} onPress={() => step(5)} />
    </View>
  );
}

export const AppearanceStudioAccentSheet = forwardRef<AccentSheetHandle, AccentSheetProps>(
  function AppearanceStudioAccentSheet({ theme, target, original, saved, palette, resolveCandidate, stacked, onCancel, onUse }, ref) {
    const { role, profile } = target;
    const inherited = palette.roles[role].inheritedColor;
    const defaultHex = compositePaletteColor(inherited, palette.palette.surface);
    const opening = original ?? defaultHex;
    const title = `${PROFILE_NAMES[profile]} · ${ROLE_NAMES[role]}`;
    const [hsv, setHsv] = useState(() => hexToAccentHsv(opening));
    const [edited, setEdited] = useState(false);
    const [hexInput, setHexInput] = useState<string | null>(null);
    const [showHex, setShowHex] = useState(false);
    const [validate, setValidate] = useState(false);
    const [useDefault, setUseDefault] = useState(false);
    const [focusedHue, setFocusedHue] = useState<number | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [area, setArea] = useState({ width: 0, height: 0 });
    const [pickerLayout, setPickerLayout] = useState({ contentHeight: 0, viewportHeight: 0 });
    const [shadeDragLayout, setShadeDragLayout] = useState<typeof pickerLayout | null>(null);
    const [scrollPosition] = useState(() => new Animated.Value(0));
    const [keyboard, setKeyboard] = useState<StudioKeyboardFrame | null>(() => Keyboard.metrics() ?? null);
    const [viewport, setViewport] = useState<StudioMeasuredFrame | null>(null);
    const root = useRef<View>(null);
    const scrollViewport = useRef<View>(null);
    const scroll = useRef<ScrollView>(null);
    const field = useRef<View>(null);
    const heading = useRef<Text>(null);
    const returnButton = useRef<View>(null);
    const offset = useRef(0);
    const editorOffset = useRef(0);
    const inputFocused = useRef(false);
    const revealError = useRef(false);
    const returning = useRef(false);
    const { width, height } = useWindowDimensions();

    const hex = accentHsvToHex(hsv);
    const raw = hexInput ?? hex;
    const inset = viewport ? studioKeyboardInset(viewport, keyboard) : 0;
    const error = validate && !parseStudioAccent(raw) ? ACCENT_ERROR : null;
    const candidate = useDefault ? null : edited ? hex : original;
    const dirty = candidate !== original || !parseStudioAccent(raw);
    const resolution = useMemo(() => resolveCandidate(candidate), [resolveCandidate, candidate]);
    const proposedTheme = resolution.palette;
    const hue = hueIndex(hsv.hue);
    const accent = studioAccentForeground(theme, theme.elevated, 3);
    const { contentHeight, viewportHeight } = pickerLayout;
    const scrollRange = contentHeight - viewportHeight;
    const thumbHeight = viewportHeight > 0 && scrollRange > 0
      ? Math.min(viewportHeight, Math.max(20, viewportHeight * viewportHeight / contentHeight))
      : 0;

    const measure = useCallback(() => {
      readFrame(root.current, next => setViewport(previous =>
        previous?.x === next.x && previous.y === next.y &&
        previous.width === next.width && previous.height === next.height ? previous : next));
    }, []);

    useEffect(() => {
      const show = (event: KeyboardEvent) => setKeyboard(event.endCoordinates);
      const subscriptions = [
        Keyboard.addListener("keyboardDidShow", show),
        Keyboard.addListener("keyboardDidHide", () => setKeyboard(null)),
      ];
      if (Platform.OS === "ios") subscriptions.push(Keyboard.addListener("keyboardWillChangeFrame", show));
      return () => subscriptions.forEach(subscription => subscription.remove());
    }, []);

    useEffect(() => {
      const frame = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(frame);
    }, [width, height, keyboard, measure]);

    const reveal = useCallback(() => {
      if (!inputFocused.current && !revealError.current) return;
      readFrame(scrollViewport.current, visible => readFrame(field.current, bounds => {
        const current = offset.current;
        const move = studioRevealOffset(current, visible, bounds, spacing[2]);
        if (Math.abs(move - current) >= 1) scroll.current?.scrollTo({ y: move, animated: false });
        revealError.current = false;
      }));
    }, []);

    useEffect(() => {
      const frame = requestAnimationFrame(reveal);
      return () => cancelAnimationFrame(frame);
    }, [error, inset, keyboard, showHex, reveal]);

    useEffect(() => {
      const frame = requestAnimationFrame(() => {
        if (returning.current && !confirming) {
          returning.current = false;
          scroll.current?.scrollTo({ y: editorOffset.current, animated: false });
          focusStudioNode(returnButton.current);
        } else focusStudioNode(heading.current);
      });
      return () => cancelAnimationFrame(frame);
    }, [confirming]);

    function close() {
      Keyboard.dismiss();
      if (!dirty) onCancel();
      else {
        editorOffset.current = offset.current;
        setConfirming(true);
      }
    }

    function back() {
      if (keyboard || Keyboard.isVisible()) Keyboard.dismiss();
      else if (confirming) { returning.current = true; setConfirming(false); }
      else close();
    }

    useImperativeHandle(ref, () => ({ back }));

    function select(next: AccentHsv) {
      setEdited(true);
      setUseDefault(false);
      setHexInput(null);
      setValidate(false);
      setHsv(current => current.hue === next.hue && current.saturation === next.saturation &&
        current.brightness === next.brightness ? current : next);
    }

    function selectShade({ nativeEvent: { locationX, locationY } }: GestureResponderEvent) {
      const next = accentFromArea(hsv.hue, locationX, locationY, area.width, area.height);
      if (next) select(next);
    }

    function startShade(event: GestureResponderEvent) {
      // Hold the viewport and scroll extent while live details below Shade change height.
      setShadeDragLayout(pickerLayout);
      selectShade(event);
    }

    function endShade() {
      setShadeDragLayout(null);
    }

    function editHex(value: string) {
      setEdited(true);
      setUseDefault(false);
      setHexInput(value);
      const parsed = parseStudioAccent(value);
      if (parsed) setHsv(current => hexToAccentHsv(parsed, current.hue));
    }

    function useColor() {
      const parsed = parseStudioAccent(raw);
      if (parsed) {
        Keyboard.dismiss();
        onUse(useDefault ? null : edited ? parsed : original);
      } else {
        revealError.current = true;
        setShowHex(true);
        setValidate(true);
        requestAnimationFrame(reveal);
      }
    }
    return (
      <View ref={root} collapsable={false} testID="studio-picker-viewport" onLayout={measure}
        accessibilityViewIsModal onAccessibilityEscape={back}
        style={[styles.overlay, { backgroundColor: theme.mediaScrim, paddingBottom: inset }]}>
        <View style={[styles.sheet, {
          backgroundColor: theme.elevated, borderColor: theme.border,
          maxHeight: keyboard || (viewport?.height ?? height) < 520 ? "100%" : "90%",
        }]}>
          <View ref={scrollViewport} testID="studio-picker-visible" collapsable={false}
            style={[styles.scrollViewport, shadeDragLayout?.viewportHeight ? { height: shadeDragLayout.viewportHeight } : undefined]}
            onLayout={({ nativeEvent: { layout: { height } } }) => {
              setPickerLayout(current => current.viewportHeight === height ? current : { ...current, viewportHeight: height });
              reveal();
            }}>
            <ScrollView ref={scroll} testID="studio-picker-scroll" keyboardShouldPersistTaps="handled"
              scrollEnabled={shadeDragLayout === null} style={styles.scroll}
              contentContainerStyle={[styles.content, shadeDragLayout && { minHeight: shadeDragLayout.contentHeight }]}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(_width, height) =>
                setPickerLayout(current => current.contentHeight === height ? current : { ...current, contentHeight: height })}
              onScroll={event => {
                offset.current = event.nativeEvent.contentOffset.y;
                scrollPosition.setValue(offset.current);
              }} scrollEventThrottle={16}>
              <View style={styles.header}>
                <StudioHeading dialogTitle title={confirming ? "Discard color changes?" : title}
                  headingRef={heading} theme={theme} background={theme.elevated} />
                {!confirming && <StudioAction label="Close color picker" icon="close" actionRef={returnButton}
                  theme={theme} background={theme.elevated} onPress={close} />}
              </View>
              {confirming ? (
                <>
                  <Text style={{ color: theme.textSecondary }}>Your changes in the color picker won’t be used.</Text>
                  <View style={stacked ? styles.group : styles.row}>
                    <StudioAction label="Keep editing color" theme={theme} fluid={!stacked} onPress={() => {
                      returning.current = true;
                      setConfirming(false);
                    }} />
                    <StudioAction label="Discard color changes" theme={theme} fluid={!stacked} onPress={onCancel} />
                  </View>
                </>
              ) : (
                <>
                  {role === "accent" && (
                    <View style={styles.group}>
                      <StudioHeading title="Orion Accents" theme={theme} background={theme.elevated} />
                      <View style={stacked ? styles.group : styles.row}>
                        {presets.map(preset => <View key={preset.hex} style={!stacked && styles.preset}>
                          <StudioCard compact label={preset.label + ", " + preset.hex} swatch={preset.hex} theme={theme}
                            checked={hex === preset.hex} onPress={() => select(hexToAccentHsv(preset.hex))} />
                        </View>)}
                      </View>
                    </View>
                  )}
                  <StudioHeading title="Hue" theme={theme} background={theme.elevated} />
                  <View style={styles.row}>
                    {ACCENT_HUES.map((name, index) => {
                      const swatch = accentHsvToHex({ hue: index * 30, saturation: 100, brightness: 100 });
                      const checked = index === hue;
                      return (
                        <Pressable key={name} accessibilityRole="radio" accessibilityLabel={name + " hue"}
                          accessibilityState={{ checked }} onPress={() => select({ ...hsv, hue: index * 30 })}
                          onFocus={() => setFocusedHue(index)} onBlur={() => setFocusedHue(null)}
                          android_ripple={{ color: theme.accentSoft }}
                          style={[styles.hue, {
                            backgroundColor: swatch, borderColor: checked || focusedHue === index ? accent : studioReadableForeground(theme.elevated, swatch, 3),
                          }]}>
                          {checked && <Ionicons accessible={false} name="checkmark-circle" size={23}
                            color={studioReadableForeground(swatch, theme.text)} />}
                        </Pressable>
                      );
                    })}
                  </View>
                  <StudioHeading title="Shade" theme={theme} background={theme.elevated} />
                  <View testID="studio-color-area" accessible={false} focusable={false}
                    importantForAccessibility="no-hide-descendants"
                    onLayout={({ nativeEvent: { layout: { width, height } } }) =>
                      setArea(current => current.width === width && current.height === height ? current : { width, height })}
                    onStartShouldSetResponder={() => area.width > 0 && area.height > 0}
                    onResponderGrant={startShade} onResponderMove={selectShade}
                    onResponderRelease={endShade} onResponderTerminate={endShade}
                    onResponderTerminationRequest={() => false}
                    style={[styles.colorArea, { borderColor: accent,
                      backgroundColor: accentHsvToHex({ hue: hsv.hue, saturation: 100, brightness: 100 }) }]}>
                    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
                      <LinearGradient colors={["#FFFFFF", "#FFFFFF00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill} />
                      <LinearGradient colors={["#00000000", "#000000"]} style={StyleSheet.absoluteFill} />
                      <View testID="studio-shade-marker" style={[styles.marker, {
                        left: markerOffset(hsv.saturation / 100, area.width),
                        top: markerOffset(1 - hsv.brightness / 100, area.height),
                        borderColor: studioReadableForeground(hex, theme.text, 3), backgroundColor: hex,
                      }]} />
                    </View>
                  </View>
                  <ColorStep label="Saturation" value={hsv.saturation} theme={theme}
                    onChange={saturation => select({ ...hsv, saturation })} />
                  <ColorStep label="Brightness" value={hsv.brightness} theme={theme}
                    onChange={brightness => select({ ...hsv, brightness })} />
                  <View style={[styles.row, styles.samples]}>
                    <View style={styles.colorSample}>
                      <StudioSwatch color={saved ?? inherited} backing={theme.elevated} />
                      <Text style={[styles.label, { color: theme.text }]}>Saved color</Text>
                      <Text style={{ color: theme.textSecondary }}>{roleColorText(saved, inherited)}</Text>
                    </View>
                    <View style={styles.colorSample}>
                      <View testID="studio-picker-sample" style={[styles.requestedSwatch, { backgroundColor: candidate ?? inherited,
                        borderColor: accent }]} />
                      <Text style={[styles.label, { color: theme.text }]}>Proposed color</Text>
                      <Text testID="studio-proposed-color" accessibilityLiveRegion="polite" style={{ color: theme.textSecondary }}>
                        {candidate === null ? roleColorText(null, inherited) : `${describeAccent(hex)}, ${hex}`}
                      </Text>
                    </View>
                  </View>
                  <StudioPaletteFeedback role={role} resolution={resolution} theme={theme} />
                  {resolution.issues.filter(issue => issue.role !== role).map(issue =>
                    <StudioPaletteFeedback key={issue.role} role={issue.role} resolution={resolution} theme={theme} />)}
                  <View style={[styles.sample, { backgroundColor: proposedTheme.background, borderColor: proposedTheme.border }]}>
                    <View style={[styles.sample, { backgroundColor: proposedTheme.surface, borderColor: proposedTheme.border }]}>
                      <Text style={[styles.sampleTitle, { color: proposedTheme.text }]}>{PROFILE_NAMES[profile]} preview</Text>
                      <View style={[styles.sampleAction, { backgroundColor: proposedTheme.accent }]}>
                        <Text style={[styles.label, { color: studioReadableForeground(proposedTheme.accent, proposedTheme.onAccent) }]}>Play</Text>
                      </View>
                    </View>
                  </View>
                  <StudioAction label="Use Orion default" theme={theme} onPress={() => {
                    select(hexToAccentHsv(defaultHex));
                    setUseDefault(true);
                  }} />
                  <StudioAction label={showHex ? "Hide HEX" : "Enter HEX"} theme={theme} onPress={() => {
                    if (showHex) Keyboard.dismiss();
                    setShowHex(value => !value);
                  }} />
                  {showHex && (
                    <View ref={field} collapsable={false} onLayout={reveal} testID="studio-hex-group">
                      <StudioAccentField theme={theme} label={`${PROFILE_NAMES[profile]} ${ROLE_NAMES[role].toLowerCase()} HEX`}
                        value={raw} error={error} onChange={editHex}
                        onFocus={() => { inputFocused.current = true; reveal(); }}
                        onBlur={() => { inputFocused.current = false; setValidate(true); }}
                        onSubmit={() => { revealError.current = true; setValidate(true); requestAnimationFrame(reveal); }} />
                    </View>
                  )}
                  <View testID="studio-picker-actions" style={stacked || keyboard ? styles.group : styles.row}>
                    <StudioAction label="Cancel color" theme={theme} fluid={!stacked && !keyboard} onPress={() => {
                      Keyboard.dismiss();
                      onCancel();
                    }} />
                    <StudioAction label="Use Color" theme={theme} primary fluid={!stacked && !keyboard} onPress={useColor} />
                  </View>
                </>
              )}
            </ScrollView>
            {thumbHeight > 0 && (
              <Animated.View testID="studio-picker-scrollbar" accessible={false} importantForAccessibility="no"
                pointerEvents="none" style={[styles.scrollbar, { backgroundColor: accent, height: thumbHeight,
                  transform: [{ translateY: scrollPosition.interpolate({
                    inputRange: [0, scrollRange], outputRange: [0, viewportHeight - thumbHeight], extrapolate: "clamp",
                  }) }],
                }]} />
            )}
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "flex-end" },
  sheet: {
    width: "100%", maxWidth: 590, minHeight: 0, flexShrink: 1, borderWidth: 1,
    borderTopLeftRadius: radii["2xl"], borderTopRightRadius: radii["2xl"], overflow: "hidden",
  },
  scrollViewport: { minHeight: 0, flexShrink: 1 },
  scroll: { minHeight: 0, flexShrink: 1, flexGrow: 0 },
  scrollbar: { position: "absolute", top: 0, right: 3, width: 3, borderRadius: 2 },
  content: { padding: spacing[4], gap: spacing[3] },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  group: { gap: spacing[3] },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  samples: { gap: spacing[3] },
  colorSample: { flexGrow: 1, flexBasis: 115, minWidth: 0, gap: spacing[1] },
  preset: { flexGrow: 1, flexBasis: 210, minWidth: 0 },
  requestedSwatch: { width: 20, height: 20, borderWidth: 1, borderRadius: 10 },
  label: { fontSize: fontSizes.sm, fontWeight: "800" },
  percentage: { fontSize: fontSizes.base },
  sample: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing[2], minWidth: 0, maxWidth: "100%",
    padding: spacing[2], borderRadius: radii.md, borderWidth: 1 },
  sampleTitle: { minWidth: 0, flexShrink: 1 },
  sampleAction: { padding: spacing[2], borderRadius: radii.md },
  hue: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  colorArea: { minHeight: 148, borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" },
  marker: { position: "absolute", width: MARKER_SIZE, height: MARKER_SIZE, borderRadius: MARKER_SIZE / 2, borderWidth: 2 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], minHeight: 48 },
  stepLabel: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: "center" },
});
