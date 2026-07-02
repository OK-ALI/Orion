import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchPool: vi.fn(), fetchPersonal: vi.fn(), getCache: vi.fn(), setCache: vi.fn() }));
vi.mock("../../../src/renderer/features/people/constellation/service", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchCinemaConstellationPool: mocks.fetchPool,
  fetchPersonalConstellation: mocks.fetchPersonal,
  getCachedConstellationPool: mocks.getCache,
  setCachedConstellationPool: mocks.setCache,
}));

import ConstellationPage from "../../../src/renderer/features/people/constellation/ConstellationPage";

const person = {
  id: 7, name: "Ava Example", media_type: "person", profile_path: null,
  known_for_department: "Acting", crafts: ["acting"], mediaTypes: ["movie"],
  known_for: [{ id: 9, media_type: "movie", title: "Example Story" }],
  contributionCount: 2, score: 90,
};
const pool = { cinemaId: "global", people: [person], seedPage: 1, totalPages: 2, generatedAt: 10, partialFailures: 0 };

describe("Constellation page", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.fetchPool.mockReset().mockResolvedValue(pool);
    mocks.fetchPersonal.mockReset().mockResolvedValue([]);
    mocks.getCache.mockReset().mockReturnValue(null);
    mocks.setCache.mockReset();
  });

  it("renders mapped people and opens the existing Person route", async () => {
    const onNavigate = vi.fn();
    render(<ConstellationPage apiKey="token" history={[]} saved={[]} offline={false} onNavigate={onNavigate} />);
    expect(await screen.findByRole("heading", { name: "Constellation" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Ava Example").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: "Open Ava Example" })[0]);
    expect(onNavigate).toHaveBeenCalledWith("person", expect.objectContaining({ id: 7 }));
  });

  it("persists filters immediately and filters the current pool locally", async () => {
    render(<ConstellationPage apiKey="token" history={[]} saved={[]} offline={false} onNavigate={() => {}} />);
    await waitFor(() => expect(screen.getAllByText("Ava Example").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("tab", { name: "Directing" }));
    expect(JSON.parse(localStorage.getItem("orion_constellationPreferences"))).toMatchObject({ craft: "directing" });
    expect(screen.getByRole("heading", { name: "No people match these filters" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Acting" }));
    fireEvent.change(screen.getByPlaceholderText(/Filter people/), { target: { value: "Example Story" } });
    expect(screen.getAllByText("Ava Example").length).toBeGreaterThan(0);
  });

  it("uses cached people offline and disables network retry", async () => {
    mocks.getCache.mockReturnValue(pool);
    render(<ConstellationPage apiKey="token" history={[]} saved={[]} offline onNavigate={() => {}} />);
    expect(await screen.findByText(/Offline — showing a saved constellation/)).toBeInTheDocument();
    expect(screen.getAllByText("Ava Example").length).toBeGreaterThan(0);
    expect(mocks.fetchPool).not.toHaveBeenCalled();
  });
});
