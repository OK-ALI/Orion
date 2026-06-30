import { useEffect, useRef, useState } from "react";
import { storage, STORAGE_KEYS, secureStorage } from "../../../services/settingsStore";
import { clearTmdbCache } from "../../../services/tmdb";
import { ACCENT_PRESETS, applyAccentColor, applyFontPreset, THEME_PRESETS, applyTheme, DEFAULT_CUSTOM_VARS, FONT_PRESETS } from "../../../shared/utils/appearance";
import { SUBTITLE_LANGUAGES } from "../../../shared/utils/subtitles";
import { SettingsSelect, Toggle } from "../components/SettingsControls";

export function AppearanceSection({ sectionRef = null }) {
  const [accent, setAccent] = useState(
    () => storage.get(STORAGE_KEYS.ACCENT_COLOR) || "orion",
  );
  const [fontPreset, setFontPreset] = useState(
    () => storage.get(STORAGE_KEYS.FONT_PRESET) || "orion",
  );
  const [fontSize, setFontSize] = useState(
    () => storage.get(STORAGE_KEYS.FONT_SIZE) || "normal",
  );
  const [compact, setCompact] = useState(
    () => !!storage.get(STORAGE_KEYS.COMPACT_MODE),
  );
  const [noAnim, setNoAnim] = useState(
    () => !!storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS),
  );
  const [motionPreset, setMotionPreset] = useState(
    () => storage.get(STORAGE_KEYS.MOTION_PRESET) || "balanced",
  );
  const [backgroundScene, setBackgroundScene] = useState(
    () => storage.get(STORAGE_KEYS.BACKGROUND_SCENE) || "orbit",
  );
  const [ambientProfile, setAmbientProfile] = useState(
    () => storage.get(STORAGE_KEYS.AMBIENT_PROFILE) || (storage.get(STORAGE_KEYS.AMBIENT_GLOW) === false ? "off" : "balanced"),
  );
  const [accentInPlayer, setAccentInPlayer] = useState(
    () => storage.get(STORAGE_KEYS.ACCENT_IN_PLAYER) !== false,
  );
  const [theme, setTheme] = useState(
    () => storage.get(STORAGE_KEYS.THEME) || "dark",
  );
  const [customVars, setCustomVars] = useState(
    () =>
      storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || { ...DEFAULT_CUSTOM_VARS },
  );
  const [customInputs, setCustomInputs] = useState(() => ({
    ...(storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || DEFAULT_CUSTOM_VARS)
  }));
  useEffect(() => {
    setCustomInputs({ ...customVars });
  }, [customVars]);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [saved, setSaved] = useState(false);

  // Remember the committed (saved) values to revert on unmount if unsaved
  const committedRef = useRef({
    accent: storage.get(STORAGE_KEYS.ACCENT_COLOR) || "orion",
    fontPreset: storage.get(STORAGE_KEYS.FONT_PRESET) || "orion",
    theme: storage.get(STORAGE_KEYS.THEME) || "dark",
    customVars: storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || {
      ...DEFAULT_CUSTOM_VARS,
    },
    backgroundScene: storage.get(STORAGE_KEYS.BACKGROUND_SCENE) || "orbit",
  });
  const savedRef = useRef(false);

  // Revert live preview when leaving without saving
  useEffect(() => {
    return () => {
      if (!savedRef.current) {
        const { accent, fontPreset, theme, customVars, backgroundScene: committedBackground } = committedRef.current;
        applyAccentColor(accent);
        applyFontPreset(fontPreset);
        applyTheme(theme, theme === "custom" ? customVars : null);
        document.body.dataset.background = committedBackground;
      }
    };
  }, []);

  const handleThemeSelect = (id) => {
    savedRef.current = false;
    setTheme(id);
    if (id !== "custom") {
      applyTheme(id);
    } else {
      applyTheme("custom", customVars);
      setShowCustomEditor(true);
    }
  };

  const handleCustomVarChange = (prop, value) => {
    savedRef.current = false;
    const next = { ...customVars, [prop]: value };
    setCustomVars(next);
    applyTheme("custom", next);
  };

  const handleSave = () => {
    storage.set(STORAGE_KEYS.ACCENT_COLOR, accent);
    storage.set(STORAGE_KEYS.ACCENT_IN_PLAYER, accentInPlayer);
    storage.set(STORAGE_KEYS.FONT_PRESET, fontPreset);
    storage.set(STORAGE_KEYS.FONT_SIZE, fontSize);
    storage.set(STORAGE_KEYS.COMPACT_MODE, compact ? 1 : 0);
    storage.set(STORAGE_KEYS.REDUCE_ANIMATIONS, noAnim ? 1 : 0);
    storage.set(STORAGE_KEYS.MOTION_PRESET, motionPreset);
    storage.set(STORAGE_KEYS.BACKGROUND_SCENE, backgroundScene);
    storage.set(STORAGE_KEYS.AMBIENT_PROFILE, ambientProfile);
    storage.set(STORAGE_KEYS.AMBIENT_GLOW, ambientProfile !== "off");
    storage.set(STORAGE_KEYS.THEME, theme);
    if (theme === "custom") {
      storage.set(STORAGE_KEYS.CUSTOM_THEME_VARS, customVars);
    }
    // Apply immediately
    applyAccentColor(accent);
    applyFontPreset(fontPreset);
    applyTheme(theme, theme === "custom" ? customVars : null);
    const zoomMap = { sm: 0.85, normal: 1, lg: 1.15 };
    if (window.electron?.setZoomFactor)
      window.electron.setZoomFactor(zoomMap[fontSize] ?? 1);
    document.body.classList.toggle("compact-mode", compact);
    document.body.classList.toggle("no-anim", noAnim);
    const appliedMotion = noAnim ? "calm" : motionPreset;
    document.body.dataset.motion = appliedMotion;
    document.documentElement.dataset.motion = appliedMotion;
    document.body.dataset.background = backgroundScene;
    // Mark as saved so the cleanup effect doesn't revert
    savedRef.current = true;
    committedRef.current = { accent, fontPreset, theme, customVars, backgroundScene };
    // Notify App.jsx so playerSettings prop (accent + lang) is refreshed
    window.dispatchEvent(new CustomEvent("orion:player-settings-changed"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const CUSTOM_VAR_LABELS = {
    "--bg": "Background",
    "--surface": "Surface",
    "--surface2": "Surface 2",
    "--surface3": "Surface 3",
    "--border": "Border",
    "--text": "Text",
    "--text2": "Text 2",
    "--text3": "Text 3",
  };

  return (
    <div ref={sectionRef} style={{ marginBottom: 40, scrollMarginTop: 80 }}>
      <div className="settings-section-title">Appearance</div>

      {/* Theme */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: 10,
          }}
        >
          Theme
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {THEME_PRESETS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeSelect(t.id)}
              title={t.description}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                borderRadius: "var(--radius)",
                background:
                  theme === t.id
                    ? "color-mix(in srgb, var(--red) 15%, var(--surface2))"
                    : "var(--surface2)",
                border:
                  theme === t.id
                    ? "1.5px solid var(--red)"
                    : "1.5px solid var(--border)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                minWidth: 70,
              }}
            >
              {/* Mini preview swatch */}
              <div
                style={{
                  width: 40,
                  height: 28,
                  borderRadius: 4,
                  background:
                    t.id === "custom"
                      ? `linear-gradient(135deg, ${customVars["--bg"] || customVars["--bg-base"]} 50%, ${customVars["--surface2"] || customVars["--bg-surface"]} 50%)`
                      : t.vars
                        ? `linear-gradient(135deg, ${t.vars["--bg"] || t.vars["--bg-base"]} 50%, ${t.vars["--surface2"] || t.vars["--bg-surface"]} 50%)`
                        : "var(--surface3)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: theme === t.id ? 600 : 400,
                  color: theme === t.id ? "var(--text)" : "var(--text2)",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
          {THEME_PRESETS.find((t) => t.id === theme)?.description}
        </div>
      </div>

      {/* Custom theme editor */}
      {theme === "custom" && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setShowCustomEditor((v) => !v)}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "5px 12px", marginBottom: 12 }}
          >
            {showCustomEditor ? "▲ Hide" : "▼ Edit"} custom colours
          </button>
          {showCustomEditor && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
                padding: 16,
                background: "var(--surface2)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            >
              {Object.entries(CUSTOM_VAR_LABELS).map(([prop, label]) => {
                const val = customInputs[prop] || "";
                const isValidHex = val.startsWith("#") && (val.length === 4 || val.length === 7 || val.length === 9);
                return (
                  <div
                    key={prop}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      padding: 12,
                      background: "var(--surface3)",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)" }}>{prop}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isValidHex ? (
                        <input
                          type="color"
                          value={val.slice(0, 7)}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            setCustomInputs((prev) => ({ ...prev, [prop]: newColor }));
                            handleCustomVarChange(prop, newColor);
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 4,
                            border: "1px solid var(--border)",
                            cursor: "pointer",
                            background: "none",
                            padding: 2,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 4,
                            border: "1px solid var(--border)",
                            background: "var(--surface2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            color: "var(--text3)",
                            flexShrink: 0,
                          }}
                          title="Non-hex color (e.g. rgba)"
                        >
                          A
                        </div>
                      )}
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const newText = e.target.value;
                          setCustomInputs((prev) => ({ ...prev, [prop]: newText }));
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 32,
                          padding: "0 8px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          color: "var(--text)",
                          fontSize: 12,
                          fontFamily: "monospace",
                        }}
                      />
                      <button
                        className="btn btn-secondary"
                        style={{
                          fontSize: 11,
                          padding: "0 10px",
                          height: 32,
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                        onClick={() => handleCustomVarChange(prop, val)}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                );
              })}
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={() => {
                    savedRef.current = false;
                    setCustomVars({ ...DEFAULT_CUSTOM_VARS });
                    applyTheme("custom", DEFAULT_CUSTOM_VARS);
                  }}
                >
                  Reset to defaults
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accent Colour */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: 10,
          }}
        >
          Accent Colour
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                savedRef.current = false;
                setAccent(p.id);
                applyAccentColor(p.id);
              }}
              title={p.label}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: p.color,
                border:
                  accent === p.id
                    ? `3px solid var(--text)`
                    : "3px solid transparent",
                outline: accent === p.id ? `2px solid ${p.color}` : "none",
                outlineOffset: 2,
                cursor: "pointer",
                transition: "transform 0.15s",
                transform: accent === p.id ? "scale(1.15)" : "scale(1)",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>
          {ACCENT_PRESETS.find((p) => p.id === accent)?.label}, applied to
          buttons, highlights, and indicators.
        </div>
        {/* Accent in streaming player */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 14,
          }}
        >
          <Toggle value={accentInPlayer} onChange={setAccentInPlayer} />
          <div>
            <div
              style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}
            >
              Apply accent colour to streaming player
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              Passes the selected accent colour to the player source (Videasy,
              Vidking). VidSrc does not support colour theming.
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: 10,
          }}
        >
          Font style
        </div>
        <div className="orion-font-presets">
          {FONT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`orion-font-preset${fontPreset === preset.id ? " active" : ""}`}
              onClick={() => {
                savedRef.current = false;
                setFontPreset(preset.id);
                applyFontPreset(preset.id);
              }}
            >
              <strong style={{ fontFamily: preset.heading }}>Orion Cinema</strong>
              <span style={{ fontFamily: preset.body }}>Browse, discover, continue watching</span>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: 10,
          }}
        >
          Font Size
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "sm", label: "Small" },
            { id: "normal", label: "Normal" },
            { id: "lg", label: "Large" },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setFontSize(o.id)}
              className={
                fontSize === o.id ? "btn btn-primary" : "btn btn-ghost"
              }
              style={{
                padding: "7px 18px",
                fontSize: o.id === "sm" ? 12 : o.id === "lg" ? 16 : 14,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>Background scene</div>
        <div className="orion-background-presets">
          {[
            { id: "orbit", label: "Orbit", description: "Half-orbits at Orion's edges" },
            { id: "nebula", label: "Nebula", description: "Slow spectral star field" },
            { id: "minimal", label: "Minimal", description: "Clean cinematic vignette" },
          ].map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={`orion-background-preset${backgroundScene === scene.id ? " active" : ""}`}
              onClick={() => {
                savedRef.current = false;
                setBackgroundScene(scene.id);
                document.body.dataset.background = scene.id;
              }}
            >
              <span className={`orion-background-preview ${scene.id}`} aria-hidden="true" />
              <strong>{scene.label}</strong>
              <small>{scene.description}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="orion-appearance-grid" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Motion preset</div>
          <SettingsSelect value={motionPreset} onChange={setMotionPreset} options={[
            { value: "calm", label: "Calm" },
            { value: "balanced", label: "Balanced" },
            { value: "expressive", label: "Expressive" },
          ]} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>Dynamic ambient glow</div>
          <SettingsSelect value={ambientProfile} onChange={setAmbientProfile} options={[
            { value: "off", label: "Off" },
            { value: "low", label: "Low" },
            { value: "balanced", label: "Balanced" },
            { value: "vivid", label: "Vivid" },
          ]} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Toggle value={compact} onChange={setCompact} />
          <div>
            <div
              style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}
            >
              Compact card grid
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              Shows more titles per row by reducing card size.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Toggle value={noAnim} onChange={setNoAnim} />
          <div>
            <div
              style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}
            >
              Reduce animations
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              Disables transitions and hover effects throughout the app.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          Save
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "#48c774" }}>✓ Saved</span>
        )}
      </div>
    </div>
  );
}
