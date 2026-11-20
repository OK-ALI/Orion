import React, { useState } from "react";
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontSizes, radii, spacing } from "@orion/shared/tokens";
import type { MobileThemeTokens } from "../../context/ThemeContext";
import { studioAccentForeground, studioReadableForeground } from "./appearanceStudioContrast";

export function focusStudioNode(node: Text | View | null) {
  if (!node) return;
  if (Platform.OS === "web") {
    (node as unknown as { focus?: () => void }).focus?.();
    return;
  }
  const handle = findNodeHandle(node);
  if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
}

export function StudioHeading({ title, theme, background = theme.background, headingRef, dialogTitle = false }: {
  title: string;
  theme: MobileThemeTokens;
  background?: string;
  headingRef?: React.Ref<Text>;
  dialogTitle?: boolean;
}) {
  return (
    <Text ref={headingRef} accessible accessibilityRole="header" style={[styles.heading, dialogTitle && styles.dialogTitle, {
      color: studioAccentForeground(theme, background),
    }]}>{title}</Text>
  );
}

export function StudioAction({
  label, onPress, theme, primary = false, disabled = false, fluid = false, actionRef, icon, background = theme.surface,
}: {
  label: string;
  onPress: () => void;
  theme: MobileThemeTokens;
  primary?: boolean;
  disabled?: boolean;
  fluid?: boolean;
  actionRef?: React.Ref<View>;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  background?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable ref={actionRef} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => {
        const fill = primary ? theme.accent : pressed ? theme.surfaceHover : background;
        return [styles.action, fluid && styles.fluid, icon && styles.iconAction, {
          backgroundColor: fill,
          borderColor: focused ? studioAccentForeground(theme, fill, 3) : primary ? studioAccentForeground(theme, theme.background, 3) : theme.border,
          opacity: disabled ? 0.65 : 1,
        }];
      }}>
      {icon ? <Ionicons accessible={false} name={icon} size={22} color={studioAccentForeground(theme, background)} />
        : <Text style={[styles.label, { color: primary ? studioReadableForeground(theme.accent, theme.onAccent) : theme.text,
          textAlign: "center" }]}>{label}</Text>}
    </Pressable>
  );
}

interface CardProps {
  label: string;
  value?: string;
  swatch?: string;
  checked?: boolean;
  expanded?: boolean;
  detail?: string;
  theme: MobileThemeTokens;
  palette?: MobileThemeTokens;
  onPress?: () => void;
  cardRef?: React.Ref<View>;
  compact?: boolean;
}

export function StudioCard({
  label, value, swatch, checked, expanded, detail, theme, palette = theme, onPress, cardRef, compact,
}: CardProps) {
  const [focused, setFocused] = useState(false);
  const fill = compact ? theme.elevated : palette.background;
  const accent = studioAccentForeground(theme, fill, 3);
  const content = <>
    {swatch && <StudioSwatch color={swatch} backing={fill} />}
    <View style={styles.copy}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      {(value || detail) && <Text style={[value ? studioTextStyles.description : styles.cardDescription,
        { color: palette.textSecondary }]}>{value ?? detail}</Text>}
    </View>
    {checked && <Ionicons accessible={false} name="checkmark-circle" color={accent} size={18} />}
    {onPress && checked === undefined &&
      <Ionicons accessible={false} name={expanded ? "chevron-up" : "chevron-forward"} color={accent} size={18} />}
  </>;
  const style = [styles.card, compact && styles.compact, {
    backgroundColor: fill, borderColor: checked || focused ? accent : palette.border,
  }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable ref={cardRef} accessibilityRole={checked === undefined ? "button" : "radio"}
      accessibilityLabel={value ? label + ", " + value : label}
      accessibilityState={{ checked, expanded }} onPress={onPress}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={style}>{content}</Pressable>
  );
}

export function StudioSwatch({ color, backing }: { color: string; backing: string }) {
  return <View accessible={false} style={[styles.swatch, {
    backgroundColor: color, borderColor: studioReadableForeground(backing, color, 3),
  }]} />;
}

export function StudioAccentField({ theme, value, error, onChange, onFocus, onBlur, onSubmit }: {
  theme: MobileThemeTokens;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: theme.text }]}>HEX color</Text>
      <TextInput testID="studio-accent-input" accessibilityLabel="Custom Dark accent HEX"
        accessibilityHint={error ?? "Enter six HEX digits."} value={value}
        autoCapitalize="characters" autoCorrect={false} spellCheck={false} returnKeyType="done"
        onChangeText={onChange} onFocus={() => { setFocused(true); onFocus(); }}
        onBlur={() => { setFocused(false); onBlur(); }} onSubmitEditing={onSubmit}
        style={[styles.input, {
          color: theme.text, backgroundColor: theme.input,
          borderColor: error ? studioReadableForeground(theme.input, theme.danger, 3)
            : focused ? studioAccentForeground(theme, theme.input, 3) : theme.border,
        }]} />
      {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={[studioTextStyles.description, { color: theme.text }]}>{error}</Text>}
    </View>
  );
}

export const studioTextStyles = StyleSheet.create({
  description: { fontSize: fontSizes.xs, lineHeight: 18 },
});

const styles = StyleSheet.create({
  heading: { fontSize: fontSizes.md, fontWeight: "900", flexShrink: 1, minWidth: 0 },
  dialogTitle: { fontSize: fontSizes.lg },
  group: { gap: spacing[2], minWidth: 0 },
  label: { fontSize: fontSizes.sm, fontWeight: "800" },
  cardDescription: { fontSize: fontSizes.xs, lineHeight: 15 },
  copy: { flex: 1, minWidth: 0, gap: spacing[1] },
  swatch: { width: 20, height: 20, borderWidth: 1, borderRadius: 10, flexShrink: 0 },
  card: {
    minHeight: 68, minWidth: 0, borderWidth: 2, borderRadius: radii.xl, gap: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: "row", alignItems: "center",
  },
  compact: { minHeight: 52, borderWidth: 1 },
  action: {
    minHeight: 48, minWidth: 0, paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    borderWidth: 1, borderRadius: radii.lg, alignItems: "center", justifyContent: "center",
  },
  fluid: { flexGrow: 1, flexBasis: 132 },
  iconAction: { width: 48, paddingHorizontal: 0, borderRadius: 24, flexShrink: 0 },
  input: {
    minHeight: 48, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderRadius: radii.lg, fontSize: fontSizes.md, fontWeight: "700",
  },
});
