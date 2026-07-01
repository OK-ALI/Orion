import { afterEach, describe, expect, it } from "vitest";
import {
  applyInteractionAppearance,
  normalizeInteractionSettings,
} from "../../../src/renderer/shared/utils/appearance";

describe("interaction appearance", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
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
});
