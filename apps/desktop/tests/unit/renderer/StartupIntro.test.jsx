import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StartupIntro from "../../../src/renderer/app/startup/StartupIntro";

describe("Orion startup intro", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals Orion identity and fully completes after its exit transition", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { container } = render(<StartupIntro onComplete={onComplete} />);

    expect(screen.getByRole("status", { name: "Orion is starting" })).toBeInTheDocument();
    expect(screen.getByText("A universe made to be felt.")).toBeInTheDocument();
    expect(container.querySelectorAll(".orion-startup-word span")).toHaveLength(5);

    act(() => vi.advanceTimersByTime(1120));
    expect(container.querySelector(".orion-startup-intro")).toHaveClass("is-exiting");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("uses the short accessible path when Reduced Motion is enabled", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { container } = render(
      <StartupIntro reducedMotion onComplete={onComplete} />,
    );

    expect(container.querySelector(".orion-startup-intro")).toHaveClass("is-reduced");
    act(() => vi.advanceTimersByTime(310));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
