import { describe, expect, it } from "vitest";
import { parseSoftresUrl } from "@/lib/integrations/softres/adapter";

describe("parseSoftresUrl", () => {
  it("extracts the id from a full raid URL", () => {
    expect(parseSoftresUrl("https://softres.it/raid/pfsymj")).toEqual({
      softresId: "pfsymj",
    });
  });

  it("extracts the id from an /edit URL", () => {
    expect(parseSoftresUrl("https://softres.it/raid/pfsymj/edit")).toEqual({
      softresId: "pfsymj",
    });
  });

  it("handles a scheme-less host", () => {
    expect(parseSoftresUrl("softres.it/raid/pfsymj")).toEqual({
      softresId: "pfsymj",
    });
  });

  it("accepts a bare id", () => {
    expect(parseSoftresUrl("pfsymj")).toEqual({ softresId: "pfsymj" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseSoftresUrl("  pfsymj  ")).toEqual({ softresId: "pfsymj" });
  });

  it("returns null for empty input", () => {
    expect(parseSoftresUrl("")).toBeNull();
    expect(parseSoftresUrl("   ")).toBeNull();
  });

  it("returns null for a non-softres URL", () => {
    expect(parseSoftresUrl("https://example.com/raid/pfsymj")).toBeNull();
  });
});
