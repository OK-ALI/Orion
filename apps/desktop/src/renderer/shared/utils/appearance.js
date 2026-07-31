// ── Accent colour presets & helpers ──────────────────────────────────────────

export const ACCENT_PRESETS = [
  {
    id: "orion",
    label: "Orion violet",
    color: "#8b5cf6",
    hover: "#a78bfa",
    soft: "rgba(139, 92, 246, 0.14)",
    glow: "rgba(139, 92, 246, 0.38)",
    border: "rgba(139, 92, 246, 0.46)",
  },
  {
    id: "red",
    label: "Red",
    color: "#E50914",
    hover: "#ff1a1a",
    soft: "rgba(229, 9, 20, 0.12)",
    glow: "rgba(229, 9, 20, 0.35)",
    border: "rgba(229, 9, 20, 0.4)",
  },
  {
    id: "blue",
    label: "Blue",
    color: "#2563eb",
    hover: "#3b82f6",
    soft: "rgba(37, 99, 235, 0.12)",
    glow: "rgba(37, 99, 235, 0.35)",
    border: "rgba(37, 99, 235, 0.4)",
  },
  {
    id: "purple",
    label: "Purple",
    color: "#7c3aed",
    hover: "#8b5cf6",
    soft: "rgba(124, 58, 237, 0.12)",
    glow: "rgba(124, 58, 237, 0.35)",
    border: "rgba(124, 58, 237, 0.4)",
  },
  {
    id: "green",
    label: "Green",
    color: "#059669",
    hover: "#10b981",
    soft: "rgba(5, 150, 105, 0.12)",
    glow: "rgba(5, 150, 105, 0.35)",
    border: "rgba(5, 150, 105, 0.4)",
  },
  {
    id: "orange",
    label: "Orange",
    color: "#d97706",
    hover: "#f59e0b",
    soft: "rgba(217, 119, 6, 0.12)",
    glow: "rgba(217, 119, 6, 0.35)",
    border: "rgba(217, 119, 6, 0.4)",
  },
  {
    id: "pink",
    label: "Pink",
    color: "#db2777",
    hover: "#ec4899",
    soft: "rgba(219, 39, 119, 0.12)",
    glow: "rgba(219, 39, 119, 0.35)",
    border: "rgba(219, 39, 119, 0.4)",
  },
];

export function applyAccentColor(presetId, glowStrength = 50) {
  const preset =
    ACCENT_PRESETS.find((p) => p.id === presetId) ?? ACCENT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--accent", preset.color);
  root.style.setProperty("--accent-hover", preset.hover);
  root.style.setProperty("--accent-soft", preset.soft);
  const strength = Math.max(0, Math.min(100, Number(glowStrength) || 0));
  const glowPercent = Math.round(6 + strength * 0.62);
  root.style.setProperty("--accent-glow", `color-mix(in srgb, ${preset.color} ${glowPercent}%, transparent)`);
  root.style.setProperty("--border-accent", preset.border);
}

export const INTERACTION_PRESETS = Object.freeze({
  subtle: { lift: -2, scale: 1.01 },
  balanced: { lift: -4, scale: 1.02 },
  vivid: { lift: -6, scale: 1.035 },
});

export function normalizeInteractionSettings(value = {}) {
  const preset = Object.hasOwn(INTERACTION_PRESETS, value.preset) ? value.preset : "balanced";
  const override = /^#[0-9a-f]{6}$/i.test(String(value.override || "").trim())
    ? String(value.override).trim()
    : "";
  const strength = Math.max(0, Math.min(100, Number(value.strength ?? 50) || 0));
  return { preset, override, strength };
}

