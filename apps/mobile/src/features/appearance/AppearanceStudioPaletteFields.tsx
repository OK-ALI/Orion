import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing } from "@orion/shared/tokens";
import type { MobileThemeTokens } from "../../context/ThemeContext";
import { StudioAction, StudioCard, StudioHeading, StudioSwatch, studioTextStyles } from "./AppearanceStudioControls";
import { PROFILE_NAMES, ROLE_NAMES } from "./appearanceStudioDraft";
import {
  CUSTOM_PALETTE_ROLES, isHexColor, type CustomPaletteProfile, type CustomPaletteResolution,
  type CustomPaletteRole, type PaletteIssue, type PaletteRoleColor,
} from "./customAppearancePalette";

export function colorText(color: string) {
  return isHexColor(color) ? color.toUpperCase() : "Translucent";
}

export function roleColorText(color: string | null, inherited: string) {
  return color === null ? "Orion default · " + colorText(inherited) : colorText(color);
}

function issueText(issue: PaletteIssue) {
  if (issue.code === "text-contrast") return "Text needs more contrast against the background and surfaces.";
  return "Enter a six-digit HEX color.";
}

export function StudioPaletteFeedback({ role, resolution, theme }: {
  role: CustomPaletteRole;
  resolution: CustomPaletteResolution;
  theme: MobileThemeTokens;
}) {
  const { requestedColor, inheritedColor, effectiveColor } = resolution.roles[role];
  const issue = resolution.issues.find(item => item.role === role);
  if (issue) return (
    <Text accessibilityLiveRegion="polite" style={[studioTextStyles.description, { color: theme.text }]}>
      {issue.code === "scheme-luminance"
        ? `${ROLE_NAMES[role]} must fit the ${resolution.palette.dark ? "Dark" : "Light"} profile. Choose a ${resolution.palette.dark ? "darker" : "lighter"} shade.`
        : issueText(issue)}
    </Text>
  );
  const adjusted = resolution.issues.length === 0 && resolution.warnings.some(warning => warning.role === role);
  if (!adjusted) return null;
  return (
    <View style={styles.feedback}>
      <ColorEvidence label="Requested" color={requestedColor ?? inheritedColor}
        description={roleColorText(requestedColor, inheritedColor)} theme={theme} />
      <ColorEvidence label="Displayed" color={effectiveColor} description={colorText(effectiveColor)} theme={theme} />
      <Text style={[studioTextStyles.description, { color: theme.textSecondary }]}>Adjusted for contrast.</Text>
    </View>
  );
}

function ColorEvidence({ label, color, description, theme }: {
  label: string; color: string; description: string; theme: MobileThemeTokens;
}) {
  return (
    <View style={styles.evidence}>
      <StudioSwatch color={color} backing={theme.background} />
      <Text style={[styles.evidenceText, studioTextStyles.description, { color: theme.textSecondary }]}>
        {label} {description}
      </Text>
    </View>
  );
}

interface PaletteFieldsProps {
  profile: CustomPaletteProfile;
  resolution: CustomPaletteResolution;
  theme: MobileThemeTokens;
  stacked: boolean;
  canReset: boolean;
  onProfile: (profile: CustomPaletteProfile) => void;
  onEdit: (role: CustomPaletteRole) => void;
  onResetRole: (role: CustomPaletteRole) => void;
  onResetPalette: () => void;
  roleRef: (role: CustomPaletteRole, node: View | null) => void;
}

function Field({ role, entry, resolution, theme, onEdit, onResetRole, roleRef }: Pick<PaletteFieldsProps,
  "resolution" | "theme" | "onEdit" | "onResetRole" | "roleRef"> & { role: CustomPaletteRole; entry: PaletteRoleColor }) {
  const { requestedColor, inheritedColor } = entry;
  return (
    <View testID={`studio-role-${role}`} style={styles.group}>
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <StudioCard compact label={`Edit ${ROLE_NAMES[role]}`} value={roleColorText(requestedColor, inheritedColor)}
            swatch={requestedColor ?? inheritedColor} theme={theme} cardRef={node => roleRef(role, node)}
            onPress={() => onEdit(role)} />
        </View>
        {requestedColor !== null && <StudioAction label={`Reset ${ROLE_NAMES[role]}`} theme={theme}
          onPress={() => onResetRole(role)} />}
      </View>
      <StudioPaletteFeedback role={role} resolution={resolution} theme={theme} />
    </View>
  );
}

export function AppearanceStudioPaletteFields(props: PaletteFieldsProps) {
  const { profile, resolution, theme, stacked, canReset, onProfile, onResetPalette } = props;
  return (
    <View style={styles.section}>
      <StudioHeading title="Custom Palette" theme={theme} />
      <View style={stacked ? styles.group : styles.fieldRow}>
        {(["light", "dark"] as const).map(id => (
          <View key={id} style={styles.field}>
            <StudioCard compact label={PROFILE_NAMES[id]} theme={theme} checked={profile === id} onPress={() => onProfile(id)} />
          </View>
        ))}
      </View>
      <Text style={[studioTextStyles.description, { color: theme.textSecondary }]}>Editing {PROFILE_NAMES[profile]}</Text>
      {CUSTOM_PALETTE_ROLES.map(role => <Field key={`${profile}:${role}`} {...props} role={role} entry={resolution.roles[role]} />)}
      <StudioAction label="Restore default palette" theme={theme} disabled={!canReset} onPress={onResetPalette} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3], minWidth: 0, marginTop: spacing[2] },
  group: { gap: spacing[1], minWidth: 0 },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[2] },
  field: { flexGrow: 1, flexBasis: 152, minWidth: 0 },
  feedback: { gap: spacing[1], paddingHorizontal: spacing[2] },
  evidence: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  evidenceText: { flex: 1, minWidth: 0 },
});
