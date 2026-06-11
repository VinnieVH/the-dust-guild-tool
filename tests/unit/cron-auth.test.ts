import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/lib/cron-auth";

describe("isAuthorizedCron", () => {
  it("accepts a matching bearer token", () => {
    expect(isAuthorizedCron("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(isAuthorizedCron("Bearer nope", "s3cret")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorizedCron(null, "s3cret")).toBe(false);
  });

  it("rejects when no secret is configured (fail closed)", () => {
    expect(isAuthorizedCron("Bearer anything", undefined)).toBe(false);
    expect(isAuthorizedCron(null, undefined)).toBe(false);
  });

  it("rejects a raw token without the Bearer prefix", () => {
    expect(isAuthorizedCron("s3cret", "s3cret")).toBe(false);
  });
});