export function applyInteractionAppearance(value = {}) {
  const settings = normalizeInteractionSettings(value);
  const preset = INTERACTION_PRESETS[settings.preset];
  const accent = ACCENT_PRESETS.find((item) => item.id === value.accentId) || ACCENT_PRESETS[0];
  const rawColor = settings.override || accent.hover;
  const hoverColor = value.themeId === "light"
    ? `color-mix(in srgb, ${rawColor} 76%, #181b22)`
    : rawColor;
  const root = document.documentElement;
  const softPercent = Math.round(8 + settings.strength * 0.14);
  const borderPercent = Math.round(38 + settings.strength * 0.32);
  const glowPercent = Math.round(settings.strength * 0.5);
  root.style.setProperty("--interaction-hover", hoverColor);
  root.style.setProperty("--interaction-hover-soft", `color-mix(in srgb, var(--interaction-hover) ${softPercent}%, transparent)`);
  root.style.setProperty("--interaction-hover-border", `color-mix(in srgb, var(--interaction-hover) ${borderPercent}%, transparent)`);
  root.style.setProperty("--interaction-hover-glow", `color-mix(in srgb, var(--interaction-hover) ${glowPercent}%, transparent)`);
  root.style.setProperty("--interaction-lift", `${preset.lift}px`);
  root.style.setProperty("--interaction-scale", String(preset.scale));
  root.style.setProperty("--interaction-glow-blur", `${Math.round(12 + settings.strength * 0.36)}px`);
  return settings;
}

export const FONT_PRESETS = [
  {
    id: "orion",
    label: "Orion",
    description: "Space Grotesk headings with Inter body copy",
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    heading: '"Space Grotesk", "Inter", sans-serif',
  },
  {
    id: "sora",
    label: "Sora",
    description: "Futurist headings with relaxed Manrope reading text",
    body: '"Manrope", "Inter", sans-serif',
    heading: '"Sora", "Manrope", sans-serif',
  },
  {
    id: "outfit",
    label: "Outfit",
    description: "Rounded contemporary titles with clean interface rhythm",
    body: '"Inter", "Manrope", sans-serif',
    heading: '"Outfit", "Inter", sans-serif',
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Fraunces for prestige headers with modern supporting text",
    body: '"Manrope", "Inter", sans-serif',
    heading: '"Fraunces", "Manrope", serif',
  },
  {
    id: "screen",
    label: "Screen",
    description: "Sharp all-screen typography tuned for long browsing sessions",
    body: '"Inter", "Manrope", sans-serif',
    heading: '"Manrope", "Inter", sans-serif',
  },
];

export function applyFontPreset(presetId) {
  const preset = FONT_PRESETS.find((item) => item.id === presetId) || FONT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--font-body", preset.body);
  root.style.setProperty("--font-heading", preset.heading);
  root.style.setProperty("--font-display", preset.heading);
}

// ── Theme presets ─────────────────────────────────────────────────────────────

