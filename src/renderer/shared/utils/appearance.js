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

export function applyAccentColor(presetId) {
  const preset =
    ACCENT_PRESETS.find((p) => p.id === presetId) ?? ACCENT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--accent", preset.color);
  root.style.setProperty("--accent-hover", preset.hover);
  root.style.setProperty("--accent-soft", preset.soft);
  root.style.setProperty("--accent-glow", preset.glow);
  root.style.setProperty("--border-accent", preset.border);
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
