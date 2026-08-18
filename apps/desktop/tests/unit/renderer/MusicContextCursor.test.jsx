import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import CustomCursor, {
  resolveMusicCursorContext,
} from "../../../src/renderer/features/music/components/CustomCursor";

const originalMatchMedia = window.matchMedia;
const originalAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

beforeEach(() => {
  window.matchMedia = vi.fn((query) => ({
    matches: query === "(pointer: fine)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
});

afterEach(() => {
  document.documentElement.classList.remove("music-custom-cursor-active");
  window.matchMedia = originalMatchMedia;
  window.requestAnimationFrame = originalAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
});

test("context resolver distinguishes precision, text, adjustment, drag, action and blocked controls", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <button id="close" aria-label="Clear search">×</button>
    <button id="action">Play</button>
    <button id="blocked" disabled>Unavailable</button>
    <input id="text" type="search">
    <input id="range" type="range">
    <div id="drag" draggable="true">Drag</div>
  `;

  expect(resolveMusicCursorContext(root.querySelector("#close"))).toBe("precision");
  expect(resolveMusicCursorContext(root.querySelector("#action"))).toBe("action");
  expect(resolveMusicCursorContext(root.querySelector("#blocked"))).toBe("blocked");
  expect(resolveMusicCursorContext(root.querySelector("#text"))).toBe("text");
  expect(resolveMusicCursorContext(root.querySelector("#range"))).toBe("adjust");
  expect(resolveMusicCursorContext(root.querySelector("#drag"))).toBe("drag");
  expect(resolveMusicCursorContext(root)).toBe("default");
});

test("active custom cursor changes semantic context without the old universal hover ring", () => {
  const { unmount } = render(<div className="music-planet-container">
    <CustomCursor />
    <button data-testid="precision" aria-label="Clear search">×</button>
    <input aria-label="Music query" />
    <button data-testid="action">Play</button>
  </div>);

  const cursor = document.querySelector(".music-planet-cursor");
  expect(document.documentElement).toHaveClass("music-custom-cursor-active");

  fireEvent.mouseMove(screen.getByTestId("precision"), { clientX: 40, clientY: 40 });
  expect(cursor).toHaveAttribute("data-context", "precision");
  expect(cursor).toHaveClass("is-ready");

  fireEvent.mouseMove(screen.getByRole("textbox", { name: "Music query" }), { clientX: 60, clientY: 40 });
  expect(cursor).toHaveAttribute("data-context", "text");

  fireEvent.mouseMove(screen.getByTestId("action"), { clientX: 80, clientY: 40 });
  expect(cursor).toHaveAttribute("data-context", "action");

  unmount();
  expect(document.documentElement).not.toHaveClass("music-custom-cursor-active");
});

test("reduced-motion preference leaves the native cursor owner active", () => {
  window.matchMedia = vi.fn((query) => ({
    matches: query === "(pointer: fine)" || query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  render(<CustomCursor />);
  expect(document.documentElement).not.toHaveClass("music-custom-cursor-active");
});
