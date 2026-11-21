import {
  editAdvancedPaletteRole, isCustomAccent, normalizeAccent, prepareAdvancedAppearanceWrite,
  resetAdvancedPaletteProfile,
  type AdvancedAppearanceChoices, type AppearanceScheme, type MobileAppearanceThemeId, type ThemePreferencesV3,
} from "./appearancePreferences";
import type { CustomPaletteProfile, CustomPaletteRole, PaletteIssue } from "./customAppearancePalette";

export type StudioThemeGroup = AppearanceScheme | "fixed";
export type StudioColorTarget = { profile: CustomPaletteProfile; role: CustomPaletteRole };
export const ACCENT_ERROR = "Enter six HEX digits, such as #E50914.";

export const THEME_NAMES: Record<MobileAppearanceThemeId, string> = {
  "midnight-premiere": "Midnight Premiere",
  amoled: "AMOLED",
  mocha: "Mocha",
  slate: "Slate",
  "projector-silver": "Projector Silver",
  custom: "Custom Dark",
  "custom-light": "Custom Light",
};

export const THEME_DETAILS: Record<MobileAppearanceThemeId, string> = {
  "midnight-premiere": "Orion’s cinematic dark signature.",
  amoled: "Pure black tuned for OLED displays.",
  mocha: "Warm cinema tones with softer contrast.",
  slate: "Cool blue-gray tones for a calmer screen.",
  "projector-silver": "A bright projector-inspired light theme.",
  custom: "Your colors on Orion’s dark canvas.",
  "custom-light": "Your colors on Orion’s light canvas.",
};

const lightThemes = ["projector-silver", "custom-light"] as const;
const darkThemes = ["midnight-premiere", "amoled", "mocha", "slate", "custom"] as const;
export const STUDIO_THEME_CHOICES = { light: lightThemes, dark: darkThemes,
  fixed: ["midnight-premiere", "amoled", "mocha", "slate", "projector-silver", "custom", "custom-light"] as const };
export const PROFILE_NAMES = { light: THEME_NAMES["custom-light"], dark: THEME_NAMES.custom };
export const ROLE_NAMES = { accent: "Accent", background: "Background", surface: "Surface", text: "Text", border: "Border" };

export function parseStudioAccent(input: string): string | null {
  const value = input.trim();
  const hex = value.startsWith("#") ? value : "#" + value;
  return isCustomAccent(hex) ? normalizeAccent(hex) : null;
}

export function selectStudioTheme(draft: AdvancedAppearanceChoices, group: StudioThemeGroup,
  theme: MobileAppearanceThemeId): AdvancedAppearanceChoices {
  if (group === "fixed") return { ...draft, manualTheme: theme };
  if (group === "light" && lightThemes.some(id => id === theme)) {
    return { ...draft, lightTheme: theme as AdvancedAppearanceChoices["lightTheme"] };
  }
  if (group === "dark" && darkThemes.some(id => id === theme)) {
    return { ...draft, darkTheme: theme as AdvancedAppearanceChoices["darkTheme"] };
  }
  return draft;
}

export function resetStudioSelection(draft: AdvancedAppearanceChoices, opening: AdvancedAppearanceChoices,
  group: StudioThemeGroup): AdvancedAppearanceChoices {
  return selectStudioTheme(draft, group, group === "fixed" ? opening.manualTheme
    : group === "light" ? lightThemes[0] : darkThemes[0]);
}

export function getStudioPreviewTheme(draft: AdvancedAppearanceChoices, scheme: AppearanceScheme) {
  if (!draft.followSystem && STUDIO_THEME_CHOICES[scheme].some(id => id === draft.manualTheme)) {
    return draft.manualTheme;
  }
  return scheme === "light" ? draft.lightTheme : draft.darkTheme;
}

export function readStudioColor(choices: AdvancedAppearanceChoices, { profile, role }: StudioColorTarget) {
  return (profile === "light" ? choices.custom.light : choices.custom.dark.colors)[role];
}

export function withStudioColor(draft: AdvancedAppearanceChoices, target: StudioColorTarget, color: string | null) {
  return editAdvancedPaletteRole(draft, target.profile, target.role, color);
}

export function restoreStudioPalette(draft: AdvancedAppearanceChoices, profile: CustomPaletteProfile) {
  return resetAdvancedPaletteProfile(draft, profile);
}

export function getStudioDraftPlan(opening: AdvancedAppearanceChoices, draft: AdvancedAppearanceChoices,
  validate: (choices: AdvancedAppearanceChoices, profile: CustomPaletteProfile) => PaletteIssue[] = () => []) {
  const baseline: ThemePreferencesV3 = { schemaVersion: 3, reducedMotion: false, ...opening };
  const plan = prepareAdvancedAppearanceWrite(opening, draft, baseline, validate);
  return plan.ok
    ? { dirty: plan.preferences !== baseline, choices: plan.preferences, error: null }
    : { dirty: true, choices: draft, error: plan.message };
}

export function getStudioLayout(width: number, height: number, fontScale: number, keyboard: boolean) {
  return {
    sideBySide: width >= 840 && height >= 480 && fontScale <= 1.3 && !keyboard,
    stackedActions: width < 340 || height < 400 || fontScale > 1.3 || keyboard,
  };
}

export function studioBackAction(keyboard: boolean, confirming: boolean, dirty: boolean) {
  if (keyboard) return "hide-keyboard";
  if (confirming) return "keep-editing";
  return dirty ? "confirm-discard" : "close";
}
