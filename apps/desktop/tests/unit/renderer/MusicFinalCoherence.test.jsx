import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const enablePlugin = vi.fn(async () => {});
const disablePlugin = vi.fn(async () => {});

vi.mock("../../../src/renderer/features/music/context/MusicProvider", () => ({
  useMusic: () => ({
    plugins: {
      loaded: true,
      isLoading: false,
      enablePlugin,
      disablePlugin,
      plugins: [
        { id: "one", name: "Signal One", version: "1.0.0", author: "Orion", description: "First", enabled: true },
        { id: "two", name: "Signal Two", version: "1.1.0", author: "Orion", description: "Second", enabled: false },
      ],
    },
  }),
}));

import PluginsSection from "../../../src/renderer/features/music/planet-sections/PluginsSection";

test("final plugin cards are semantic, theme-owned and free of component-local presentation styles", () => {
  const { container } = render(<PluginsSection />);

  const cards = container.querySelectorAll(".music-plugin-stage-card");
  expect(cards).toHaveLength(2);
  cards.forEach((card) => expect(card).not.toHaveAttribute("style"));

  const active = screen.getByRole("button", { name: "Active" });
  const disabled = screen.getByRole("button", { name: "Disabled" });
  expect(active).toHaveClass("music-plugin-stage-toggle", "is-enabled");
  expect(active).toHaveAttribute("aria-pressed", "true");
  expect(disabled).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(disabled);
  expect(enablePlugin).toHaveBeenCalledWith("two");
});
