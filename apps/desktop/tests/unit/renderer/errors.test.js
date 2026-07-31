import { describe, expect, it } from "vitest";
import { classifyOrionError, redactDiagnostic } from "../../../src/renderer/services/errors";

describe("Orion error diagnostics", () => {
  it("redacts signed URLs and authorization values", () => {
    expect(redactDiagnostic("https://x.test/a?token=secret&sig=hidden Authorization: Bearer abc.def")).not.toContain("secret");
    expect(redactDiagnostic("Authorization: Bearer abc.def")).not.toContain("abc.def");
  });

  it("classifies connectivity failures with recovery guidance", () => {
    expect(classifyOrionError(new Error("TMDB unreachable"), "discover")).toMatchObject({ code: "offline", title: "Orion cannot reach the service" });
  });
});
