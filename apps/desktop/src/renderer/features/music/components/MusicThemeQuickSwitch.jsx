import { useState } from "react";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import { applyTheme, DEFAULT_CUSTOM_VARS, THEME_PRESETS } from "../../../shared/utils/appearance";

export default function MusicThemeQuickSwitch() {
  const [themeId, setThemeId] = useState(() => storage.get(STORAGE_KEYS.THEME) || "dark");

  const selectTheme = (nextTheme) => {
    const customVars = storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || null;
    storage.set(STORAGE_KEYS.THEME, nextTheme);
    applyTheme(nextTheme, customVars);
    setThemeId(nextTheme);
    window.dispatchEvent(new CustomEvent("orion:theme-changed", { detail: { theme: nextTheme } }));
  };

  return (
    <section className="music-theme-quick-switch" aria-labelledby="music-theme-quick-title">
      <header>
        <div>
          <span className="music-eyebrow">Orion appearance</span>
          <h2 id="music-theme-quick-title">Theme</h2>
          <p>Switch Orion's shared theme without leaving Music Planet. Your existing accent and Music appearance stay intact.</p>
        </div>
      </header>
      <div className="music-theme-preset-grid" role="group" aria-label="Orion theme presets">
        {THEME_PRESETS.map((theme) => {
          const customVars = theme.id === "custom"
            ? (storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || DEFAULT_CUSTOM_VARS)
            : null;
          const vars = theme.vars || customVars || {};
          const swatchStart =
            vars["--bg-elevated"] ||
            vars["--surface"] ||
            vars["--bg-base"] ||
            vars["--bg"];
          const swatchEnd =
            vars["--cinema-velvet"] ||
            vars["--bg-hover"] ||
            vars["--surface3"] ||
            vars["--bg-surface"] ||
            vars["--surface2"];

          return (
            <button
              key={theme.id}
              type="button"
              className={themeId === theme.id ? "active" : ""}
              aria-pressed={themeId === theme.id}
              aria-label={`Use ${theme.label} theme`}
              onClick={() => selectTheme(theme.id)}
            >
              <span
                className="music-theme-swatch"
                aria-hidden="true"
                style={{
                  "--music-theme-swatch-start": swatchStart,
                  "--music-theme-swatch-end": swatchEnd,
                }}
              />
              <span><strong>{theme.label}</strong><small>{theme.description}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
