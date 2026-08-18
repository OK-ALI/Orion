import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QuickSearchFilterRail from "../../../src/renderer/components/search/QuickSearchFilterRail";

describe("QuickSearchFilterRail", () => {
  it("converts vertical wheel input into horizontal chip scrolling when the rail overflows", () => {
    render(
      <QuickSearchFilterRail label="Cinema" ariaLabel="Quick search cinema">
        {Array.from({ length: 8 }, (_, index) => <button key={index}>Filter {index + 1}</button>)}
      </QuickSearchFilterRail>,
    );
    const rail = screen.getByRole("tablist", { name: "Quick search cinema" });
    Object.defineProperty(rail, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(rail, "clientWidth", { configurable: true, value: 240 });
    Object.defineProperty(rail, "scrollLeft", { configurable: true, writable: true, value: 0 });

    fireEvent.wheel(rail, { deltaY: 120, deltaX: 0 });
    expect(rail.scrollLeft).toBe(120);
  });
});