export const THEME_PRESETS = [
  {
    id: "dark",
    label: "Midnight Premiere",
    description: "Projector-room ink, velvet violet and restrained marquee gold",
    vars: {
      "--bg-base": "#08070c",
      "--bg-elevated": "#100e17",
      "--bg-surface": "#191622",
      "--bg-hover": "#252033",
      "--bg-input": "#14111c",
      "--text-primary": "#f7f2ea",
      "--text-secondary": "#c4bac8",
      "--text-muted": "#83798b",
      "--border": "rgba(231, 217, 238, 0.10)",
      "--cinema-gold": "#e5bd73",
      "--cinema-velvet": "#5b214f",
    },
  },
  {
    id: "amoled",
    label: "AMOLED",
    description: "Deep black for OLED displays",
    vars: {
      "--bg-base": "#000000",
      "--bg-elevated": "#080808",
      "--bg-surface": "#111111",
      "--bg-hover": "#1c1c1c",
      "--bg-input": "#0f0f0f",
      "--text-primary": "#ffffff",
      "--text-secondary": "#cccccc",
      "--text-muted": "#888888",
      "--border": "rgba(255, 255, 255, 0.06)",
    },
  },
  {
    id: "watchfree",
    label: "Obsidian Cyan",
    description: "Midnight obsidian background paired with vibrant electric cyan accents",
    vars: {
      "--bg-base": "#090b10",
      "--bg-elevated": "#11141c",
      "--bg-surface": "#1a1e29",
      "--bg-hover": "#252b3b",
      "--bg-input": "#0d1016",
      "--text-primary": "#ffffff",
      "--text-secondary": "#ccd2e3",
      "--text-muted": "#708090",
      "--border": "rgba(102, 252, 241, 0.08)",
      "--cinema-gold": "#66fcf1",
      "--cinema-velvet": "#1f2833",
    },
  },
  {
    id: "mocha",
    label: "Mocha",
    description: "Warm dark brown tones",
    vars: {
      "--bg-base": "#0e0b09",
      "--bg-elevated": "#1a1410",
      "--bg-surface": "#231c16",
      "--bg-hover": "#332820",
      "--bg-input": "#1d1713",
      "--text-primary": "#f0e8df",
      "--text-secondary": "#c4b09a",
      "--text-muted": "#8a7060",
      "--border": "rgba(240, 232, 223, 0.06)",
    },
  },
  {
    id: "slate",
    label: "Slate",
    description: "Cool blue-grey tones",
    vars: {
      "--bg-base": "#0d1117",
      "--bg-elevated": "#161b22",
      "--bg-surface": "#1f2937",
      "--bg-hover": "#2d3748",
      "--bg-input": "#18222f",
      "--text-primary": "#e6edf3",
      "--text-secondary": "#8b949e",
      "--text-muted": "#6e7681",
      "--border": "rgba(230, 237, 243, 0.06)",
    },
  },
  {
    id: "light",
    label: "Projector Silver",
    description: "Neutral cinema silver, charcoal type and restrained violet detail",
    vars: {
      "--bg-base": "#f2f4f7",
      "--bg-elevated": "#fbfcfe",
      "--bg-surface": "#e7ebf1",
      "--bg-hover": "#dce2ea",
      "--bg-input": "#ffffff",
      "--text-primary": "#181b22",
      "--text-secondary": "#48505e",
      "--text-muted": "#687384",
      "--border": "rgba(24, 27, 34, 0.12)",
      "--cinema-gold": "#9a6a20",
      "--cinema-velvet": "#7a315f",
      "--music-scene-base": "#090b14",
      "--music-scene-surface": "rgba(17, 23, 37, 0.72)",
      "--music-scene-surface-active": "rgba(26, 52, 70, 0.84)",
      "--music-scene-glass": "rgba(17, 23, 37, 0.72)",
      "--music-scene-glass-strong": "rgba(17, 23, 37, 0.9)",
      "--music-scene-text": "#f5f7ff",
      "--music-scene-muted": "#c7d0dc",
      "--music-scene-label": "#a8edf7",
      "--music-scene-line": "rgba(225, 236, 255, 0.22)",
    },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your own custom colors",
    vars: null,
  },
];

export const DEFAULT_CUSTOM_VARS = {
  "--bg": "#0a0a0f",
  "--surface": "#12121a",
  "--surface2": "#1a1a26",
  "--surface3": "#22223a",
  "--border": "rgba(255, 255, 255, 0.07)",
  "--text": "#f0f0f5",
  "--text2": "#a0a0b0",
  "--text3": "#606078",
};

export function applyTheme(themeId, customVars = null) {
  const preset =
    THEME_PRESETS.find((t) => t.id === themeId) ?? THEME_PRESETS[0];
  const vars =
    themeId === "custom" ? (customVars ?? DEFAULT_CUSTOM_VARS) : preset.vars;
  const root = document.documentElement;
  root.dataset.theme = themeId;

  // Clear previously applied theme variables to prevent leaks
  const allProps = [
    "--bg-base",
    "--bg-elevated",
    "--bg-surface",
    "--bg-hover",
    "--bg-input",
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--bg",
    "--surface",
    "--surface2",
    "--surface3",
    "--text",
    "--text2",
    "--text3",
    "--border",
    "--cinema-gold",
    "--cinema-velvet",
    "--music-scene-base",
    "--music-scene-surface",
    "--music-scene-surface-active",
    "--music-scene-glass",
    "--music-scene-glass-strong",
    "--music-scene-text",
    "--music-scene-muted",
    "--music-scene-label",
    "--music-scene-line",
  ];
  for (const prop of allProps) {
    root.style.removeProperty(prop);
  }

  const CUSTOM_TO_BASE_MAP = {
    "--bg": "--bg-base",
    "--surface": "--bg-elevated",
    "--surface2": "--bg-surface",
    "--surface3": "--bg-hover",
    "--text": "--text-primary",
    "--text2": "--text-secondary",
    "--text3": "--text-muted",
  };

  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
    if (themeId === "custom") {
      if (CUSTOM_TO_BASE_MAP[prop]) {
        root.style.setProperty(CUSTOM_TO_BASE_MAP[prop], value);
      }
      if (prop === "--surface") {
        root.style.setProperty("--bg-input", value);
      }
    }
  }
}
