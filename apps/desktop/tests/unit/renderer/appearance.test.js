import { afterEach, describe, expect, it } from "vitest";
import {
  ACCENT_PRESETS,
  applyInteractionAppearance,
  applyTheme,
  normalizeInteractionSettings,
  THEME_PRESETS,
} from "../../../src/renderer/shared/utils/appearance";

describe("interaction appearance", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
  });

  it("uses non-disruptive defaults for existing profiles", () => {
    expect(normalizeInteractionSettings()).toEqual({
      preset: "balanced",
      override: "",
      strength: 50,
    });
  });

  it("validates custom colors and clamps glow strength", () => {
    expect(normalizeInteractionSettings({
      preset: "vivid",
      override: "#12abEF",
      strength: 140,
    })).toEqual({ preset: "vivid", override: "#12abEF", strength: 100 });
    expect(normalizeInteractionSettings({
      preset: "unknown",
      override: "red",
      strength: -4,
    })).toEqual({ preset: "balanced", override: "", strength: 0 });
  });

  it("applies movement and theme-corrected hover tokens live", () => {
    applyInteractionAppearance({
      preset: "subtle",
      override: "#ff00aa",
      strength: 25,
      themeId: "light",
    });

    const style = document.documentElement.style;
    expect(style.getPropertyValue("--interaction-hover")).toContain("#ff00aa 76%");
    expect(style.getPropertyValue("--interaction-lift")).toBe("-2px");
    expect(style.getPropertyValue("--interaction-scale")).toBe("1.01");
    expect(style.getPropertyValue("--interaction-hover-glow")).toContain("13%");
  });

  it("keeps Projector Silver warm while exposing Projector Red independently", () => {
    const silver = THEME_PRESETS.find((theme) => theme.id === "light");
    const projectorRed = ACCENT_PRESETS.find((accent) => accent.id === "projector-red");

    expect(silver?.vars["--bg-base"]).toBe("#f1ede5");
    expect(silver?.vars["--bg-elevated"]).toBe("#faf8f4");
    expect(silver?.vars["--bg-surface"]).toBe("#e8e2d9");
    expect(silver?.vars["--music-scene-base"]).toBe("#eee8df");
    expect(silver?.vars["--music-scene-text"]).toBe("#211f23");
    expect(silver?.vars["--music-scene-muted"]).toBe("#625b66");
    expect(projectorRed?.color).toBe("#a1121d");
  });

  it("derives semantic glass, border and disabled tokens for presets and custom themes", () => {
    applyTheme("light");
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--glass-bg")).toContain("var(--bg-elevated)");
    expect(style.getPropertyValue("--text-disabled")).toContain("var(--text-muted)");
    expect(style.getPropertyValue("--shadow-color")).toContain("52, 39, 45");

    applyTheme("custom", {
      "--bg": "#f7f1e7",
      "--surface": "#fffaf2",
      "--surface2": "#eee5d8",
      "--surface3": "#e2d8c9",
      "--border": "rgba(30,20,15,.12)",
      "--text": "#221e1b",
      "--text2": "#5d554e",
      "--text3": "#7a7168",
    });
    expect(style.getPropertyValue("--bg-base")).toBe("#f7f1e7");
    expect(style.getPropertyValue("--quick-search-glass")).toContain("var(--bg-elevated)");
    expect(style.getPropertyValue("--shadow-color")).toContain("52, 39, 45");
  });

});
