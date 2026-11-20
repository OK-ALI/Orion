import type { OrionThemeId } from "@orion/shared/types";
import {
  chooseSystemTheme, isCustomAccent, matchesThemeScheme, normalizeAccent, resetSystemTheme,
  type AppearanceChoices, type AppearanceScheme,
} from "./appearancePreferences";

export const THEME_NAMES: Record<OrionThemeId, string> = {
  "midnight-premiere": "Midnight Premiere",
  amoled: "AMOLED",
  mocha: "Mocha",
  slate: "Slate",
  "projector-silver": "Projector Silver",
  custom: "Custom",
};

export const THEME_DETAILS: Record<OrionThemeId, string> = {
  "midnight-premiere": "Orion’s cinematic dark signature.",
  amoled: "Pure black tuned for OLED displays.",
  mocha: "Warm cinema tones with softer contrast.",
  slate: "Cool blue-gray tones for a calmer screen.",
  "projector-silver": "A bright projector-inspired light theme.",
  custom: "Your accent on Orion’s dark canvas.",
};

export interface StudioDraft {
  choices: AppearanceChoices;
  accentInput: string;
}
export const ACCENT_ERROR = "Enter six HEX digits, such as #E50914.";

export function newStudioDraft(choices: AppearanceChoices, defaultAccent: string): StudioDraft {
  return { choices: { ...choices }, accentInput: choices.customAccent ?? defaultAccent };
}

export function parseStudioAccent(input: string): string | null {
  const value = input.trim();
  const hex = value.startsWith("#") ? value : "#" + value;
  return isCustomAccent(hex) ? normalizeAccent(hex) : null;
}

export function withStudioAccent(draft: StudioDraft, input: string, defaultAccent: string): StudioDraft {
  const hex = parseStudioAccent(input);
  return {
    accentInput: input,
    choices: hex === null || hex === (draft.choices.customAccent ?? defaultAccent) ? draft.choices : {
      ...draft.choices,
      customAccent: hex === defaultAccent ? null : hex,
    },
  };
}

export function withAccentChoice(draft: StudioDraft, accent: string | null, defaultAccent: string): StudioDraft {
  return { choices: { ...draft.choices, customAccent: accent }, accentInput: accent ?? defaultAccent };
}

export function getStudioTheme(choices: AppearanceChoices, scheme: AppearanceScheme): OrionThemeId {
  if (!choices.followSystem) return choices.manualTheme;
  return scheme === "light" ? choices.lightTheme : choices.darkTheme;
}

export function selectStudioTheme(draft: StudioDraft, scheme: AppearanceScheme, theme: OrionThemeId): StudioDraft {
  const choices = draft.choices.followSystem
    ? chooseSystemTheme(draft.choices, scheme, theme)
    : { ...draft.choices, manualTheme: theme };
  return { ...draft, choices };
}

export function resetStudioSelection(draft: StudioDraft, opening: AppearanceChoices, scheme: AppearanceScheme): StudioDraft {
  const choices = draft.choices.followSystem
    ? resetSystemTheme(draft.choices, scheme)
    : { ...draft.choices, manualTheme: opening.manualTheme };
  return { ...draft, choices };
}

export function getStudioPreviewTheme(draft: StudioDraft, scheme: AppearanceScheme): OrionThemeId {
  const choice = getStudioTheme(draft.choices, scheme);
  if (matchesThemeScheme(choice, scheme)) return choice;
  return scheme === "light" ? draft.choices.lightTheme : draft.choices.darkTheme;
}

export function isStudioDirty(draft: StudioDraft, opening: AppearanceChoices): boolean {
  return parseStudioAccent(draft.accentInput) === null ||
    draft.choices.manualTheme !== opening.manualTheme ||
    draft.choices.lightTheme !== opening.lightTheme ||
    draft.choices.darkTheme !== opening.darkTheme ||
    draft.choices.followSystem !== opening.followSystem ||
    draft.choices.customAccent !== opening.customAccent;
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
