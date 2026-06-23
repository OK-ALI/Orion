// ── Accent colour presets & helpers ──────────────────────────────────────────

export const ACCENT_PRESETS = [
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

// ── Theme presets ─────────────────────────────────────────────────────────────

export const THEME_PRESETS = [
  {
    id: "dark",
    label: "Dark",
    description: "Default dark theme",
    vars: {
      "--bg-base": "#0a0a0f",
      "--bg-elevated": "#12121a",
      "--bg-surface": "#1a1a26",
      "--bg-hover": "#22223a",
      "--bg-input": "#161622",
      "--text-primary": "#f0f0f5",
      "--text-secondary": "#a0a0b0",
      "--text-muted": "#606078",
      "--border": "rgba(255, 255, 255, 0.07)",
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
    label: "Light",
    description: "Clean light theme",
    vars: {
      "--bg-base": "#ebebed",
      "--bg-elevated": "#f8f8fa",
      "--bg-surface": "#eeeef0",
      "--bg-hover": "#dcdce0",
      "--bg-input": "#f0f0f2",
      "--text-primary": "#111113",
      "--text-secondary": "#3a3a40",
      "--text-muted": "#6b6b74",
      "--border": "rgba(0, 0, 0, 0.08)",
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
  "--bg-base": "#0a0a0f",
  "--bg-elevated": "#12121a",
  "--bg-surface": "#1a1a26",
  "--bg-hover": "#22223a",
  "--bg-input": "#161622",
  "--text-primary": "#f0f0f5",
  "--text-secondary": "#a0a0b0",
  "--text-muted": "#606078",
  "--border": "rgba(255, 255, 255, 0.07)",
};

export function applyTheme(themeId, customVars = null) {
  const preset =
    THEME_PRESETS.find((t) => t.id === themeId) ?? THEME_PRESETS[0];
  const vars =
    themeId === "custom" ? (customVars ?? DEFAULT_CUSTOM_VARS) : preset.vars;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}
