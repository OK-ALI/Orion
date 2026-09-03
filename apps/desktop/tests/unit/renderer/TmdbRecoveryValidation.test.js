import { afterEach, expect, it, vi } from "vitest";
import { validateTmdbService } from "../../../src/renderer/services/tmdb";
afterEach(() => vi.unstubAllGlobals());
it("validates fresh reachability on every call, with no content-cache authority", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, body: { cancel: vi.fn() } });
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await validateTmdbService("fixture", { signal });
  await validateTmdbService("fixture", { signal });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith("https://api.themoviedb.org/3/configuration", {
    cache: "no-store", signal, headers: { Authorization: "Bearer fixture" },
  });
});
it.each([401, 403, 503])("rejects service status %s rather than marking it reachable", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
  await expect(validateTmdbService("fixture")).rejects.toMatchObject({ status });
});
