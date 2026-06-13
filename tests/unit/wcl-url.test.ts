import { describe, expect, it } from "vitest";
import { parseWclUrl } from "@/lib/integrations/warcraftlogs/adapter";

describe("parseWclUrl", () => {
  it("parses a full report URL", () => {
    expect(parseWclUrl("https://www.warcraftlogs.com/reports/NYh79GKXvVqMA6rW")).toEqual({
      reportCode: "NYh79GKXvVqMA6rW",
    });
  });

  it("parses a URL with a fight fragment", () => {
    expect(
      parseWclUrl("https://www.warcraftlogs.com/reports/NYh79GKXvVqMA6rW#fight=3&type=damage-done"),
    ).toEqual({ reportCode: "NYh79GKXvVqMA6rW" });
  });

  it("parses a scheme-less URL with trailing slash", () => {
    expect(parseWclUrl("warcraftlogs.com/reports/abc123/")).toEqual({
      reportCode: "abc123",
    });
  });

  it("accepts a bare report code", () => {
    expect(parseWclUrl("NYh79GKXvVqMA6rW")).toEqual({ reportCode: "NYh79GKXvVqMA6rW" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseWclUrl("  NYh79GKXvVqMA6rW  ")).toEqual({ reportCode: "NYh79GKXvVqMA6rW" });
  });

  it("rejects empty and non-code junk", () => {
    expect(parseWclUrl("")).toBeNull();
    expect(parseWclUrl("   ")).toBeNull();
    expect(parseWclUrl("https://example.com/not-a-report")).toBeNull();
  });
});
