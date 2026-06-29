import { describe, expect, it } from "vitest";
import { findProviderId, WORLD_HUBS } from "../../../src/renderer/features/discover/discoveryHubs";

describe("discovery hubs", () => {
  it("resolves regional provider ids by catalog name instead of hard-coding ids", () => {
    const hub = { aliases: ["Netflix"] };
    expect(findProviderId([{ provider_id: 8, provider_name: "Netflix" }], hub)).toBe(8);
    expect(findProviderId([{ provider_id: 9, provider_name: "Netflix Standard with Ads" }], hub)).toBe(9);
    expect(findProviderId([], hub)).toBeNull();
  });

  it("defines a movie and TV query for every curated world filter", () => {
    for (const world of WORLD_HUBS) {
      expect(world.filters.length).toBeGreaterThan(0);
      for (const filter of world.filters) {
        expect(filter.movie).toBeTruthy();
        expect(filter.tv).toBeTruthy();
      }
    }
  });
});
